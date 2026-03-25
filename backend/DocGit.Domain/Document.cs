using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DocGit.Domain
{
    public class Document
    {
        public string Title { get; set; }
        public string Content { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsDeleted { get; set; }

        public bool IsShared { get; set; } 

        public string Directory { get; set; }

        // each doc will have multiple collaborators -> plural entity -> table
        // each user can share a doc to collaborators


    }
}
