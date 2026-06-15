using Azure.Storage.Blobs;

namespace Docgit.Service
{
    public class BlobService
    {
        private readonly BlobContainerClient _container;

        public BlobService(IConfiguration config)
        {
            var connectionString = config["AzureBlob:ConnectionString"]!;
            var containerName = config["AzureBlob:ContainerName"] ?? "docgit-files";
            _container = new BlobContainerClient(connectionString, containerName);
            _container.CreateIfNotExists();
        }

        public async Task<string> UploadAsync(string blobName, byte[] content)
        {
            var blob = _container.GetBlobClient(blobName);
            using var stream = new MemoryStream(content);
            await blob.UploadAsync(stream, overwrite: true);
            return blobName;
        }

        public async Task<byte[]?> DownloadAsync(string blobName)
        {
            var blob = _container.GetBlobClient(blobName);
            if (!await blob.ExistsAsync())
                return null;
            var response = await blob.DownloadContentAsync();
            return response.Value.Content.ToArray();
        }

        public async Task DeleteAsync(string blobName)
        {
            var blob = _container.GetBlobClient(blobName);
            await blob.DeleteIfExistsAsync();
        }

        public static string FileBlobName(int userId, string path) =>
            $"files/{userId}/{path}";

        public static string HistoryBlobName(int fileEntityId, int versionNumber) =>
            $"history/{fileEntityId}/v{versionNumber}";
    }
}
