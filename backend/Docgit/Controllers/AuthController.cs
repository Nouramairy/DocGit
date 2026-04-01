using Docgit.Data;
using Docgit.Domain;
using Docgit.Dto;
using Docgit.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Docgit.Controllers
{
    //[Route("api/[controller]")]
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
        [HttpPost("/api/register")] //Rout/api/register
        public async Task<IActionResult> Register([FromBody]LogInReqDTO request)
        {
            if (await _db.Users.AnyAsync(user => user.UserName == request.UserName)) // to avoid duplicate username
                return BadRequest(new { message = "Username already exists" });

           // if (request.Password.Length < 8) // has to be at least 8 characters long
               // return BadRequest(new { message = "password must be longer than 8" });
           // if (!request.Password.Any(char.IsUpper)) // has to contain at least one uppercase letter
               // return BadRequest(new { message = "password must contain at least one uppercase letter" });
            var user = new User     // create a new user object and hash the password using BCrypt
            {
                UserName = request.UserName,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password) 
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();// save the new user to the database

            return Ok(new { message = "User registered successfully" });
        }

        [HttpPost("/api/login")] //  Route/api/login
        public async Task<IActionResult> Login([FromBody] LogInReqDTO request)
        {
            var user = await _jwtService.AuthenticateAsync(request.UserName, request.Password);
            if (user == null)
                return Unauthorized(new { message = "Invalid username or password" });

            var token = _jwtService.GenerateToken(user); // Generate a JWT token for the authenticated user
           
            return Ok(new LogInResponseDto {Token = token});
        }
    }
}
