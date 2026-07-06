---
tags: [docgit, interview, practice]
---

# 12 — Interviewer's Perspective: Practice Questions & Model Answers

> Related notes: every other note in this vault — each question below links back to the relevant deep-dive

Format: **Q** (as an interviewer would actually phrase it) → a model answer grounded in *your actual code*, not generic textbook phrasing. Use these to rehearse out loud, not just read silently.

## Architecture & System Design

**Q: Walk me through what happens, end to end, when a user hits Save on a document.**
A: See [[01-Project-Overview]] §4 and [[08-Backend-Frontend-Connection]] §5 in full. Short version: Angular's `Editor` calls `DocApiService.putFile`, an HTTP `PUT` with a JWT bearer header hits `FilesController.UpdateFile`, which calls `Fileservice.UpsertFileAsync` — that snapshots the old content into `FileHistories` via `FileHistoryService`, uploads the new bytes to Azure Blob Storage via `BlobService`, and updates the SQL row. The controller then pushes a `FileChangeEvent` over the already-open SignalR WebSocket to every connected tab, which triggers a *separate* fresh `GET /api/files` to refresh the tree — SignalR only notifies, REST still does all actual data fetching.

**Q: Why does this project use two data stores instead of just one?**
A: SQL Server holds structured, queryable metadata (ownership, tree structure, timestamps); Azure Blob Storage holds the actual file bytes. Relational databases aren't efficient for storing large binary blobs; object storage is purpose-built for it. See [[01-Project-Overview]] §2.

**Q: If I deleted the entire Angular frontend right now, would the backend still work?**
A: Yes — completely. The backend is a self-contained REST API with no dependency on any particular client; the CLI `Client` project proves this by being a second, independent frontend against the exact same endpoints. See [[01-Project-Overview]] §6, [[09-The-CLI-Client]].

**Q: How is the file tree represented, given there's no real filesystem?**
A: Every file/folder is a row in `FileSystemEntities`, with a nullable self-referencing `ParentId` (null = root). The backend flattens/refetches this once per request and recursively reshapes it into nested JSON via `Fileservice.BuildNestTree`. See [[01-Project-Overview]] §3, [[02-Methods-And-APIs]] §5.

## Async / Task / Middleware

**Q: What's the difference between `Task` and `Task<T>`, and why is almost everything in this backend `async`?**
A: `Task` represents a future completion with no return value; `Task<T>` carries a result of type `T`. Nearly everything that talks to the database or Azure Blob Storage is I/O-bound, and `async`/`await` lets the thread be released back to the pool while waiting, instead of blocking a thread per in-flight request — critical for a server handling many concurrent users. See [[03-Async-Middleware-Databases]] §1.

**Q: Explain `Task.WhenAll` and where it's used here.**
A: Used in `Fileservice.PermanentDeleteAsync` to delete a file's own blob and all its history blobs in Azure concurrently rather than sequentially — every deletion `Task` is started first, collected into a list, then all awaited together, so the total wait time is bounded by the slowest call rather than the sum of all of them. See [[03-Async-Middleware-Databases]] §1.

**Q: What is middleware, and why does the order in `Program.cs` matter?**
A: Middleware is an ordered pipeline every request passes through before reaching a controller. Order matters because, e.g., CORS must run before anything that might reject the request (so even error responses carry CORS headers the browser needs), and Authentication must run before Authorization (you have to identify who's asking before you can decide if they're allowed). See [[03-Async-Middleware-Databases]] §2.

**Q: How does SignalR authenticate a WebSocket connection, given browsers can't set custom headers on a raw WebSocket handshake?**
A: The JWT is passed as an `access_token` query string parameter instead, and a custom `OnMessageReceived` hook in the JWT-bearer middleware specifically checks for that parameter on the `/api/events/signalr` path and treats it as the bearer token. See [[03-Async-Middleware-Databases]] §2, [[08-Backend-Frontend-Connection]] §4.

## SRP & Design

**Q: Explain the Single Responsibility Principle using your own code as an example.**
A: `Fileservice`, `FileHistoryService`, and `BlobService` are split by *reason to change*: tree/CRUD logic, versioning logic, and Azure-specific storage code respectively. `BlobService` knows nothing about files or users — it only uploads/downloads/deletes named byte blobs — so switching cloud providers would only touch that one class. See [[04-Single-Responsibility-Principle]].

**Q: Can you find somewhere in your own project that *doesn't* fully follow SRP?**
A: Yes — `Fileservice` has grown to handle tree-building, CRUD, and recursive soft-delete/restore logic all in one class; those could reasonably be split further (e.g. a separate tree-builder). Also, `AuthController` queries `_db` directly for uniqueness checks while `FilesController` never touches `_db` directly — an inconsistency in how strictly the two controllers delegate to services. See [[04-Single-Responsibility-Principle]] §3.

## Database / DbContext / ICollection

**Q: What is a `DbContext`, and what lifetime should it have in a web app, and why?**
A: A session with the database plus a change tracker; `DbSet<T>` properties represent tables. It should be **Scoped** (one per HTTP request) because it isn't thread-safe, and Scoped lets multiple services within one request share the same tracked changes so one `SaveChangesAsync()` commits them all together. See [[05-DbContext]] §4, [[10-Services-And-DI]] §2.

**Q: What does `OnModelCreating` do, and give me an example from your code where a relationship needed explicit configuration.**
A: It's where you use EF Core's Fluent API to configure things conventions can't infer — e.g. `FileSystemEntity.Parent`/`Children` is a self-referencing one-to-many relationship, explicitly configured with `.HasOne(f => f.Parent).WithMany(f => f.Children).HasForeignKey(f => f.ParentId).OnDelete(DeleteBehavior.Restrict)` — `Restrict` specifically to avoid SQL Server rejecting the schema due to multiple possible cascade paths (user→files and file→children both trying to cascade-delete the same rows). See [[05-DbContext]] §2.

**Q: Why is `ICollection<T>` used for navigation properties instead of `List<T>` directly?**
A: Programming to the interface keeps the exposed contract minimal (add/remove/count/iterate) rather than the entire `List<T>` API surface, and EF Core itself only needs something it can `.Add()` to when materializing related rows — it doesn't care about the concrete type. `= new List<T>()` still supplies a safe non-null default. See [[07-ICollection]] §2.

**Q: When does EF Core actually populate a navigation collection like `FileHistories`?**
A: Only when explicitly requested via `.Include()` in a query (there's no lazy-loading configured in this project) — otherwise it stays as its default empty collection. `Fileservice.PermanentDeleteAsync` uses `.Include(f => f.FileHistories)` specifically because it needs to iterate and delete each history's blob. See [[07-ICollection]] §4.

## Domains / DTOs

**Q: Why not just return your EF Core entities directly from your API endpoints?**
A: Two reasons visible in this code: it would leak internal-only fields (like `BlobName`, an Azure implementation detail) to clients, and entities like `FileSystemEntity` have circular navigation references (`Parent` ↔ `Children`) that would either throw or serialize huge/awkward payloads. DTOs are flat, minimal, and represent the API *contract* separately from the database *schema* — so one can change without forcing the other to. See [[06-Domains-DTOs-Classes]] §1.

**Q: Give an example of a DTO handling more than one client shape.**
A: `LogInReqDto` has both `User` (with `[JsonPropertyName("user")]`, for the CLI client's `{"user": ...}` body) and `UserName` (for Angular's `{"userName": ...}` body) — `AuthController.Login` picks whichever is populated. See [[06-Domains-DTOs-Classes]] §3, [[09-The-CLI-Client]] §5.

## Backend ↔ Frontend

**Q: What is CORS, and is it a server-side or client-side security mechanism?**
A: It's enforced by the **browser**, not the server — it stops a webpage's JavaScript from reading cross-origin responses unless the server opts in via `Access-Control-Allow-Origin`-family headers. It does nothing to stop direct tools like curl or the CLI client, since those don't run in a browser and don't enforce it at all. See [[08-Backend-Frontend-Connection]] §1.

**Q: How does the Angular app stay logged in across a page refresh?**
A: The JWT is stored in `localStorage` (guarded for SSR via `isPlatformBrowser`). On startup, `App.tryRestoreSession()` checks if a token exists and, if so, immediately refetches the tree and reconnects SignalR — the token itself *is* the session; there's no server-side session store, which is the point of JWTs being stateless. See [[08-Backend-Frontend-Connection]] §3.

**Q: What's the difference between the HTTP calls and the SignalR connection in this app?**
A: HTTP/REST calls are what actually *cause* and *fetch* data — every `GET`/`PUT`/`POST`/`DELETE` in `DocApiService`. SignalR is a separate, long-lived WebSocket connection purely for *notification*: when any change happens, the server pushes an event over it, and the frontend's only reaction is to refetch via a normal REST call. SignalR never carries the actual updated data itself in this implementation. See [[08-Backend-Frontend-Connection]] §4-5.

## The CLI Client

**Q: How does `push` decide what to delete on the server?**
A: It builds two sets of relative paths — everything on local disk, and everything the server currently has (via the same `GET /api/files` tree) — and anything present on the server but absent from the combined local set gets deleted, deepest-path-first for safety. See [[09-The-CLI-Client]] §4.

**Q: Why does the CLI reuse one `HttpClient` instance for the whole run instead of creating a new one per request?**
A: Creating a new `HttpClient` per call is a known .NET anti-pattern — it can exhaust OS socket handles under load due to how connection pooling works internally. One shared instance (plus a generous timeout, since `pull`/`push` can move a lot of data) is the recommended pattern. See [[09-The-CLI-Client]] §7.

## Services & DI

**Q: Why is `BlobService` registered as a Singleton while `Fileservice` is Scoped?**
A: `BlobContainerClient` (Azure SDK) is explicitly thread-safe and expensive to construct — sharing one instance for the app's whole lifetime is safe and efficient. `Fileservice` depends (indirectly) on `ApplicationDbContext`, which is *not* thread-safe, so it must be Scoped — one instance per request — to avoid two concurrent requests corrupting the same change tracker. See [[10-Services-And-DI]] §2.

**Q: What would go wrong if you registered `ApplicationDbContext` as a Singleton?**
A: Every request would share the exact same `DbContext` and its internal change tracker — since it's not thread-safe, concurrent requests could corrupt each other's tracked entities, causing subtle data corruption or crashes under real traffic, even though it might appear to work fine in casual single-user testing.

## Security & Robustness (self-critique questions — the ones that impress interviewers most)

**Q: Find a bug in your own real-time system.**
A: `EventHub.UserGroup(int userId)` ignores its parameter and always returns the literal string `"hubgroup"` — meaning every connected user is actually in the same broadcast group, so file-change events for one user are pushed to every other logged-in user's browser, not just that user's own sessions. The frontend's blind "refetch on any event" behavior hides the symptom, but it's a real over-broadcast and a design mismatch between the method's name/intent and its implementation. See [[11-Extra-Topics]] §5.

**Q: Why is BCrypt used instead of a faster hash like SHA-256 for passwords?**
A: Password hashing needs to be deliberately *slow* and *salted* to resist brute-force/rainbow-table attacks; general-purpose fast hashes like SHA-256 are the wrong tool specifically *because* they're fast — great for checksums, bad for defending stolen password hashes. See [[11-Extra-Topics]] §2.

**Q: What's the security risk in `AuthController.Register`'s exception handling?**
A: It returns the raw exception type, message, inner exception, and full stack trace to the client on failure — acceptable for local debugging, but in production this is an information-disclosure risk (reveals internal implementation details, paths, sometimes connection info) and should be replaced with a generic error response plus server-side logging. See [[11-Extra-Topics]] §6.

**Q: `EnsureCreated()` vs. `Migrate()` — what's the difference, and which does this project actually use?**
A: `EnsureCreated()` creates the schema from the current model if the database doesn't exist yet, but has no concept of incremental migration history. `Migrate()` applies pending migrations from the `Migrations/` folder in order. This project calls `EnsureCreated()` at startup despite having real migrations checked in — a mismatch that would cause confusion in a real deployment pipeline; production code should pick one strategy consistently, almost always `Migrate()`. See [[05-DbContext]] §3, [[11-Extra-Topics]] §7.

---

### How to use this file effectively
Cover the "A:" lines and try answering from memory using only the "Q:" prompt, then check yourself against the model answer and the linked deep-dive note. If you can explain *why* something is the way it is — not just *what* it does — you're ready.
