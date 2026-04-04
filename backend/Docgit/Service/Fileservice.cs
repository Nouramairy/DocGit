using Docgit.Data;
using Docgit.Domain;
using Docgit.Dto;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using System.Text.Json.Nodes;

namespace Docgit.Service
{
    public class Fileservice
    {
        private readonly ApplicationDbContext _db;
        private readonly FileHistoryService _historyService;

        public Fileservice(ApplicationDbContext db, FileHistoryService fileHistoryService)
        {
            _db = db;
            _historyService = fileHistoryService;
        }

        public async Task<JsonObject> GetAllForUserAsync(int userId)
        {
            var entities = await _db.FileSystemEntities
                .Where(entity => entity.UserID == userId && !entity.IsDeleted)
                .ToListAsync();
            return null;
        }

        // need discussion 
        private JsonObject BuildNestTree(List<FileSystemEntity> allEntities, int? parentId)
        {
            var tree = new JsonObject();
            var children = allEntities.Where(e => e.ParentId == parentId).OrderBy(e => e.Name).ToList();

            foreach (var entity in children)
            {
                var node = new JsonObject
                {
                    ["file"] = entity.IsFile,
                    ["created"] = entity.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                    ["changed"] = entity.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                    ["bytes"] = entity.Bytes
                };

                if (entity.IsFile && entity.Extintion != null)
                    node["extension"] = entity.Extintion;

                if (!entity.IsFile)
                    node["content"] = BuildNestTree(allEntities, entity.Id);

                tree[entity.Name] = node;
            }

            return tree;
        }


        public async Task<FileSystemEntity> CreateFileAsync(int userId, string path, byte[] content)
        {
            var fileEntity = new FileSystemEntity
            {
                UserID = userId,
                Path = path,
                Content = content,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
            var entry = await _db.FileSystemEntities.AddAsync(fileEntity);
            await _db.SaveChangesAsync();
            return fileEntity;
        }

        public async Task<FileSystemEntity?> GetByPathAsync(int userId, string path)
        {
           var file = await _db.FileSystemEntities
                .FirstOrDefaultAsync(entity => entity.UserID == userId && entity.Path == path && !entity.IsDeleted);
            return file;
        }

        public async Task<List<TrashIteamDto>> GetTrashAsync(int userId)
        {
            var trashItems = await _db.FileSystemEntities
                .Where(entity => entity.UserID == userId && entity.IsDeleted)
                .Select(entity => new TrashIteamDto
                {
                    Name = entity.Name,
                    Path = entity.Path,
                    IsFile = entity.IsFile,
                    DeletedAt = entity.DeletedAt.HasValue ? entity.DeletedAt.Value.ToString("yyyy-MM-dd HH:mm:ss") : null
                }).ToListAsync();
            return trashItems;
        }

        public async Task<FileSystemEntity?> CreateFolderAsync(int userId, string path)
        {
            var existing = await GetByPathAsync(userId, path);
            if (existing != null) return null;

            // Notebook / Math / Calculas / sunday -> here sunday folder will be created.
            var segments = path.Split('/');
            //what the size? 
            var folderName = segments[^1];

            int? parentId = null;
            if (segments.Length > 1)
            {
                var parentPath = string.Join('/', segments[..^1]);
                var parent = await _db.FileSystemEntities
                    .FirstOrDefaultAsync(f => f.UserID == userId && f.Path == parentPath);
                parentId = parent?.Id;
            }

            var folderEntity = new FileSystemEntity
            {
                UserID = userId,
                Name = folderName,
                Path = path,
                IsFile = false,
                ParentId = (int)parentId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            await _db.FileSystemEntities.AddAsync(folderEntity);
            await _db.SaveChangesAsync();
            return folderEntity;
        }

        public async Task<(FileSystemEntity entity, bool existed)> UpsertFileAsync(int userId, string path, byte[] content)
        {
            {
                var existing = await GetByPathAsync(userId, path);

                if (existing != null)
                {
                    await _historyService.SaveVersionAsync(existing);
                    existing.Content = content;
                    existing.Bytes = content.LongLength;
                    existing.UpdatedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();
                    return (existing, true);
                }

                var created = await CreateFileWithParentsAsync(userId, path, content);
                return (created, false);
            }

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
                    .FirstOrDefaultAsync(f => f.UserID == userId && f.Path == currentPath);

                if (folder == null)
                {
                    folder = new FileSystemEntity
                    {
                        UserID = userId,
                        Name = segments[i],
                        Path = currentPath,
                        IsFile = false,
                        ParentId = (int)parentId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _db.FileSystemEntities.Add(folder);
                    await _db.SaveChangesAsync();
                }

                parentId = folder.Id;
            }
            var fileEntity = new FileSystemEntity
            {
                UserID = userId,
                Name = fileName,
                Path = path,
                IsFile = true,
                Content = content,
                Extintion = string.IsNullOrEmpty(extension) ? null : extension,
                Bytes = content.LongLength,
                ParentId = (int)parentId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.FileSystemEntities.Add(fileEntity);
            await _db.SaveChangesAsync();
            return fileEntity;
        }
        public async Task SoftDeleteAsync(int userId, string path)
        {
            var entity = await _db.FileSystemEntities.FirstOrDefaultAsync(f => f.UserID == userId && f.Path == path && !f.IsDeleted);
            if (entity == null) return;

            var allEntities = await _db.FileSystemEntities
            .Where(f => f.UserID == userId && !f.IsDeleted)
            .ToListAsync();


            // Notebook / Math / Calculas / sunday / abx.md
            // if we are to delete the notebook folder
            // SoftDeleteRecursive , it deletes the sub folders and files [Math / Calculas / sunday / abx.md]
            SoftDeleteRecursive(entity, allEntities);
            await _db.SaveChangesAsync();


        }

        // will be discussed later
        private static void SoftDeleteRecursive(FileSystemEntity entity, List<FileSystemEntity> all)
        {
            entity.IsDeleted = true;
            entity.DeletedAt = DateTime.UtcNow;
            foreach (var child in all.Where(f => f.ParentId == entity.Id))
                SoftDeleteRecursive(child, all);
        }

        public async Task PermanentDeleteAsync(int userId, string path)
        {
            var entity = await _db.FileSystemEntities
                .Include(f => f.FileHistories)
                .FirstOrDefaultAsync(f => f.UserID == userId && f.Path == path);

            if (entity == null) return;

            _db.FileHistories.RemoveRange(entity.FileHistories);
            _db.FileSystemEntities.Remove(entity);
            await _db.SaveChangesAsync();
        }

        public async Task<bool> RestoreFromTrashAsync(int userId, string path)
        {
            var entity = await _db.FileSystemEntities.FirstOrDefaultAsync(f => f.UserID == userId && f.Path == path && f.IsDeleted);
            if (entity == null)

            entity.IsDeleted = false;
            entity.DeletedAt = null;

            var allDeleted = await _db.FileSystemEntities
                .Where(f => f.UserID == userId && f.IsDeleted)
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
    }
}
