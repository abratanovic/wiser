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
}
