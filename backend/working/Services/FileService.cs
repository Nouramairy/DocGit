using System.Text.Json.Nodes;
using Docgit.Data;
using Docgit.DTOs;
using Docgit.Models;
using Microsoft.EntityFrameworkCore;

namespace Docgit.Services;

public class FileService
{
    private readonly AppDbContext _db;
    private readonly FileHistoryService _historyService;

    public FileService(AppDbContext db, FileHistoryService historyService)
    {
        _db = db;
        _historyService = historyService;
    }

    public async Task<JsonObject> GetAllForUserAsync(int userId)
    {
        var entities = await _db.FileSystemEntities
            .Where(f => f.UserId == userId && !f.IsDeleted)
            .ToListAsync();

        return BuildNestedTree(entities, null);
    }

    private static JsonObject BuildNestedTree(List<FileSystemEntity> allEntities, int? parentId)
    {
        var result = new JsonObject();
        var children = allEntities.Where(e => e.ParentId == parentId).OrderBy(e => e.Name).ToList();

        foreach (var entity in children)
        {
            var node = new JsonObject
            {
                ["file"] = entity.IsFile,
                ["created"] = entity.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                ["changed"] = entity.ChangedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                ["bytes"] = entity.Bytes
            };

            if (entity.IsFile && entity.Extension != null)
                node["extension"] = entity.Extension;

            if (!entity.IsFile)
                node["content"] = BuildNestedTree(allEntities, entity.Id);

            result[entity.Name] = node;
        }

        return result;
    }

    public async Task<FileSystemEntity?> GetByPathAsync(int userId, string path)
    {
        return await _db.FileSystemEntities
            .FirstOrDefaultAsync(f => f.UserId == userId && f.Path == path && !f.IsDeleted);
    }

    /// <summary>
    /// Creates a file. Returns null if already exists (409 conflict).
    /// </summary>
    public async Task<FileSystemEntity?> CreateFileAsync(int userId, string path, byte[] content)
    {
        var existing = await GetByPathAsync(userId, path);
        if (existing != null) return null;

        return await CreateFileWithParentsAsync(userId, path, content);
    }

    /// <summary>
    /// Creates a folder. Returns null if already exists (409 conflict).
    /// </summary>
    public async Task<FileSystemEntity?> CreateFolderAsync(int userId, string path)
    {
        var existing = await GetByPathAsync(userId, path);
        if (existing != null) return null;

        var segments = path.Split('/');
        var folderName = segments[^1];

        int? parentId = null;
        if (segments.Length > 1)
        {
            var parentPath = string.Join('/', segments[..^1]);
            var parent = await _db.FileSystemEntities
                .FirstOrDefaultAsync(f => f.UserId == userId && f.Path == parentPath);
            parentId = parent?.Id;
        }

        var folder = new FileSystemEntity
        {
            UserId = userId,
            Name = folderName,
            Path = path,
            IsFile = false,
            ParentId = parentId,
            CreatedAt = DateTime.UtcNow,
            ChangedAt = DateTime.UtcNow
        };

        _db.FileSystemEntities.Add(folder);
        await _db.SaveChangesAsync();
        return folder;
    }

    /// <summary>
    /// Upserts a file: saves history if updating an existing file.
    /// Returns (entity, wasExisting).
    /// </summary>
    public async Task<(FileSystemEntity entity, bool existed)> UpsertFileAsync(int userId, string path, byte[] content)
    {
        var existing = await GetByPathAsync(userId, path);

        if (existing != null)
        {
            await _historyService.SaveVersionAsync(existing);
            existing.Content = content;
            existing.Bytes = content.LongLength;
            existing.ChangedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return (existing, true);
        }

        var created = await CreateFileWithParentsAsync(userId, path, content);
        return (created, false);
    }

    private async Task<FileSystemEntity> CreateFileWithParentsAsync(int userId, string path, byte[] content)
    {
        var segments = path.Split('/');
        var fileName = segments[^1];
        var extension = System.IO.Path.GetExtension(fileName);

        int? parentId = null;
        var currentPath = string.Empty;

        for (int i = 0; i < segments.Length - 1; i++)
        {
            currentPath = i == 0 ? segments[i] : $"{currentPath}/{segments[i]}";
            var folder = await _db.FileSystemEntities
                .FirstOrDefaultAsync(f => f.UserId == userId && f.Path == currentPath);

            if (folder == null)
            {
                folder = new FileSystemEntity
                {
                    UserId = userId,
                    Name = segments[i],
                    Path = currentPath,
                    IsFile = false,
                    ParentId = parentId,
                    CreatedAt = DateTime.UtcNow,
                    ChangedAt = DateTime.UtcNow
                };
                _db.FileSystemEntities.Add(folder);
                await _db.SaveChangesAsync();
            }

            parentId = folder.Id;
        }

        var fileEntity = new FileSystemEntity
        {
            UserId = userId,
            Name = fileName,
            Path = path,
            IsFile = true,
            Content = content,
            Extension = string.IsNullOrEmpty(extension) ? null : extension,
            Bytes = content.LongLength,
            ParentId = parentId,
            CreatedAt = DateTime.UtcNow,
            ChangedAt = DateTime.UtcNow
        };

        _db.FileSystemEntities.Add(fileEntity);
        await _db.SaveChangesAsync();
        return fileEntity;
    }

    public async Task SoftDeleteAsync(int userId, string path)
    {
        var entity = await _db.FileSystemEntities
            .FirstOrDefaultAsync(f => f.UserId == userId && f.Path == path && !f.IsDeleted);

        if (entity == null) return;

        var allEntities = await _db.FileSystemEntities
            .Where(f => f.UserId == userId && !f.IsDeleted)
            .ToListAsync();

        SoftDeleteRecursive(entity, allEntities);
        await _db.SaveChangesAsync();
    }

    private static void SoftDeleteRecursive(FileSystemEntity entity, List<FileSystemEntity> all)
    {
        entity.IsDeleted = true;
        entity.DeletedAt = DateTime.UtcNow;
        foreach (var child in all.Where(f => f.ParentId == entity.Id))
            SoftDeleteRecursive(child, all);
    }

    public async Task<List<TrashItemDto>> GetTrashAsync(int userId)
    {
        return await _db.FileSystemEntities
            .Where(f => f.UserId == userId && f.IsDeleted)
            .Select(f => new TrashItemDto
            {
                Path = f.Path,
                Name = f.Name,
                IsFile = f.IsFile,
                DeletedAt = f.DeletedAt.HasValue
                    ? f.DeletedAt.Value.ToString("yyyy-MM-dd HH:mm:ss")
                    : null
            })
            .ToListAsync();
    }

    public async Task<bool> RestoreFromTrashAsync(int userId, string path)
    {
        var entity = await _db.FileSystemEntities
            .FirstOrDefaultAsync(f => f.UserId == userId && f.Path == path && f.IsDeleted);

        if (entity == null) return false;

        entity.IsDeleted = false;
        entity.DeletedAt = null;

        var allDeleted = await _db.FileSystemEntities
            .Where(f => f.UserId == userId && f.IsDeleted)
            .ToListAsync();

        RestoreChildrenRecursive(entity.Id, allDeleted);
        await _db.SaveChangesAsync();
        return true;
    }

    private static void RestoreChildrenRecursive(int parentId, List<FileSystemEntity> allDeleted)
    {
        foreach (var child in allDeleted.Where(f => f.ParentId == parentId))
        {
            child.IsDeleted = false;
            child.DeletedAt = null;
            RestoreChildrenRecursive(child.Id, allDeleted);
        }
    }

    public async Task PermanentDeleteAsync(int userId, string path)
    {
        var entity = await _db.FileSystemEntities
            .Include(f => f.Histories)
            .FirstOrDefaultAsync(f => f.UserId == userId && f.Path == path);

        if (entity == null) return;

        _db.FileHistories.RemoveRange(entity.Histories);
        _db.FileSystemEntities.Remove(entity);
        await _db.SaveChangesAsync();
    }
}
