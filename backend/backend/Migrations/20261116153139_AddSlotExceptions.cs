using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddSlotExceptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SlotExceptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SlotId = table.Column<int>(type: "integer", nullable: false),
                    OriginalDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    NewStart = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    NewEnd = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    NewRoom = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlotExceptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SlotExceptions_ManualSlots_SlotId",
                        column: x => x.SlotId,
                        principalTable: "ManualSlots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SlotExceptions_SlotId_OriginalDate",
                table: "SlotExceptions",
                columns: new[] { "SlotId", "OriginalDate" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SlotExceptions");
        }
    }
}
