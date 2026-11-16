using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddManualFaculties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ManualFaculties",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OwnerId = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    TermStart = table.Column<DateOnly>(type: "date", nullable: false),
                    TermEnd = table.Column<DateOnly>(type: "date", nullable: false),
                    SkippedDates = table.Column<List<DateOnly>>(type: "date[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ManualFaculties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ManualFaculties_AspNetUsers_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ManualSubjects",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FacultyId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    PickedGroup = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ManualSubjects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ManualSubjects_ManualFaculties_FacultyId",
                        column: x => x.FacultyId,
                        principalTable: "ManualFaculties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ManualSlots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SubjectId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Group = table.Column<string>(type: "text", nullable: true),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    Room = table.Column<string>(type: "text", nullable: true),
                    Lecturer = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ManualSlots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ManualSlots_ManualSubjects_SubjectId",
                        column: x => x.SubjectId,
                        principalTable: "ManualSubjects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ManualFaculties_OwnerId",
                table: "ManualFaculties",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_ManualSlots_SubjectId",
                table: "ManualSlots",
                column: "SubjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ManualSubjects_FacultyId",
                table: "ManualSubjects",
                column: "FacultyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ManualSlots");

            migrationBuilder.DropTable(
                name: "ManualSubjects");

            migrationBuilder.DropTable(
                name: "ManualFaculties");
        }
    }
}
