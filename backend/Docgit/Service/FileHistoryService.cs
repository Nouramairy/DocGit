using Docgit.Data;

namespace Docgit.Service
{
    public class FileHistoryService
    {
        private readonly ApplicationDbContext _db;

        public FileHistoryService(ApplicationDbContext db)
        {
            _db = db;
        }
    }
}
