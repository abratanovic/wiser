using System.Text.Json.Serialization;

namespace backend.Models;

/// <summary>A non-Wise school whose weekly schedule the owner enters by hand.</summary>
public class ManualFaculty
{
    public int Id { get; set; }
    [JsonIgnore] public string OwnerId { get; set; } = null!;
    [JsonIgnore] public AppUser Owner { get; set; } = null!;
    public string Name { get; set; } = null!;
    public DateOnly TermStart { get; set; }
    public DateOnly TermEnd { get; set; }
    public List<DateOnly> SkippedDates { get; set; } = new();
    public List<ManualSubject> Subjects { get; set; } = new();

    /// <summary>Whether the slot has a class on this date: its weekday, inside the term, not skipped.</summary>
    public bool Occurs(ManualSlot slot, DateOnly date) =>
        date >= TermStart && date <= TermEnd && !SkippedDates.Contains(date) &&
        slot.DayOfWeek == (date.DayOfWeek == System.DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek);
}

public class ManualSubject
{
    public int Id { get; set; }
    public int FacultyId { get; set; }
    [JsonIgnore] public ManualFaculty Faculty { get; set; } = null!;
    public string Name { get; set; } = null!;
    /// <summary>The exercise group the owner attends; null shows every group.</summary>
    public string? PickedGroup { get; set; }
    public List<ManualSlot> Slots { get; set; } = new();
}

/// <summary>One weekly class. Times are Ljubljana wall-clock, like Wise.</summary>
public class ManualSlot
{
    public int Id { get; set; }
    public int SubjectId { get; set; }
    [JsonIgnore] public ManualSubject Subject { get; set; } = null!;
    /// <summary>Free-text type label as entered: PR, VJ, Praksa...</summary>
    public string Type { get; set; } = null!;
    public string? Group { get; set; }
    /// <summary>ISO day of week: 1 = Monday ... 7 = Sunday.</summary>
    public int DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public string? Room { get; set; }
    public string? Lecturer { get; set; }
    [JsonIgnore] public List<SlotException> Exceptions { get; set; } = new();
}

/// <summary>One occurrence of a slot cancelled or moved, without touching the weekly pattern.</summary>
[Microsoft.EntityFrameworkCore.Index(nameof(SlotId), nameof(OriginalDate), IsUnique = true)]
public class SlotException
{
    public const string Cancelled = "cancelled";
    public const string Moved = "moved";

    public int Id { get; set; }
    public int SlotId { get; set; }
    [JsonIgnore] public ManualSlot Slot { get; set; } = null!;
    public DateOnly OriginalDate { get; set; }
    /// <summary><see cref="Cancelled"/> or <see cref="Moved"/>.</summary>
    public string Kind { get; set; } = null!;
    // Ljubljana wall-clock, like slot times.
    [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "timestamp without time zone")] public DateTime? NewStart { get; set; }
    [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "timestamp without time zone")] public DateTime? NewEnd { get; set; }
    public string? NewRoom { get; set; }
}
