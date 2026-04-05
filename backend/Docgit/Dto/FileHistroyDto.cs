namespace Docgit.Dto
{
    public class FileHistroyDto
    {
        public int Version { get; set; }
        public string SavedAt { get; set; } = string.Empty;

        public long Bytes { get; set; }
    }
}
