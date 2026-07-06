---
tags: [docgit, cli, dotnet, httpclient]
---

# 09 — The CLI Client

> Related notes: [[01-Project-Overview]] · [[08-Backend-Frontend-Connection]]

## 1. What it's for and why it exists

`Client/Program.cs` is a small, standalone **.NET 9 console application** — a second, completely independent "frontend" for the exact same backend API that Angular talks to (see [[01-Project-Overview]] §6 for why this matters conceptually: it proves the API is a real, client-agnostic contract). It supports exactly two commands:

```
Client pull <baseUrl> [username] [password]     # download the whole server tree into the current folder
Client push <baseUrl> [username] [password]     # upload the whole current folder to the server
```

## 2. Top-level statements — reading the "no `Main` method" style

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

try
{
    var ok = await RunAsync(args);
    Environment.Exit(ok ? 0 : 1);
}
catch
{
    Environment.Exit(1);
}

static async Task<bool> RunAsync(string[] args) { ... }
```

Since C# 9/10, a single file in a console app project can contain **top-level statements** — code that runs directly, without wrapping it in `class Program { static void Main(string[] args) { ... } }`. The compiler generates that boilerplate for you behind the scenes. `args` (the command-line arguments) is implicitly available. `static` local functions declared below the top-level statements (like `RunAsync`, `PullAsync`, etc.) are ordinary local functions, just written at file scope.

- `await RunAsync(args)` at the top level is allowed because the compiler-generated `Main` is itself `async Task Main(...)` under the hood when you `await` at the top level.
- `Environment.Exit(ok ? 0 : 1)` sets the **process exit code** — `0` conventionally means success, any non-zero value means failure. This matters because the Node.js test suite (`tests/tests/v3-client.js`) likely checks this exit code to assert the CLI behaved correctly — a console app's "return value" to the outside world (a shell script, a CI pipeline, another program) *is* its exit code, not a printed message.
- The outer `try/catch` is a deliberate safety net: **any** unhandled exception anywhere in the whole run gets turned into a clean exit code `1` instead of a scary .NET stack trace dumped to the console — reasonable for a CLI tool whose job is "succeed or fail", not "explain internals to the user".

## 3. `pull` — download the server's tree into the current directory

```csharp
static async Task<bool> PullAsync(HttpClient http, string baseUrl)
{
    using var resp = await http.GetAsync($"{baseUrl}/api/files");
    if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized) return false;
    if (!resp.IsSuccessStatusCode) return false;

    await using var stream = await resp.Content.ReadAsStreamAsync();
    using var treeDoc = await JsonDocument.ParseAsync(stream);
    ClearWorkingDirectory();
    await MaterializeTreeAsync(http, baseUrl, treeDoc.RootElement, "");
    return true;
}
```

1. Calls the exact same `GET /api/files` endpoint Angular's `getTree()` calls — same backend, same JSON shape, same auth header, no special "CLI mode" on the server at all.
2. **`JsonDocument.ParseAsync`** — a lower-level, more manual way of working with JSON than deserializing into a strongly-typed C# class (`JsonSerializer.Deserialize<T>`). `JsonDocument` gives you a navigable DOM-like tree (`JsonElement`s you walk with `.EnumerateObject()`, `.TryGetProperty()`) — appropriate here because the tree shape is dynamic/recursive (file vs folder, arbitrary depth) rather than a fixed, known-in-advance class shape.
3. **`ClearWorkingDirectory()`** wipes every file and folder in the current directory *first* — this is the destructive step the README explicitly warns about. It's a deliberate design choice for a "mirror" tool: `pull` guarantees your local folder becomes an *exact* copy of the server afterward, with nothing stale left behind — the tradeoff is that it's unforgiving if you run it in the wrong directory.
4. **`MaterializeTreeAsync`** recursively walks the parsed JSON tree exactly the same shape as `Fileservice.BuildNestTree` builds it server-side (see [[02-Methods-And-APIs]] §5) — for every folder node, `Directory.CreateDirectory(...)` then recurse into `content`; for every file node, `GET /api/files/{path}` to fetch its actual bytes, then stream them straight to a local `FileStream` (`resp.Content.CopyToAsync(fs)` — avoids loading a potentially huge file entirely into memory as a byte array first).

## 4. `push` — upload the current directory to the server, deleting what's gone locally

This is the more interesting half, because it has to **reconcile** two independent trees (local disk vs. server) rather than just copying one direction:

```csharp
static async Task<bool> PushAsync(HttpClient http, string baseUrl)
{
    var localFiles = new HashSet<string>(StringComparer.Ordinal);
    var localDirs = new HashSet<string>(StringComparer.Ordinal);
    CollectLocalRecursive(Directory.GetCurrentDirectory(), "", localFiles, localDirs);

    using var resp = await http.GetAsync($"{baseUrl}/api/files");
    ...
    var serverPaths = new HashSet<string>(StringComparer.Ordinal);
    CollectServerPaths(treeDoc.RootElement, "", serverPaths);

    var localAll = new HashSet<string>(localFiles, StringComparer.Ordinal);
    foreach (var d in localDirs) localAll.Add(d);

    var toDelete = serverPaths.Where(p => !localAll.Contains(p)).ToList();
    toDelete.Sort(ComparePathDepthDesc);

    foreach (var path in toDelete)
        await http.DeleteAsync($"{baseUrl}/api/files/{EscapeApiPath(path)}");   // simplified

    var dirsToCreate = localDirs.OrderBy(d => d.Count(c => c == '/')).ToList();
    foreach (var dir in dirsToCreate) await PutFolderAsync(http, baseUrl, dir);

    foreach (var file in localFiles) await PutFileAsync(http, baseUrl, file);
    return true;
}
```

Step by step:
1. **Collect local state**: walk the current directory recursively, building two `HashSet<string>`s of relative paths — one for files, one for folders. `HashSet` is used (not `List`) because membership testing (`Contains`) is what these are used for next, and a hash set does that in O(1) versus a list's O(n).
2. **Collect server state**: fetch the tree exactly like `pull` does, then flatten it into a matching set of paths (`CollectServerPaths`).
3. **Diff**: anything on the server that *isn't* in the combined local set (`localAll`) needs to be deleted server-side — this is what makes `push` a true "mirror" operation rather than just "upload everything", exactly like `pull` is a true mirror in the opposite direction.
4. **Delete in deepest-first order** (`ComparePathDepthDesc` sorts by number of `/` characters, descending): this matters because the backend's `SoftDeleteAsync` already cascades to children (see [[02-Methods-And-APIs]] §6), but deleting deepest-first is still the safer, more predictable order to issue the calls in regardless — avoids any ordering-dependent surprises, and if a shallow folder gets deleted (cascading its children) before a deeper explicit delete call for one of those already-cascaded children runs, that later call is naturally a no-op (`SoftDelete` on an already-deleted item just returns `Ok()`) rather than an error.
5. **Create folders shallowest-first** (`OrderBy(d => d.Count(c => c == '/'))`, ascending): you must create `notes` before you can create `notes/math` — a parent folder has to exist (or the backend has to be able to auto-create it, which `Fileservice.CreateFileWithParentsAsync` actually already does for files, but folder creation here still sensibly goes shallow-to-deep to be safe/explicit).
6. **Upload every file's bytes** via `PUT` (upsert — same endpoint the editor's "Save" button hits).

## 5. `LoginAsync` and bearer token attachment

```csharp
static async Task<string?> LoginAsync(HttpClient http, string baseUrl, string user, string password)
{
    var body = JsonSerializer.Serialize(new Dictionary<string, string> { ["user"] = user, ["password"] = password });
    var resp = await http.PostAsync($"{baseUrl}/api/login", new StringContent(body, Encoding.UTF8, "application/json"));
    ...
}
```
Sends `{"user": "...", "password": "..."}` — note the key is `"user"`, matching the `[JsonPropertyName("user")]`-annotated field on `LogInReqDto` on the backend (see [[06-Domains-DTOs-Classes]] §3 — this is the exact reason that compatibility field exists). Once a token comes back:
```csharp
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
```
Setting this on `HttpClient.DefaultRequestHeaders` means **every subsequent request made through this same `HttpClient` instance** automatically carries the header — you don't have to attach it manually to each `GetAsync`/`PutAsync`/`DeleteAsync` call afterward, unlike the Angular side where `authHeaders()` is called explicitly per-request (a difference driven by the shape of each library's API, not a difference in what's actually happening).

If no username/password args are given at all (`args.Length < 4`), the client simply never sets an `Authorization` header and calls the API anonymously — meaning `pull`/`push` without credentials only works against files owned by whichever account has no auth requirement, or more precisely, only succeeds if the server responds successfully to unauthenticated requests for that data (in practice, real usage of this project requires credentials, since `FilesController` is `[Authorize]`-protected).

## 6. `NormalizeBaseUrl` — a small but nice usability touch

```csharp
static string NormalizeBaseUrl(string raw)
{
    var s = raw.Trim();
    if (!s.StartsWith("http://") && !s.StartsWith("https://"))
    {
        var local = s.StartsWith("localhost") || s.StartsWith("127.0.0.1");
        s = local ? "http://" + s : "https://" + s;
    }
    return s.TrimEnd('/');
}
```
Lets a user type `Client pull localhost:5000` instead of `Client pull http://localhost:5000` — defaults to plain `http://` for local addresses (where you're unlikely to have a TLS certificate set up) and `https://` for everything else (safe default for any real remote server). A small piece of API design worth noticing: **thinking about what your actual users will type**, not just what's technically correct.

## 7. `HttpClient` usage patterns worth internalizing

```csharp
using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
```
- **One `HttpClient` instance, reused for the whole run** — this is the officially recommended pattern (creating a *new* `HttpClient` per request is a known anti-pattern in .NET; it can exhaust OS socket handles under load because of how the underlying `SocketsHttpHandler` manages connection pooling). Here, since this is a short-lived console app making a bounded number of calls, either approach would technically survive, but reusing one instance is still the right habit to build.
- **`Timeout = TimeSpan.FromMinutes(5)`** — generous, deliberately, because `pull`/`push` can involve transferring many/large files; the default `HttpClient` timeout (100 seconds) could otherwise abort a legitimately slow but successful large-folder sync.
- Every network call is wrapped in `try/catch` returning `false` on failure rather than letting exceptions propagate — consistent with the "clean exit code, no scary stack trace" philosophy from §2.
