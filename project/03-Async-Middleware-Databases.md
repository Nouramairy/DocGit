---
tags: [docgit, async, task, middleware, database, aspnetcore]
---

# 03 — Async/Task, Middleware, and Databases

> Related notes: [[01-Project-Overview]] · [[02-Methods-And-APIs]] · [[05-DbContext]] · [[10-Services-And-DI]]

## 1. `async` / `await` — what it actually is

The core problem `async`/`await` solves: **I/O operations (network calls, disk reads, database queries) are slow compared to the CPU**, and if a thread just sits there blocked waiting for a response, that thread can't do anything else — including serve a *different* user's request. On a web server handling hundreds of simultaneous users, you cannot afford to dedicate one thread per waiting request; you'd run out of threads.

`async`/`await` lets a method say "I'm waiting on something slow — free up this thread to go do other work, and resume me exactly where I left off once the slow thing finishes."

Look at `JwtService.AuthenticateAsync`:

```csharp
public async Task<User?> AuthenticateAsync(string username, string password)
{
    var user = await _db.Users.FirstOrDefaultAsync(user => user.UserName == username);
    if (user == null) return null;
    if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash)) return null;
    return user;
}
```

What happens at `await _db.Users.FirstOrDefaultAsync(...)`:
1. The method calls `FirstOrDefaultAsync`, which starts the database query and immediately returns a `Task<User?>` — a *promise* of a `User?` that will exist once the query finishes, not the `User?` itself yet.
2. `await` on that task tells the runtime: "pause this method here. Give the thread back to the thread pool so it can serve other requests. When the database responds, resume this exact method from this exact line."
3. Once the database responds, the method resumes — synchronously from the caller's point of view — with `user` now populated.

This is **not** the same as multithreading/parallelism. It's **concurrency without extra threads**: one thread can be juggling hundreds of paused-and-resumable async operations instead of hundreds of dedicated blocked threads. That's why ASP.NET Core can serve so many simultaneous requests with a modest thread pool.

### `Task` vs `Task<T>` vs plain `void`

- **`Task`** — represents "an operation that will complete, but produces no value" (like a C# `void`, but awaitable). Example: `SaveChangesAsync()` in some overloads, or `Groups.AddToGroupAsync(...)` in `EventHub`.
- **`Task<T>`** — "an operation that will complete *and* produce a `T`". `Task<User?>`, `Task<IActionResult>`, `Task<byte[]?>` all appear throughout this codebase.
- **`async void`** — exists but should almost never be used (you can't `await` it, and exceptions thrown inside it can crash the process instead of being catchable). The only legitimate use is top-level event handlers. You won't find it in this codebase's backend, and correctly so.

Every controller action in this project returns `Task<IActionResult>` — meaning "eventually, an HTTP response". ASP.NET Core's framework itself `await`s your action method internally as part of handling the request.

### `Task.WhenAll` — running things concurrently on purpose

`Fileservice.PermanentDeleteAsync`:

```csharp
var blobDeletions = new List<Task>();
if (entity.BlobName != null)
    blobDeletions.Add(_blobService.DeleteAsync(entity.BlobName));
foreach (var history in entity.FileHistories)
    if (history.BlobName != null)
        blobDeletions.Add(_blobService.DeleteAsync(history.BlobName));

await Task.WhenAll(blobDeletions);
```

Here, instead of `await`ing each blob deletion one at a time (which would wait for #1 to fully finish before even *starting* #2), every deletion is **started** first (each call returns a `Task` immediately and the actual HTTP call to Azure runs in the background), collected into a list, and then `Task.WhenAll` awaits all of them together. If a file has 20 historical versions, this turns "20 sequential round trips to Azure" into "20 round trips happening at the same time, bounded by whichever one is slowest" — a real, meaningful performance technique for I/O-bound fan-out work.

### The `async`/`await` keyword pairing rule

Every `async` method's return type must be `Task`, `Task<T>`, `ValueTask<T>`, or `void` (event handlers only). Inside it, `await` can only be used on something awaitable (a `Task`, `Task<T>`, or anything with a `GetAwaiter()`). If you forget `await` and just call an async method, you get a `Task` object back that you're ignoring — the operation might still run, but you have no way to observe when it finishes or whether it threw, and the compiler will warn you ("this call is not awaited").

## 2. Middleware — the pipeline every request walks through

**Middleware** is ASP.NET Core's name for "a chain of steps that each incoming HTTP request passes through, in order, before reaching your controller — and each step can also run code on the way back out." Picture it as a series of nested boxes:

```
Request  →  [CORS]  →  [Authentication]  →  [Authorization]  →  [Routing]  →  Controller Action
                                                                                       │
Response ←  [CORS]  ←  [Authentication]  ←  [Authorization]  ←  [Routing]  ←──────────┘
```

Every middleware component can (a) inspect/modify the request, (b) decide to short-circuit and return a response immediately without calling the next step (e.g. "no valid token → 401, stop here"), or (c) call the next component and then do more work once *that* returns (e.g. logging the response status code afterward).

This exact pipeline is configured in `Program.cs`, and **order matters enormously**:

```csharp
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<EventHub>("/api/events/signalr");

app.MapFallbackToFile("index.html");
```

Why this order:
1. **`UseDefaultFiles` / `UseStaticFiles`** — first, so requests for `index.html`, JS bundles, CSS etc. (the compiled Angular app, copied into `wwwroot` at publish time — see the `Docgit.csproj` MSBuild target) are served directly from disk without ever touching auth or controllers.
2. **`UseCors()`** — must run before anything that might reject the request, so that even error responses carry the CORS headers the browser needs to *read* them (otherwise the browser blocks the response client-side regardless of what the server sent).
3. **`UseAuthentication()`** — reads the `Authorization: Bearer <token>` header (or the `access_token` query string, specially handled for SignalR — see below), validates the JWT signature and expiry, and if valid, populates `HttpContext.User` with the claims from the token. This step does **not** reject unauthenticated requests — it just identifies who's asking, if anyone.
4. **`UseAuthorization()`** — this is the step that actually *enforces* `[Authorize]`: if the endpoint requires auth and `HttpContext.User` isn't a valid authenticated identity, the request is rejected with `401` right here, before ever reaching your controller code.
5. **`MapControllers()` / `MapHub<EventHub>(...)`** — routes the (now authenticated+authorized) request to the matching controller action or SignalR hub.
6. **`MapFallbackToFile("index.html")`** — the last resort: if nothing above matched (e.g. the user navigated the Angular SPA to `/editor/some-file` directly, a route that only exists client-side in Angular's router), serve `index.html` anyway and let Angular's client-side router figure out what to show. This is the standard "SPA fallback" pattern.

### A subtle but important middleware detail: SignalR + JWT over query string

Normally JWTs travel in an HTTP header, but the browser's native `WebSocket` API can't set custom headers when opening a socket connection. So `Program.cs` has:

```csharp
options.Events = new JwtBearerEvents
{
    OnMessageReceived = context =>
    {
        var accessToken = context.Request.Query["access_token"];
        var path = context.HttpContext.Request.Path;
        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/api/events/signalr"))
        {
            context.Token = accessToken;
        }
        return Task.CompletedTask;
    }
};
```

This hooks into the JWT authentication middleware's extensibility point (`OnMessageReceived`) to say: "if this specific request is for the SignalR hub, and it has an `access_token` query parameter, treat that as the bearer token instead of requiring the header." This is exactly what `RealtimeEventsService` on the Angular side relies on via `accessTokenFactory` (see [[08-Backend-Frontend-Connection]]). Without this, SignalR connections could never authenticate at all.

### Writing your own middleware (for context/completeness)

You won't find a custom one in this project, but the general shape (for future reference) is:

```csharp
app.Use(async (context, next) =>
{
    // before: e.g. log the incoming request
    await next(context);   // call the rest of the pipeline
    // after: e.g. log the response status code
});
```

Every `app.Use...` call in `Program.cs` (`UseCors`, `UseAuthentication`, etc.) is really just a pre-packaged version of this same pattern, written by the framework authors.

## 3. Databases in this project

### Two different data stores, two different jobs

- **SQL Server**, accessed through EF Core (`ApplicationDbContext`), stores structured, relational, queryable *metadata*: users, the file tree structure, timestamps, sizes. Anything you'd want to filter/sort/join on.
- **Azure Blob Storage** (`BlobService`), stores unstructured *bytes*: the actual file content, and every historical version's content. See [[01-Project-Overview]] §2 for why these are split.

### How EF Core turns C# into SQL

`Fileservice.GetByPathAsync`:

```csharp
var file = await _db.FileSystemEntities
    .FirstOrDefaultAsync(entity => entity.UserID == userId && entity.Path == path && !entity.IsDeleted);
```

`_db.FileSystemEntities` is a `DbSet<FileSystemEntity>` — conceptually, "the whole table, as a C# collection you can LINQ-query". EF Core doesn't fetch the whole table into memory and then filter in C#; it **translates the LINQ expression into a SQL `WHERE` clause** at the database level:

```sql
SELECT TOP(1) * FROM FileSystemEntities
WHERE UserID = @userId AND Path = @path AND IsDeleted = 0
```

This translation happens because `DbSet<T>` implements `IQueryable<T>`, not just `IEnumerable<T>` — the LINQ methods build up an *expression tree* (a description of the query) rather than executing immediately, and EF Core's query provider walks that tree and emits SQL only when you finally `await` it (or call `.ToList()`, etc.). This is precisely why `_db.FileSystemEntities.Where(...).ToListAsync()` in `GetAllForUserAsync` is one round trip to the database, while calling `.ToList()` too early and then `.Where(...)` in plain C# afterward would pull the *entire table* over the wire first — a classic EF Core performance mistake to be aware of.

### Async database calls specifically

Every EF Core query in this codebase ends in `...Async` — `FirstOrDefaultAsync`, `ToListAsync`, `AnyAsync`, `SaveChangesAsync`, `MaxAsync`. Database round trips are I/O (network calls to the SQL Server process), so they follow exactly the `async`/`await` reasoning from §1: while SQL Server is executing the query, the ASP.NET Core thread is freed to handle other requests.

### `SaveChangesAsync()` — when does data actually get written?

EF Core batches changes. Calling `_db.FileSystemEntities.Add(entity)` or mutating a tracked entity's property (`existing.Bytes = content.LongLength`) only changes an **in-memory tracked object** — nothing hits the database yet. `await _db.SaveChangesAsync()` is the point where EF Core looks at everything it's tracking, figures out which rows are new/changed/removed, and issues the actual `INSERT`/`UPDATE`/`DELETE` SQL statements, all wrapped in a single database transaction by default. This is why you'll see the same pattern everywhere: mutate the C# object(s) first, then one `SaveChangesAsync()` call at the very end.

### Where the connection string lives

`appsettings.json`:
```json
"ConnectionStrings": { "DefaultConnection": "" }
```
and `Program.cs`:
```csharp
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));
```
`AddDbContext` registers `ApplicationDbContext` into the DI container as **scoped** (see [[10-Services-And-DI]]) and tells EF Core which database provider to use (`UseSqlServer` — swappable for `UseSqlite`/`UseNpgsql`/etc. without touching any other code, which is the whole point of EF Core being provider-agnostic).

## 4. How the app boots — reading `Program.cs` top to bottom

This is "top-level statements" style (C# lets a file's top level *be* `Main`, no explicit `class Program { static void Main() }` boilerplate needed since C# 9/10). Sequence:

1. `WebApplication.CreateBuilder(args)` — creates a `builder` that will accumulate configuration and services.
2. `builder.Services.Add...` calls — this is the **Dependency Injection registration phase**: every service the app will need (`DbContext`, `JwtService`, `BlobService`, authentication scheme, SignalR, CORS policy, controllers) is registered here, but nothing is running yet.
3. `builder.Build()` — freezes configuration/services and produces the actual runnable `app`.
4. The `using (var scope = app.Services.CreateScope())` block runs **once at startup**: ensures the database exists (`db.Database.EnsureCreated()`) and seeds a `test-user` account if missing. A manual `scope` is needed here because `ApplicationDbContext` is registered as *scoped* (see [[10-Services-And-DI]]), and outside of a request there's no naturally-created scope to resolve it from.
5. Middleware pipeline is configured (§2 above).
6. `app.Run()` — starts Kestrel and blocks, listening for requests until the process is shut down.
