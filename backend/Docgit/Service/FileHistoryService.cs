using Docgit.Data;
using Docgit.Domain;
using Docgit.Dto;
using Microsoft.EntityFrameworkCore;

namespace Docgit.Service
{
    public class FileHistoryService
    {
        private readonly ApplicationDbContext _db;
        private readonly BlobService _blobService;

        public FileHistoryService(ApplicationDbContext db, BlobService blobService)
        {
            _db = db;
            _blobService = blobService;
        }

        public async Task SaveVersionAsync(FileSystemEntity entity)
        {
            byte[]? content;
            if (entity.BlobName != null)
                content = await _blobService.DownloadAsync(entity.BlobName);
            else
                content = entity.Content;

            if (content == null || content.Length == 0) return;

            var maxVersion = await _db.FileHistories
                .Where(h => h.FileEntityId == entity.Id)
                .MaxAsync(h => (int?)h.VersionNumber) ?? 0;

            var versionNumber = maxVersion + 1;
            var blobName = BlobService.HistoryBlobName(entity.Id, versionNumber);
            await _blobService.UploadAsync(blobName, content);

            var history = new FileHistory
            {
                FileEntityId = entity.Id,
                VersionNumber = versionNumber,
                BlobName = blobName,
                Content = null,
                Bytes = content.LongLength,
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

        public async Task<byte[]?> GetVersionContentAsync(int fileEntityId, int versionNumber)
        {
            var history = await _db.FileHistories
                .FirstOrDefaultAsync(h => h.FileEntityId == fileEntityId && h.VersionNumber == versionNumber);

            if (history == null) return null;

            if (history.BlobName != null)
                return await _blobService.DownloadAsync(history.BlobName);

            return history.Content;
        }
    }
}
