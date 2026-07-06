---
tags: [docgit, api, controllers, rest]
---

# 02 — Every Method & API Call, Explained

> Related notes: [[01-Project-Overview]] · [[03-Async-Middleware-Databases]] · [[10-Services-And-DI]]

This note walks through **every HTTP endpoint** in the backend, what C# method handles it, what it calls internally, and — critically — **how you'd build a brand new one yourself**, step by step, as a template you can reuse for your own projects.

## 1. What makes something an "API endpoint" in ASP.NET Core

Three ingredients, all visible in `FilesController.cs`:

```csharp
[Route("api/files")]      // 1. base URL prefix for this whole class
[ApiController]           // 2. turns on automatic model validation, [FromBody] inference, etc.
[Authorize]               // 3. every action in this class requires a valid JWT, unless overridden
public class FilesController : ControllerBase
{
    [HttpGet]                          // 4. HTTP verb + relative route for this one method
    public async Task<IActionResult> GetAll() { ... }
}
```

- `ControllerBase` (not `Controller` — that one also supports Razor views, which we don't need for a pure API) gives you helpers like `Ok()`, `NotFound()`, `BadRequest()`, `File()`, `StatusCode()` that build the correct HTTP response for you.
- `[ApiController]` is a big deal: it makes ASP.NET Core automatically return `400 Bad Request` if a `[FromBody]` model fails validation, infers where parameters come from (route vs query vs body) without you writing `[FromRoute]` everywhere, and disables the legacy "try the view engine" behaviour.
- `[Authorize]` at class level is short for "put this on every action". `AuthController` deliberately has **no** `[Authorize]` at all (you can't require login to... log in).
- **Routing**: ASP.NET Core matches the incoming URL + HTTP verb against every `[Http*]` attribute in every controller and picks the most specific match. `{**path}` is a *catch-all* route parameter — the two stars mean "match everything after this point, including slashes", which is exactly what you need for `/api/files/notebook/math/notes.md` to arrive as a single string `"notebook/math/notes.md"`.

## 2. How to build a brand new endpoint (recipe)

Say you wanted to add `GET /api/files/count` (return how many files a user has). Steps, in order:

1. **Decide the route & verb.** `GET /api/files/count` → lives in `FilesController` since it's about files.
2. **Add the action method**, above the catch-all `GetFileOrFolder` (routing matters here — see gotcha below):
   ```csharp
   [HttpGet("count")]
   public async Task<IActionResult> GetCount()
   {
       var count = await _fileService.CountFilesAsync(UserId);
       return Ok(new { count });
   }
   ```
3. **Add the business logic** to the service layer (never put database queries directly in a controller — see [[04-Single-Responsibility-Principle]]):
   ```csharp
   // in Fileservice.cs
   public async Task<int> CountFilesAsync(int userId) =>
       await _db.FileSystemEntities.CountAsync(e => e.UserID == userId && e.IsFile && !e.IsDeleted);
   ```
4. **Test it** — either via Swagger UI (`/swagger` in development mode, enabled by `app.UseSwaggerUI()` in `Program.cs`), curl, Postman, or by adding a case to `tests/tests/`.
5. **Call it from Angular** — add one method to `DocApiService` (see [[08-Backend-Frontend-Connection]]).

### Gotcha: route ordering with catch-all routes

`FilesController` defines `GetTrash()` at `[HttpGet("trash")]` **before** `GetFileOrFolder(string path)` at `[HttpGet("{**path}")]`. This isn't accidental — ASP.NET Core's router tries more specific literal routes before catch-all wildcard routes regardless of declaration order in modern versions, but the code comment makes the intent explicit: *"must be defined before catch-all"*. If you added a new literal route like `/api/files/count` in a version of the framework (or a routing setup) that mattered on declaration order, and it came after the catch-all, `{**path}` would swallow the word "count" as a file path and you'd never reach your new method. **Lesson: always sanity-check that a new literal route isn't secretly being captured by an existing wildcard route.**

## 3. Auth endpoints — `AuthController.cs`

### `POST /api/register`

```csharp
[HttpPost("/api/register")]
public async Task<IActionResult> Register([FromBody] RegisterDto request)
```

Walkthrough:
1. `[FromBody] RegisterDto request` — ASP.NET Core deserializes the JSON request body into a `RegisterDto` (see [[06-Domains-DTOs-Classes]]) automatically, using `System.Text.Json`.
2. Validates `UserName`/`Password` aren't blank — manual validation (could also be done with `[Required]` data-annotation attributes on the DTO + `ModelState.IsValid`, but this project does it by hand).
3. Checks uniqueness: `await _db.Users.AnyAsync(u => u.UserName == request.UserName)`. `AnyAsync` translates to a SQL `EXISTS (...)` query — much cheaper than fetching the whole row just to check existence.
4. **Hashes the password**: `BCrypt.Net.BCrypt.HashPassword(request.Password)`. Passwords are **never** stored as plain text or even with a fast hash like SHA-256 — BCrypt is a *slow*, *salted* hashing algorithm purpose-built for passwords (deliberately slow so brute-forcing is expensive; salted so identical passwords don't produce identical hashes). See [[11-Extra-Topics]] for more on this.
5. Creates the `User` entity, adds it to the `DbSet`, and calls `SaveChangesAsync()` — this is the point where the actual `INSERT` SQL statement fires.
6. Wrapped in a `try/catch` that returns `500` with the exception details on failure — **fine for a learning project, but you'd never leak `stackTrace` to a client in production** (information disclosure vulnerability).

### `POST /api/login`

```csharp
[HttpPost("/api/login")]
public async Task<IActionResult> Login([FromBody] LogInReqDto request)
```

1. Accepts either `user` or `userName` in the body (`LogInReqDto` has both — a compatibility shim for two different callers, the Angular app sends `userName`, the CLI client sends `user`).
2. Delegates to `JwtService.AuthenticateAsync(username, password)`, which looks the user up and calls `BCrypt.Net.BCrypt.Verify(password, user.PasswordHash)` — BCrypt re-derives the hash using the same embedded salt and compares.
3. On success, `JwtService.GenerateToken(user)` builds and signs a JWT (see [[11-Extra-Topics]] for the full JWT anatomy), and the controller returns `{ "token": "..." }`.
4. On failure at any point, returns `401 Unauthorized` — **deliberately the same error whether the username doesn't exist or the password is wrong**, so an attacker can't use the API to enumerate valid usernames.

## 4. File & folder endpoints — `FilesController.cs`

All of these run through the shared private helpers first:

```csharp
private int UserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
private string UserGroupName => EventHub.UserGroup(UserId);
```

`UserId` is a computed property (not a field) — every time you reference `UserId` in the controller, it re-reads the claim from the current request's `User` principal (populated by the JWT authentication middleware before the controller ever runs). This guarantees the ID always reflects *this* request's caller, never a stale value.

### `GET /api/files` → `GetAll()`

```csharp
[HttpGet]
public async Task<IActionResult> GetAll()
{
    var tree = await _fileService.GetAllForUserAsync(UserId);
    return Ok(tree);
}
```
Fetches every non-deleted row belonging to this user, then calls `Fileservice.BuildNestTree` to turn the flat list into nested JSON (see below). `Ok(tree)` returns `200` with the object serialized to JSON.

### `GET /api/files/{**path}` → `GetFileOrFolder(string path)`

This one method has to handle **two very different cases** — a file, or a folder — because both share the same URL shape:

```csharp
var fileOrFolder = await _fileService.GetByPathAsync(UserId, path);
if (fileOrFolder == null) return NotFound();

AddFileHeaders(fileOrFolder);

if (!fileOrFolder.IsFile)
{
    var folderContent = await _fileService.GetFolderContentAsync(UserId, path);
    return Ok(folderContent ?? new System.Text.Json.Nodes.JsonObject());
}

var content = await _fileService.GetFileContentAsync(UserId, path);
if (content == null) return Ok();
return File(content, GetMimeType(fileOrFolder.Extintion), fileOrFolder.Name);
```

- For a **folder**: returns the nested JSON of just that subtree.
- For a **file**: returns the raw bytes with `File(bytes, mimeType, downloadName)` — `ControllerBase.File()` builds a `FileContentResult`, setting `Content-Type` and `Content-Disposition` so the browser knows how to treat the payload.
- `AddFileHeaders` (private helper) stuffs metadata into **custom HTTP response headers** (`X-Created-At`, `X-Changed-At`, `X-Type`, `X-Bytes`, `X-Extension`) rather than into the JSON body. Why? Because when the *body itself* is the raw file content (for a file `GET`), there's no JSON envelope left to put metadata in — headers are the only place left. The code comment explains the intent directly: the frontend can read metadata instantly from headers without waiting for/parsing the whole body.

### `HEAD /api/files/{**path}` → `HeadFileOrFolder`

Identical lookup, but returns **only the headers, no body** (`return Ok()` after setting headers — ASP.NET Core automatically strips the body for a `HEAD` response per HTTP spec). The code comment explains why this exists: if the frontend just wants to display "last changed 2 minutes ago, 40 KB" for search results without downloading a potentially huge file, `HEAD` gets the metadata without the bandwidth/memory cost of a `GET`. This is a real HTTP-level optimization technique worth remembering for interviews.

### `POST /api/files/{**path}` → `CreateFile(string path)`

```csharp
using var ms = new MemoryStream();
await Request.Body.CopyToAsync(ms);
var content = ms.ToArray();

var extension = Path.GetExtension(path);
if (content.Length == 0 && string.IsNullOrEmpty(extension))
{
    var folder = await _fileService.CreateFolderAsync(UserId, path);
    ...
}

var file = await _fileService.CreateFileAsync(UserId, path, content);
...
await _hub.Clients.Group(UserGroupName).SendAsync("Event", 0, path);
return Ok(new { message = "File created successfully" });
```

Key ideas:
- The request body isn't bound to a DTO here — it's read as **raw bytes** directly off `Request.Body`, because a file can be arbitrary binary content (not always JSON). `CopyToAsync` streams it into an in-memory buffer.
- **Folder vs. file disambiguation by convention**: an empty body *and* no file extension in the path is treated as "you meant to create a folder". This is a pragmatic (if slightly fragile) design choice — a cleaner REST design might use a distinct endpoint or a request header/flag instead, which is exactly why `POST /api/files/folders/{**path}` also exists as an explicit alternative.
- After the database write succeeds, it broadcasts an `"Event"` message over SignalR with a numeric event-type code (`0` = file created, `5` = folder created — see the table in [[08-Backend-Frontend-Connection]]) so every other connected tab updates live.
- Returns `409 Conflict` (`Conflict(...)`) if the path already exists — correct REST usage: `409` specifically means "the request conflicts with the current state of the resource".

### `PUT /api/files/{**path}` → `UpdateFile(string path)`

This is the **upsert** endpoint (update-or-insert) — the most important one conceptually, because it's what "Save" in the editor calls:

```csharp
var (entity, existed) = await _fileService.UpsertFileAsync(UserId, path, content);
var eventType = existed ? 1 : 0;
await _hub.Clients.Group(UserGroupName).SendAsync("FileChangeEvent", eventType, path);
return Ok();
```

`PUT` is semantically "replace this resource with exactly this content, creating it if it doesn't exist" — which is why the same verb doubles as both create and update here, unlike `POST` which is purely "create". This is standard REST practice: `PUT` should be **idempotent** (calling it 10 times with the same body has the same end effect as calling it once), which upsert naturally satisfies.

### `DELETE /api/files/{**path}` → `SoftDelete(string path)`

```csharp
var entity = await _fileService.GetByPathAsync(UserId, path);
if (entity == null) return Ok();          // deleting something already gone is not an error
var isFolder = !entity.IsFile;
await _fileService.SoftDeleteAsync(UserId, path);
await _hub.Clients.Group(UserGroupName).SendAsync("Event", isFolder ? 7 : 2, path);
return Ok();
```

Notice this **never actually removes a row** — it calls `SoftDeleteAsync`, which flags `IsDeleted = true` (see [[11-Extra-Topics]] for the soft-delete pattern in depth, and section 6 below for the recursive folder version).

### Trash endpoints

- `GET /api/files/trash` → `GetTrash()` — lists all rows where `IsDeleted == true` for this user, projected into `TrashIteamDto`.
- `POST /api/files/trash/restore/{**path}` → un-flags `IsDeleted`.
- `DELETE /api/files/trash/{**path}` → `PermanentDeleteAsync` — this is the **only** place that actually calls `_db.FileSystemEntities.Remove(entity)`, i.e. a real SQL `DELETE`. It also explicitly deletes the file's blobs and all its history blobs from Azure Blob Storage first (`Task.WhenAll(blobDeletions)`) — otherwise you'd orphan bytes in Blob Storage that nothing in SQL points to anymore (a storage leak).

### Version history endpoints

- `GET /api/files/history/{**path}` → lists every saved version's number/timestamp/size (not the content itself — cheap to list).
- `GET /api/files/history/{version:int}/{**path}` → returns the actual bytes of that one historical version. Note `{version:int}` — a **route constraint**: ASP.NET Core will only match this route if that segment parses as an integer, which is also how it's disambiguated from the catch-all path route.
- `POST /api/files/history/restore/{version:int}/{**path}` → fetches the historical content and calls `UpsertFileAsync` again with it — restoring a version is implemented as "save the old content as if it were new", which *also* means restoring creates yet another new history entry for the content you just overwrote. That's a deliberate, sensible behaviour: you never lose data, even the version you're replacing gets snapshotted.

## 5. `Fileservice.BuildNestTree` — the tree-building algorithm

This is worth understanding as its own algorithm, since it's the trickiest bit of pure logic in the backend:

```csharp
private static JsonObject BuildNestTree(List<FileSystemEntity> allEntities, int? parentId)
{
    var tree = new JsonObject();
    var children = allEntities.Where(e => e.ParentId == parentId).OrderBy(e => e.Name).ToList();

    foreach (var entity in children)
    {
        var node = new JsonObject { ["file"] = entity.IsFile, ... };
        if (!entity.IsFile)
            node["content"] = BuildNestTree(allEntities, entity.Id);   // recursion!
        tree[entity.Name] = node;
    }
    return tree;
}
```

- It's **recursive**: to build the tree rooted at `parentId`, find all rows whose `ParentId` equals it, and for each folder among them, recursively build *its* subtree by looking for rows whose `ParentId` equals *that folder's* `Id`.
- It only queries the database **once** (`GetAllForUserAsync` fetches the whole flat list up front), then does all the tree-shaping in memory with LINQ. This is a deliberate performance choice: recursively querying the database at every folder level (an "N+1 query" problem) would be far slower than one query + in-memory grouping, especially as the tree grows.
- Base case: when there are no rows with that `ParentId`, `children` is empty, the `foreach` does nothing, and an empty `JsonObject` is returned — this naturally terminates the recursion at leaf files (files never recurse because of the `if (!entity.IsFile)` guard) and at genuinely empty folders.

## 6. `SoftDeleteRecursive` — same recursive-tree pattern, different purpose

```csharp
private static void SoftDeleteRecursive(FileSystemEntity entity, List<FileSystemEntity> all)
{
    entity.IsDeleted = true;
    entity.DeletedAt = DateTime.UtcNow;
    foreach (var child in all.Where(f => f.ParentId == entity.Id))
        SoftDeleteRecursive(child, all);
}
```
Deleting a folder must cascade to everything inside it (you can't have a file whose parent folder is "deleted" but the file itself still shows up as active). Same shape as `BuildNestTree`: fetch all candidate rows once, then walk the in-memory tree recursively, mutating each node before recursing into its children. `RestoreChildrenRecursive` mirrors this exactly in reverse for un-deleting a folder from Trash.

## 7. Mental checklist for reading *any* endpoint in this codebase

1. What HTTP verb + route is it? What does that verb *mean* semantically (read/create/replace/delete)?
2. Where does `UserId` come from, and is every DB query filtered by it?
3. Does it touch a Service method, or (wrongly) query `_db` directly in the controller?
4. Does it fire a SignalR event afterward, and with which numeric type code?
5. What HTTP status code does it return on success/failure, and is that the *correct* one semantically?
