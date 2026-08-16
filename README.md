# DocGit

A document management system with Git-inspired version history. Store, edit, and organize text files and folders in a hierarchical tree, with automatic per-save versioning and real-time sync across browser sessions.

**Live URL:** https://docgit-ddgpfhb9fccvfaej.swedencentral-01.azurewebsites.net/ // right now there is issues with azure free plan.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Setup & Running](#setup--running)
  - [1. Backend (ASP.NET Core API)](#1-backend-aspnet-core-api)
  - [2. Frontend (Angular)](#2-frontend-angular)
  - [3. CLI Client (.NET)](#3-cli-client-net)
  - [4. Tests (Node.js)](#4-tests-nodejs)
- [API Reference](#api-reference)
- [Real-Time Events (SignalR)](#real-time-events-signalr)
- [CLI Client Usage](#cli-client-usage)
- [Database Schema](#database-schema)
- [Supported File Types](#supported-file-types)

---

## Overview

DocGit treats your documents like source code. Every save creates a numbered version snapshot that you can browse and restore — similar to `git log` and `git checkout` for files. Files and folders are stored in a tree structure in a SQL database and exposed over a REST API. The Angular frontend provides a browser-based editor with Markdown preview, and a .NET CLI client lets you `push` and `pull` your local working directory to/from the server.

---

## Architecture

```
┌─────────────────────┐     HTTP/REST + SignalR     ┌──────────────────────────┐
│   Angular Frontend  │ ◄──────────────────────────► │  ASP.NET Core 9 API      │
│   (port 4200)       │                              │  (port 5000 / 5001)      │
└─────────────────────┘                              │                          │
                                                     │  ┌────────────────────┐  │
┌─────────────────────┐     HTTP/REST               │  │  SQL Server / EF   │  │
│   .NET CLI Client   │ ◄──────────────────────────► │  │  (ApplicationDb)   │  │
│   (Client.exe)      │                              │  └────────────────────┘  │
└─────────────────────┘                              └──────────────────────────┘
```

---

## Features

- **User accounts** — register and log in with username + password (BCrypt hashed), authenticated via JWT
- **File & folder tree** — hierarchical structure stored in a database, returned as a nested JSON tree
- **Rich editor** — textarea-based editor with undo/redo, heading shortcuts, bold/italic/code wrapping, bullet and numbered lists, and auto-resize
- **Markdown preview** — live `.md` preview panel powered by `marked`
- **Version history** — every `PUT` (save) of an existing file snapshots the previous content; versions are numbered and timestamped
- **Version restore** — select any past version from the history panel and restore it as the current content
- **Soft delete & trash** — deleted files/folders move to trash; trash items can be restored or permanently deleted
- **Real-time sync** — SignalR pushes file-tree change events to all connected clients instantly
- **File import/upload** — drag a local file into the editor or sidebar to upload it to the server
- **CLI push/pull** — sync an entire local directory with the server in one command

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | ASP.NET Core 9, Entity Framework Core |
| Authentication | JWT (HS256), BCrypt.Net-Next |
| Real-time | SignalR (`/eventhub`) |
| Database | SQL Server (configurable via EF Core) |
| Frontend | Angular 21, TypeScript 5.9, `@microsoft/signalr` |
| Markdown | `marked` v17 |
| SSR | `@angular/ssr` (Express) |
| CLI Client | .NET 9 console app |
| Tests | Node.js custom framework |

---

## Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9)
- [Node.js 20+](https://nodejs.org/) and npm 11+
- [Angular CLI 21](https://angular.dev/tools/cli) (`npm install -g @angular/cli`)
- SQL Server (local or remote) — or update the connection string to use SQLite/another EF-supported provider

---

## Project Structure

```
DocGit/
├── backend/
│   └── Docgit/
│       ├── Controllers/
│       │   ├── AuthController.cs      # POST /api/register, POST /api/login
│       │   └── FilesController.cs     # Full CRUD for files/folders + history
│       ├── Data/
│       │   └── ApplicationDbContext.cs
│       ├── Domain/
│       │   ├── User.cs
│       │   ├── FileSystemEntity.cs
│       │   └── FileHistory.cs
│       ├── Dto/                       # Request/response data transfer objects
│       ├── Hubs/
│       │   └── EventHub.cs            # SignalR hub for real-time events
│       ├── Migrations/                # EF Core migration files
│       ├── Service/
│       │   ├── JwtService.cs
│       │   ├── Fileservice.cs
│       │   └── FileHistoryService.cs
│       └── appsettings.json           # Connection string + JWT secret (configure here)
├── frontend/
│   └── Docgit/
│       ├── src/app/
│       │   ├── editor/                # Text editor component
│       │   ├── side-bar/              # File tree navigation
│       │   ├── account/               # Account/settings panel
│       │   ├── deleted-items/         # Trash view
│       │   ├── log-in/                # Login/register page
│       │   └── services/             # API + SignalR service layer
│       └── package.json
├── Client/
│   └── Program.cs                     # CLI: pull / push commands
└── tests/
    ├── run.js                         # Test runner
    └── tests/
        ├── v1-api-files-post.js
        ├── v1-api-login.js
        ├── v1-index-html.js
        ├── v2-signalr.js
        └── v3-client.js
```

---

## Setup & Running

### 1. Backend (ASP.NET Core API)

**Configure `appsettings.json`**

Open `backend/Docgit/appsettings.json` and add your connection string and JWT secret:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=DocGit;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Secret": "your-very-long-and-secure-secret-key-at-least-32-chars"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

**Apply EF Core migrations and run**

```bash
cd backend/Docgit

# Create the database and apply schema
dotnet ef database update

# Start the API server
dotnet run
```

The API starts on `http://localhost:5000` (HTTP) and `https://localhost:5001` (HTTPS) by default. Check `Properties/launchSettings.json` for the exact ports.

---

### 2. Frontend (Angular)

```bash
cd frontend/Docgit

# Install dependencies
npm install

# Start the dev server (proxies API calls to the backend)
npm start
```

The app is served at `http://localhost:4200`.

**Production build**

```bash
npm run build
```

Output goes to `dist/Docgit/`. For SSR:

```bash
npm run serve:ssr:Docgit
```

---

### 3. CLI Client (.NET)

```bash
cd Client
dotnet build
```

This produces `Client.exe` (Windows) or `Client` (Linux/macOS) in `bin/Debug/net9.0/`.

See [CLI Client Usage](#cli-client-usage) for commands.

---

### 4. Tests (Node.js)

The tests validate the API endpoints, SignalR events, and the CLI client behavior.

```bash
# From the repo root
npm install
npm test
```

To run tests targeting a specific backend URL:

```bash
npm test -- --url http://localhost:5000
```

To also run the CLI client tests, pass the path to the `Client.csproj` directory:

```bash
npm test -- --url http://localhost:5000 ./Client
```

---

## API Reference

All endpoints except `/api/register` and `/api/login` require a `Authorization: Bearer <token>` header.

### Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/register` | `{ userName, password, name, email }` | `200 OK` |
| POST | `/api/login` | `{ userName, password }` | `{ token }` |

### Files & Folders

| Method | Path | Description |
|---|---|---|
| GET | `/api/files` | Returns the full file tree as a nested JSON object |
| GET | `/api/files/{path}` | Returns file content or folder listing |
| HEAD | `/api/files/{path}` | Returns file metadata in response headers only |
| POST | `/api/files/{path}` | Create a file (with body) or folder (empty body, no extension) |
| POST | `/api/files/folders/{path}` | Create a folder explicitly |
| PUT | `/api/files/{path}` | Create or update (upsert) a file or folder |
| DELETE | `/api/files/{path}` | Soft-delete (moves to trash) |

### Trash

| Method | Path | Description |
|---|---|---|
| GET | `/api/files/trash` | List all trashed items |
| POST | `/api/files/trash/restore/{path}` | Restore a trashed item |
| DELETE | `/api/files/trash/{path}` | Permanently delete from trash |

### Version History

| Method | Path | Description |
|---|---|---|
| GET | `/api/files/history/{path}` | List all saved versions of a file |
| GET | `/api/files/history/{version}/{path}` | Get content of a specific version |
| HEAD | `/api/files/history/{version}/{path}` | Get version metadata headers |
| POST | `/api/files/history/restore/{version}/{path}` | Restore a file to a specific version |

**File metadata response headers** (on GET/HEAD for files):

| Header | Description |
|---|---|
| `X-Created-At` | Creation timestamp (`yyyy-MM-dd HH:mm:ss`) |
| `X-Changed-At` | Last update timestamp |
| `X-Type` | `file` or `folder` |
| `X-Bytes` | File size in bytes |
| `X-Extension` | File extension (e.g. `.md`) |

**File tree node structure** (from `GET /api/files`):

```json
{
  "folder-name": {
    "file": false,
    "created": "2026-01-01 12:00:00",
    "changed": "2026-01-01 12:00:00",
    "bytes": 0,
    "content": {
      "notes.md": {
        "file": true,
        "created": "2026-01-01 12:00:00",
        "changed": "2026-01-01 12:00:00",
        "bytes": 1024,
        "extension": ".md"
      }
    }
  }
}
```

---

## Real-Time Events (SignalR)

Connect to the hub at `/eventhub`. After connecting, the server adds you to a broadcast group and you will receive `Event` messages when any file operation occurs.

**Event type codes:**

| Code | Meaning |
|---|---|
| `0` | File created |
| `1` | File updated |
| `2` | File deleted (soft) |
| `5` | Folder created |
| `7` | Folder deleted (soft) |

**Hub methods (callable from client):**

| Method | Arguments | Description |
|---|---|---|
| `JoinGroup` | `groupName: string` | Join an arbitrary group |
| `LeaveGroup` | `groupName: string` | Leave a group |
| `JoinDocumentGroup` | `documentPath: string` | Join the group for a specific document path |
| `LeaveDocumentGroup` | `documentPath: string` | Leave a document group |

---

## CLI Client Usage

The CLI client syncs your local working directory with the server.

```
Client <command> <baseUrl> [username] [password]
```

| Command | Description |
|---|---|
| `pull` | Downloads the entire file tree from the server into the current directory, replacing all local files |
| `push` | Uploads all local files and folders to the server, deleting server-side entries that no longer exist locally |

**Examples**

```bash
# Pull without authentication (public server)
Client pull http://localhost:5000

# Pull with authentication
Client pull http://localhost:5000 myuser mypassword

# Push local files to the server
Client push http://localhost:5000 myuser mypassword
```

> **Warning:** `pull` clears your working directory before downloading. `push` deletes server files that are absent locally. Both are destructive — make sure you are in the right directory before running them.

The client automatically prepends `http://` for `localhost`/`127.0.0.1` addresses and `https://` for all other hosts.

---

## Database Schema

Three tables managed by Entity Framework Core:

**Users**

| Column | Type | Notes |
|---|---|---|
| `Id` | int PK | Auto-increment |
| `UserName` | string | Unique index |
| `Name` | string | Display name |
| `Email` | string | |
| `PasswordHash` | string | BCrypt hash |
| `CreatedAt` | DateTime | |
| `UpdatedAt` | DateTime | |
| `IsDeleted` | bool | Soft-delete flag |

**FileSystemEntities**

| Column | Type | Notes |
|---|---|---|
| `Id` | int PK | Auto-increment |
| `UserID` | int FK → Users | Cascade delete |
| `ParentId` | int? FK → self | `NULL` = root item |
| `Name` | string | File or folder name |
| `Path` | string | Full slash-separated path, unique per user |
| `IsFile` | bool | `true` = file, `false` = folder |
| `Content` | byte[]? | File content as raw bytes |
| `Extintion` | string? | File extension (e.g. `.md`) |
| `Bytes` | long | Content size |
| `CreatedAt` | DateTime | |
| `UpdatedAt` | DateTime | |
| `DeletedAt` | DateTime? | Set on soft delete |
| `IsDeleted` | bool | Soft-delete flag |

**FileHistories**

| Column | Type | Notes |
|---|---|---|
| `Id` | int PK | Auto-increment |
| `FileEntityId` | int FK → FileSystemEntities | Cascade delete |
| `VersionNumber` | int | Increments per file |
| `Content` | byte[]? | Snapshot of file content |
| `Bytes` | long | Snapshot size |
| `SavedAt` | DateTime | When this version was saved |

---

## Supported File Types

The editor and import/upload dialogs accept:

`.md` `.txt` `.html` `.htm` `.css` `.js` `.ts` `.json` `.xml` `.csv` `.yaml` `.yml`

Files with unrecognized extensions are served as `application/octet-stream`.
