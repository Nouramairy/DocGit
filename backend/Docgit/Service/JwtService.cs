using Docgit.Data;
using Docgit.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Docgit.Service
{
    public class JwtService
    {
        private readonly IConfiguration _configuration;

        private readonly ApplicationDbContext _db;

        public JwtService(IConfiguration configuration, ApplicationDbContext db)
            {
                _db = db;
                _configuration = configuration;
            }

        public async Task<User?> AuthenticateAsync(string username, string password)
        {

  
            var user = await _db.Users.FirstOrDefaultAsync(user => user.UserName == username);
            // in this line , we are searching for the user via _db object. we are using the FirstOrDefaultAsync
            // method to find the first user that matches the provided username. if no user is found,
            // it will return null. if a user is found, it will be stored in the user variable for further processing.

            if (user == null) return null; // if no user is found, we return null to indicate authentication failure.

            if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash)) return null;
            // in this line, we are using the BCrypt library to verify the provided
            // password against the stored password hash.
            return user;
        }


        public string GenerateToken(User user)
        {
            var secret = _configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT secret not configured");
            // the secret variable retrieves the JWT secret key from the configuration.
            // if the secret is not configured, it throws an exception to indicate that the JWT secret is missing.

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            // the key variable creates a new SymmetricSecurityKey using the secret key.
            // The secret key is converted to a byte array using UTF8 encoding.

            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            // the signing credentials is used to specify the key and algorithm used to sign the JWT token.
            //  the creads variable creates new SigningCredentials using the symmetric key and specifying
            //  the HMAC SHA256 algorithm for signing the token.
            // the creds variable creates new SigningCredentials using
            // the symmetric key and specifying the HMAC SHA256 algorithm for signing the token.

            var claims = new[]
            {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.UserName)
        };
            // a claim is a statement about an entity (typically, the user) and additional metadata.
            // Claims are used to store information about the user in the JWT token.
            // the claims variable defines an array of claims to be included in the JWT token.
            // In this case, it includes the user's ID and username as claims.
            // we are using the id  and username , as we will find them useful
            // when we want to identify the user from the token later on.
            // we will use the username to find the user if id is not available for some reason.

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddHours(24),
                signingCredentials: creds
            );
            // the token variable creates a new JwtSecurityToken using the specified claims,
            // expiration time, and signing credentials.

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

    }
}
