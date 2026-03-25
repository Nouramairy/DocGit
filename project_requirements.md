# Project Documentation: ASP.NET File Management System

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Program Specification](#2-program-specification)
3. [REST API — File Endpoints](#3-rest-api--file-endpoints)
4. [Website / Client](#4-website--client)
5. [Users and Authentication (JWT)](#5-users-and-authentication-jwt)
6. [SignalR Real-Time Events](#6-signalr-real-time-events)
7. [File History](#7-file-history)
8. [Tips and Implementation Guidance](#8-tips-and-implementation-guidance)
9. [Grading Criteria](#9-grading-criteria)

---

## 1. Project Overview

**Source:** `Nour_Amairy_19-03_project_assignment_.pdf`

This is a multi-week assignment for the course **Web Applications in C#, ASP.NET** (`.NET25_WEAPP`). The fictional scenario is that "Kalle Anka AB" (Donald Duck Inc.) has done market research and decided to build a new platform that combines the visual layout of GitHub with the version-control simplicity of Google Docs. The idea is a website where users can manage project files and folders, view file contents, and have real-time synchronization — all without the complexity of Git commits and terminal commands.

The assignment is divided into phases:

- **Week 1:** Website + REST API for files
- **Week 2:** WebSockets / SignalR for real-time syncing
- **Week 3:** Entity Framework SQLite database + file history
- **Future:** A standalone terminal client for direct file/folder syncing (like Git but real-time)

The assignment can be done individually or in a group, but **group work adds additional requirements** such as JWT authentication, folder support, and stricter real-time syncing expectations.

**Deadline:** 8 April 23:59

---

## 2. Program Specification

**Source:** `Nour_Amairy_19-03_project_assignment_.pdf`

The goal is described as **"Google Docs + GitHub"**:

- A website that visually resembles GitHub (file/folder listing, clicking on files to view them)
- Version control modeled after Google Docs (automatic history tracking, no manual commits)
- A folder (or repo/project) with files and potential subfolders
- When a user clicks on a file, it should be displayed (similar to how GitHub renders file contents)

> **Note:** This does not need to be an exact clone of GitHub in style or layout. The actual detailed requirements are defined in the project's markdown instruction files.

---

## 3. REST API — File Endpoints

**Source:** `Files_APIet.md`

The API must be a complete, functioning REST API for file management. All files are served under the base path `/api/files`. Below is a full description of each endpoint.

### GET /api/files

Returns **all** files as a single JSON object (not an array). Each key is a filename (or folder name for group projects). The value is an object with metadata — no file content is included.

**Response format (individual work — files only):**

```json
{
    "README.md": {
        "created": "2026-03-13 20:03:20",
        "changed": "2026-03-13 20:03:20",
        "file": true,
        "bytes": 59,
        "extension": ".md"
    },
    "test.txt": {
        "created": "2026-03-13 20:03:20",
        "changed": "2026-03-13 20:03:20",
        "file": true,
        "bytes": 124,
        "extension": ".txt"
    }
}
```

**Response format (group work — with folder support):**

Folders are represented with `"file": false` and include a nested `"content"` object containing the folder's children. Folders do **not** have an `"extension"` field.

```json
{
    "README.md": {
        "created": "2026-03-13 20:03:20",
        "changed": "2026-03-13 20:03:20",
        "file": true,
        "bytes": 59,
        "extension": ".md"
    },
    "mapp 1": {
        "created": "2026-03-13 20:03:20",
        "changed": "2026-03-13 20:03:20",
        "file": false,
        "bytes": 44533,
        "content": {
            "random.txt": { ... },
            "nvarchar.jpeg": { ... }
        }
    }
}
```

### GET /api/files/{path}

Returns the **content** of a specific file. The path after `/api/files/` is the filename or, for group projects with folders, the full path (e.g., `/api/files/mapp 1/nvarchar.jpeg`).

Folder nesting can be unlimited — `/api/files/a/b/c/d/e/f/g/hello.txt` is a valid path, just like on a real filesystem.

### HEAD /api/files/{path}

Identical to `GET` but returns **no body**. Both `GET` and `HEAD` return metadata in response headers. This allows clients to retrieve file information (size, dates) without downloading the full content — critical for large files.

**Required response headers:**

| Header | Example Value |
|--------|---------------|
| `X-Created-At` | `2026-03-13 20:03:20` |
| `X-Changed-At` | `2026-03-13 20:03:20` |
| `X-Type` | `file` |
| `X-Bytes` | `59` |
| `X-Extension` | `.md` |

### POST /api/files/{path}

Creates a new file at the specified path. The file content comes from the request body.

- If the file **does not exist**: create it and return success.
- If the file **already exists**: return status **409 Conflict**.

For group projects with folders: `/api/files/foldername/example.txt` creates the file inside the given folder.

### PUT /api/files/{path}

Same as `POST`, but if the file already exists, it is **replaced** with the new version.

> **Important:** Every `PUT` call that replaces an existing file must trigger a history save (see [Section 7](#7-file-history)).

### DELETE /api/files/{path}

Deletes the specified file. If the file does not exist, status **200** should still be returned.

---

## 4. Website / Client

**Source:** `Webbsida.md`

### Core Requirements (All Students)

- The page must display a view of all files
- Files must be fetched via the API using `fetch`
- Upload and deletion of files must work (also via `fetch`)
- File preview and editing is a **bonus**, not a requirement
- **Everything shown on the page must be functional** — do not add buttons or links that do nothing

### Additional Requirements for Group Work

- A login dialog (any format) where the user enters username and password
- Login **must** use JWTs (see [Section 5](#5-users-and-authentication-jwt))
- Full folder support in the UI:
  - Create folders
  - Create subfolders
  - Add and remove files from folders
  - Delete folders

### Technology Choice

Any frontend technology is allowed:

- Plain HTML, CSS, and JavaScript
- TypeScript
- React, Angular, Vue, or other frameworks
- Blazor (C#-based, will be covered later in the course)

**Critical build requirement:** If a framework is used, there must be a build script in the root `package.json` under `npm run build` that:

1. Installs dependencies
2. Builds the framework
3. Copies the built output into `wwwroot` (or the equivalent static files directory)

The instructor (Oscar) must be able to clone the repo, run `npm run build`, and start the C# server without any further steps. The build script must work on **Windows, Mac, and Linux** — avoid OS-specific terminal commands.

### Relative URLs Are Mandatory

All `fetch` calls must use **relative URLs**:

```js
// CORRECT
const allFiles = fetch("/api/files");

// WRONG — will break on real hardware / deployment
const allFiles = fetch("http://localhost:3000/api/files");
```

Hard-coded URLs will result in 404 errors or CORS issues when deployed, and **the assignment will be rejected** until this is fixed.

> **Framework note:** If using a frontend framework's dev server, you'll need to configure its reverse proxy so that `/api/files` routes to the C# backend (e.g., `http://localhost:5275/api/files`).

---

## 5. Users and Authentication (JWT)

**Source:** `Inloggning.md`

> **Note:** JWT authentication is **required only for group projects**. Individual students may add it optionally.

### Requirements

- All `/api/files` endpoints must require authentication
- Files returned must **belong to the logged-in user** — two different users should see completely different files
- Even if two users create a file with the same path, they get two completely separate files

### Login Endpoint

**POST /api/login**

```json
{
    "user": "test-user",
    "password": "So Long, and Thanks for All the Fish"
}
```

The test user above **must** exist in the system, as the NPM tests use it.

User information is extracted from the JWT's claims on the C# server side.

### Client-Side Token Storage

It is recommended (but not required) to store the JWT on the client side (e.g., in `localStorage`) so the user doesn't have to log in again on every page reload.

---

## 6. SignalR Real-Time Events

**Source:** `signalR_and_history_requirements.txt`, `assignment_11.pdf`

### Hub Configuration

A SignalR hub must be registered at `/api/events/signalr`.

The hub does not need to contain any methods, but it may optionally accept client data (e.g., which document a client has open, cursor position — for Google Docs-like collaboration effects).

### Required Behavior

Whenever the REST API processes a `POST`, `PUT`, or `DELETE` request, the server must send an event to **all** connected SignalR clients.

Events are sent to the method **`"Event"`** with two arguments:

1. **Type** (integer) — the kind of change
2. **File path** (string) — the path of the affected file/folder

### Event Type Values

| Integer | Meaning |
|---------|---------|
| 0 | A file has been created |
| 1 | A file has been updated |
| 2 | A file has been deleted |
| 5 | A folder has been created (group/folder support only) |
| 7 | A folder has been deleted (group/folder support only) |

> **Important:** If a `PUT` creates a file that did not previously exist, the event type should be **0** (created), not 1 (updated). Type 1 is only used when the file already existed.

> **Tip:** A C# enum with specific integer values is very convenient for this.

### File Path Argument

The file path string must exactly match the path used in the API call. Examples:

| API Call | Event Path String |
|----------|-------------------|
| `/api/files/example.txt` | `"example.txt"` |
| `/api/files/test.xml` | `"test.xml"` |
| `/api/files/a/b/c/d/hello.md` | `"a/b/c/d/hello.md"` |

### Example Scenario

1. A client sends `POST /api/files/example.txt`
2. The server creates the file
3. The server sends a SignalR event to method `"Event"` with arguments: `0` (file created) and `"example.txt"`
4. All connected clients receive this event and can update their UI

### Additional Group Requirements

- The SignalR hub must be protected by the same JWT authentication used by the API

---

## 7. File History

**Source:** `signalR_and_history_requirements.txt`, `assignment_11.pdf`

### Core Requirements (All Students)

1. **Viewable history via the web page:** Users must be able to browse older versions of a file and navigate forward again through the interface. The old version does not need to be applied/restored (unless working in a group), but it must be possible to **view** the old version.

2. **History triggered on PUT:** Every time a `PUT` is made to `/api/files/...`, the old version of the file must be saved **before** it is replaced with the new content.

3. **Entity Framework SQLite database:** All history must be stored in an Entity Framework-driven SQLite database. This can be done by saving full file content in the database, or by storing paths to files on disk — any approach is acceptable.

### UI Format

There are no strict requirements for the UI format. Acceptable approaches include:

- **Ctrl+Z / Ctrl+Y** to navigate back and forward (if a full editor is implemented)
- **Left/right arrows** in the interface for mouse-based navigation
- **Google Docs-style** version history panel
- **ZBrush-style** progress bar showing all versions
- **Git-style** diff view

### Implementation Tips

**Simple approach:** Save a clean copy of the file content in a history table column, with another column for the version number (starting at 1, then 2, 3, etc. for the same file). This makes it easy to retrieve sorted history for any specific file.

**Advanced approach (for high achievers):** Use the [LCS (Longest Common Subsequence) algorithm](https://en.wikipedia.org/wiki/Longest_common_subsequence) to calculate differences between two text versions at `PUT` time. This way, only the diff is saved in the database, which uses less space and naturally produces Git-style diff data.

It is also acceptable to create an additional endpoint (via the API or SignalR) where a clean diff is sent from the client, so a full `PUT` doesn't need to be performed every time — as long as the original `PUT`-based approach still works via tools like Postman.

### Additional Group Requirements

1. **Deleted file recovery:** Files deleted via `DELETE` must be saved in a "deleted files" list and be recoverable, including their individual version history.

2. **Restore version button:** A "restore this version" button must exist in the interface that restores the document to the version currently being viewed.

---

## 8. Tips and Implementation Guidance

**Source:** `Nour_Amairy_19-03_project_assignment__tips.pdf`

### Suppress Null Values in JSON Serialization

Configure the JSON serializer to exclude `null` properties entirely instead of including them as `null`:

```csharp
using System.Text.Json.Serialization;

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});
```

### [JsonIgnore] Attribute

Use `[JsonIgnore]` to prevent specific properties from being serialized:

```csharp
public class SomeData
{
    public string SomeValue { get; set; }
    [JsonIgnore] public string SomeIgnoredValue { get; set; }
}
```

### [JsonPropertyName] Attribute

Use `[JsonPropertyName]` to control the JSON key name:

```csharp
public class SomeData
{
    [JsonPropertyName("example")]
    public string SomeValue { get; set; }
}
// Output: { "example": "..." }
```

### Custom Getter for Serialization Control

Combine `[JsonIgnore]` and `[JsonPropertyName]` on a computed property to control formatting:

```csharp
[JsonIgnore] public DateTime SomeDate { get; set; }
[JsonPropertyName("SomeDate")] public string JsonSomeDate => SomeDate.ToString("yyyy-MM-dd HH:mm:ss");
```

### Dedicated JSON DTO Class

For complex objects, create a separate class used only for JSON responses. This keeps your domain model clean and guarantees consistency between JSON output and response headers:

```csharp
public class FileSystemEntity
{
    // Domain properties and methods...

    public FileSystemEntityJson ToJson()
    {
        var bytes = GetSize();
        return new FileSystemEntityJson()
        {
            Created = Created.ToString(),
            Changed = Changed.ToString(),
            File = IsFile,
            Bytes = bytes,
            Extension = IsFile ? Path.GetExtension(Name) : null,
            Content = DirectoryContent?.ToDictionary(x => x.Key, x => x.Value.ToJson())
        };
    }
}
```

### Returning File Data with Results.File()

Use `Results.File()` to return binary file content with the correct MIME type:

```csharp
return Results.File(fileBytes, fileContentType);
```

To automatically determine the MIME type from a file extension:

```csharp
var extensions = new FileExtensionContentTypeProvider();
extensions.TryGetContentType("example.txt", out var contentType);
// contentType = "text/plain"
```

### UTF-8 Charset in Content-Type

Always add `; charset=UTF-8` to text-based Content-Types to ensure special characters (like Swedish åäö) display correctly:

```
text/plain; charset=UTF-8
application/json; charset=UTF-8
text/markdown; charset=UTF-8
```

### Catch-All Route Parameters

Use `{**name}` to capture the entire remaining path as a single parameter — essential for folder-based file paths:

```csharp
app.MapGet("/example/{**path}", (string path) =>
{
    Console.WriteLine(path);
    // For URL /example/this/is/an/example
    // path = "this/is/an/example"
});
```

This also works with a body parameter:

```csharp
app.MapPost("/example/{**path}", (string path, SomeBodyDto body) =>
{
    // Use both path and body
});
```

### Mapping HEAD Requests

There is no `MapHead` shorthand — use `MapMethods` instead:

```csharp
app.MapMethods("/some/path", ["HEAD"], () =>
{
    // Handle HEAD request
});
```

### Request Body Size Limits

The default Kestrel limit is 30 MB, which is too small for file uploads. Increase it globally:

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 1_000_000_000; // 1 GB
});
```

Or per-endpoint (requires `using Microsoft.AspNetCore.Mvc`):

```csharp
app.MapPost("/upload", async (HttpRequest request) =>
{
    // ...
}).WithMetadata(new RequestSizeLimitAttribute(1_000_000_000));
```

---

## 9. Grading Criteria

**Source:** `Nour_Amairy_19-03_project_assignment_.pdf`

### Criteria for G (Pass)

The assignment covers two syllabus points:

- Developing web applications through ASP.NET
- Calling Web APIs from and developing your own with .NET

To pass, the program specification from the project's markdown files must be met. Additionally:

1. **No compile warnings** when building C# projects — no yellow warnings, no red errors; the project should build cleanly.

2. **The program must start immediately** without configuration, an existing database, or a running web framework dev server. This is easiest with SQLite and plain JS (or Blazor).
   - If setup is required, it must be handled entirely via `npm run build` in the root `package.json`.
   - Oscar must be able to clone the repo → run `npm run build` → start the C# server with no further steps.
   - The build script must work on **Windows, Mac, and Linux**.
   - Multiple `package.json` files in the project are fine (e.g., separate `client/` and `server/` folders).

3. **No external resources** — no external APIs, no externally hosted databases, no images from the web. Everything must be in the repo so the application works offline.

### Criteria for VG (Pass with Distinction)

One additional syllabus point is assessed:

> *"The student also takes a good architecture in the application that makes it both easy to maintain and safer to use."*

This involves an overall code quality assessment based on:

- **Thread safety**
- **Correct use of CancellationTokens**
- **Polymorphism or generic solutions** used when necessary to avoid duplication (not used for its own sake)
- **Safe handling of potential null values**

---

## Summary of Requirements by Work Mode

| Feature | Individual | Group |
|---------|-----------|-------|
| REST API (GET, POST, PUT, DELETE, HEAD) | ✅ Required | ✅ Required |
| Folder support in API | ❌ Optional | ✅ Required |
| Website showing files | ✅ Required | ✅ Required |
| File upload/delete via UI | ✅ Required | ✅ Required |
| JWT authentication | ❌ Optional | ✅ Required |
| Login dialog on website | ❌ Optional | ✅ Required |
| Per-user file isolation | ❌ Optional | ✅ Required |
| Folder UI (create/delete/navigate) | ❌ Optional | ✅ Required |
| SignalR hub at `/api/events/signalr` | ✅ Required | ✅ Required |
| SignalR events on POST/PUT/DELETE | ✅ Required | ✅ Required |
| SignalR JWT protection | ❌ Optional | ✅ Required |
| File history (EF + SQLite) | ✅ Required | ✅ Required |
| View old versions in UI | ✅ Required | ✅ Required |
| Restore old version button | ❌ Optional | ✅ Required |
| Deleted file recovery | ❌ Optional | ✅ Required |
| Relative fetch URLs | ✅ Required | ✅ Required |
| `npm run build` script (if framework used) | ✅ Required | ✅ Required |
| No compile warnings | ✅ Required | ✅ Required |
| Offline-capable (no external resources) | ✅ Required | ✅ Required |

---

## Source Document Reference

| Document | Language | Contents |
|----------|----------|----------|
| `Nour_Amairy_19-03_project_assignment_.pdf` | English | Main assignment description, grading criteria, program specification |
| `Nour_Amairy_19-03_project_assignment__tips.pdf` | English | Implementation tips (JSON serialization, routing, file handling, body size limits) |
| `assignment_11.pdf` | English | Week 3 extension — SignalR and History requirements overview |
| `Files_APIet.md` | Swedish | Complete REST API specification with endpoint details and response formats |
| `Inloggning.md` | Swedish | JWT authentication requirements and login endpoint specification |
| `signalR_and_history_requirements.txt` | English (translated from Swedish) | Detailed SignalR event system and file history requirements |
| `Webbsida.md` | Swedish | Website/client requirements, technology choices, and URL rules |