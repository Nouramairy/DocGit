---
tags: [docgit, security, jwt, bcrypt, signalr, soft-delete]
---

# 11 — Extra Topics Worth Knowing (Not Explicitly Asked, But Important)

> Related notes: all other notes — this one fills gaps

You asked me to flag anything important I noticed that you didn't explicitly list. Here's everything that stood out while reading the whole codebase.

## 1. JWT anatomy — what's actually inside that token string

A JWT is three Base64URL-encoded segments joined by dots: `header.payload.signature`. `JwtService.GenerateToken`:

```csharp
var claims = new[]
{
    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
    new Claim(ClaimTypes.Name, user.UserName)
};
var token = new JwtSecurityToken(claims: claims, expires: DateTime.UtcNow.AddHours(24), signingCredentials: creds);
```

- The **payload** is just JSON containing those claims plus standard fields like `exp` (expiry) — and critically, **it is only Base64-encoded, not encrypted**. Anyone can decode a JWT and read its contents (try pasting one into jwt.io) — the security guarantee is *integrity* (nobody can forge or modify it undetected), not *confidentiality*. Never put secrets (passwords, etc.) inside a JWT payload.
- The **signature** is an HMAC-SHA256 hash of `header + payload`, computed using the secret key (`Jwt:Secret` in `appsettings.json`). Anyone with the secret can produce a valid signature; anyone without it can't forge a token that will pass `ValidateIssuerSigningKey` on the server. This is why the secret **must** be kept out of source control (it currently is — `appsettings.json` in the repo has an empty string, filled in per-environment).
- **24-hour expiry**, hardcoded. There's no refresh-token mechanism in this project — once a token expires, the user must log in again. Worth knowing as a real limitation: production systems commonly use short-lived access tokens (minutes) plus longer-lived refresh tokens to balance security and user experience.
- `ClockSkew = TimeSpan.Zero` in `Program.cs`'s validation parameters — by default, ASP.NET Core allows a 5-minute grace period past `exp` to account for clock drift between servers; this project disables that entirely, meaning expiry is enforced to the second.

## 2. BCrypt — why not just SHA-256 the password?

```csharp
string hash = BCrypt.Net.BCrypt.HashPassword(request.Password);
...
BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
```

Fast general-purpose hashes (SHA-256, MD5) are *designed* to be fast — great for checksums, terrible for passwords, because that same speed lets an attacker who steals your database try billions of guesses per second (especially with GPUs). BCrypt is deliberately **slow** (tunable via a "cost factor" / number of rounds) and automatically **salts** each hash (a random value baked into the hash itself, so two users with the same password get completely different hash strings, defeating precomputed "rainbow table" attacks). `BCrypt.Verify` doesn't need the salt passed in separately — it's embedded in the stored hash string itself. This is a genuinely important, production-correct security choice this project already gets right.

## 3. Soft delete — a pattern you'll use constantly in real systems

Instead of `DELETE FROM FileSystemEntities WHERE ...`, most rows in this project are only ever flagged:
```csharp
entity.IsDeleted = true;
entity.DeletedAt = DateTime.UtcNow;
```
and every "normal" read query filters `!entity.IsDeleted` (see `Fileservice.GetByPathAsync`, `GetAllForUserAsync`, etc.). Why this matters:
- **Reversibility** — the entire Trash/Restore feature only works because data isn't actually gone.
- **Auditability** — you can still see when/what was deleted, which is often a compliance or debugging requirement in real systems.
- **The tradeoff** — every single query in the codebase must remember to add the `!IsDeleted` filter, forever, or "deleted" rows silently leak back into normal results. This project handles it consistently but manually (no global query filter is configured in `OnModelCreating`) — a more robust approach at scale would use EF Core's [global query filters](https://learn.microsoft.com/ef/core/querying/filters) (`modelBuilder.Entity<FileSystemEntity>().HasQueryFilter(e => !e.IsDeleted)`) so the filter is applied automatically everywhere, impossible to forget. Worth mentioning as a "here's how I'd harden this further" point in an interview.

## 4. Storing bytes: SQL column vs. Blob Storage — the migration story

Covered briefly elsewhere, but worth its own callout: `FileSystemEntity` has **both** `Content` (byte[], legacy) and `BlobName` (string, current). The commit history (`e858e4d "blob storage cofigured and is working"`) confirms this was an active, real migration during development. This is a genuinely valuable thing to have lived through as a student: **schema evolution while keeping old data valid** is one of the hardest parts of real backend work, and this project's service methods (`GetFileContentAsync`, `SaveVersionAsync`) explicitly check `if (entity.BlobName != null) → blob storage, else → the old inline Content` — a manual "fallback" pattern that lets both old and new rows keep working simultaneously without a one-time backfill migration being strictly required.

## 5. SignalR groups — a subtlety worth noticing

```csharp
public static string UserGroup(int userId) => "hubgroup";
```
Look closely — **this ignores the `userId` parameter entirely** and always returns the literal string `"hubgroup"`. That means, as currently written, **every connected user across the entire application is in the same broadcast group** — a file change event for User A's files is pushed to User B's browser too (the frontend would just refetch User B's own tree, which happens to be unaffected content-wise, so the bug is invisible in normal use, but it's still broadcasting more than intended, and could become a real problem — e.g. a subtle information leak, or a scalability issue as user count grows). The method's name and signature (`UserGroup(int userId)`) clearly *communicate the intent* of per-user isolation that the implementation doesn't actually deliver. This is a great, concrete example to bring up if asked "find a bug" or "what would you fix first" in an interview — the fix would simply be `=> $"user-{userId}"`.

## 6. Error handling gaps (also good interview material)

- `AuthController.Register` catches `Exception` broadly and returns the raw exception message + stack trace to the client (`StatusCode(500, new { type, message, inner, stackTrace })`). Fine for local debugging, but a real production API should never return stack traces to a client — that's an information-disclosure risk (reveals internal file paths, library versions, sometimes connection details in exception messages).
- Most other controller actions/services don't `try/catch` at all — an unhandled exception would currently bubble up to ASP.NET Core's default behavior (a generic 500 in production, a detailed error page only in Development, controlled by `app.Environment.IsDevelopment()` which is only used here for Swagger, not for a custom exception page/middleware). A more mature setup would add a global exception-handling middleware (`app.UseExceptionHandler(...)`) to guarantee *consistent, safe* error responses everywhere, rather than each controller handling it ad hoc (or not at all).

## 7. `EnsureCreated()` vs. real migrations — a real gotcha

Already covered in [[05-DbContext]] §3, but worth restating as a standalone warning: `Program.cs` calls `db.Database.EnsureCreated()` at startup, which creates the schema if the database doesn't exist yet — but this project *also* has real EF Core migrations checked in (`Migrations/` folder). These two mechanisms don't compose well: `EnsureCreated()` doesn't know about or apply the migration history at all, and running `dotnet ef database update` against a database that `EnsureCreated()` already created (outside of migrations) can get out of sync in confusing ways. In a real deployment you'd pick one strategy — almost always `Database.Migrate()` — and stick to it consistently.

## 8. Kestrel's 1GB request body limit

```csharp
builder.WebHost.ConfigureKestrel(options => { options.Limits.MaxRequestBodySize = 1_073_741_824; });
```
Worth knowing *why* this line exists at all: ASP.NET Core's default max request body size (~28.6MB via Kestrel's default, or IIS's own separate limit if hosted that way) would otherwise reject uploads of any reasonably large file with a `413 Payload Too Large` before your controller code ever runs. Raising it is necessary for this app's "upload/import any file" feature to work for non-trivial files — but it's also a resource-exhaustion consideration: allowing up to 1GB per request means a malicious or buggy client could tie up significant server memory/bandwidth per request; a production system might pair this with rate limiting or per-user quotas.

## 9. Things that look like typos/rough edges but are real, present in the code

Worth being able to recognize (not "fix silently in your head") when reading the actual files: `Extintion` (should be "Extension"), `FileHistroyDto`/`GetVersionContentAsync` naming, `TrashIteamDto` (should be "TrashItemDto"), the unused `Setting` domain class, the unused `Directory` property on `FileSystemEntity`. None of these break functionality — C# doesn't care what you name things — but they're realistic examples of the kind of small inconsistencies that accumulate in any real codebase, and being able to spot and calmly describe them (rather than being thrown off by them) is itself a useful skill.

## 10. What you'd add next if this were a real product (good "what would you improve" talking points)

- Rename/move file & folder support (currently there's no endpoint for it — you can only create, upsert-by-full-content, and soft-delete; renaming would currently mean delete + recreate, losing version history).
- Collaborators/sharing a document with another user (there's a comment in `FileSystemEntity.cs` hinting this was planned: *"each doc will have multiple collaborators... each user can share a doc to collaborators"*).
- Refresh tokens instead of a flat 24-hour JWT expiry.
- Fixing the `UserGroup` SignalR bug (§5).
- Global query filter for soft-delete (§3) instead of manual `!IsDeleted` everywhere.
- A global exception-handling middleware (§6) instead of per-controller ad hoc handling.
