namespace Docgit.Models;

public class FileHistory
{
    public int Id { get; set; }
    public int FileEntityId { get; set; }
    public FileSystemEntity FileEntity { get; set; } = null!;
    public int VersionNumber { get; set; }
    public byte[] Content { get; set; } = Array.Empty<byte>();
    public long Bytes { get; set; }
    public DateTime SavedAt { get; set; }
}
