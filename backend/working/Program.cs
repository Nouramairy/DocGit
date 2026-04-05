using System.Text;
using Docgit.Data;
using Docgit.Hubs;
using Docgit.Models;
using Docgit.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Services
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<FileHistoryService>();
builder.Services.AddScoped<FileService>();

// JWT Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"]!;
var key = Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        };

        // Allow token via query string for SignalR
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) &&
                    path.StartsWithSegments("/api/events/signalr"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// SignalR
builder.Services.AddSignalR();

// Controllers
builder.Services.AddControllers()
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull);

// Swagger
builder.Services.AddSwaggerGen();

// CORS for Angular dev server
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()));

// Kestrel body size limit (1 GB for file uploads)
builder.WebHost.ConfigureKestrel(options =>
    options.Limits.MaxRequestBodySize = 1_073_741_824);

var app = builder.Build();

// Ensure database exists and seed test user
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    if (!db.Users.Any(u => u.Username == "test-user"))
    {
        db.Users.Add(new User
        {
            Username = "test-user",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("So Long, and Thanks for All the Fish"),
            CreatedAt = DateTime.UtcNow
        });
        db.SaveChanges();
    }
}

// Static files (Angular production build)
app.UseDefaultFiles();
app.UseStaticFiles();

// Swagger (dev only)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<EventHub>("/api/events/signalr");

// SPA fallback — serve index.html for all non-API routes
app.MapFallbackToFile("index.html");

app.Run();
