---
tags: [docgit, dependency-injection, services, angular]
---

# 10 — Services & Dependency Injection

> Related notes: [[04-Single-Responsibility-Principle]] · [[05-DbContext]] · [[08-Backend-Frontend-Connection]]

## 1. What "Dependency Injection" actually means

**Dependency Injection (DI)** is a way of giving a class the objects it depends on *from the outside*, instead of the class creating them itself internally. Compare:

```csharp
// WITHOUT DI — the class controls/creates its own dependency
public class Fileservice
{
    private readonly ApplicationDbContext _db = new ApplicationDbContext(/* ...how would you even configure this here? */);
}

// WITH DI — the class only declares what it needs; something else supplies it
public class Fileservice
{
    private readonly ApplicationDbContext _db;
    public Fileservice(ApplicationDbContext db, FileHistoryService historyService, BlobService blobService)
    {
        _db = db;
        _historyService = historyService;
        _blobService = blobService;
    }
}
```

This is exactly how every service in DocGit's backend is written — this pattern is called **constructor injection**. `Fileservice` doesn't know or care *how* an `ApplicationDbContext` gets built (connection string, provider, etc.) — it just declares "give me one" as a constructor parameter, and trusts something else to provide a correctly configured instance. That "something else" is the **DI container** — a built-in ASP.NET Core feature (no third-party library needed) that knows how to construct every registered type and automatically supply constructor parameters when something is requested.

### Why this matters (not just "because it's the convention")

1. **Testability** — you could construct a `Fileservice` in a unit test with a fake/in-memory `ApplicationDbContext` and a fake `BlobService`, without ever touching real SQL Server or Azure. If `Fileservice` created those internally with `new`, that would be impossible.
2. **Decoupling** — `Fileservice` depends on the *abstraction* "a `BlobService` exists with this shape", not on Azure-specific setup details (connection string, container name) — those live only in `BlobService`'s own constructor and `Program.cs`'s registration line. See [[04-Single-Responsibility-Principle]].
3. **Centralized configuration** — every service's connection string / secret comes from one place (`Program.cs` reading `IConfiguration`), rather than being duplicated or hardcoded across many classes.

## 2. Registering services — `Program.cs`

```csharp
builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddScoped<JwtService>();
builder.Services.AddSingleton<BlobService>();
builder.Services.AddScoped<Fileservice>();
builder.Services.AddScoped<FileHistoryService>();
```

This is the **composition root** — the one place in the whole app where "here's what implementation to use for what type" decisions are made. Three different **lifetimes** are available, and picking the right one matters:

| Lifetime | Meaning | Used for, in this project |
|---|---|---|
| **Transient** | A brand-new instance every single time it's requested, even multiple times within the same request | Not used explicitly here |
| **Scoped** | One instance per HTTP request — shared by everything resolved during that same request, disposed at the request's end | `ApplicationDbContext`, `JwtService`, `Fileservice`, `FileHistoryService` |
| **Singleton** | Exactly one instance for the entire lifetime of the application | `BlobService` |

### Why `ApplicationDbContext`/`Fileservice`/etc. are Scoped

A `DbContext` is explicitly documented as **not thread-safe**. Two concurrent HTTP requests must never share the same context instance, or their change-tracking could corrupt each other's in-flight data. Scoped guarantees "one instance per request" — safe, and also lets multiple services *within the same request* (e.g. `FilesController`, `Fileservice`, `FileHistoryService` all needing the DB) share one context and one set of tracked changes, which is exactly what lets a single `SaveChangesAsync()` at the end of a request commit everything together. `Fileservice`/`FileHistoryService`/`JwtService` are Scoped mainly *because* they hold a Scoped `ApplicationDbContext` — a Scoped service is allowed to depend on another Scoped service, but **not** on something with a shorter lifetime in a way that would let a longer-lived object hold a stale/disposed short-lived one (see the "captive dependency" note below).

### Why `BlobService` is Singleton

```csharp
public class BlobService
{
    private readonly BlobContainerClient _container;
    public BlobService(IConfiguration config)
    {
        _container = new BlobContainerClient(connectionString, containerName);
        _container.CreateIfNotExists();
    }
}
```
`BlobContainerClient` (from the Azure SDK) is explicitly designed to be **thread-safe and expensive to create** (it manages its own internal HTTP connection pooling to Azure) — the opposite profile from `DbContext`. Creating a brand-new one per request would be wasteful; sharing exactly one for the whole app's lifetime is both safe and efficient. This is a real, general rule of thumb: **DI lifetime should match the actual thread-safety and cost characteristics of what you're wrapping**, not just be picked by habit.

### The "captive dependency" trap (worth knowing, doesn't actually occur here — good to recognize why)

A **Singleton must never depend on a Scoped or Transient service** — if it did, the DI container would resolve that shorter-lived dependency *once* (when the singleton is first built) and the singleton would hold onto it forever, even after the request it "belongs to" ends and its `DbContext` gets disposed — using a disposed `DbContext` throws. `BlobService` correctly only depends on `IConfiguration`, which is itself effectively singleton-safe (immutable config), so this project doesn't hit that trap — but it's exactly the kind of thing worth being able to explain if asked "why can't `Fileservice` just be a Singleton for performance?"

## 3. How a request actually gets its services — resolving the dependency graph

When an HTTP request for, say, `PUT /api/files/notes.md` comes in:
1. ASP.NET Core needs to construct a `FilesController`. Its constructor asks for `ApplicationDbContext`, `Fileservice`, `IHubContext<EventHub>`, `FileHistoryService`.
2. The DI container resolves each one. To build `Fileservice`, it sees *its* constructor needs `ApplicationDbContext`, `FileHistoryService`, `BlobService` — and resolves those too, recursively.
3. Because `ApplicationDbContext` is Scoped, and this whole resolution happens within one request's scope, **every place that needed an `ApplicationDbContext` in this graph gets the exact same instance** — `FilesController._db` and `Fileservice._db` (indirectly) are literally the same object in memory for the duration of this one request.
4. At the end of the request, the scope is disposed, which disposes the `DbContext` (closing its database connection) automatically — you never call `_db.Dispose()` yourself anywhere in this codebase; the framework does it for you.

This automatic graph-resolution is the whole value proposition of a DI container: you never write `new FilesController(new ApplicationDbContext(...), new Fileservice(...), ...)` by hand anywhere — the container works it out from the constructors alone.

### The one manual exception: `Program.cs`'s startup seeding block

```csharp
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.EnsureCreated();
    ...
}
```
Outside of an actual HTTP request, there's no naturally-occurring "scope" for a Scoped service to live in — so this code manually creates one (`CreateScope()`), resolves `ApplicationDbContext` from it (`GetRequiredService`), uses it, and the `using` block disposes the scope (and the context) afterward. This is the standard pattern for "I need a scoped service at startup, before any request exists".

## 4. Backend services, one by one (each covered in depth elsewhere — this is the DI-focused summary)

| Service | Lifetime | Depends on | See |
|---|---|---|---|
| `ApplicationDbContext` | Scoped | `DbContextOptions` (SQL Server connection) | [[05-DbContext]] |
| `JwtService` | Scoped | `IConfiguration`, `ApplicationDbContext` | [[02-Methods-And-APIs]], [[11-Extra-Topics]] |
| `Fileservice` | Scoped | `ApplicationDbContext`, `FileHistoryService`, `BlobService` | [[02-Methods-And-APIs]] |
| `FileHistoryService` | Scoped | `ApplicationDbContext`, `BlobService` | [[02-Methods-And-APIs]] |
| `BlobService` | Singleton | `IConfiguration` | [[01-Project-Overview]] |
| `EventHub` (SignalR hub) | Transient-per-connection (framework-managed, not manually registered) | `ILogger<EventHub>` | [[08-Backend-Frontend-Connection]] |

## 5. `IConfiguration` — DI's role in reading `appsettings.json`

```csharp
public BlobService(IConfiguration config)
{
    var connectionString = config["AzureBlob:ConnectionString"]!;
    var containerName = config["AzureBlob:ContainerName"] ?? "docgit-files";
}
```
`IConfiguration` is itself injected via DI (registered automatically by `WebApplication.CreateBuilder`), and reads from `appsettings.json`/`appsettings.Development.json`/environment variables/etc., merged together by convention. `config["AzureBlob:ContainerName"]` reads the nested JSON key `AzureBlob.ContainerName`. This is exactly the same mechanism `Program.cs` uses for `builder.Configuration.GetConnectionString("DefaultConnection")` and `builder.Configuration["Jwt:Secret"]`.

## 6. Angular's side: services and DI look almost identical in spirit

```typescript
@Injectable({ providedIn: 'root' })
export class DocApiService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
}
```
- `@Injectable({ providedIn: 'root' })` is Angular's equivalent of `builder.Services.AddSingleton<T>()` — `providedIn: 'root'` means exactly one instance exists for the whole app, created lazily the first time something needs it.
- `inject(HttpClient)` is Angular's modern function-based DI syntax (an alternative to old-style constructor-parameter injection, e.g. `constructor(private http: HttpClient)`, which still works but is less common in code written against very recent Angular).
- Just like `Fileservice` depends on `BlobService`, `RealtimeEventsService` depends on `DocApiService` (`private readonly api = inject(DocApiService)`) to read the stored auth token — same idea, same benefit: `RealtimeEventsService` doesn't need to know *how* the token is stored (`localStorage`? a cookie? something else?), only that `DocApiService.getToken()` exists.
- **Why every component funnels through `DocApiService` instead of injecting `HttpClient` directly**: exactly [[04-Single-Responsibility-Principle]] again — `DocApiService` is the one place that knows the base URL, auth header logic, and endpoint shapes; if any of that changes, no component needs to change.

## 7. Quick interview-ready summary

*"Dependency Injection means a class declares what it needs through its constructor, and a container wires those dependencies together automatically, rather than the class creating them itself. In my backend, I register services with different lifetimes based on their thread-safety and cost: `DbContext`-dependent services are Scoped — one instance per HTTP request, since `DbContext` isn't thread-safe — while `BlobService` is a Singleton because the underlying Azure client is thread-safe and expensive to construct. On the Angular side, `providedIn: 'root'` gives me the same singleton-per-app behavior for services like `DocApiService`, which centralizes all HTTP/auth logic so components don't need to know how requests are built."*
