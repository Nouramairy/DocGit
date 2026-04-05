namespace Docgit.DTOs;

public class TrashItemDto
{
    public string Path { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsFile { get; set; }
    public string? DeletedAt { get; set; }
}
