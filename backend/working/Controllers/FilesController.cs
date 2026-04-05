using System.Security.Claims;
using Docgit.Hubs;
using Docgit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Docgit.Controllers;

[ApiController]
[Authorize]
public class FilesController : ControllerBase
{
    private readonly FileService _fileService;
    private readonly FileHistoryService _historyService;
    private readonly IHubContext<EventHub> _hub;

    public FilesController(FileService fileService, FileHistoryService historyService, IHubContext<EventHub> hub)
    {
        _fileService = fileService;
        _historyService = historyService;
        _hub = hub;
    }

    // Reads the current logged-in user's id from the JWT claims.
    // We use this in every endpoint so each user can only access their own files.
    private int UserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    // GET /api/files
    // Returns the whole file/folder tree for the current user.
    [HttpGet("/api/files")]
    public async Task<IActionResult> GetAllFiles()
    {
        var tree = await _fileService.GetAllForUserAsync(UserId);
        return Ok(tree);
    }

    // GET /api/files/trash
    // Returns only the items that are in trash (soft-deleted items).
    [HttpGet("/api/files/trash")]
    public async Task<IActionResult> GetTrash()
    {
        var items = await _fileService.GetTrashAsync(UserId);
        return Ok(items);
    }

    // GET /api/files/{path}/history
    // Returns all saved history versions for one file.
    [HttpGet("/api/files/{**path}/history")]
    public async Task<IActionResult> GetFileHistory(string path)
    {
        var file = await _fileService.GetByPathAsync(UserId, path);
        if (file == null)
        {
            return NotFound();
        }

        var history = await _historyService.GetHistoryAsync(file.Id);
        return Ok(history);
    }

    // GET /api/files/{path}/history/{version}
    // Returns the content of one specific historical version.
    [HttpGet("/api/files/{**path}/history/{version:int}")]
    public async Task<IActionResult> GetFileHistoryVersion(string path, int version)
    {
        var file = await _fileService.GetByPathAsync(UserId, path);
        if (file == null)
        {
            return NotFound();
        }

        var content = await _historyService.GetVersionContentAsync(file.Id, version);
        if (content == null)
        {
            return NotFound();
        }

        AddFileHeaders(file);
        return File(content, "text/plain; charset=UTF-8");
    }

    // HEAD /api/files/{path}/history/{version}
    // Same target as GET history version, but returns only headers (no body).
    [HttpHead("/api/files/{**path}/history/{version:int}")]
    public async Task<IActionResult> HeadFileHistoryVersion(string path, int version)
    {
        var file = await _fileService.GetByPathAsync(UserId, path);
        if (file == null)
        {
            return NotFound();
        }

        var content = await _historyService.GetVersionContentAsync(file.Id, version);
        if (content == null)
        {
            return NotFound();
        }

        AddFileHeaders(file);
        return Ok();
    }

    // GET /api/files/{path}
    // Returns file bytes if the path points to a file.
    // Returns 200 OK with no body if the path points to a folder.
    [HttpGet("/api/files/{**path}")]
    public async Task<IActionResult> GetFileOrFolder(string path)
    {
        var fileOrFolder = await _fileService.GetByPathAsync(UserId, path);
        if (fileOrFolder == null)
        {
            return NotFound();
        }

        AddFileHeaders(fileOrFolder);

        if (!fileOrFolder.IsFile || fileOrFolder.Content == null)
        {
            return Ok();
        }

        return File(fileOrFolder.Content, GetMimeType(fileOrFolder.Extension), fileOrFolder.Name);
    }

    // HEAD /api/files/{path}
    // Returns metadata headers only for a file or folder.
    [HttpHead("/api/files/{**path}")]
    public async Task<IActionResult> HeadFileOrFolder(string path)
    {
        var fileOrFolder = await _fileService.GetByPathAsync(UserId, path);
        if (fileOrFolder == null)
        {
            return NotFound();
        }

        AddFileHeaders(fileOrFolder);
        return Ok();
    }

    // POST /api/files/trash/{path}/restore
    // Restores one item from trash back to its original location.
    [HttpPost("/api/files/trash/{**path}/restore")]
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

    // POST /api/files/{path}/history/{version}/restore
    // Copies historical content into the current file (restore old version).
    [HttpPost("/api/files/{**path}/history/{version:int}/restore")]
    public async Task<IActionResult> RestoreFromHistory(string path, int version)
    {
        var file = await _fileService.GetByPathAsync(UserId, path);
        if (file == null)
        {
            return NotFound();
        }

        var historicalContent = await _historyService.GetVersionContentAsync(file.Id, version);
        if (historicalContent == null)
        {
            return NotFound();
        }

        await _fileService.UpsertFileAsync(UserId, path, historicalContent);
        await _hub.Clients.All.SendAsync("Event", 1, path);
        return Ok();
    }

    // POST /api/files/folders/{path}
    // Creates a new folder only.
    // This endpoint never creates files.
    [HttpPost("/api/files/folders/{**path}")]
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

    // POST /api/files/files/{path}
    // Creates a new file only.
    // Request body should contain the file bytes/content.
    [HttpPost("/api/files/files/{**path}")]
    public async Task<IActionResult> CreateFile(string path)
    {
        using var ms = new MemoryStream();
        await Request.Body.CopyToAsync(ms);
        var content = ms.ToArray();

        var file = await _fileService.CreateFileAsync(UserId, path, content);
        if (file == null)
        {
            return Conflict(new { message = "Already exists" });
        }

        await _hub.Clients.All.SendAsync("Event", 0, path);
        return StatusCode(201);
    }

    // PUT /api/files/{**path}
    // Creates or updates a file at the given path.
    // If file already exists => update.
    // If file does not exist => create.
    [HttpPut("/api/files/{**path}")]
    public async Task<IActionResult> CreateOrUpdateFile(string path)
    {
        using var ms = new MemoryStream();
        await Request.Body.CopyToAsync(ms);
        var content = ms.ToArray();

        var (entity, existed) = await _fileService.UpsertFileAsync(UserId, path, content);
        var eventType = existed ? 1 : 0;
        await _hub.Clients.All.SendAsync("Event", eventType, path);
        return Ok();
    }

    // DELETE /api/files/trash/{path}
    // Permanently removes an item from trash.
    [HttpDelete("/api/files/trash/{**path}")]
    public async Task<IActionResult> PermanentDeleteFromTrash(string path)
    {
        await _fileService.PermanentDeleteAsync(UserId, path);
        return Ok();
    }

    // DELETE /api/files/{path}
    // Soft-deletes a normal file or folder (moves it to trash).
    [HttpDelete("/api/files/{**path}")]
    public async Task<IActionResult> SoftDelete(string path)
    {
        var entity = await _fileService.GetByPathAsync(UserId, path);
        var isFolder = entity != null && !entity.IsFile;

        await _fileService.SoftDeleteAsync(UserId, path);
        await _hub.Clients.All.SendAsync("Event", isFolder ? 7 : 2, path);
        return Ok();
    }

    // Adds metadata headers to the HTTP response.
    // These headers help frontend know details without parsing body.
    private void AddFileHeaders(Docgit.Models.FileSystemEntity entity)
    {
        Response.Headers["X-Created-At"] = entity.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss");
        Response.Headers["X-Changed-At"] = entity.ChangedAt.ToString("yyyy-MM-dd HH:mm:ss");
        Response.Headers["X-Type"] = entity.IsFile ? "file" : "folder";
        Response.Headers["X-Bytes"] = entity.Bytes.ToString();

        if (entity.Extension != null)
        {
            Response.Headers["X-Extension"] = entity.Extension;
        }
    }

    // Converts file extension to HTTP MIME type.
    // Browser/editor uses this to understand how to open the file content.
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
}
