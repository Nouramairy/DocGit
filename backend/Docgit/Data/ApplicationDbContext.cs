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

            // its a two way relationship
            modelBuilder.Entity<FileHistory>()
                .HasOne<FileSystemEntity>() // each file history is associated with one file system entity
                .WithMany(file=> file.FileHistories) // a file system entity can have many file histories
                .HasForeignKey(fileHistory => fileHistory.FileEntityId) // foreign Key in file history that references file system entity
                .OnDelete(DeleteBehavior.Cascade); // if we delete a file system entity, we want to delete all the file histories associated with that file system entity

            modelBuilder.Entity<User>()
                .HasIndex(user => user.UserName) // create an index on the UserName property
                .IsUnique(); // ensure that the UserName is unique across all users

            // not so important
            modelBuilder.Entity<FileSystemEntity>()
                .HasIndex(file  => new {file.UserID, file.Path })
                . IsUnique();

            // we will talk about it later
            modelBuilder.Entity<FileSystemEntity>()
                .HasOne(file => file.Parent)
                .WithMany(file => file.Children)
                .HasForeignKey(file => file.ParentId)
                .OnDelete(DeleteBehavior.Restrict);


        }

    }
}
