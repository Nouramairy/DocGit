namespace Docgit.DTOs;

public class FileHistoryDto
{
    public int Version { get; set; }
    public string SavedAt { get; set; } = string.Empty;
    public long Bytes { get; set; }
}
