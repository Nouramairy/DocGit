using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Docgit.Migrations
{
    /// <inheritdoc />
    public partial class AddBlobStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BlobName",
                table: "FileSystemEntities",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BlobName",
                table: "FileHistories",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BlobName",
                table: "FileSystemEntities");

            migrationBuilder.DropColumn(
                name: "BlobName",
                table: "FileHistories");
        }
    }
}
