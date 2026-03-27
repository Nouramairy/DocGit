using Docgit.Domain;
using Microsoft.EntityFrameworkCore;

namespace Docgit.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions options) : base(options)
        {
        }
        public DbSet<FileSystemEntity> FileSystemEntities => Set<FileSystemEntity>();
        public DbSet<FileHistory> FileHistories => Set<FileHistory>();

        public DbSet<User> Users => Set<User>();

        protected override void OnModelCreating(ModelBuilder modelBuilder) // very important for configuring relationships and constraints
        {
            base.OnModelCreating(modelBuilder);
            // Configure relationships and constraints
            modelBuilder.Entity<FileSystemEntity>() // Fluent Api  to configure the relationship between FileSystemEntity and User
                .HasOne(fileSystem => fileSystem.User) // has one user f means the file system entity has one user
                .WithMany() // user can have many file system entities
                .HasForeignKey(fileSystem => fileSystem.UserID)  // foreign key in file system entity that references user
                .OnDelete(DeleteBehavior.Cascade); // if we delete a user, we want to delete all the file system entities associated with that user.
        }

    }
}
