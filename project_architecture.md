# DocGit — Project Architecture

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [Feature List (Minimal Scope)](#2-feature-list-minimal-scope)
3. [Frontend Architecture (Angular)](#3-frontend-architecture-angular)
4. [Backend Architecture (ASP.NET Web API)](#4-backend-architecture-aspnet-web-api)
5. [Database Schema (Entity Framework + SQLite)](#5-database-schema-entity-framework--sqlite)
6. [SignalR Architecture](#6-signalr-architecture)
7. [API Endpoint List](#7-api-endpoint-list)
8. [JWT Authentication Flow](#8-jwt-authentication-flow)
9. [Feature Implementation Plans](#9-feature-implementation-plans)
10. [Build and Deployment Strategy](#10-build-and-deployment-strategy)

---

## 1. Project Summary

DocGit is a file management web application that combines the visual layout of GitHub with the version-control simplicity of Google Docs. Users authenticate via JWT, manage files and folders through a REST API, receive real-time updates via SignalR, and can browse or restore historical file versions — all stored in an Entity Framework-driven SQLite database.

**Technology Stack:**

- **Frontend:** Angular (standalone components, signals-based state)
- **Backend:** ASP.NET Web API (controller-based, Swagger-documented)
- **Database:** SQLite via Entity Framework Core
- **Real-Time:** SignalR
- **Authentication:** JWT Bearer tokens
- **Hosting:** Kestrel dev server serving both API and Angular static files from `wwwroot`

---

## 2. Feature List (Minimal Scope)

This list is derived strictly from the group-work requirements in `project_requirements.md`. The existing frontend prototype contains extra features (collaborator panel, settings panel, search bar, admin login panel, social login, rich-text formatting toolbar, file renaming UI) that are **out of scope** for this implementation phase and will be excluded or disabled.

### Required Features

| ID | Feature | Source |
|----|---------|--------|
| F1 | **User Login (JWT)** | Section 5 — Login dialog, `POST /api/login`, token storage |
| F2 | **Per-User File Isolation** | Section 5 — Each user sees only their own files |
| F3 | **File Listing** | Section 3 — `GET /api/files` returns all user files/folders as nested JSON object |
| F4 | **File Content Retrieval** | Section 3 — `GET /api/files/{path}` returns file content |
| F5 | **File Metadata (HEAD)** | Section 3 — `HEAD /api/files/{path}` returns metadata headers, no body |
| F6 | **File Upload (Create)** | Section 3 — `POST /api/files/{path}` creates a new file, 409 if exists |
| F7 | **File Update (Replace)** | Section 3 — `PUT /api/files/{path}` replaces file, triggers history save |
| F8 | **File Delete** | Section 3 — `DELETE /api/files/{path}` removes a file |
| F9 | **Folder Support** | Section 3 & 4 — Create/delete folders, nested structure, navigate in UI |
| F10 | **SignalR Real-Time Events** | Section 6 — Hub at `/api/events/signalr`, events on POST/PUT/DELETE |
| F11 | **SignalR JWT Protection** | Section 6 — Hub requires authenticated connection |
| F12 | **File History (EF + SQLite)** | Section 7 — Save old version on every PUT, store in database |
| F13 | **View Old Versions in UI** | Section 7 — Browse through file version history |
| F14 | **Restore Old Version** | Section 7 — Button to restore a viewed historical version |
| F15 | **Deleted File Recovery** | Section 7 — Soft-delete files, list in trash, recoverable with history |
| F16 | **Relative Fetch URLs** | Section 4 — All frontend API calls use relative paths |
| F17 | **npm run build Script** | Section 4 — Cross-platform build that outputs to `wwwroot` |

### Excluded from Scope

The following frontend components exist in the prototype but are **not required** and will be stripped or left non-functional:

- **Collaborator Panel** — Real-time collaboration roles/invites are not in the spec
- **Settings Panel** — General/editor/git settings toggles are not in the spec
- **Admin Login Panel** — Not in the spec
- **Search Bar** — Not explicitly required (nice-to-have, not mandatory)
- **Social Login (GitHub/Google)** — Spec requires username-password login only
- **Rich-Text Formatting Toolbar** — File editing is a bonus feature; raw text editing is sufficient
- **File Rename UI** — Not in the API spec (rename = delete + create with different path)
- **Live Presence / Typing Indicators** — Not in the spec

---

## 3. Frontend Architecture (Angular)

### 3.1 Application Shell

The Angular application is a single-page application with no routing. The shell has two states:

1. **Unauthenticated** — Shows the login screen
2. **Authenticated** — Shows the main application layout (topbar, sidebar, editor area)

Authentication state is determined by the presence of a valid JWT in `localStorage`.

### 3.2 Component Structure (Minimal)

```
App (root)
├── LoginComponent              — Username/password form, calls POST /api/login
├── TopBar (inline in app)      — Logo, deleted-items button, user avatar/logout
├── SideBarComponent            — File/folder tree, create folder, create file, delete actions
├── EditorComponent             — Displays selected file content, allows editing
├── DeletedItemsComponent       — Modal overlay listing soft-deleted files, restore/permanent-delete
├── AddFolderComponent          — Modal for creating a root-level folder
├── AddSubFolderComponent       — Modal for creating a subfolder within an existing folder
└── FileHistoryComponent (NEW)  — Panel/modal for browsing and restoring file versions
```

### 3.3 Services

Three Angular services handle all data access and real-time communication:

**AuthService**

- Stores the JWT token in `localStorage`
- Provides an `authHeaders()` method returning the `Authorization: Bearer <token>` header
- Exposes `isAuthenticated` signal and `currentUser` signal (decoded from JWT claims)
- Provides `login(username, password)` and `logout()` methods

**FileService**

- All methods use relative URLs (e.g., `fetch('/api/files')`)
- Each request includes the JWT via `AuthService.authHeaders()`
- Methods:
  - `getAll()` — `GET /api/files` — returns the full nested file/folder JSON object
  - `getFileContent(path)` — `GET /api/files/{path}` — returns raw file content
  - `getFileMeta(path)` — `HEAD /api/files/{path}` — returns metadata from response headers
  - `createFile(path, content)` — `POST /api/files/{path}` — creates a new file
  - `updateFile(path, content)` — `PUT /api/files/{path}` — replaces an existing file
  - `deleteFile(path)` — `DELETE /api/files/{path}` — soft-deletes a file
  - `getHistory(path)` — `GET /api/files/{path}/history` — returns version list for a file
  - `getHistoryVersion(path, version)` — `GET /api/files/{path}/history/{version}` — returns a specific old version's content
  - `restoreVersion(path, version)` — `POST /api/files/{path}/history/{version}/restore` — restores an old version (triggers a PUT internally on the backend)
  - `getDeletedFiles()` — `GET /api/files/trash` — lists all soft-deleted files for the user
  - `restoreDeletedFile(path)` — `POST /api/files/trash/{path}/restore` — restores a soft-deleted file
  - `permanentDeleteFile(path)` — `DELETE /api/files/trash/{path}` — permanently deletes a soft-deleted file

**SignalRService**

- Establishes a HubConnection to `/api/events/signalr` with the JWT as an access token
- Listens to the `"Event"` method which receives two arguments: `type` (integer) and `path` (string)
- On receiving an event, triggers a refresh of the file tree by calling `FileService.getAll()`
- Exposes an observable/signal of recent events for optional UI notifications

### 3.4 State Management

State is managed using Angular signals (already in prototype). The app component holds the root signals:

- `isAuthenticated` — boolean, drives authenticated vs login view
- `files` — the nested file/folder tree fetched from the API (replaces the current hardcoded mock data)
- `activeFile` — the currently selected file for editing
- `deletedFiles` — list of soft-deleted files from `GET /api/files/trash`
- `fileHistory` — version list for the currently viewed file

All data flows top-down through input signals to child components, and actions flow up through output events.

### 3.5 Proxy Configuration

During development, the Angular dev server must proxy API requests to the ASP.NET backend. A `proxy.conf.json` file will route `/api/*` to `http://localhost:5275` (or whichever port the backend runs on).

---

## 4. Backend Architecture (ASP.NET Web API)

### 4.1 Project Structure

```
backend/
├── Docgit/                         — ASP.NET Web API project (startup, controllers, hubs)
│   ├── Controllers/
│   │   ├── AuthController.cs       — POST /api/login
│   │   └── FilesController.cs      — All /api/files/* endpoints
│   ├── Hubs/
│   │   └── EventHub.cs             — SignalR hub at /api/events/signalr
│   ├── Services/
│   │   ├── IFileService.cs         — Interface for file operations
│   │   ├── FileService.cs          — Implementation: file CRUD, interacts with EF
│   │   ├── IFileHistoryService.cs  — Interface for history operations
│   │   ├── FileHistoryService.cs   — Implementation: version tracking, restore
│   │   └── JwtService.cs           — Token generation and validation
│   ├── Data/
│   │   └── AppDbContext.cs         — EF Core DbContext with SQLite
│   ├── DTOs/
│   │   ├── LoginRequestDto.cs      — { user, password }
│   │   ├── LoginResponseDto.cs     — { token }
│   │   ├── FileMetadataDto.cs      — { created, changed, file, bytes, extension, content }
│   │   └── FileHistoryDto.cs       — { version, changedAt, bytes }
│   ├── Models/
│   │   ├── FileSystemEntity.cs     — Domain entity for files and folders
│   │   ├── FileHistory.cs          — Domain entity for version history
│   │   └── User.cs                 — Domain entity for users
│   ├── Program.cs                  — Service registration, middleware pipeline
│   ├── appsettings.json            — JWT secret, connection string, Kestrel config
│   └── wwwroot/                    — Angular build output (served as static files)
└── DocGit.Domain/                  — (To be merged into the main project or kept as shared lib)
```

### 4.2 Controller Approach

Two controllers handle all endpoints:

**AuthController** — Handles user authentication. Single endpoint. No `[Authorize]` attribute.

**FilesController** — Handles all file and folder operations. Every action method is decorated with `[Authorize]`. The current user is extracted from the JWT claims via `HttpContext.User`. All file operations are scoped to the authenticated user, ensuring per-user file isolation.

### 4.3 Service Layer

Controllers delegate business logic to injected services:

- **FileService** — Reads/writes file entities to the database. Builds the nested JSON response for `GET /api/files`. Handles path resolution for nested folders. On `PUT`, calls `FileHistoryService` to save the old version before replacing.
- **FileHistoryService** — Saves full file content snapshots to the `FileHistory` table. Retrieves version lists and specific version content. Handles the restore operation (which internally writes a new version via `FileService`).
- **JwtService** — Generates JWT tokens on login. Validates credentials against the database. The test user (`test-user` / `So Long, and Thanks for All the Fish`) must be seeded on application startup.

### 4.4 Middleware Pipeline (Program.cs)

The `Program.cs` configures the following middleware in order:

1. **Static Files** — Serve Angular build output from `wwwroot`
2. **Routing**
3. **CORS** — Configured to allow the Angular dev server origin during development
4. **Authentication** — JWT Bearer authentication scheme
5. **Authorization**
6. **Controllers** — Map controller routes
7. **SignalR Hub** — Map the hub at `/api/events/signalr`
8. **Fallback** — SPA fallback to serve `index.html` for Angular routing (if any)

Additional configuration:

- **JSON serialization** — Suppress null values in responses (`JsonIgnoreCondition.WhenWritingNull`)
- **Kestrel body size limit** — Increased to 1 GB for file uploads
- **Swagger** — Enabled in development mode for API documentation and testing

---

## 5. Database Schema (Entity Framework + SQLite)

### 5.1 Entities

**Users**

| Column | Type | Notes |
|--------|------|-------|
| Id | int (PK, auto-increment) | Primary key |
| Username | string (unique, required) | Login username |
| PasswordHash | string (required) | Hashed password (BCrypt or similar) |
| CreatedAt | DateTime | Account creation timestamp |

**FileSystemEntities**

| Column | Type | Notes |
|--------|------|-------|
| Id | int (PK, auto-increment) | Primary key |
| UserId | int (FK → Users.Id) | Owner — ensures per-user isolation |
| Name | string (required) | File or folder name |
| Path | string (required) | Full path from root (e.g., `mapp 1/random.txt`) |
| IsFile | bool | true = file, false = folder |
| Content | byte[] (nullable) | File content (null for folders) |
| Extension | string (nullable) | File extension (null for folders) |
| Bytes | long | Size in bytes (for folders: sum of children) |
| ParentId | int? (FK → FileSystemEntities.Id, nullable) | Null for root-level items |
| IsDeleted | bool | Soft-delete flag. Default false |
| DeletedAt | DateTime? | When the item was soft-deleted |
| CreatedAt | DateTime | Creation timestamp |
| ChangedAt | DateTime | Last modification timestamp |

**Unique constraint:** `(UserId, Path)` — no two entities can share the same path for the same user.

**Self-referencing relationship:** `ParentId → FileSystemEntities.Id` — enables nested folder structure with unlimited depth.

**FileHistories**

| Column | Type | Notes |
|--------|------|-------|
| Id | int (PK, auto-increment) | Primary key |
| FileEntityId | int (FK → FileSystemEntities.Id) | The file this version belongs to |
| VersionNumber | int | Sequential version number (1, 2, 3, ...) |
| Content | byte[] | Snapshot of the full file content at this version |
| Bytes | long | Size of this version in bytes |
| SavedAt | DateTime | When this version was saved |

### 5.2 Relationships

- **User → FileSystemEntities:** One-to-many. A user owns many files/folders.
- **FileSystemEntity → FileSystemEntity (self):** One-to-many. A folder contains many children.
- **FileSystemEntity → FileHistories:** One-to-many. A file has many history versions.

### 5.3 Seed Data

On application startup (EF migration or `EnsureCreated`), seed the required test user:

- **Username:** `test-user`
- **Password:** `So Long, and Thanks for All the Fish` (stored as a hash)

---

## 6. SignalR Architecture

### 6.1 Hub Registration

A SignalR hub named `EventHub` is mapped at the path `/api/events/signalr`. The hub class itself does not need to define any server-side methods. It exists solely as a broadcast endpoint.

### 6.2 JWT Protection

The hub is protected by the same JWT authentication used by the REST API. The token is passed via the query string during connection because SignalR WebSocket connections cannot send custom headers. The authentication middleware is configured to also read the token from the `access_token` query parameter when the request path starts with `/api/events/signalr`.

### 6.3 Event Broadcasting

After every successful `POST`, `PUT`, or `DELETE` operation in `FilesController`, the controller calls `IHubContext<EventHub>` to broadcast an event to all connected clients.

The broadcast calls `Clients.All.SendAsync("Event", eventType, filePath)` with two arguments:

1. **eventType** (int) — An integer identifying the kind of change:
   - `0` = File created
   - `1` = File updated
   - `2` = File deleted
   - `5` = Folder created
   - `7` = Folder deleted

2. **filePath** (string) — The exact path used in the API call, without the `/api/files/` prefix (e.g., `"example.txt"`, `"a/b/c/hello.md"`)

### 6.4 Event Type Logic

- `POST /api/files/{path}` → Event type `0` (file created) or `5` (folder created, if applicable)
- `PUT /api/files/{path}` where file already existed → Event type `1` (file updated)
- `PUT /api/files/{path}` where file did not exist → Event type `0` (file created)
- `DELETE /api/files/{path}` for a file → Event type `2` (file deleted)
- `DELETE /api/files/{path}` for a folder → Event type `7` (folder deleted)

### 6.5 Client-Side Handling

The Angular `SignalRService` connects to the hub with the JWT. On receiving an `"Event"`, it triggers a full refresh of the file tree (`FileService.getAll()`) to keep the UI in sync. This is the simplest reliable approach — no need to patch the local tree manually.

---

## 7. API Endpoint List

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/login` | No | Accepts `{ user, password }`, returns `{ token }` |

### File Management

All endpoints below require JWT authentication via `Authorization: Bearer <token>` header. All file operations are scoped to the authenticated user.

| Method | Path | Description | Success | Error |
|--------|------|-------------|---------|-------|
| GET | `/api/files` | Returns all files/folders as nested JSON object (no content) | 200 | 401 |
| GET | `/api/files/{**path}` | Returns the content of the file at the given path | 200 | 401, 404 |
| HEAD | `/api/files/{**path}` | Returns metadata headers only (no body) | 200 | 401, 404 |
| POST | `/api/files/{**path}` | Creates a file at the given path (body = file content) | 201 | 401, 409 |
| PUT | `/api/files/{**path}` | Creates or replaces a file (body = file content). Saves old version to history if replacing. | 200 | 401 |
| DELETE | `/api/files/{**path}` | Soft-deletes the file/folder at the given path | 200 | 401 |

### File History

| Method | Path | Description | Success | Error |
|--------|------|-------------|---------|-------|
| GET | `/api/files/{**path}/history` | Returns list of all versions for the file | 200 | 401, 404 |
| GET | `/api/files/{**path}/history/{version}` | Returns the content of a specific historical version | 200 | 401, 404 |
| POST | `/api/files/{**path}/history/{version}/restore` | Restores the file to the specified version (internally performs a PUT) | 200 | 401, 404 |

### Deleted Files (Trash)

| Method | Path | Description | Success | Error |
|--------|------|-------------|---------|-------|
| GET | `/api/files/trash` | Returns list of all soft-deleted files for the user | 200 | 401 |
| POST | `/api/files/trash/{**path}/restore` | Restores a soft-deleted file (unsets `IsDeleted` flag) | 200 | 401, 404 |
| DELETE | `/api/files/trash/{**path}` | Permanently deletes a soft-deleted file and its history | 200 | 401 |

### Response Headers (for GET and HEAD on `/api/files/{path}`)

| Header | Example Value | Description |
|--------|---------------|-------------|
| `X-Created-At` | `2026-03-13 20:03:20` | File creation timestamp |
| `X-Changed-At` | `2026-03-13 20:03:20` | Last modification timestamp |
| `X-Type` | `file` | `file` or `folder` |
| `X-Bytes` | `59` | File size in bytes |
| `X-Extension` | `.md` | File extension (omitted for folders) |

---

## 8. JWT Authentication Flow

### 8.1 Login Sequence

1. User enters username and password in the Angular login form
2. Angular sends `POST /api/login` with `{ "user": "...", "password": "..." }`
3. `AuthController` receives the request, passes it to `JwtService`
4. `JwtService` looks up the user in the database, verifies the password hash
5. If valid, `JwtService` generates a JWT containing claims: `sub` (user ID), `name` (username)
6. The JWT is signed with a secret key stored in `appsettings.json`
7. `AuthController` returns `{ "token": "eyJ..." }`
8. Angular stores the token in `localStorage`
9. All subsequent API calls include the header `Authorization: Bearer <token>`

### 8.2 Token Structure

The JWT payload contains:

- `sub` — The user's database ID (integer as string)
- `name` — The username
- `iat` — Issued-at timestamp
- `exp` — Expiration timestamp (e.g., 24 hours from issue)

### 8.3 Backend Validation

Every request to `FilesController` passes through the JWT Bearer authentication middleware. The middleware:

1. Extracts the token from the `Authorization` header
2. Validates the signature using the secret key
3. Checks the expiration
4. Populates `HttpContext.User` with claims from the token
5. The controller reads `User.FindFirst(ClaimTypes.NameIdentifier)?.Value` to get the user ID and scopes all database queries to that user

### 8.4 SignalR Token Delivery

SignalR WebSocket connections cannot use standard `Authorization` headers. The token is sent as a query parameter:

- Angular: `new HubConnectionBuilder().withUrl('/api/events/signalr', { accessTokenFactory: () => token })`
- Backend: The JWT middleware is configured to read from `context.Request.Query["access_token"]` when the path starts with `/api/events/signalr`

---

## 9. Feature Implementation Plans

### F1: User Login (JWT)

**Backend:**

- Create `AuthController` with a `POST /api/login` action
- The action accepts `LoginRequestDto { User, Password }`
- `JwtService.Authenticate(username, password)` looks up the user in the `Users` table, compares the password hash using BCrypt
- On success, `JwtService.GenerateToken(user)` creates a JWT with claims `sub` and `name`, signed with the secret from `appsettings.json`, with a 24-hour expiry
- Returns `LoginResponseDto { Token }` with status 200
- Returns 401 Unauthorized if credentials are invalid
- In `Program.cs`, configure `AddAuthentication().AddJwtBearer(...)` with the same secret and validation parameters
- Seed the test user on startup: username `test-user`, password `So Long, and Thanks for All the Fish`

**Frontend:**

- Simplify the existing `LogIn` component: remove signup mode, forgot-password mode, social login buttons, and password strength meter
- Keep only the sign-in form with username and password fields
- On submit, call `AuthService.login(username, password)` which posts to `/api/login`
- On success, store the token in `localStorage`, set `isAuthenticated` to true
- On failure, display the error message returned by the API
- On app initialization, check `localStorage` for an existing token and auto-authenticate if not expired

**Logout:**

- Clear the token from `localStorage`
- Disconnect SignalR
- Reset `isAuthenticated` to false

---

### F2: Per-User File Isolation

**Backend:**

- Every query in `FileService` includes a `WHERE UserId == currentUserId` clause
- The `currentUserId` is extracted from the JWT claims in the controller and passed to the service
- When creating files/folders, the `UserId` column is set to the authenticated user's ID
- There is no endpoint to access another user's files; the isolation is enforced at the database query level

**Frontend:**

- No special frontend logic needed. The API automatically returns only the authenticated user's files.

---

### F3: File Listing

**Backend:**

- `GET /api/files` in `FilesController` calls `FileService.GetAllForUser(userId)`
- `FileService` queries all `FileSystemEntities` where `UserId == userId` and `IsDeleted == false`
- Builds the nested JSON structure: root-level items are keys in a dictionary, folders contain a nested `content` dictionary
- Each entry includes: `created`, `changed`, `file` (bool), `bytes`, `extension` (null for folders)
- Folder entries include `content` with their children recursively nested
- The response is a single JSON object (not an array), matching the spec format

**Frontend:**

- On authentication, call `FileService.getAll()` to populate the file tree
- The `SideBar` component renders the tree using the existing flat-tree approach
- Remove the hardcoded mock data from `app.ts` and replace with API-fetched data
- Map the API response format (dictionary with nested content) to the internal `DocFile[]` structure used by the components

---

### F4: File Content Retrieval

**Backend:**

- `GET /api/files/{**path}` in `FilesController` calls `FileService.GetByPath(userId, path)`
- Looks up the `FileSystemEntity` by `UserId` and `Path`
- Returns the file content as `Results.File(content, mimeType)` with correct Content-Type and charset
- MIME type is determined automatically using `FileExtensionContentTypeProvider`
- Adds `; charset=UTF-8` for text-based types
- Sets the custom response headers (`X-Created-At`, `X-Changed-At`, `X-Type`, `X-Bytes`, `X-Extension`)
- Returns 404 if the file does not exist or belongs to another user

**Frontend:**

- When a user clicks a file in the sidebar, call `FileService.getFileContent(path)` to fetch the content
- Display the content in the editor area

---

### F5: File Metadata (HEAD)

**Backend:**

- `HEAD /api/files/{**path}` is mapped using `MapMethods` with `["HEAD"]` method filter, or handled within the same controller action as GET with a check for `Request.Method == "HEAD"`
- Returns the same custom headers as GET (`X-Created-At`, `X-Changed-At`, `X-Type`, `X-Bytes`, `X-Extension`)
- Returns no response body
- Returns 404 if the file does not exist for the user

**Frontend:**

- Not directly used by the UI, but available for programmatic metadata checks without downloading full file content

---

### F6: File Upload (Create)

**Backend:**

- `POST /api/files/{**path}` in `FilesController` reads the request body as a byte array
- Calls `FileService.Create(userId, path, content)`
- `FileService` checks if a `FileSystemEntity` with the same `UserId` and `Path` already exists — if so, returns 409 Conflict
- If the path contains folder segments (e.g., `folder1/file.txt`), the service ensures all parent folders exist in the database, creating them if necessary
- Creates the `FileSystemEntity` with: `Name` (filename portion), `Path` (full path), `IsFile` = true, `Content` = request body bytes, `Extension` = file extension, `Bytes` = content length, `UserId`, `CreatedAt` and `ChangedAt` = now
- Broadcasts a SignalR event: type `0` (file created), path = the file path

**Frontend:**

- The `AddFolder` component (reused in file mode) collects the file name
- On create, the app constructs the full path from the parent folder's path and the new filename
- Calls `FileService.createFile(path, content)` with empty content (new file)
- Refreshes the file tree on success (or relies on the SignalR event to trigger a refresh)

---

### F7: File Update (Replace)

**Backend:**

- `PUT /api/files/{**path}` in `FilesController` reads the request body as a byte array
- Calls `FileService.Update(userId, path, content)`
- `FileService` checks if the file exists:
  - **If it exists:** Calls `FileHistoryService.SaveVersion(fileEntity)` to snapshot the current content into the `FileHistories` table before replacing. Then updates `Content`, `Bytes`, and `ChangedAt`. Broadcasts SignalR event type `1` (file updated).
  - **If it does not exist:** Creates the file (same as POST logic). Broadcasts SignalR event type `0` (file created).

**Frontend:**

- When the user edits file content in the editor and triggers a save (or on auto-save), call `FileService.updateFile(path, newContent)` with a `PUT` request
- The editor component emits `contentChange` events; the app component debounces these and sends the update

---

### F8: File Delete

**Backend:**

- `DELETE /api/files/{**path}` in `FilesController`
- Calls `FileService.SoftDelete(userId, path)`
- Sets `IsDeleted = true` and `DeletedAt = now` on the `FileSystemEntity`
- If the target is a folder, recursively soft-deletes all children
- Returns 200 regardless of whether the file existed
- Broadcasts SignalR event type `2` (file deleted) or `7` (folder deleted)

**Frontend:**

- The sidebar delete button calls `FileService.deleteFile(path)`
- On success, the file tree is refreshed (via SignalR event or explicit re-fetch)
- If the deleted file was the active editor file, clear the editor

---

### F9: Folder Support

**Backend:**

- Folders are stored as `FileSystemEntity` with `IsFile = false`, `Content = null`, `Extension = null`
- Creating a folder: `POST /api/files/{path}` with an empty body — the service detects it should be a folder based on the path having no extension, or an explicit flag in the request
- Alternatively, folders are created implicitly when a file is created at a nested path (e.g., `POST /api/files/newfolder/file.txt` creates `newfolder` if it does not exist)
- Deleting a folder: `DELETE /api/files/{path}` — recursively soft-deletes the folder and all its children
- `GET /api/files` returns folders with `"file": false` and a nested `"content"` object

**Frontend:**

- `AddFolder` component creates root-level folders by calling `POST /api/files/{folderName}` (or a dedicated convention)
- `AddSubFolder` component creates subfolders by calling `POST /api/files/{parentPath}/{subfolderName}`
- Sidebar tree renders folders with expand/collapse toggle
- Clicking a folder toggles it open/closed; clicking a file opens it in the editor

---

### F10 & F11: SignalR Real-Time Events with JWT Protection

**Backend:**

- Create `EventHub` class inheriting from `Hub` (empty class, no methods needed)
- In `Program.cs`, register SignalR: `builder.Services.AddSignalR()`
- Map the hub: `app.MapHub<EventHub>("/api/events/signalr")`
- Add `[Authorize]` attribute to the `EventHub` class
- Configure the JWT middleware to also read tokens from the `access_token` query string for the SignalR path
- Inject `IHubContext<EventHub>` into `FilesController`
- After each POST, PUT, or DELETE operation, call `hubContext.Clients.All.SendAsync("Event", eventType, filePath)`

**Frontend:**

- `SignalRService` creates a `HubConnection` with the JWT passed via `accessTokenFactory`
- Registers a handler for the `"Event"` method
- On any event, calls `FileService.getAll()` to refresh the sidebar file tree
- The connection is established after login and disconnected on logout

---

### F12: File History (Save on PUT)

**Backend:**

- When `FileService.Update()` replaces an existing file, it first calls `FileHistoryService.SaveVersion(fileEntity)`
- `FileHistoryService.SaveVersion()`:
  1. Queries the current highest `VersionNumber` for the file from the `FileHistories` table
  2. Creates a new `FileHistory` row with: `FileEntityId`, `VersionNumber = max + 1` (or 1 if first history), `Content = fileEntity.Content` (the old content before replacement), `Bytes = fileEntity.Bytes`, `SavedAt = now`
  3. Saves to the database

---

### F13: View Old Versions in UI

**Backend:**

- `GET /api/files/{**path}/history` returns a list of all history entries for the file, ordered by `VersionNumber` descending
- Each entry includes: `version` (int), `changedAt` (DateTime string), `bytes` (long)
- `GET /api/files/{**path}/history/{version}` returns the raw content of that specific version

**Frontend:**

- Create a new `FileHistoryComponent` (panel or modal) accessible from the editor area (e.g., a "History" button in the document header)
- When opened, calls `FileService.getHistory(path)` to fetch the version list
- Displays a list of versions with timestamps
- Clicking a version calls `FileService.getHistoryVersion(path, version)` and displays the content in a read-only preview within the panel
- Navigation between versions: simple list click or left/right arrows

---

### F14: Restore Old Version

**Backend:**

- `POST /api/files/{**path}/history/{version}/restore` in `FilesController`
- Fetches the historical version's content from `FileHistories`
- Calls `FileService.Update(userId, path, historicalContent)` — this in turn saves the current content as a new history entry before overwriting with the old content
- Broadcasts a SignalR event type `1` (file updated)
- Returns 200 on success

**Frontend:**

- In the `FileHistoryComponent`, when viewing a specific version, show a "Restore this version" button
- On click, calls `FileService.restoreVersion(path, version)`
- On success, close the history panel and refresh the editor with the restored content

---

### F15: Deleted File Recovery

**Backend:**

- `GET /api/files/trash` queries `FileSystemEntities` where `UserId == userId` and `IsDeleted == true`
- Returns a list with each item's `Path`, `Name`, `IsFile`, `DeletedAt`
- `POST /api/files/trash/{**path}/restore` sets `IsDeleted = false` and `DeletedAt = null`; if the item is a folder, recursively restores children
- `DELETE /api/files/trash/{**path}` permanently removes the entity and all its `FileHistories` from the database
- Broadcasts appropriate SignalR events on restore (type `0` for recreated items)

**Frontend:**

- The `DeletedItems` component is opened from the topbar trash icon
- On open, calls `FileService.getDeletedFiles()` to populate the list
- Each item has a "Restore" button (calls `FileService.restoreDeletedFile(path)`) and a "Delete permanently" button (calls `FileService.permanentDeleteFile(path)`)
- An "Empty trash" button calls permanent delete on all items

---

### F16: Relative Fetch URLs

**Implementation:**

- All `fetch()` calls in `FileService` and `AuthService` use relative URLs: `/api/files`, `/api/login`, etc.
- No `http://localhost:XXXX` prefixes anywhere in the frontend code
- During development, the Angular proxy configuration routes `/api/*` to the backend
- In production, the Angular build is served from `wwwroot` by the same ASP.NET server, so relative URLs resolve naturally

---

### F17: npm run build Script

**Implementation:**

- A `package.json` exists at the repository root with a `build` script
- The build script performs three steps:
  1. `cd frontend/Docgit && npm install` — install Angular dependencies
  2. `cd frontend/Docgit && npx ng build --configuration production --output-path ../../backend/Docgit/wwwroot` — build and output directly to the backend's static files directory
  3. (No further steps needed — the ASP.NET server serves from `wwwroot`)
- The script uses cross-platform compatible commands (no bash-specific or PowerShell-specific syntax)
- The instructor can clone the repo, run `npm run build` at the root, then start the C# server and everything works

---

## 10. Build and Deployment Strategy

### Development Workflow

1. **Backend:** Run the ASP.NET project from `backend/Docgit/` using `dotnet run`. The API runs on `https://localhost:5275` (or configured port).
2. **Frontend:** Run the Angular dev server from `frontend/Docgit/` using `ng serve`. The dev server runs on `http://localhost:4200` with the proxy routing `/api/*` to the backend.
3. Both processes run simultaneously during development.

### Production / Submission Workflow

1. Run `npm run build` from the repository root
2. This builds the Angular app and copies the output into `backend/Docgit/wwwroot/`
3. Run `dotnet run` from `backend/Docgit/`
4. The ASP.NET server serves both the API and the Angular SPA from a single port
5. No external dependencies, no external databases, no external APIs — fully offline-capable

### Database Initialization

- On first run, `AppDbContext` calls `Database.EnsureCreated()` (or applies pending migrations) to create the SQLite database file
- The test user is seeded automatically
- The SQLite database file is stored locally (e.g., `docgit.db`) and is gitignored

### Cross-Platform Compatibility

- The build script uses `npx` and `npm` commands that work on Windows, Mac, and Linux
- No OS-specific path separators or shell commands
- The SQLite database file is created at runtime — no pre-existing database required
