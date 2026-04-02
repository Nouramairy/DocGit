namespace Docgit.Dto
{
    public class FileHistroyDto
    {
        public int version { get; set; }
        public string SavedAt { get; set; } = string.Empty;

        public long Bytes { get; set; }
    }
}
