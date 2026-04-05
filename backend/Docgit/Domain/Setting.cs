using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Docgit.Domain
{
    public class Setting
    {
        public string Key { get; set; }  = string.Empty;

        public string Id { get; set; } = string.Empty;

        public string Value { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsDeleted { get; set; }
    }
}
