using Docgit.Data;
using Docgit.Domain;
using Docgit.Hubs;
using Docgit.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using System.Threading.Tasks;


namespace Docgit.Controllers
{
    [Route("api/files")]
    [ApiController]
    public class FilesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly Fileservice _fileService;
        private readonly FileHistoryService _fileHistoryService;
        private readonly IHubContext<EventHub> _hub;




        public FilesController(ApplicationDbContext db, Fileservice fileService, IHubContext<EventHub> hub, FileHistoryService fileHistoryService)
        {
            _db = db;
            _fileService = fileService;
            _hub = hub;
            _fileHistoryService = fileHistoryService;
        }


        private void AddFileHeaders(FileSystemEntity entity)
        {
            // meta data -> information about the files in the header
            // we add these headers so that the frontend doesnt need to process the data we send ,
            // and it can immediately show the data to the user, and user wont have to wait
            Response.Headers["X-Created-At"] = entity.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss");
            Response.Headers["X-Changed-At"] = entity.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss");
            Response.Headers["X-Type"] = entity.IsFile ? "file" : "folder";
            Response.Headers["X-Bytes"] = entity.Bytes.ToString();
            if (entity.Extintion != null)
                Response.Headers["X-Extension"] = entity.Extintion;
        }


        private int UserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        // when user sends the request with token , the token will be decrypted and user id will be extracted and assigned here.


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
        [HttpGet]
        public async Task<IActionResult> GetAll() // This route will be called right after the Auth,
                                                  // returns files that the user with specific user id has accsess to!
        {
            var tree = await _fileService.GetAllForUserAsync(UserId);
            return Ok(tree);
        }


        // GET /api/files/trash  (must be defined before catch-all)
        [HttpGet("trash")]
        public async Task<IActionResult> GetTrash()
        {
            var items = await _fileService.GetTrashAsync(UserId);
            return Ok(items);
        }




        [HttpGet("{**path}")]
        public async Task<IActionResult> GetFileOrFolder(string path)
        {
            // notebook/notes.md -> file
            // notebook/math -> folder


            var fileOrFolder = await _fileService.GetByPathAsync(UserId, path);
            if (fileOrFolder == null)
            {
                return NotFound();
            }


            AddFileHeaders(fileOrFolder);


            //fileOrFolder.Content == null -> the file is ok but it doesnt have any content or empty file
            //!fileOrFolder.IsFile is false , it means its a folder
            if (!fileOrFolder.IsFile || fileOrFolder.Content == null)
            {
                return Ok();
            }


            return File(fileOrFolder.Content, GetMimeType(fileOrFolder.Extintion), fileOrFolder.Name);
        }


        [HttpHead("{**path}")]
        public async Task<IActionResult> HeadFileOrFolder(string path)
        {


            // A search operation -> user seearch like "test"
            // test.md -> small : 200kB -> use get method -> we get the info + file -> file is small -> not a big deal
            //mytest.md -> large : 50Mb -> use get method -> we get the info + file -> file is big -> it will load in the browser ram -> it will slowdown the browser.


            // using get method for large files is not efficient , so we use this method.


            var fileOrFolder = await _fileService.GetByPathAsync(UserId, path);
            if (fileOrFolder == null)
            {
                return NotFound();
            }


            AddFileHeaders(fileOrFolder);
            return Ok();


        }




        [HttpPost("{**path}")]
        public async Task<IActionResult> CreateFile(string path)
        {
            using var ms = new MemoryStream(); // create a new memory stream to hold the file content.
            await Request.Body.CopyToAsync(ms); // copy the content of the request body into the memory stream asynchronously.
            // new thread is created to perform the copy operation without blocking the main thread.
            var content = ms.ToArray(); // convert the memory stream to a byte array, which represents the file content.
            var file = await _fileService.CreateFileAsync(UserId, path, content); // 1 needs to be replaced with the actual user ID of the authenticated user.
            if (file == null)
            {
                return Conflict(new { message = "Already exists" });
            }
            // create a new instance of the Fileservice class and call the CreateFileAsync method to create a new file in the database.


            await _hub.Clients.All.SendAsync("Event", 0, path);
            return Ok(new { message = "File created successfully" });
        }


        [HttpPost("folders/{**path}")]
        public async Task<IActionResult> CreateFolder(string path)
        {
            var folder = await _fileService.CreateFolderAsync(UserId, path);
            if (folder == null)
            {
                return Conflict(new { message = "Already exists" });
            }


            await _hub.Clients.All.SendAsync("Event", 5, path);
            return StatusCode(201);
        }




        // PUT /api/files/{**path}
        [HttpPut("{**path}")]
        public async Task<IActionResult> UpdateFile(string path)
        {
            using var ms = new MemoryStream();
            await Request.Body.CopyToAsync(ms);
            var content = ms.ToArray();


            var (entity, existed) = await _fileService.UpsertFileAsync(UserId, path, content);
            var eventType = existed ? 1 : 0;
            await _hub.Clients.All.SendAsync("Event", eventType, path);
            return Ok();
        }


        // DELETE /api/files/{**path}  — soft-delete or permanent-delete from trash
        [HttpDelete("{**path}")]
        public async Task<IActionResult> SoftDelete(string path)
        {
            var entity = await _fileService.GetByPathAsync(UserId, path);
            var isFolder = entity != null && !entity.IsFile;


            await _fileService.SoftDeleteAsync(UserId, path);
            await _hub.Clients.All.SendAsync("Event", isFolder ? 7 : 2, path);
            return Ok();
        }


        [HttpDelete("trash/{**path}")]
        public async Task<IActionResult> PermanentDeleteFromTrash(string path)
        {
            await _fileService.PermanentDeleteAsync(UserId, path);
            return Ok();
        }
        [HttpGet("history/{**path}")]


        public async Task<IActionResult> GetFileHistory(string path)
        {
            var file = await _fileService.GetByPathAsync(UserId, path);
            if (file == null)
            {
                return NotFound();
            }




            var history = await _fileHistoryService.GetHistoryAsync(file.Id);
            return Ok(history);


        }
        [HttpGet("history/{version:int}/{**path}")]


        public async Task<IActionResult> GetFileHistoryVersion(string path, int version)
        {
            var file = await _fileService.GetByPathAsync(UserId, path);
            if (file == null)
            {
                return NotFound();
            }


            var content = await _fileHistoryService.GetVersionContentAsync(file.Id, version);
            if (content == null)
            {
                return NotFound();
            }


            AddFileHeaders(file);
            return File(content, "text/plain; charset=UTF-8");
        }


        [HttpHead("history/{version:int}/{**path}")]
        public async Task<IActionResult> HeadFileHistoryVersion(string path, int version)
        {
            var file = await _fileService.GetByPathAsync(UserId, path);
            if (file == null)
            {
                return NotFound();
            }


            var content = await _fileHistoryService.GetVersionContentAsync(file.Id, version);
            if (content == null)
            {
                return NotFound();
            }


            AddFileHeaders(file);
            return Ok();
        }


        [HttpPost("history/restore/{version:int}/{**path}")]
        public async Task<IActionResult> RestoreFromHistory(string path, int version)
        {
            var file = await _fileService.GetByPathAsync(UserId, path);
            if (file == null)
            {
                return NotFound();
            }


            var historicalContent = await _fileHistoryService.GetVersionContentAsync(file.Id, version);
            if (historicalContent == null)
            {
                return NotFound();
            }


            await _fileService.UpsertFileAsync(UserId, path, historicalContent);
            await _hub.Clients.All.SendAsync("Event", 1, path);
            return Ok();
        }
        [HttpPost("trash/restore/{**path}")]
        public async Task<IActionResult> RestoreFromTrash(string path)
        {


            var success = await _fileService.RestoreFromTrashAsync(UserId, path);
            if (!success)
            {
                return NotFound();
            }




            await _hub.Clients.All.SendAsync("Event", 0, path);
            return Ok();


        }






    }
}



