using Docgit.Data;
using Docgit.Domain;
using Docgit.Dto;
using Microsoft.EntityFrameworkCore;

namespace Docgit.Service
{
    public class FileHistoryService
    {
        private readonly ApplicationDbContext _db;


        public FileHistoryService(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task SaveVersionAsync(FileSystemEntity entity)
        {
            if (entity.Content == null || entity.Content.Length == 0) return;

            var maxVersion = await _db.FileHistories
                .Where(h => h.FileEntityId == entity.Id)
                .MaxAsync(h => (int?)h.VersionNumber) ?? 0;

            var history = new FileHistory
            {
                FileEntityId = entity.Id,
                VersionNumber = maxVersion + 1,
                Content = entity.Content,
                Bytes = entity.Bytes,
                SavedAt = DateTime.UtcNow
            };

            _db.FileHistories.Add(history);
            await _db.SaveChangesAsync();
        }

        public async Task<List<FileHistroyDto>> GetHistoryAsync(int fileEntityId)
        {
            return await _db.FileHistories
                .Where(h => h.FileEntityId == fileEntityId)
                .OrderByDescending(h => h.VersionNumber)
                .Select(h => new FileHistroyDto
                {
                    Version = h.VersionNumber,
                    SavedAt = h.SavedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                    Bytes = h.Bytes
                })
                .ToListAsync();
        }

            public async Task<byte[]> GetVersionContentAsync(int fileEntityId, int versionNumber)
            {
                var history = await _db.FileHistories
                    .FirstOrDefaultAsync(h => h.FileEntityId == fileEntityId && h.VersionNumber == versionNumber);
    
                return history?.Content;
        }
    }
}
