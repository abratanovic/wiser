using backend.Services.Timetable;

namespace backend.Tests;

/// <summary>
/// Stands in for Wise: one session per posted selection, on the first day of the range at
/// 08:00–10:00, with the selection's picks echoed back as its groups.
/// </summary>
public sealed class StubWiseSource : ITimetableSource
{
    public Task<IReadOnlyList<TimetableSession>> GetSessionsAsync(TimetableQuery query, CancellationToken ct)
    {
        var day = query.From.ToString("yyyy-MM-dd");
        IReadOnlyList<TimetableSession> sessions = query.WiseSelections
            .Select(s => new TimetableSession(
                Id: $"wise:stub-{s.SubjectId}",
                Source: TimetableSession.WiseSource("STUB"),
                SubjectKey: $"wise:{s.SubjectId}",
                Subject: $"Subject {s.SubjectId}",
                Code: null,
                Type: "PR",
                Room: "A-1",
                Lecturers: ["Lecturer"],
                Groups: s.Picks.Values.ToList(),
                StartAt: $"{day}T08:00:00",
                FinishAt: $"{day}T10:00:00",
                Status: TimetableSession.Scheduled))
            .ToList();
        return Task.FromResult(sessions);
    }
}
