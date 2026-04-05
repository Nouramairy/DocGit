using Docgit.Models;
using Microsoft.EntityFrameworkCore;

namespace Docgit.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<FileSystemEntity> FileSystemEntities => Set<FileSystemEntity>();
    public DbSet<FileHistory> FileHistories => Set<FileHistory>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<FileSystemEntity>()
            .HasIndex(f => new { f.UserId, f.Path })
            .IsUnique();

        modelBuilder.Entity<FileSystemEntity>()
            .HasOne(f => f.Parent)
            .WithMany(f => f.Children)
            .HasForeignKey(f => f.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FileSystemEntity>()
            .HasOne(f => f.User)
            .WithMany()
            .HasForeignKey(f => f.UserId);

        modelBuilder.Entity<FileHistory>()
            .HasOne(h => h.FileEntity)
            .WithMany(f => f.Histories)
            .HasForeignKey(h => h.FileEntityId);
    }
}
