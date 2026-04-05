using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Docgit.Hubs

{
    [Authorize]
    public class EventHub : Hub
    {

    }
}
