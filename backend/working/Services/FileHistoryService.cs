using Docgit.Data;
using Docgit.DTOs;
using Docgit.Models;
using Microsoft.EntityFrameworkCore;

namespace Docgit.Services;

public class FileHistoryService
{
    private readonly AppDbContext _db;

    public FileHistoryService(AppDbContext db)
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

    public async Task<List<FileHistoryDto>> GetHistoryAsync(int fileEntityId)
    {
        return await _db.FileHistories
            .Where(h => h.FileEntityId == fileEntityId)
            .OrderByDescending(h => h.VersionNumber)
            .Select(h => new FileHistoryDto
            {
                Version = h.VersionNumber,
                SavedAt = h.SavedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                Bytes = h.Bytes
            })
            .ToListAsync();
    }

    public async Task<byte[]?> GetVersionContentAsync(int fileEntityId, int version)
    {
        var history = await _db.FileHistories
            .FirstOrDefaultAsync(h => h.FileEntityId == fileEntityId && h.VersionNumber == version);
        return history?.Content;
    }
}
