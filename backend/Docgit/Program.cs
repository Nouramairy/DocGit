using Docgit.Data;
using Docgit.Hubs;
using Docgit.Service;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 100_000_000; // ~100 MB (Vecka 1: 64 MB fil-upload)
});

// Add services to the container.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddControllers();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));

builder.Services.AddScoped<JwtService>(); // register the JwtService as a scoped service in the dependency injection container.
builder.Services.AddScoped<Fileservice>();
// This allows it to be injected into controllers or other services that require it.
builder.Services.AddScoped<FileHistoryService>();
var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Statiska filer: GET / och GET /index.html (Vecka 1-tester). Ingen HTTPS-redirect — testerna anropar http://
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthorization();

app.MapControllers();
app.MapHub<EventHub>("/api/events/signalr");

// SPA fallback — serve index.html for all non-API routes
app.MapFallbackToFile("index.html");

app.Run();
