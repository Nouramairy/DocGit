namespace Docgit.Dto
{
    public class TrashIteamDto
    {
        public string Name { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
        public bool IsFile { get; set; }
        public string DeletedAt { get; set; } = string.Empty;
    }
}
