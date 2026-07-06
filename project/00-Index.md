---
tags: [docgit, moc]
---

# DocGit — Study Notes (Map of Content)

This vault is a deep-dive study guide over one real project, **DocGit** (a document manager with Git-like version history: ASP.NET Core 9 backend + Angular 21 frontend + a .NET CLI client + SignalR real-time sync). Every note is grounded in the actual code in this repository — not generic theory — so you can trace every claim back to a real file and line.

Drop this whole `project/` folder into your Obsidian vault as-is; the `[[wiki-links]]` between notes will resolve automatically and you'll get a connected graph.

## Suggested reading order

1. [[01-Project-Overview]] — start here. The system, its architecture, and the full request lifecycle for a "Save".
2. [[02-Methods-And-APIs]] — every controller method and API endpoint, explained, plus how to build your own.
3. [[03-Async-Middleware-Databases]] — `async`/`await`, `Task`, the ASP.NET Core middleware pipeline, and how EF Core talks to SQL Server.
4. [[04-Single-Responsibility-Principle]] — "the Single R", with real examples of where this project follows it and where it doesn't.
5. [[05-DbContext]] — `ApplicationDbContext`, `OnModelCreating`, migrations, DI lifetime.
6. [[06-Domains-DTOs-Classes]] — every Domain and DTO class, and why the two are kept separate.
7. [[07-ICollection]] — `ICollection<T>`, navigation properties, and EF Core relationships.
8. [[08-Backend-Frontend-Connection]] — CORS, the JWT handshake, `DocApiService`, and SignalR, end to end.
9. [[09-The-CLI-Client]] — the `Client` console app: top-level statements, `pull`/`push`, `HttpClient` patterns.
10. [[10-Services-And-DI]] — Dependency Injection, service lifetimes, and Angular's parallel DI system.
11. [[11-Extra-Topics]] — things worth knowing that weren't explicitly asked for: JWT/BCrypt security, soft delete, a real bug in the SignalR grouping, and more.
12. [[12-Interview-Questions]] — practice questions and model answers covering everything above, phrased the way an interviewer would actually ask.

## Quick topic index

| Topic | Note |
|---|---|
| System architecture, tree-in-a-database, request lifecycle | [[01-Project-Overview]] |
| REST endpoints, routing, `BuildNestTree`, recursion | [[02-Methods-And-APIs]] |
| `async`/`Task`, middleware pipeline, EF Core queries | [[03-Async-Middleware-Databases]] |
| SOLID / SRP | [[04-Single-Responsibility-Principle]] |
| `DbContext`, Fluent API, migrations | [[05-DbContext]] |
| Domain entities vs. DTOs | [[06-Domains-DTOs-Classes]] |
| `ICollection<T>` | [[07-ICollection]] |
| CORS, JWT flow, SignalR, `DocApiService` | [[08-Backend-Frontend-Connection]] |
| CLI client (`Client/Program.cs`) | [[09-The-CLI-Client]] |
| Dependency Injection & service lifetimes | [[10-Services-And-DI]] |
| Security notes, known bugs, what to improve | [[11-Extra-Topics]] |
| Interview Q&A | [[12-Interview-Questions]] |

## The project in one paragraph

DocGit stores files and folders as rows in a SQL Server database (metadata) with actual file bytes in Azure Blob Storage, exposed through a JWT-authenticated ASP.NET Core 9 REST API. An Angular 21 single-page app is the primary client — it calls the REST API for all reads/writes and maintains a separate SignalR WebSocket connection purely to be notified when something changes (its own or another tab's edits), at which point it re-fetches over REST. A standalone .NET console app (`Client`) is a second, independent client that can mirror an entire local folder to/from the server (`push`/`pull`). Every save snapshots the previous version of a file, and deletes are soft (flagged, recoverable from Trash) until permanently purged.
