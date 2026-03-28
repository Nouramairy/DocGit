using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Docgit.Controllers
{
    //[Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        public AuthController()
        {
            
        }
        [HttpPost("/api/register")] //Rout/api/register
        public async Task<IActionResult> Register(string userName, string Password)
        {

            return Ok();
        }
    }
}
