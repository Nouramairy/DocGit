using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Docgit.Domain
{
    public class FileSystemEntity
    {
        public string Name { get; set; } = string.Empty;
        public int Id { get; set; } // PK
        public int? ParentId { get; set; } //  FK
        public int UserID { get; set; } //FK 
        public User? User { get; set; } = null;
        public string Path { get; set; } = string.Empty;
        public bool IsFile { get; set; }
        public byte[]? Content { get; set; } 
        public string? Extintion { get; set; } = string.Empty; // need to fix
        public FileSystemEntity? Parent { get; set; }

        public long Bytes { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        public bool IsDeleted { get; set; }

        public ICollection<FileSystemEntity> Children { get; set; } = new List<FileSystemEntity>();
        public ICollection<FileHistory> FileHistories { get; set; } = new List<FileHistory>();

        public string Directory { get; set; } = string.Empty;

        // each doc will have multiple collaborators -> plural entity -> table
        // each user can share a doc to collaborators


    }
}
