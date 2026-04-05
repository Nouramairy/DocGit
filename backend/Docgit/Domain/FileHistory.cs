namespace Docgit.Domain
{
    public class FileHistory
    {
        public int Id { get; set; } //pk
        public int FileEntityId { get; set; } //FK
        public FileSystemEntity FileEntity { get; set; } = null!;
        public int VersionNumber { get; set; } 
        public byte[]? Content { get; set; }
        public long Bytes { get; set; }
        public DateTime SavedAt { get; set; }
    }
}
