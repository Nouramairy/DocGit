---
tags: [docgit, efcore, dbcontext, database]
---

# 05 — The DbContext

> Related notes: [[03-Async-Middleware-Databases]] · [[07-ICollection]] · [[10-Services-And-DI]]

## 1. What a `DbContext` is

`ApplicationDbContext` (`backend/Docgit/Data/ApplicationDbContext.cs`) is DocGit's single EF Core `DbContext`. Conceptually, a `DbContext` is:

- **A session with the database** — it holds an open (or openable) connection and tracks a "unit of work" — a batch of changes you'll eventually commit together.
- **A collection of `DbSet<T>` properties**, one per table, each acting like an in-memory queryable collection that's secretly backed by SQL.
- **The change tracker** — as you read, add, modify, or remove entities through it, it remembers what changed so `SaveChanges()` knows exactly what SQL to generate.

```csharp
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<FileSystemEntity> FileSystemEntities => Set<FileSystemEntity>();
    public DbSet<FileHistory> FileHistories => Set<FileHistory>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) { ... }
}
```

- Inheriting from `DbContext` is what makes this class "an EF Core context" at all — all the querying/tracking/saving machinery comes from the base class.
- The constructor takes `DbContextOptions<ApplicationDbContext>` — this is how EF Core knows *which* database provider and connection string to use, without `ApplicationDbContext` itself hardcoding that anywhere. Those options are supplied by `Program.cs`:
  ```csharp
  builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));
  ```
  This is **Dependency Injection** in action (see [[10-Services-And-DI]]): the context doesn't know or care it's talking to SQL Server specifically — that decision lives entirely in `Program.cs`, and swapping providers (e.g. to SQLite for local testing) never requires touching `ApplicationDbContext.cs`.
- `DbSet<FileSystemEntity> FileSystemEntities => Set<FileSystemEntity>();` — `Set<T>()` is the modern (post EF Core 5) way to expose a `DbSet`, using an expression-bodied property instead of a settable auto-property. Functionally it's the same as `public DbSet<FileSystemEntity> FileSystemEntities { get; set; }`, just slightly more explicit that you're not supposed to reassign it.

## 2. `OnModelCreating` — teaching EF Core the shape of your data

EF Core can infer a lot automatically by convention (a property called `Id` becomes the primary key; a property named `XyzId` next to a navigation property `Xyz` becomes a foreign key). But some relationships and constraints need to be spelled out explicitly using the **Fluent API**, which is exactly what `OnModelCreating` is for:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    base.OnModelCreating(modelBuilder);

    modelBuilder.Entity<FileSystemEntity>()
        .HasOne(fileSystem => fileSystem.User)
        .WithMany()
        .HasForeignKey(fileSystem => fileSystem.UserID)
        .OnDelete(DeleteBehavior.Cascade);

    modelBuilder.Entity<FileHistory>()
        .HasOne(fileHistory => fileHistory.FileEntity)
        .WithMany(file => file.FileHistories)
        .HasForeignKey(fileHistory => fileHistory.FileEntityId)
        .OnDelete(DeleteBehavior.Cascade);

    modelBuilder.Entity<User>()
        .HasIndex(user => user.UserName)
        .IsUnique();

    modelBuilder.Entity<FileSystemEntity>()
        .HasIndex(file => new { file.UserID, file.Path })
        .IsUnique();

    modelBuilder.Entity<FileSystemEntity>()
        .HasOne(file => file.Parent)
        .WithMany(file => file.Children)
        .HasForeignKey(file => file.ParentId)
        .OnDelete(DeleteBehavior.Restrict);
}
```

Read each one as a sentence:

1. **"A `FileSystemEntity` has one `User` (via `UserID`), a `User` can have many (unspecified, un-navigated) `FileSystemEntity`s, and deleting a `User` cascades to delete all their files."** `.WithMany()` with no argument means "`User` doesn't need a `Children`-style navigation collection back to its files" — the relationship is one-directional from the entity's point of view.
2. **"A `FileHistory` has one `FileEntity` (via `FileEntityId`), a `FileSystemEntity` has many `FileHistories`, and deleting the file cascades to delete all its history."** This one *is* bidirectional — both `FileHistory.FileEntity` and `FileSystemEntity.FileHistories` exist as navigation properties, so `.WithMany(file => file.FileHistories)` tells EF Core exactly which collection on the other side to keep in sync.
3. **Unique index on `User.UserName`** — this is what actually *enforces*, at the database level, that two users can't register the same username. Note this is a *safety net*, not the only check — `AuthController.Register` also does an application-level uniqueness check (`AnyAsync`) before insert, partly for a nicer error message, partly because there's a small race-condition window between the check and the insert that only the database-level unique index truly closes.
4. **Composite unique index on `(UserID, Path)`** — enforces "you personally can't have two files/folders with the same path", while still allowing *different* users to both have a file at `notes/todo.md` (since the index includes `UserID`).
5. **Self-referencing relationship**: `FileSystemEntity.Parent` / `FileSystemEntity.Children` — a folder "has one" parent and "has many" children, and both properties live on the *same* entity type. This is what makes the whole tree structure possible (see [[01-Project-Overview]] §3 and [[07-ICollection]]).
   - **`.OnDelete(DeleteBehavior.Restrict)`** here specifically — unlike the other two relationships, this one does **not** cascade. Why? Because cascade-deleting a parent already **would** need to happen (and does — see `SoftDeleteRecursive` in [[02-Methods-And-APIs]]), but it's handled *manually in application code*, not by the database. If you set `Cascade` here, SQL Server would refuse to create the schema at all — the two cascade paths (user→files, and file→children) could both try to delete the same row via different paths, which SQL Server detects as a potential "multiple cascade paths" cycle and rejects at migration time. `Restrict` sidesteps that entirely, and the recursive soft-delete/permanent-delete logic in `Fileservice` handles the cascading behaviour explicitly in C# instead.

## 3. Migrations — how the C# model becomes actual database schema

You never hand-write `CREATE TABLE` statements in this project. Instead:

```bash
dotnet ef migrations add SomeChangeName
dotnet ef database update
```

- `dotnet ef migrations add` inspects your current `DbContext`/entity classes, diffs them against the last known model snapshot (`ApplicationDbContextModelSnapshot.cs`), and generates a new file in `Migrations/` containing an `Up()` (apply the change) and `Down()` (revert it) method, expressed in EF Core's migration DSL (`migrationBuilder.CreateTable(...)`, `.AddColumn(...)`, etc.).
- `dotnet ef database update` actually runs the pending migrations' `Up()` methods against your real database.

This project has two real migrations: `20260328182930_IntitalMigration.cs` (the original schema) and `20260615050115_AddBlobStorage.cs` (added the `BlobName` columns when the project moved file content out of SQL and into Azure Blob Storage — see [[01-Project-Overview]] §2). This is a good, real example of how a schema evolves over a project's lifetime without ever throwing away the existing database — each migration is an incremental diff.

`app.Run()` doesn't apply migrations automatically in this project — instead `Program.cs` calls `db.Database.EnsureCreated()` at startup, which is a simpler (but less flexible) alternative: it creates the database and schema *if it doesn't exist yet*, based on the current model — but it does **not** apply incremental migrations to an existing database, and doesn't play well *at all* alongside a real migrations history once a database already exists. Worth knowing as a "well, actually" for an interview: `EnsureCreated()` and `Migrate()` are two different, largely incompatible strategies, and production apps almost always want `Migrate()` (or a proper migration/deployment pipeline) rather than `EnsureCreated()`.

## 4. How the DbContext gets to your controller — DI lifetime

```csharp
builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));
```

`AddDbContext` registers `ApplicationDbContext` with a **Scoped** lifetime by default — meaning: *one instance per HTTP request*. Every service/controller that asks for `ApplicationDbContext` during the same request gets the *exact same instance*, sharing the same change tracker; a new request gets a brand new instance. This matters because:

- Sharing one context across a whole request lets `Fileservice`, `FileHistoryService`, and `FilesController` all see the same tracked, uncommitted changes within a single request (e.g. `SoftDeleteRecursive` mutates a bunch of tracked entities, and one final `SaveChangesAsync()` commits them all together).
- You'd never want a `DbContext` to be a **Singleton** (one instance for the whole app's lifetime) — `DbContext` is explicitly documented as **not thread-safe**; two simultaneous requests sharing one instance could corrupt its internal state.
- You'd rarely want it **Transient** (a new instance every time it's injected, even within the same request) either, since that would prevent different services in the same request from sharing tracked changes, and would open more database connections than necessary.

See [[10-Services-And-DI]] for the full breakdown of Scoped vs Singleton vs Transient with every service in this project.

## 5. Practical patterns you'll reuse constantly

```csharp
// read one, or null
await _db.Users.FirstOrDefaultAsync(u => u.UserName == username);

// existence check without loading data (translates to SQL EXISTS)
await _db.Users.AnyAsync(u => u.UserName == request.UserName);

// read many into a real in-memory List
await _db.FileSystemEntities.Where(e => e.UserID == userId && !e.IsDeleted).ToListAsync();

// insert
_db.Users.Add(newUser);
await _db.SaveChangesAsync();

// update (just mutate a tracked entity's properties, then save)
existing.Bytes = content.LongLength;
existing.UpdatedAt = DateTime.UtcNow;
await _db.SaveChangesAsync();

// delete
_db.FileSystemEntities.Remove(entity);
await _db.SaveChangesAsync();

// eager-load a related collection (avoids a separate query later)
await _db.FileSystemEntities.Include(f => f.FileHistories).FirstOrDefaultAsync(...);
```

That last one, `.Include(...)`, appears in `PermanentDeleteAsync` — without it, accessing `entity.FileHistories` afterward would either be an empty collection (if lazy loading isn't configured) or trigger a second, separate query behind the scenes (if it is) — `.Include()` makes EF Core fetch the entity **and** its related `FileHistories` in one SQL query (a `JOIN`), which is both more explicit and, for this use case, more efficient.
