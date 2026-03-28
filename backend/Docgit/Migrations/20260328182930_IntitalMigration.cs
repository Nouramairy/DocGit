using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Docgit.Migrations
{
    /// <inheritdoc />
    public partial class IntitalMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FileSystemEntities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ParentId = table.Column<int>(type: "int", nullable: false),
                    UserID = table.Column<int>(type: "int", nullable: false),
                    Path = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IsFile = table.Column<bool>(type: "bit", nullable: false),
                    Content = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    Extintion = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Bytes = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    Directory = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FileSystemEntities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FileSystemEntities_FileSystemEntities_ParentId",
                        column: x => x.ParentId,
                        principalTable: "FileSystemEntities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FileSystemEntities_Users_UserID",
                        column: x => x.UserID,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FileHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FileEntityId = table.Column<int>(type: "int", nullable: false),
                    VersionNumber = table.Column<int>(type: "int", nullable: false),
                    Content = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    Bytes = table.Column<long>(type: "bigint", nullable: false),
                    SavedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FileHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FileHistories_FileSystemEntities_FileEntityId",
                        column: x => x.FileEntityId,
                        principalTable: "FileSystemEntities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FileHistories_FileEntityId",
                table: "FileHistories",
                column: "FileEntityId");

            migrationBuilder.CreateIndex(
                name: "IX_FileSystemEntities_ParentId",
                table: "FileSystemEntities",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_FileSystemEntities_UserID_Path",
                table: "FileSystemEntities",
                columns: new[] { "UserID", "Path" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_UserName",
                table: "Users",
                column: "UserName",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FileHistories");

            migrationBuilder.DropTable(
                name: "FileSystemEntities");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
