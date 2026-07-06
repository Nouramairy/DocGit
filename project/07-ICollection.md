---
tags: [docgit, icollection, efcore, csharp]
---

# 07 — `ICollection<T>`

> Related notes: [[05-DbContext]] · [[06-Domains-DTOs-Classes]]

## 1. Where it appears in this project

```csharp
// FileSystemEntity.cs
public ICollection<FileSystemEntity> Children { get; set; } = new List<FileSystemEntity>();
public ICollection<FileHistory> FileHistories { get; set; } = new List<FileHistory>();
```

Both are **navigation properties** representing the "many" side of a one-to-many relationship (configured explicitly in `ApplicationDbContext.OnModelCreating` — see [[05-DbContext]]):
- One folder has many `Children` (other files/folders whose `ParentId` points at it).
- One file has many `FileHistories` (its saved historical versions).

## 2. What `ICollection<T>` actually is

It's a **.NET interface** (`System.Collections.Generic.ICollection<T>`), sitting in the collection-interfaces hierarchy like this:

```
IEnumerable<T>          → can only be iterated (foreach), read-only, forward-only
  └── ICollection<T>    → adds Count, Add(), Remove(), Contains(), Clear() — a mutable "bag" of items
        └── IList<T>    → adds indexing (list[0]), Insert(), RemoveAt() — ordered, indexable
```

`List<T>` is a concrete class that implements all three. When a property is *typed* as `ICollection<T>` but *instantiated* as `new List<T>()`, that's a deliberate, very common C# idiom:

```csharp
public ICollection<FileSystemEntity> Children { get; set; } = new List<FileSystemEntity>();
```

Why declare the property as the narrower interface (`ICollection<T>`) rather than the concrete type (`List<T>`)? **Program to an interface, not an implementation** — a core OOP principle:
- Anyone consuming `entity.Children` only sees "a collection I can add/remove/count/iterate", not "a `List` specifically with all of `List<T>`'s extra API surface (`Sort`, `BinarySearch`, `Capacity`, indexers, etc.)".
- **EF Core itself doesn't care whether it's a `List<T>`, `HashSet<T>`, or any other `ICollection<T>`-implementing type** — it only needs something it can call `.Add()` on when materializing related rows from the database. Declaring the narrower interface keeps the *contract* minimal while `= new List<T>()` supplies a safe, concrete default so the property is never `null` and callers can safely do `entity.Children.Count` even before EF Core has loaded anything into it.
- If you ever wanted to swap the backing collection to a `HashSet<FileSystemEntity>` (e.g. to guarantee no duplicates, or for O(1) `Contains` checks) you'd only need to change the *initializer*, not every piece of code that reads `entity.Children` — because none of that code depends on `List<T>`-specific members.

## 3. Why `ICollection<T>` specifically, and not `IEnumerable<T>` or `IList<T>`

- **Not `IEnumerable<T>`** — because you need to `Add()` to it. `FileSystemEntity.Children` gets populated by EF Core when it loads related child entities; if it were `IEnumerable<T>` (read-only-shaped), you couldn't. Also relevant: while `FileHistories` in this project is only ever read/appended-to indirectly (via `_db.FileHistories.Add(...)` on the `DbSet`, not `entity.FileHistories.Add(...)` directly), EF Core's convention for navigation collections generally expects something it can mutate.
- **Not `IList<T>`** — because ordering/indexing by position (`Children[2]`) is meaningless here; folder children are naturally looked up/filtered by property (`Where(c => c.ParentId == id)`), not by list position. `ICollection<T>` is the minimal interface that supports "a modifiable group of related rows" without implying an order that doesn't actually exist in the data model.

## 4. How EF Core actually uses these properties

This is the part that makes `ICollection<T>` navigation properties feel a bit "magic" the first time you see them: **you never manually populate `Children` or `FileHistories` yourself** in this codebase's actual runtime logic. Instead:

- If you explicitly ask for it with `.Include()`:
  ```csharp
  var entity = await _db.FileSystemEntities.Include(f => f.FileHistories)
      .FirstOrDefaultAsync(f => f.UserID == userId && f.Path == path);
  ```
  EF Core runs a `JOIN`, and **populates `entity.FileHistories` for you** with the matching rows, ready to iterate — exactly what `Fileservice.PermanentDeleteAsync` relies on (`foreach (var history in entity.FileHistories)`).
- If you *don't* `.Include()` it, and lazy-loading isn't configured (it isn't, in this project — no lazy-loading proxies package is referenced), the collection is simply left empty rather than populated on first access. This project deliberately avoids lazy loading and instead either (a) explicitly `.Include()`s when it needs a related collection, or (b) — much more commonly here — fetches the flat list of all rows once and does the tree-shaping itself in memory with plain LINQ (`BuildNestTree`, `SoftDeleteRecursive` in `Fileservice` — see [[02-Methods-And-APIs]]), **never actually walking `entity.Children` at all**. That's worth noticing: `Children` exists on the entity and is *configured* as a real relationship, but the actual tree logic in this codebase is implemented independently in application code against a flat `List<FileSystemEntity>`, not by walking the `Children` navigation property. Both approaches are valid; this project happens to use the manual/flat approach for the tree, and reserves `.Include()`-driven navigation for the simpler, one-level `FileHistories` case.

## 5. `ICollection<T>` vs. arrays vs. `List<T>` — quick contrast for a student

| Type | Fixed size? | Has `Add`/`Remove`? | Indexable? | Used in this project for... |
|---|---|---|---|---|
| `T[]` (array) | Yes | No | Yes | `byte[]? Content` — raw bytes, fixed-length by nature |
| `List<T>` | No (grows) | Yes | Yes | The concrete collection actually instantiated everywhere |
| `ICollection<T>` | No | Yes | **No** | The *declared type* of navigation properties |
| `IEnumerable<T>` | No | No | No | Used implicitly whenever you `foreach` over a LINQ query result |

`byte[]? Content` uses a plain array deliberately — file bytes are a fixed, already-known-length blob once read, there's no scenario where you'd `Add()` a single byte to it later, so the richer collection interfaces would add nothing but noise.

## 6. Quick interview-ready summary

*"`ICollection<T>` is the interface I use for EF Core navigation properties that represent the many-side of a relationship — like a folder's `Children` or a file's `FileHistories`. I declare the property as the interface but initialize it with a concrete `List<T>`, which follows 'program to an interface' — callers only see the minimal add/remove/count contract they actually need, and I could swap the concrete implementation later without touching any calling code. EF Core populates these automatically when I explicitly `.Include()` a related collection in a query; without that, the collection just stays empty rather than lazily loading, since this project doesn't use lazy-loading proxies."*
