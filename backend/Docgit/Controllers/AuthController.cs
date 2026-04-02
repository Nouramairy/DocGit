using Docgit.Data;
using Docgit.Domain;
using Docgit.Dto;
using Docgit.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Docgit.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        private readonly ApplicationDbContext _db;
        private readonly JwtService _jwtService;

        public AuthController(ApplicationDbContext db, IConfiguration configuration, JwtService jwtService )
        {
            _configuration = configuration;
            _db = db;
            _jwtService = jwtService;
        }
      [HttpPost("register")] // Route/api/register 
        public async Task<IActionResult> Register([FromBody] RegisterDto request)
        {
            try
            {
                //if (request == null)
                    //return BadRequest(new { step = "request", message = "Request is null" });

                if (string.IsNullOrWhiteSpace(request.UserName))
                    return BadRequest(new { step = "username", message = "Username is required" });

                if (string.IsNullOrWhiteSpace(request.Password))
                    return BadRequest(new { step = "password", message = "Password is required" });

                bool Userexists = await _db.Users.AnyAsync(u => u.UserName == request.UserName);

                if (Userexists)
                    return BadRequest(new { step = "exists", message = "Username already exists" });

                string hash = BCrypt.Net.BCrypt.HashPassword(request.Password);

                bool Emailexists = await _db.Users.AnyAsync(u => u.Email == request.Email);

                if (Emailexists)
                    return BadRequest(new { step = "emailexists", message = "Email already exists" });

                var newUser = new User
                {
                    UserName = request.UserName,
                    PasswordHash = hash,
                    Name = request.Name,
                    Email = request.Email,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsDeleted = false
                };

                _db.Users.Add(newUser);
                await _db.SaveChangesAsync();

                return Ok(new { step = "done", message = "User registered successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    type = ex.GetType().FullName,
                    message = ex.Message,
                    inner = ex.InnerException?.Message,
                    stackTrace = ex.StackTrace
                });
            }
        }  

        [HttpPost("login")] //  Route/api/login
        public async Task<IActionResult> Login([FromBody] LogInReqDto request)
        {
            var user = await _jwtService.AuthenticateAsync(request.UserName, request.Password);
            if (user == null)
                return Unauthorized(new { message = "Invalid username or password" });

            var token = _jwtService.GenerateToken(user); // Generate a JWT token for the authenticated user
           
            return Ok(new LogInResponseDto {Token = token});
        }
    }
}
