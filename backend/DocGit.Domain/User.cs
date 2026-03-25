using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DocGit.Domain
{
    public class User
    {
        public string Name { get; set; } 

        public string Email { get; set; }

        private string _Password { get; set; }

        public  DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public bool IsDeleted { get; set; } 

        

    }
}
