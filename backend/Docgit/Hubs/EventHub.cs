using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace Docgit.Hubs

{
   // [Authorize]
    public class EventHub : Hub
    {
        private readonly ILogger<EventHub> _logger;

        public EventHub(ILogger<EventHub> logger)
        {
            _logger = logger;
        }

        public static string UserGroup(int userId) => "hubgroup";

        public static string DocumentGroup(string documentPath)
        {
            var normalized = documentPath.Replace("\\", "/").Trim('/');
            return $"doc:{normalized}";
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userName = Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? Context.User?.Identity?.Name;

            if (!string.IsNullOrWhiteSpace(userId))
            {
                var group = UserGroup(int.Parse(userId));
                await Groups.AddToGroupAsync(Context.ConnectionId, group);

                _logger.LogInformation(
                    "SignalR connected. ConnectionId={ConnectionId}, UserId={UserId}, UserName={UserName}, Group={Group}",
                    Context.ConnectionId,
                    userId,
                    userName,
                    group);

                await Clients.Caller.SendAsync("Connected", new
                {
                    connectionId = Context.ConnectionId,
                    userId,
                    group
                });
            }
            else
            {
                _logger.LogWarning(
                    "SignalR connected without NameIdentifier claim. ConnectionId={ConnectionId}",
                    Context.ConnectionId);
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!string.IsNullOrWhiteSpace(userId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, UserGroup(int.Parse(userId)));
            }

            if (exception == null)
            {
                _logger.LogInformation(
                    "SignalR disconnected. ConnectionId={ConnectionId}, UserId={UserId}",
                    Context.ConnectionId,
                    userId);
            }
            else
            {
                _logger.LogWarning(
                    exception,
                    "SignalR disconnected with error. ConnectionId={ConnectionId}, UserId={UserId}",
                    Context.ConnectionId,
                    userId);
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task JoinGroup(string groupName)
        {
            if (string.IsNullOrWhiteSpace(groupName))
            {
                throw new HubException("Group name is required.");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            _logger.LogInformation(
                "SignalR JoinGroup. ConnectionId={ConnectionId}, Group={Group}",
                Context.ConnectionId,
                groupName);
        }

        public async Task LeaveGroup(string groupName)
        {
            if (string.IsNullOrWhiteSpace(groupName))
            {
                throw new HubException("Group name is required.");
            }

            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
            _logger.LogInformation(
                "SignalR LeaveGroup. ConnectionId={ConnectionId}, Group={Group}",
                Context.ConnectionId,
                groupName);
        }

        public Task JoinDocumentGroup(string documentPath) => JoinGroup(DocumentGroup(documentPath));

        public Task LeaveDocumentGroup(string documentPath) => LeaveGroup(DocumentGroup(documentPath));

    }
}
