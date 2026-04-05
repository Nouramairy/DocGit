namespace Docgit.Models;

public class FileSystemEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public bool IsFile { get; set; }
    public byte[]? Content { get; set; }
    public string? Extension { get; set; }
    public long Bytes { get; set; }
    public int? ParentId { get; set; }
    public FileSystemEntity? Parent { get; set; }
    public ICollection<FileSystemEntity> Children { get; set; } = new List<FileSystemEntity>();
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ChangedAt { get; set; }
    public ICollection<FileHistory> Histories { get; set; } = new List<FileHistory>();
}
