using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using backend.Infrastructure.Database;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

/// <summary>
/// Owner-only CRUD for manual faculties, their subjects and weekly slots. Anything the caller
/// does not own is a 404, so nobody can probe for another user's ids.
/// </summary>
[ApiController]
[Route("api/manual-faculties")]
[Authorize]
public class ManualFacultiesController(AppDbContext db) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    private IQueryable<ManualFaculty> MyFaculties => db.ManualFaculties.Where(f => f.OwnerId == UserId);
    private IQueryable<ManualSubject> MySubjects => db.ManualSubjects.Where(s => s.Faculty.OwnerId == UserId);
    private IQueryable<ManualSlot> MySlots => db.ManualSlots.Where(s => s.Subject.Faculty.OwnerId == UserId);

    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await MyFaculties.AsNoTracking()
            .Include(f => f.Subjects.OrderBy(s => s.Id)).ThenInclude(s => s.Slots.OrderBy(s => s.Id))
            .OrderBy(f => f.Id)
            .ToListAsync());

    [HttpPost]
    public async Task<IActionResult> CreateFaculty([FromBody] FacultyRequest req)
    {
        var faculty = new ManualFaculty {OwnerId = UserId};
        req.ApplyTo(faculty);
        db.ManualFaculties.Add(faculty);
        await db.SaveChangesAsync();
        return Ok(faculty);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateFaculty(int id, [FromBody] FacultyRequest req)
    {
        var faculty = await MyFaculties.FirstOrDefaultAsync(f => f.Id == id);
        if (faculty == null) return NotFound();
        req.ApplyTo(faculty);
        await db.SaveChangesAsync();
        return Ok(faculty);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteFaculty(int id) =>
        await MyFaculties.Where(f => f.Id == id).ExecuteDeleteAsync() == 0 ? NotFound() : NoContent();

    [HttpPost("{facultyId:int}/subjects")]
    public async Task<IActionResult> CreateSubject(int facultyId, [FromBody] SubjectRequest req)
    {
        if (!await MyFaculties.AnyAsync(f => f.Id == facultyId)) return NotFound();
        var subject = new ManualSubject {FacultyId = facultyId, Name = req.Name};
        db.ManualSubjects.Add(subject);
        await db.SaveChangesAsync();
        return Ok(subject);
    }

    [HttpPut("subjects/{id:int}")]
    public async Task<IActionResult> UpdateSubject(int id, [FromBody] SubjectRequest req)
    {
        var subject = await MySubjects.FirstOrDefaultAsync(s => s.Id == id);
        if (subject == null) return NotFound();
        subject.Name = req.Name;
        await db.SaveChangesAsync();
        return Ok(subject);
    }

    [HttpDelete("subjects/{id:int}")]
    public async Task<IActionResult> DeleteSubject(int id) =>
        await MySubjects.Where(s => s.Id == id).ExecuteDeleteAsync() == 0 ? NotFound() : NoContent();

    [HttpPost("subjects/{subjectId:int}/slots")]
    public async Task<IActionResult> CreateSlot(int subjectId, [FromBody] SlotRequest req)
    {
        if (!await MySubjects.AnyAsync(s => s.Id == subjectId)) return NotFound();
        var slot = new ManualSlot {SubjectId = subjectId};
        req.ApplyTo(slot);
        db.ManualSlots.Add(slot);
        await db.SaveChangesAsync();
        return Ok(slot);
    }

    [HttpPut("slots/{id:int}")]
    public async Task<IActionResult> UpdateSlot(int id, [FromBody] SlotRequest req)
    {
        var slot = await MySlots.FirstOrDefaultAsync(s => s.Id == id);
        if (slot == null) return NotFound();
        req.ApplyTo(slot);
        await db.SaveChangesAsync();
        return Ok(slot);
    }

    [HttpDelete("slots/{id:int}")]
    public async Task<IActionResult> DeleteSlot(int id) =>
        await MySlots.Where(s => s.Id == id).ExecuteDeleteAsync() == 0 ? NotFound() : NoContent();
}

public sealed class FacultyRequest : IValidatableObject
{
    [Required, StringLength(200, MinimumLength = 1)] public string Name { get; set; } = "";
    public DateOnly TermStart { get; set; }
    public DateOnly TermEnd { get; set; }
    public List<DateOnly> SkippedDates { get; set; } = new();

    public IEnumerable<ValidationResult> Validate(ValidationContext _)
    {
        if (TermEnd < TermStart)
            yield return new ValidationResult("Term end falls before term start", [nameof(TermEnd)]);
    }

    public void ApplyTo(ManualFaculty f)
    {
        f.Name = Name.Trim();
        f.TermStart = TermStart;
        f.TermEnd = TermEnd;
        f.SkippedDates = SkippedDates.Distinct().Order().ToList();
    }
}

public sealed class SubjectRequest
{
    [Required, StringLength(200, MinimumLength = 1)] public string Name { get; set; } = "";
}

public sealed class SlotRequest : IValidatableObject
{
    [Required, StringLength(50, MinimumLength = 1)] public string Type { get; set; } = "";
    [StringLength(50)] public string? Group { get; set; }
    /// <summary>ISO: 1 = Monday ... 7 = Sunday.</summary>
    [Range(1, 7)] public int DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    [StringLength(200)] public string? Room { get; set; }
    [StringLength(200)] public string? Lecturer { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext _)
    {
        if (EndTime <= StartTime)
            yield return new ValidationResult("End time must be after start time", [nameof(EndTime)]);
    }

    public void ApplyTo(ManualSlot s)
    {
        s.Type = Type.Trim();
        s.Group = string.IsNullOrWhiteSpace(Group) ? null : Group.Trim();
        s.DayOfWeek = DayOfWeek;
        s.StartTime = StartTime;
        s.EndTime = EndTime;
        s.Room = string.IsNullOrWhiteSpace(Room) ? null : Room.Trim();
        s.Lecturer = string.IsNullOrWhiteSpace(Lecturer) ? null : Lecturer.Trim();
    }
}
