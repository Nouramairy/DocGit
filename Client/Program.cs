using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

try
{
    var ok = await RunAsync(args);
    Environment.Exit(ok ? 0 : 1);
}
catch
{
    Environment.Exit(1);
}

static async Task<bool> RunAsync(string[] args)
{
    if (args.Length < 2)
        return false;

    var cmd = args[0].Trim().ToLowerInvariant();
    if (cmd is not ("pull" or "push"))
        return false;

    if (args.Length == 3)
        return false;

    var rawBase = args[1].Trim();
    if (string.IsNullOrEmpty(rawBase))
        return false;

    var baseUrl = NormalizeBaseUrl(rawBase);

    using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };

    string? token = null;
    if (args.Length >= 4)
    {
        var user = args[2];
        var password = args[3];
        token = await LoginAsync(http, baseUrl, user, password);
        if (token is null)
            return false;
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    return cmd switch
    {
        "pull" => await PullAsync(http, baseUrl),
        "push" => await PushAsync(http, baseUrl),
        _ => false
    };
}

static string NormalizeBaseUrl(string raw)
{
    var s = raw.Trim();
    if (!s.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
        !s.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
    {
        var local = s.StartsWith("localhost", StringComparison.OrdinalIgnoreCase) ||
                    s.StartsWith("127.0.0.1", StringComparison.OrdinalIgnoreCase);
        s = local ? "http://" + s : "https://" + s;
    }

    return s.TrimEnd('/');
}

static async Task<string?> LoginAsync(HttpClient http, string baseUrl, string user, string password)
{
    var body = JsonSerializer.Serialize(new Dictionary<string, string>
    {
        ["user"] = user,
        ["password"] = password
    });

    HttpResponseMessage resp;
    try
    {
        resp = await http.PostAsync(
            $"{baseUrl}/api/login",
            new StringContent(body, Encoding.UTF8, "application/json"));
    }
    catch
    {
        return null;
    }

    if (!resp.IsSuccessStatusCode)
        return null;

    await using var stream = await resp.Content.ReadAsStreamAsync();
    using var doc = await JsonDocument.ParseAsync(stream);
    if (!doc.RootElement.TryGetProperty("token", out var t))
        return null;

    return t.GetString();
}

static async Task<bool> PullAsync(HttpClient http, string baseUrl)
{
    try
    {
        using var resp = await http.GetAsync($"{baseUrl}/api/files");
        if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            return false;
        if (!resp.IsSuccessStatusCode)
            return false;

        await using var stream = await resp.Content.ReadAsStreamAsync();
        using var treeDoc = await JsonDocument.ParseAsync(stream);
        ClearWorkingDirectory();
        await MaterializeTreeAsync(http, baseUrl, treeDoc.RootElement, "");
        return true;
    }
    catch
    {
        return false;
    }
}

static void ClearWorkingDirectory()
{
    var cwd = Directory.GetCurrentDirectory();
    foreach (var name in Directory.GetFileSystemEntries(cwd))
    {
        var attr = File.GetAttributes(name);
        if (attr.HasFlag(FileAttributes.Directory))
            Directory.Delete(name, recursive: true);
        else
            File.Delete(name);
    }
}

static async Task MaterializeTreeAsync(HttpClient http, string baseUrl, JsonElement node, string relPrefix)
{
    foreach (var prop in node.EnumerateObject())
    {
        var path = string.IsNullOrEmpty(relPrefix) ? prop.Name : $"{relPrefix}/{prop.Name}";
        var el = prop.Value;
        if (!el.TryGetProperty("file", out var fileProp))
            continue;

        var isFile = fileProp.GetBoolean();
        if (isFile)
        {
            var localPath = Path.Combine(Directory.GetCurrentDirectory(), path.Replace('/', Path.DirectorySeparatorChar));
            var dir = Path.GetDirectoryName(localPath);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);

            var url = $"{baseUrl}/api/files/{EscapeApiPath(path)}";
            using var resp = await http.GetAsync(url);
            if (!resp.IsSuccessStatusCode)
                throw new InvalidOperationException();

            await using var fs = new FileStream(localPath, FileMode.Create, FileAccess.Write, FileShare.None);
            await resp.Content.CopyToAsync(fs);
        }
        else
        {
            if (!el.TryGetProperty("content", out var content))
                continue;

            var localDir = Path.Combine(Directory.GetCurrentDirectory(), path.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(localDir);
            await MaterializeTreeAsync(http, baseUrl, content, path);
        }
    }
}

static async Task<bool> PushAsync(HttpClient http, string baseUrl)
{
    var localFiles = new HashSet<string>(StringComparer.Ordinal);
    var localDirs = new HashSet<string>(StringComparer.Ordinal);
    CollectLocalRecursive(Directory.GetCurrentDirectory(), "", localFiles, localDirs);

    try
    {
        using var resp = await http.GetAsync($"{baseUrl}/api/files");
        if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            return false;
        if (!resp.IsSuccessStatusCode)
            return false;

        await using var stream = await resp.Content.ReadAsStreamAsync();
        using var treeDoc = await JsonDocument.ParseAsync(stream);

        var serverPaths = new HashSet<string>(StringComparer.Ordinal);
        CollectServerPaths(treeDoc.RootElement, "", serverPaths);

        var localAll = new HashSet<string>(localFiles, StringComparer.Ordinal);
        foreach (var d in localDirs)
            localAll.Add(d);

        var toDelete = serverPaths.Where(p => !localAll.Contains(p)).ToList();
        toDelete.Sort(ComparePathDepthDesc);

        foreach (var path in toDelete)
        {
            try
            {
                using var del = await http.DeleteAsync($"{baseUrl}/api/files/{EscapeApiPath(path)}");
                if (del.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    return false;
                if (!del.IsSuccessStatusCode)
                    return false;
            }
            catch
            {
                return false;
            }
        }

        var dirsToCreate = localDirs.OrderBy(d => d.Count(c => c == '/')).ToList();
        foreach (var dir in dirsToCreate)
        {
            if (!await PutFolderAsync(http, baseUrl, dir))
                return false;
        }

        foreach (var file in localFiles)
        {
            if (!await PutFileAsync(http, baseUrl, file))
                return false;
        }

        return true;
    }
    catch
    {
        return false;
    }
}

static int ComparePathDepthDesc(string a, string b)
{
    var da = a.Count(c => c == '/');
    var db = b.Count(c => c == '/');
    var cDepth = db.CompareTo(da);
    return cDepth != 0 ? cDepth : string.Compare(b, a, StringComparison.Ordinal);
}

static async Task<bool> PutFolderAsync(HttpClient http, string baseUrl, string path)
{
    try
    {
        using var content = new ByteArrayContent(Array.Empty<byte>());
        content.Headers.ContentType = new MediaTypeHeaderValue("text/plain") { CharSet = "utf-8" };
        using var resp = await http.PutAsync($"{baseUrl}/api/files/{EscapeApiPath(path)}", content);
        if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            return false;
        return resp.IsSuccessStatusCode;
    }
    catch
    {
        return false;
    }
}

static async Task<bool> PutFileAsync(HttpClient http, string baseUrl, string relativePath)
{
    var full = Path.Combine(Directory.GetCurrentDirectory(), relativePath.Replace('/', Path.DirectorySeparatorChar));
    byte[] bytes;
    try
    {
        bytes = await File.ReadAllBytesAsync(full);
    }
    catch
    {
        return false;
    }

    try
    {
        using var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue("text/plain") { CharSet = "utf-8" };
        using var resp = await http.PutAsync($"{baseUrl}/api/files/{EscapeApiPath(relativePath)}", content);
        if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            return false;
        return resp.IsSuccessStatusCode;
    }
    catch
    {
        return false;
    }
}

static void CollectLocalRecursive(string absDir, string relFromRoot, HashSet<string> files, HashSet<string> dirs)
{
    foreach (var subdir in Directory.GetDirectories(absDir))
    {
        var name = Path.GetFileName(subdir);
        var rel = string.IsNullOrEmpty(relFromRoot) ? name : $"{relFromRoot}/{name}";
        dirs.Add(rel);
        CollectLocalRecursive(subdir, rel, files, dirs);
    }

    foreach (var file in Directory.GetFiles(absDir))
    {
        var name = Path.GetFileName(file);
        var rel = string.IsNullOrEmpty(relFromRoot) ? name : $"{relFromRoot}/{name}";
        files.Add(rel);
    }
}

static void CollectServerPaths(JsonElement node, string prefix, HashSet<string> paths)
{
    foreach (var prop in node.EnumerateObject())
    {
        var path = string.IsNullOrEmpty(prefix) ? prop.Name : $"{prefix}/{prop.Name}";
        paths.Add(path);
        var el = prop.Value;
        if (!el.TryGetProperty("file", out var fp) || fp.GetBoolean())
            continue;
        if (el.TryGetProperty("content", out var content))
            CollectServerPaths(content, path, paths);
    }
}

static string EscapeApiPath(string path) =>
    string.Join("/", path.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Uri.EscapeDataString));
