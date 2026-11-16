using backend.Services.Wise;

namespace backend.Services.Timetable;

/// <summary>
/// Somewhere classes come from — Wise today. The timetable endpoint asks every registered source
/// and returns one combined list.
/// </summary>
public interface ITimetableSource
{
    Task<IReadOnlyList<TimetableSession>> GetSessionsAsync(TimetableQuery query, CancellationToken ct);
}

/// <summary>What one timetable request asks for: a date range, who is asking (null when signed out), and their Wise selections.</summary>
public sealed record TimetableQuery(DateOnly From, DateOnly To, string? UserId, IReadOnlyList<WiseSelection> WiseSelections);

/// <summary>Body of POST /api/timetable.</summary>
public sealed class TimetableRequest
{
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    public List<WiseSelection> Selections { get; set; } = new();
}

/// <summary>Which source a session came from. <c>Key</c> is stable and filterable: "wise" for Wise.</summary>
public sealed record SessionSource(string Key, string Kind, string Name);

/// <summary>One class occurrence from any source. Times are Ljubljana wall time, no offset.</summary>
public sealed record TimetableSession(
    string Id,
    SessionSource Source,
    string SubjectKey,
    string Subject,
    string? Code,
    string Type,
    string Room,
    IReadOnlyList<string> Lecturers,
    IReadOnlyList<string> Groups,
    string StartAt,
    string FinishAt,
    string Status)
{
    public const string Scheduled = "scheduled";

    public static SessionSource WiseSource(string name) => new("wise", "wise", name);
}
