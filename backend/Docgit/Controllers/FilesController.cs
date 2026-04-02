using Docgit.Data;
using Docgit.Domain;
using Docgit.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace Docgit.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FilesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly Fileservice _fileService;  

        public FilesController(ApplicationDbContext db, Fileservice fileService)
        {
            _db = db;
            _fileService = fileService;
        }

        private void AddFileHeaders(FileSystemEntity entity)
        {
            Response.Headers["X-Created-At"] = entity.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss");
            Response.Headers["X-Changed-At"] = entity.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss");
            Response.Headers["X-Type"] = entity.IsFile ? "file" : "folder";
            Response.Headers["X-Bytes"] = entity.Bytes.ToString();
            //if (entity.Extension != null)
            //    Response.Headers["X-Extension"] = entity.Extension;
        }


        private static string GetMimeType(string? extension)
        {
            return extension?.ToLowerInvariant() switch
            {
                ".txt" => "text/plain; charset=UTF-8",
                ".md" => "text/markdown; charset=UTF-8",
                ".json" => "application/json; charset=UTF-8",
                ".html" or ".htm" => "text/html; charset=UTF-8",
                ".css" => "text/css; charset=UTF-8",
                ".js" => "application/javascript; charset=UTF-8",
                ".ts" => "text/plain; charset=UTF-8",
                ".xml" => "application/xml; charset=UTF-8",
                ".csv" => "text/csv; charset=UTF-8",
                _ => "application/octet-stream"
            };
        }


        // GET /api/files
        [HttpGet("/api/files")]
        public async Task<IActionResult> GetAll()
        {
            var tree = await _fileService.GetAllForUserAsync(UserId);
            return Ok(tree);
        }

        // GET /api/files/trash  (must be defined before catch-all)
        [HttpGet("/api/files/trash")]
        public async Task<IActionResult> GetTrash()
        {
            var items = await _fileService.GetTrashAsync(UserId);
            return Ok(items);
        }

        [HttpPost("{**path}")]
        public async Task<IActionResult> Post(string path) 
        {
            using var ms = new MemoryStream(); // create a new memory stream to hold the file content.
            await Request.Body.CopyToAsync(ms); // copy the content of the request body into the memory stream asynchronously. 
            // new thread is created to perform the copy operation without blocking the main thread. 
            var content = ms.ToArray(); // convert the memory stream to a byte array, which represents the file content.
            var file = await _fileService.CreateFileAsync(1, path, content); // 1 needs to be replaced with the actual user ID of the authenticated user.
            // create a new instance of the Fileservice class and call the CreateFileAsync method to create a new file in the database.
            return Ok(new { message = "File created successfully" });
        }


        // PUT /api/files/{**path}
        [HttpPut("/api/files/{**path}")]
        public async Task<IActionResult> Put(string path)
        {
            //using var ms = new MemoryStream();
            //await Request.Body.CopyToAsync(ms);
            //var content = ms.ToArray();

            //var (entity, existed) = await _fileService.UpsertFileAsync(UserId, path, content);
            //var eventType = existed ? 1 : 0;
            //await _hub.Clients.All.SendAsync("Event", eventType, path);
            return Ok();
        }

        // DELETE /api/files/{**path}  — soft-delete or permanent-delete from trash
        [HttpDelete("/api/files/{**path}")]
        public async Task<IActionResult> Delete(string path)
        {
            //// DELETE /api/files/trash/{path}
            //if (path.StartsWith("trash/", StringComparison.OrdinalIgnoreCase))
            //{
            //    var trashPath = path["trash/".Length..];
            //    await _fileService.PermanentDeleteAsync(UserId, trashPath);
            //    return Ok();
            //}

            //var entity = await _fileService.GetByPathAsync(UserId, path);
            //var isFolder = entity != null && !entity.IsFile;

            //await _fileService.SoftDeleteAsync(UserId, path);
            //await _hub.Clients.All.SendAsync("Event", isFolder ? 7 : 2, path);
            return Ok();
        }





    }

}
