using Docgit.Data;
using Docgit.DTOs;
using Docgit.Models;
using Docgit.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Docgit.Controllers;

[ApiController]
public class AuthController : ControllerBase
{
    private readonly JwtService _jwtService;
    private readonly AppDbContext _dbContext;

    public AuthController(JwtService jwtService, AppDbContext dbContext)
    {
        _jwtService = jwtService;
        _dbContext = dbContext;
    }

    [HttpPost("/api/register")]
    public async Task<IActionResult> Register([FromBody] LoginRequestDto request)
    {
        if (await _dbContext.Users.AnyAsync(u => u.Username == request.User))
            return BadRequest(new { message = "Username already exists" });

        var user = new User
        {
            Username = request.User,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "User registered successfully" });
    }

    [HttpPost("/api/login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
    {
        var user = await _jwtService.AuthenticateAsync(request.User, request.Password);
        if (user == null)
            return Unauthorized(new { message = "Invalid username or password" });

        var token = _jwtService.GenerateToken(user);
        return Ok(new LoginResponseDto { Token = token });
    }
}
