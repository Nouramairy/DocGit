---
tags: [docgit, domain, dto, classes]
---

# 06 — Domains, DTOs, and All the Classes

> Related notes: [[05-DbContext]] · [[04-Single-Responsibility-Principle]] · [[07-ICollection]]

## 1. Domain vs. DTO — the core distinction

This is one of the most important architectural ideas in any layered backend, and DocGit's folder structure makes the split physically visible: `Domain/` vs `Dto/`.

| | **Domain entity** (`Domain/`) | **DTO** (`Dto/`) |
|---|---|---|
| Purpose | Mirrors a database table. Owned by EF Core. | Mirrors a JSON shape going over HTTP. Owned by the API contract. |
| Changes when... | The database schema changes | The public API request/response shape changes |
| Contains | Every column, including internal-only ones (`BlobName`, `PasswordHash`, `IsDeleted`) | Only what the client actually needs to see/send |
| Relationships | Has navigation properties (`ICollection<FileHistory>`, `FileSystemEntity? Parent`) | Flat — no navigation properties, no cycles |

**Why not just return the entity directly from the API?** Two concrete reasons visible in this codebase:

1. **Leaking internal fields.** If `GET /api/files/history/{path}` returned `FileHistory` entities directly, the JSON would include `BlobName` (an internal Azure Blob Storage path — an implementation detail that could even be a minor information disclosure) and `FileEntityId` (meaningless to a client who already knows the file's path). Instead, `FileHistroyDto` exposes exactly three fields: `Version`, `SavedAt`, `Bytes`.
2. **Avoiding infinite loops when serializing.** `FileSystemEntity.Parent` points to another `FileSystemEntity`, which has `Children` pointing back — a **circular reference**. Serializing that directly to JSON without care would either throw (`System.Text.Json` detects cycles by default and throws `JsonException`) or, if cycle-handling were configured differently, blow up into an enormous/infinite payload. DTOs sidestep this entirely by only including primitive fields, never a direct entity-to-entity reference.

## 2. Every Domain class

### `User.cs`
```csharp
public class User
{
    public string Name { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty; // unique key
    public int Id { get; set; } // PK
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
}
```
- `Id` is the primary key **by convention** — EF Core recognizes a property literally named `Id` (or `<ClassName>Id`) as the PK automatically, no attribute needed.
- `PasswordHash`, never `Password` — the plaintext password is never persisted anywhere, only the BCrypt hash (see [[11-Extra-Topics]]).
- `UserName` has a unique index enforced in `OnModelCreating` (see [[05-DbContext]]).
- `= string.Empty` default initializers, combined with `<Nullable>enable</Nullable>` in the `.csproj`, mean the compiler enforces that these `string` properties are never `null` by design — you either set them explicitly or they default to `""`, but never `null`, avoiding a whole class of `NullReferenceException`s.

### `FileSystemEntity.cs`
```csharp
public class FileSystemEntity
{
    public string Name { get; set; } = string.Empty;
    public int Id { get; set; }
    public int? ParentId { get; set; }          // nullable: null = root item
    public int UserID { get; set; }
    public User? User { get; set; } = null;      // navigation property
    public string Path { get; set; } = string.Empty;
    public bool IsFile { get; set; }
    public byte[]? Content { get; set; }         // legacy inline storage
    public string? BlobName { get; set; }        // pointer into Azure Blob Storage
    public string? Extintion { get; set; } = string.Empty;
    public FileSystemEntity? Parent { get; set; }
    public long Bytes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public bool IsDeleted { get; set; }
    public ICollection<FileSystemEntity> Children { get; set; } = new List<FileSystemEntity>();
    public ICollection<FileHistory> FileHistories { get; set; } = new List<FileHistory>();
    public string Directory { get; set; } = string.Empty;
}
```
This is the busiest class in the project — it represents **both files and folders** in a single table (a design called "single table inheritance" or, more simply here, just "one shape used for two kinds of things, disambiguated by the `IsFile` flag"). Notable details:
- `int? ParentId` — nullable `int`. `null` specifically means "top-level, no parent folder". This nullability is meaningful, not accidental.
- `User? User` and `FileSystemEntity? Parent` are **navigation properties** — not columns in the database themselves, but EF Core's way of letting you write `entity.User.Name` in C# instead of manually joining. The *actual* foreign key columns are `UserID` and `ParentId`.
- `Children` and `FileHistories` are `ICollection<T>` navigation properties for the "many" side of one-to-many relationships — covered in depth in [[07-ICollection]].
- `Extintion` (misspelling of "Extension" — kept as-is in the real codebase; the code comment even says `// need to fix`) and `Directory` (declared but not used anywhere in the current logic — `Path` does that job instead) are both worth being able to point out if asked "is everything in this class actually necessary?" — a good, honest interview answer acknowledges real code has rough edges like unused fields and typoed names that would be cleaned up given time.
- `Bytes` is `long`, not `int` — deliberate, since file sizes can exceed ~2GB (the max `int` can represent), and `Program.cs` explicitly configures Kestrel to accept up to a 1GB request body (`MaxRequestBodySize = 1_073_741_824`), so file sizes in this system are expected to potentially be large.

### `FileHistory.cs`
```csharp
public class FileHistory
{
    public int Id { get; set; }
    public int FileEntityId { get; set; }
    public FileSystemEntity FileEntity { get; set; } = null!;
    public int VersionNumber { get; set; }
    public byte[]? Content { get; set; }
    public string? BlobName { get; set; }
    public long Bytes { get; set; }
    public DateTime SavedAt { get; set; }
}
```
One row = one historical snapshot of one file. `FileEntity = null!` uses the **null-forgiving operator** (`!`) — it tells the compiler "trust me, this will never actually be null at runtime" (EF Core populates it when you `.Include()` it, or when loading the entity that owns this row) even though the property itself isn't declared nullable. This is a common, accepted EF Core convention for required navigation properties, since EF Core itself — not your own constructor — is what ultimately assigns it.

### `Setting.cs`
```csharp
public class Setting
{
    public string Key { get; set; } = string.Empty;
    public string Id { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
}
```
This class exists in `Domain/` but is **not** registered as a `DbSet` in `ApplicationDbContext`, has no migration, and nothing in the codebase references it. It's a placeholder/future-feature stub — worth recognizing as "planned but not wired up yet" rather than assuming it's actively used. A good habit: before trusting that a class matters, check whether it's actually reachable from `DbContext`/`Program.cs`/a controller.

## 3. Every DTO class

### `RegisterDto.cs`
```csharp
public class RegisterDto
{
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
```
The shape of the JSON body for `POST /api/register`. Notice it has `Password` (plaintext, in transit only, over HTTPS in production) — this is fine for a DTO representing an *incoming* request, since the whole point of this DTO's existence is to receive the plaintext password so the server can hash it; it's only wrong if plaintext ever gets *persisted* or *returned*, which it never does here.

### `LogInReqDto.cs`
```csharp
public class LogInReqDto
{
    [JsonPropertyName("user")]
    public string User { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
```
This DTO deliberately supports **two different JSON shapes** at once: the Angular frontend sends `{ "userName": "...", "password": "..." }`, while the CLI client (`Client/Program.cs`) sends `{ "user": "...", "password": "..." }`. `[JsonPropertyName("user")]` tells `System.Text.Json` to bind the JSON key `"user"` to the C# property `User` (by default it would expect a JSON key matching the property name, case-insensitively — `"user"` would already match `User` case-insensitively, so this attribute is actually slightly redundant here, but explicit about the intent). `AuthController.Login` then picks whichever one was actually populated:
```csharp
var username = string.IsNullOrWhiteSpace(request.UserName) ? request.User : request.UserName;
```
This is a pragmatic compatibility shim rather than "correct" API design (a cleaner design would pick one field name and have both clients conform to it) — but it's a realistic pattern you'll see in real APIs that evolved organically with multiple client types.

### `LogInResponseDto.cs`
```csharp
public class LogInResponseDto { public string Token { get; set; } = string.Empty; }
```
The entire response body of a successful login: `{ "token": "eyJhbGc..." }`.

### `FileHistroyDto.cs`
```csharp
public class FileHistroyDto
{
    public int Version { get; set; }
    public string SavedAt { get; set; } = string.Empty;
    public long Bytes { get; set; }
}
```
(Note the class name itself has the same "History" → "Histroy" typo as the file name — again, real code, not a typo you introduced.) Maps 1:1 to the frontend's `FileHistoryEntryDto` interface in `doc-api.service.ts` — deliberately kept in sync by hand between C# and TypeScript, since there's no shared schema/codegen step in this project (a common, reasonable manual-sync approach for small projects; larger ones often generate one side from the other, e.g. from an OpenAPI/Swagger spec).

### `TrashIteamDto.cs`
```csharp
public class TrashIteamDto
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public bool IsFile { get; set; }
    public string? DeletedAt { get; set; }
}
```
(Yes — "Iteam" instead of "Item", another real typo preserved from the actual file/class name.) Built via LINQ projection directly inside a query in `Fileservice.GetTrashAsync`:
```csharp
.Select(entity => new TrashIteamDto { Name = entity.Name, Path = entity.Path, ... })
```
This `.Select()` projection is itself worth noting: EF Core translates it so that **only the four needed columns** are fetched from SQL Server (`SELECT Name, Path, IsFile, DeletedAt FROM ...`), not the entire row — projecting straight to a DTO inside the query is both a correctness pattern (shape control) and a performance pattern (less data over the wire) at the same time.

## 4. The parallel TypeScript side (for completeness)

`doc-api.service.ts` defines matching TypeScript interfaces — `ApiTreeNode`, `DocFile`, `TrashItemDto`, `FileHistoryEntryDto` — which are the frontend's equivalent of DTOs: plain shape descriptions with no behaviour, describing exactly what JSON the API sends/expects. `DocFile` is interesting because it's **not** a 1:1 mirror of anything backend — it's the frontend's own richer, UI-oriented shape (adds `children: DocFile[]`, converts date strings to real `Date` objects, tracks `content` only when loaded) built by transforming the raw `ApiTreeNode` tree (see `treeToDocFiles` in [[08-Backend-Frontend-Connection]]). This is a good example of "DTO on the wire" vs. "view model in the app" being two different, legitimately different shapes even on the same side of the network boundary.

## 5. Quick rule of thumb to carry forward

> If a class only exists to describe what JSON looks like at an API boundary and has no relationships/navigation properties → it's a DTO.
> If a class is registered in a `DbContext` (or clearly modeled to be) and has relationships to other entities → it's a Domain entity.
> Never let one do the other's job — it's the concrete embodiment of [[04-Single-Responsibility-Principle]] applied to data shapes specifically.
