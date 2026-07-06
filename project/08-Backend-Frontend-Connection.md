---
tags: [docgit, angular, cors, jwt, signalr, http]
---

# 08 — How the Backend APIs Connect to the Frontend

> Related notes: [[01-Project-Overview]] · [[02-Methods-And-APIs]] · [[10-Services-And-DI]]

This is arguably the most "full-stack" topic in the whole project — it's where ASP.NET Core and Angular actually meet. There are **three separate mechanisms** at play, and it's important to keep them conceptually distinct: (1) plain HTTP/REST calls, (2) the JWT auth handshake riding on top of those calls, and (3) the separate, persistent SignalR WebSocket connection for live updates.

## 1. CORS — why the browser needs the server's permission first

The Angular dev server runs on `http://localhost:4200`; the API runs on a different port (`http://localhost:5135` or similar). Any time a webpage's JavaScript tries to call a *different* origin (different scheme, host, or port counts as different), the browser enforces the **Same-Origin Policy** and blocks the response from being read by your JavaScript **unless the server explicitly says it's OK**, via CORS (Cross-Origin Resource Sharing) response headers.

```csharp
// Program.cs
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? new[] { "http://localhost:4200" };

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()));
```

- `.WithOrigins(...)` — a strict allowlist of exactly which origins are trusted (not `*` — you can't combine wildcard origins with `AllowCredentials()` anyway, which is a browser-level security restriction).
- `.AllowCredentials()` — necessary here because requests carry an `Authorization` header, and by default, cross-origin requests carrying credentials (cookies, auth headers) are more strictly gated by the browser.
- `app.UseCors()` in the middleware pipeline (see [[03-Async-Middleware-Databases]]) is what actually attaches the `Access-Control-Allow-Origin` etc. headers to every response.

**Important nuance:** CORS is a **browser-enforced** protection, not a server-side security boundary. It stops a malicious website running in someone's browser from silently making authenticated requests to your API on the user's behalf. It does **not** stop a direct tool like curl, Postman, or the CLI client from calling the API — those never enforce CORS at all (CORS is entirely a browser JavaScript restriction). This is exactly why the `Client` console app (see [[09-The-CLI-Client]]) can call the API freely with no CORS configuration involved whatsoever.

## 2. The HTTP layer — `DocApiService`

Every single backend API call from Angular funnels through one file: `frontend/Docgit/src/app/services/doc-api.service.ts`. This centralization is itself a design choice worth noting — no component talks to `HttpClient` directly; they all go through this one service (see [[10-Services-And-DI]] for why that's good practice).

```typescript
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? ''                          // production: relative URLs, same origin as the Angular app itself
  : 'http://localhost:5135';    // local dev: Angular (4200) talks to a separately-running API (5135)
```

This single ternary encodes a real deployment fact: in production, the compiled Angular app is copied into the ASP.NET Core app's `wwwroot` folder (see the MSBuild target in `Docgit.csproj`) and served *by the same server* as the API — so relative URLs (`''` + `/api/files`) just work, no CORS needed at all in production. In local development, they're two separate processes on two separate ports, so an absolute URL is required and CORS *is* needed. This is a very common, very real pattern: **CORS is usually a development-environment problem that disappears once frontend and backend are served from the same origin in production.**

Every request-building method follows the same shape:

```typescript
putFile(path: string, text: string): Observable<void> {
  return this.http.put<void>(`${this.baseUrl}/api/files/${this.encodePath(path)}`, text, {
    headers: this.authHeaders('text/plain; charset=UTF-8'),
  });
}
```

- **`this.encodePath(path)`** — URL-encodes each path segment individually (`s.split('/').map(encodeURIComponent).join('/')`) so a filename containing special characters (spaces, `%`, `#`, non-ASCII) survives being embedded in a URL, while still preserving the `/` separators the backend's `{**path}` catch-all route expects.
- **`this.authHeaders(...)`** attaches `Authorization: Bearer <token>` — read straight out of `localStorage` (`getToken()`), plus a `Content-Type` when relevant. This is manually attached on every call in this project (no Angular `HttpInterceptor` is used here) — a real, valid simplification for a project this size, though a growing app would typically centralize this into an [HttpInterceptor](https://angular.dev/guide/http/interceptors) instead of repeating `authHeaders()` per call.
- **Return type is `Observable<T>`**, Angular/RxJS's core async primitive (conceptually similar to a `Promise`, but lazy — nothing happens until something `.subscribe()`s — and capable of emitting multiple values over time, cancellation, retry operators, etc.). Every component calling into `DocApiService` ends with `.subscribe({ next: ..., error: ... })`.

### `getTree()` and `treeToDocFiles` — reshaping the backend's JSON into a UI-friendly model

```typescript
getTree(): Observable<DocFile[]> {
  return this.http
    .get<Record<string, ApiTreeNode>>(`${this.baseUrl}/api/files`, { headers: this.authHeaders() })
    .pipe(map((obj) => this.treeToDocFiles(obj, null)));
}
```
The backend's `GET /api/files` returns nested objects keyed by name (see [[02-Methods-And-APIs]] §5 for `BuildNestTree`); the frontend immediately reshapes that into an array of `DocFile` objects (each carrying an explicit `id` = full path, `parent`, and `children: DocFile[]`) — a shape that's much easier for Angular templates to `*ngFor`/recurse over than a plain nested object keyed by name. `.pipe(map(...))` is the RxJS way of transforming each emitted value before it reaches the subscriber — the HTTP response is transformed *once*, in one place, rather than every component that consumes `getTree()` having to know about the raw backend JSON shape.

## 3. The JWT auth handshake, end to end

1. User submits the login form → `DocApiService.login(userName, password)` → `POST /api/login`.
2. Backend validates credentials, returns `{ token: "..." }` (see `AuthController.Login` in [[02-Methods-And-APIs]]).
3. Angular calls `this.api.setAuthToken(token)`, which does `localStorage.setItem('docgit_token', token)` (guarded by `isPlatformBrowser` since this app supports server-side rendering, where `localStorage` doesn't exist — see `main.server.ts`/`app.config.server.ts`).
4. Every subsequent API call attaches `Authorization: Bearer <token>` from that same stored value.
5. On the backend, the JWT-bearer authentication middleware validates the token's signature and expiry on every request (see [[03-Async-Middleware-Databases]] §2), and populates claims that `FilesController.UserId` reads.
6. If any call ever returns `401`, `DocApiService.handleAuthError` clears the stored token — effectively logging the user out client-side the moment their token is rejected (expired, tampered, or server restarted with a different secret).
7. On page reload, `App.tryRestoreSession()` checks `api.hasToken()` and, if present, immediately re-fetches the tree and starts the SignalR connection — the JWT itself is what "remembers" the session; there's no server-side session state at all (this is the whole point of JWT-based auth: **stateless** — any server instance can validate any token without a shared session store, which matters a lot once you have more than one server instance).

## 4. SignalR — the real-time layer

This is a **second, independent connection**, entirely separate from the request/response HTTP calls above — a long-lived WebSocket (with automatic fallback/negotiation and reconnection logic, handled by the `@microsoft/signalr` client library).

```typescript
// realtime-events.service.ts
this.connection = new signalR.HubConnectionBuilder()
  .withUrl(`${this.api.baseUrl}/api/events/signalr`, {
    accessTokenFactory: () => this.api.getToken() ?? '',
  })
  .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
  .configureLogging(signalR.LogLevel.Information)
  .build();
```

- **`accessTokenFactory`** — as covered in [[03-Async-Middleware-Databases]] §2, a browser WebSocket handshake can't carry a custom `Authorization` header, so the SignalR client instead appends the token as an `access_token` query string parameter, which the backend's `OnMessageReceived` JWT event hook specifically watches for on the `/api/events/signalr` path.
- **`.withAutomaticReconnect([0, 1000, 3000, 5000, 10000])`** — if the connection drops (network blip, server restart), the client retries after 0ms, then 1s, then 3s, 5s, 10s, then keeps retrying at the last interval — exponential-ish backoff, avoiding a reconnect storm while still recovering quickly for transient blips.
- **Server → client event**: `this.connection.on('FileChangeEvent', (type: number, path: string) => { this.eventsSubject.next({ type, path }); })` — this registers a handler for a *named message* the hub can push at any time, unprompted by any specific client request. The numeric `type` matches the codes the backend sends (`0`=file created, `1`=file updated, `2`=file deleted, `5`=folder created, `7`=folder deleted — see [[02-Methods-And-APIs]]).
- **Client → server**: `connection.invoke('JoinGroup', groupName)` calls a method defined on `EventHub` directly, RPC-style — this is the *other* direction of SignalR communication, less used in this project (mainly `JoinGroup`/`LeaveGroup`/`JoinDocumentGroup`/`LeaveDocumentGroup` exist on `EventHub` but the current `App` component doesn't call them — every connected user is already implicitly grouped by `UserGroup(userId)` inside `EventHub.OnConnectedAsync`).
- **`RealtimeEventsService.events$`** exposes an RxJS `Subject` that `App` subscribes to once, on login:
  ```typescript
  this.realtimeSub = this.realtime.events$.subscribe((evt) => {
    this.refreshFileTree();
    if (this.showDeletedItems()) this.refreshTrashList();
  });
  ```
  Notice the frontend's reaction to *any* file event is simply "refetch the whole tree" — not a granular patch of just the changed node. That's a deliberate simplicity/correctness tradeoff: re-fetching the full tree is always correct (never desyncs from the server), at the cost of being less bandwidth-efficient than a more surgical "patch just this one node" approach would be. For a learning project, and for a tree that's realistically small, that tradeoff is entirely reasonable — but it's exactly the kind of thing worth mentioning as a possible future optimization in an interview.

## 5. Putting it together: the full picture for one user action

Re-using the "Save" example from [[01-Project-Overview]] §4, here's every hop across the two layers:

```
Angular Editor component
   │  onSaveNow()
   ▼
DocApiService.putFile(path, content)          ── HTTP PUT, Authorization: Bearer <jwt> ──►  Kestrel
                                                                                                │
                                                                          CORS → JWT-auth → AuthZ → routing
                                                                                                │
                                                                                        FilesController.UpdateFile
                                                                                                │
                                                                                        Fileservice.UpsertFileAsync
                                                                                          (SQL Server + Blob Storage)
                                                                                                │
                                                                         _hub.Clients.Group(...).SendAsync("FileChangeEvent", 1, path)
                                                                                                │
                                                                            ── pushed over the OPEN SignalR WebSocket ──►
                                                                                                │
                                          RealtimeEventsService (every open tab, incl. the one that just saved)
                                                                                                │
                                                              App subscription → refreshFileTree() → DocApiService.getTree()
                                                                                                │
                                                                                       (new HTTP GET round trip)
```

The last GET is a completely fresh, independent HTTP call — SignalR only ever tells the frontend "something changed, go find out what", it doesn't carry the new tree data itself in this implementation. That's the crucial mental model: **SignalR is a notification channel, REST is still the only way data is actually fetched.**
