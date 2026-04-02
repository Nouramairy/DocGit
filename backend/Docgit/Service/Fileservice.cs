using Docgit.Data;
using Docgit.Domain;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using System.Text.Json.Nodes;

namespace Docgit.Service
{
    public class Fileservice
    {
        private readonly ApplicationDbContext _db;

        public Fileservice(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<JsonObject> GetAllForUserAsync(int userId)
        {
            var entities = await _db.FileSystemEntities
                .Where(entity => entity.UserID == userId && !entity.IsDeleted)
                .ToListAsync();
            return null;
        }

        private JsonObject BuildNestTree(List<FileSystemEntity> entities, string parentId)
        {
            var tree = new JsonObject();
            var children = entities.Where(e => GetParentPath(e.Path) == currentPath).ToList();
            foreach (var child in children)
            {
                if (child.IsFile)
                {
                    tree[GetName(child.Path)] = new JsonObject
                    {
                        ["type"] = "file",
                        ["bytes"] = child.Bytes,
                        ["createdAt"] = child.CreatedAt,
                        ["updatedAt"] = child.UpdatedAt
                    };
                }
                else
                {
                    tree[GetName(child.Path)] = BuildTree(entities, child.Path);
                }
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
    }
}
