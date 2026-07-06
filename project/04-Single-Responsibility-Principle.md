---
tags: [docgit, solid, srp, design]
---

# 04 — The Single Responsibility Principle ("The Single R")

> Related notes: [[10-Services-And-DI]] · [[06-Domains-DTOs-Classes]]

## 1. What SRP actually says

The **Single Responsibility Principle** is the "S" in **SOLID** (five well-known object-oriented design principles). Its precise statement, from Robert C. Martin: *"A class should have only one reason to change."*

The word "responsibility" is often misread as "does one small thing" (e.g. "a method should be 5 lines"). That's not quite it. The real test is: **who or what would ask you to change this class?** If a class could be modified for two unrelated reasons — say, "the database schema changed" *and* "the JSON format we return to clients changed" — it has two responsibilities, and changes for one reason risk breaking the other unrelated concern.

## 2. Where DocGit follows SRP well

### The service layer split: `Fileservice`, `FileHistoryService`, `BlobService`, `JwtService`

This is the clearest, most deliberate example in the whole codebase. Instead of one giant `FileService` doing everything, the backend splits file-related logic into three separate classes, each with a distinct reason to change:

| Class | Responsibility | Reason it would change |
|---|---|---|
| `Fileservice` | Tree structure, CRUD, soft-delete/trash logic | "We need a new way to organize/query the file tree" |
| `FileHistoryService` | Versioning: saving/reading historical snapshots | "We need to change how version history works (e.g. limit to last 50 versions)" |
| `BlobService` | Talking to Azure Blob Storage specifically | "We're switching from Azure Blob to AWS S3" |
| `JwtService` | Authenticating users & minting tokens | "We're changing from JWT to session cookies, or changing token expiry rules" |

Notice how clean the dependency direction is: `Fileservice` *depends on* `FileHistoryService` and `BlobService` (constructor injection — see [[10-Services-And-DI]]), but `BlobService` knows nothing about files, folders, users, or the database at all — it only knows "upload these bytes under this name" / "download bytes for this name" / "delete this name". You could lift `BlobService` out and drop it into a completely different project unmodified. That portability is the practical payoff of SRP.

Compare: if `Fileservice` directly contained Azure SDK calls (`BlobContainerClient`, `UploadAsync`, etc.) inline, then switching cloud providers, changing container naming, or unit-testing the tree logic without a real Azure connection would all become painful and tangled together.

### `FilesController` delegates instead of doing the work itself

Look at how thin `FilesController.UpdateFile` actually is — it reads bytes off the request, calls `_fileService.UpsertFileAsync(...)`, and fires a SignalR event. It contains **zero** database queries, **zero** Azure SDK calls. Its one responsibility is *translating HTTP into a service call, and a service result back into an HTTP response* — nothing more. That's a controller doing its one job (the "web" concern) and delegating the "what actually happens" concern (the "business logic") to services. If you had to change how files are stored in the database, you'd never need to touch `FilesController` at all — only `Fileservice`.

### DTOs vs. Domain entities (also see [[06-Domains-DTOs-Classes]])

`FileHistroyDto` exists purely so the JSON returned from `GET /api/files/history/{path}` can look different from the `FileHistory` database entity (no `BlobName`, no `FileEntityId`, no `Content` — the client doesn't need or shouldn't see those). This is SRP applied to *data shapes*: the entity's reason to change is "the database schema changed"; the DTO's reason to change is "the public API contract changed". Those are genuinely different concerns, and conflating them (returning entities directly from your API) means a harmless internal refactor (e.g. renaming a database column) can silently break every client consuming your API.

## 3. Where DocGit *doesn't* fully follow SRP (worth noticing for an interview)

Being honest about this is more useful than pretending the codebase is perfect — recognizing violations is exactly the skill an interviewer is testing for.

- **`Fileservice` is doing a lot.** It handles tree-building, CRUD, soft-delete-with-recursion, trash-restore-with-recursion, *and* orchestrates calls into `BlobService`/`FileHistoryService`. Arguably `BuildNestTree` (pure tree-shaping logic) could be its own `FileTreeBuilder` class, and the soft-delete/restore recursion could be its own `TrashService`. It's not *wrong* as-is (everything in it is still "about files"), but it's a good example of a class that's grown past a single, sharply-defined responsibility as features were added over time — a very common, very realistic trajectory for any growing codebase.
- **`AuthController` talks to `_db` directly** (checking `UserName`/`Email` uniqueness) instead of delegating entirely to a service, while `FilesController` never touches `_db` directly. That's an inconsistency between the two controllers — one follows "controllers only orchestrate, services own data access", the other doesn't quite.
- **`FileSystemEntity` (the domain entity) still carries the legacy `byte[]? Content` field** alongside the new `BlobName`. Not a violation of SRP exactly, but it does mean the entity's "reason to change" now spans two eras of a storage design decision — a reasonable, deliberate migration compromise, but worth being able to explain if asked "why does this entity have two ways of representing content?"

## 4. Why this matters practically (not just academically)

SRP isn't about elegance for its own sake — it directly affects two things you'll feel immediately as a developer:

1. **Blast radius of changes.** If `BlobService` is the *only* place Azure-specific code exists, migrating cloud providers touches one file. If Azure calls were scattered through `Fileservice`, `FileHistoryService`, and controllers, the same migration touches (and risks breaking) all of them.
2. **Testability.** A class with one responsibility and few dependencies is trivial to unit test in isolation (e.g., you could test `Fileservice.BuildNestTree`'s tree-shaping logic with a hand-built list of fake `FileSystemEntity` objects, with zero database or Azure involved, because tree-building doesn't itself talk to either). A class doing five things at once usually can't be tested without dragging all five things' dependencies along.

## 5. How to explain this in an interview

A good answer sounds like: *"SRP means a class should have one reason to change. In my project, I split file storage concerns into `BlobService` for talking to Azure, `FileHistoryService` for versioning, and `Fileservice` for the tree/CRUD logic, so that if I ever swap storage providers I only touch `BlobService`. My controllers don't contain any database or storage code directly — they just translate HTTP requests into service calls and service results into HTTP responses. I can also point out places where I *didn't* fully follow it, like `Fileservice` doing tree-building, CRUD, and trash-recursion all in one class — which is a natural refactor candidate as the project grows."* That last sentence — being able to critique your own code — tends to land better than claiming everything is perfect.
