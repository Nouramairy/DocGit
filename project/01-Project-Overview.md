---
tags: [docgit, overview, architecture]
---

# 01 — Project Overview & System Architecture

> Related notes: [[02-Methods-And-APIs]] · [[08-Backend-Frontend-Connection]] · [[10-Services-And-DI]] · [[13-Interview-Questions]]

## 1. What is DocGit, in one sentence?

DocGit is a **document management system with Git-like version history**: you create files and folders in a tree (like a file explorer), every time you save a file the old content is snapshotted as a numbered "version", and everything is kept in sync live across every browser tab you have open, using a database as the source of truth instead of the actual filesystem.

Think of it as "Google Docs meets Git", built by you as a full-stack learning project, with four separate programs that talk to each other over HTTP:

| Project | Folder | What it is | Language |
|---|---|---|---|
| **Backend API** | `backend/Docgit` | ASP.NET Core 9 Web API — the brain. Owns the database, the business rules, auth. | C# |
| **Frontend** | `frontend/Docgit` | Angular 21 single-page app — the browser UI you actually click around in. | TypeScript |
| **CLI Client** | `Client` | A tiny console app that can `push`/`pull` a local folder to/from the server. | C# |
| **Tests** | `tests` | Node.js scripts that hit the API/SignalR/CLI and assert behaviour. | JavaScript |

All four are independent processes. None of them share memory. They only know about each other through **HTTP requests** (REST) and **WebSocket messages** (SignalR). This is the single most important thing to understand before anything else in this project makes sense: **the backend doesn't know or care what's calling it** — Angular, the CLI, curl, or the test scripts, it's all just HTTP to the API.

## 2. The high-level architecture

```
┌───────────────────────┐        HTTP (REST) + WebSocket (SignalR)      ┌────────────────────────────────┐
│   Angular Frontend     │ ◄────────────────────────────────────────►   │   ASP.NET Core 9 Web API        │
│   localhost:4200       │        JSON over the wire, JWT in header     │   localhost:5135 (dev)          │
└───────────────────────┘                                                │                                  │
                                                                          │  Controllers                    │
┌───────────────────────┐        HTTP (REST) only                       │   AuthController                 │
│   .NET CLI Client      │ ◄────────────────────────────────────────►   │   FilesController                │
│   Client.exe            │                                              │                                  │
└───────────────────────┘                                                │  Services (business logic)      │
                                                                          │   JwtService                    │
                                                                          │   Fileservice                    │
                                                                          │   FileHistoryService             │
                                                                          │   BlobService                    │
                                                                          │                                  │
                                                                          │  SignalR Hub (EventHub)          │
                                                                          │                                  │
                                                                          │  EF Core (ApplicationDbContext) │
                                                                          └───────────────┬──────────────────┘
                                                                                          │
                                                                     ┌────────────────────┴───────────────────┐
                                                                     │                                        │
                                                          ┌──────────▼─────────┐                  ┌───────────▼───────────┐
                                                          │   SQL Server         │                  │  Azure Blob Storage   │
                                                          │   (metadata: who     │                  │  (actual file bytes)  │
                                                          │   owns what, tree    │                  │                       │
                                                          │   structure, dates)  │                  │                       │
                                                          └──────────────────────┘                  └───────────────────────┘
```

Two data stores, on purpose (see `27d938e` / `e858e4d` commits — "blob storage configured"):

- **SQL Server** stores *metadata*: who owns the file, its name, its path, its parent folder, timestamps, size — but **not** the file bytes themselves (except as a legacy fallback, see below).
- **Azure Blob Storage** stores the *actual bytes* of the file content and of every historical version. This is a very common real-world pattern: relational databases are bad at storing large binary blobs efficiently; object storage (Blob/S3) is built for exactly that.

You can see this split directly in `FileSystemEntity.cs` (`backend/Docgit/Domain/FileSystemEntity.cs`):

```csharp
public byte[]? Content { get; set; }      // legacy / fallback: content stored directly in SQL row
public string? BlobName { get; set; }     // new: pointer to where the real bytes live in Blob Storage
```

When `BlobName` is set, the actual content lives in Azure Blob Storage under that name, and `Content` is `null`. This is a migration pattern: the project used to store bytes straight in the SQL row (`Content`), and was upgraded to store them in Blob Storage instead (see migration `20260615050115_AddBlobStorage.cs`). The old column is kept for backward compatibility with rows created before the change.

## 3. The core concept: a virtual filesystem in a database

There's no folder on disk called `notebook/math/notes.md`. Instead, every file and folder is a **row** in the `FileSystemEntities` table, and folders point at each other through a self-referencing parent/child relationship:

```
FileSystemEntities table (simplified)
┌────┬──────────┬──────────┬────────┬────────────────────┬────────┐
│ Id │ ParentId │ UserID   │ Name   │ Path                │ IsFile │
├────┼──────────┼──────────┼────────┼────────────────────┼────────┤
│ 1  │ null     │ 7        │ notes  │ notes               │ false  │  ← root folder "notes"
│ 2  │ 1        │ 7        │ math   │ notes/math          │ false  │  ← subfolder
│ 3  │ 2        │ 7        │ a.md   │ notes/math/a.md     │ true   │  ← file
└────┴──────────┴──────────┴────────┴────────────────────┴────────┘
```

`ParentId = null` means "this is a top-level item". Every row also carries `Path`, which is the full slash-separated path — this is a **denormalization** (storing the same information — the hierarchy — in two forms) done purely for speed: instead of walking up the parent chain every time you need to know "what's the full path of this file?", you can just read the `Path` column directly. The tradeoff is that `Path` must be kept consistent with `ParentId`/`Name` whenever something moves — this project doesn't currently support moving/renaming, which sidesteps that whole problem.

The backend turns this flat table into the **nested JSON tree** the frontend expects, in `Fileservice.BuildNestTree` (see [[02-Methods-And-APIs]] for the full walkthrough):

```json
{
  "notes": {
    "file": false,
    "content": {
      "math": {
        "file": false,
        "content": {
          "a.md": { "file": true, "extension": ".md", "bytes": 42 }
        }
      }
    }
  }
}
```

## 4. Request lifecycle — what actually happens when you click "Save"

This is the single most useful mental model for this whole project. Trace it end to end:

1. **Browser**: You're editing `notes/math/a.md` in the Angular `Editor` component. You click "Save".
2. **Angular component** (`app.ts` → `onSaveNow()`) calls `this.api.putFile(file.id, content)`.
3. **`DocApiService.putFile`** (`doc-api.service.ts`) builds an HTTP `PUT` request to `http://localhost:5135/api/files/notes/math/a.md`, with the raw text as the body and an `Authorization: Bearer <jwt>` header attached.
4. The request leaves the browser and hits **Kestrel** (ASP.NET Core's web server).
5. It passes through the **middleware pipeline** in `Program.cs`, in order: CORS check → JWT authentication (decodes the token, populates `HttpContext.User`) → authorization (`[Authorize]` on the controller checks there *is* a valid identity) → routing to the matching controller action.
6. **`FilesController.UpdateFile(string path)`** runs. It reads `UserId` from the JWT claims, reads the raw bytes from the request body, and calls `_fileService.UpsertFileAsync(userId, path, content)`.
7. **`Fileservice.UpsertFileAsync`**: finds the existing DB row for that path → calls `FileHistoryService.SaveVersionAsync` to snapshot the *old* content into `FileHistories` (uploading it to Blob Storage first) → uploads the *new* content to Blob Storage → updates the row's `BlobName`, `Bytes`, `UpdatedAt` → calls `_db.SaveChangesAsync()` which issues the actual `UPDATE` SQL statement.
8. Back in the controller, it calls `_hub.Clients.Group(UserGroupName).SendAsync("FileChangeEvent", 1, path)` — this pushes a real-time message over SignalR to every other browser tab logged in as this same user.
9. The controller returns `200 OK` to the original HTTP request.
10. **Every connected browser tab** (including other tabs of the *same* user) receives the `FileChangeEvent` message via the open WebSocket connection, and `RealtimeEventsService` re-emits it as an RxJS event; `App` component's subscription reacts by calling `refreshFileTree()`, so every open tab's sidebar updates without anyone reloading the page.

Notice this involves **two entirely different transport mechanisms** at once: the classic request/response HTTP call that *causes* the change, and the SignalR push that *broadcasts* the change to everyone (including tabs that didn't cause it). This dual pattern — REST for commands, WebSocket/SignalR for "something changed, go refetch" — is extremely common in real production systems (Slack, Google Docs, Figma, Trello all do variations of it) and is worth understanding deeply; see [[08-Backend-Frontend-Connection]].

## 5. Why is authentication needed on almost everything?

Because this is a **multi-user** system — many people can register accounts, and each person only sees their own files. Every `FileSystemEntity` row has a `UserID` foreign key, and every query in `Fileservice` filters `WHERE UserID == userId`. The `userId` used in that filter is never taken from the request URL or body (that would let anyone pass someone else's ID and read their files!) — it's extracted from the **JWT token's claims**, which were signed by the server at login time and can't be forged without the server's secret key. This is why `FilesController` has `[Authorize]` at the class level and reads `UserId` from `User.FindFirst(ClaimTypes.NameIdentifier)`.

## 6. Why four projects instead of one?

Because they change independently and are owned by different concerns:

- The **backend** is the only thing that touches the database and enforces rules (you can't bypass auth by editing JavaScript in the browser, because the browser doesn't have the JWT secret).
- The **frontend** is purely a *client* of the API — if you deleted the whole `frontend/` folder, the API would keep working perfectly (you could still use Postman, curl, or the CLI client against it). This separation is what "backend" and "frontend" *mean* in modern web development: the backend is a headless API; any number of different "frontends" (a web app, a CLI, a mobile app) can be built against the same one.
- The **CLI client** exists to prove that point in practice — it's a second, completely independent frontend for the exact same API, doing `pull`/`push` instead of live editing.
- The **tests** exercise the whole system as a black box from outside, the same way a real user or the CLI would, rather than testing internal C# classes directly (that's called **integration/end-to-end testing**, as opposed to *unit testing* individual methods).

## 7. Where things live on disk

```
DocGit/
├── backend/Docgit/           ASP.NET Core 9 Web API
│   ├── Controllers/          HTTP endpoints (AuthController, FilesController)
│   ├── Data/                 ApplicationDbContext (EF Core)
│   ├── Domain/                Entity classes mapped to DB tables
│   ├── Dto/                   Data Transfer Objects (shape of JSON in/out)
│   ├── Hubs/                  SignalR hub (EventHub)
│   ├── Migrations/            EF Core generated migration history
│   ├── Service/                Business logic (Fileservice, BlobService, FileHistoryService, JwtService)
│   ├── Program.cs             App startup & middleware pipeline
│   └── appsettings.json       Connection strings & secrets (not committed with real values)
├── frontend/Docgit/           Angular 21 SPA
│   └── src/app/
│       ├── services/          DocApiService (HTTP), RealtimeEventsService (SignalR)
│       ├── editor/            The text editor component
│       ├── side-bar/          File tree navigation
│       ├── log-in/            Login/registration screen
│       ├── deleted-items/     Trash view
│       └── app.ts             Root component — owns all top-level state
├── Client/                   .NET 9 console app (CLI push/pull)
└── tests/                    Node.js black-box test suite
```

## 8. Key vocabulary you'll want to be fluent in

- **REST API** — a convention for exposing operations over HTTP using URLs + HTTP verbs (`GET` = read, `POST` = create, `PUT` = create-or-replace, `DELETE` = remove). DocGit's API is a REST-ish API — see [[02-Methods-And-APIs]].
- **DTO (Data Transfer Object)** — a plain class whose only job is to define the shape of JSON going in/out of the API, separate from your database entities. See [[06-Domains-DTOs-Classes]].
- **Entity / Domain model** — a class that EF Core maps to a database table (`User`, `FileSystemEntity`, `FileHistory`).
- **DbContext** — the EF Core object that represents "a session with the database"; see [[05-DbContext]].
- **Middleware** — a pipeline of steps every HTTP request passes through before reaching your controller; see [[03-Async-Middleware-Databases]].
- **JWT (JSON Web Token)** — a signed, tamper-proof blob the server hands the client after login, proving "this request really is user #7".
- **SignalR** — Microsoft's library for real-time, bidirectional communication over WebSockets (with fallbacks), used here for the live file-tree updates.
- **Soft delete** — instead of actually deleting a database row, you flag it `IsDeleted = true` and hide it from normal queries. This is how the Trash feature works.

## 9. What to read next

- If you want to understand *every single endpoint and method* line by line → [[02-Methods-And-APIs]]
- If `async`/`await`, middleware, or "how does the app even start" confuse you → [[03-Async-Middleware-Databases]]
- If you want the "why is the code split into files this way" answer → [[04-Single-Responsibility-Principle]]
- Database internals → [[05-DbContext]], [[07-ICollection]]
- The classes themselves → [[06-Domains-DTOs-Classes]]
- How Angular and ASP.NET Core are actually wired together → [[08-Backend-Frontend-Connection]]
- The `Client` console app → [[09-The-CLI-Client]]
- Dependency Injection & the service layer → [[10-Services-And-DI]]
- Stuff nobody asked for but you should know → [[11-Extra-Topics]]
- Practice interview questions on all of the above → [[13-Interview-Questions]]
