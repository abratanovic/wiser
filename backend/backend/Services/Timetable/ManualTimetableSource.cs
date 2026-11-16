using backend.Infrastructure.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Timetable;

/// <summary>The signed-in user's manual faculties, each weekly slot repeated through its term.</summary>
public sealed class ManualTimetableSource(AppDbContext db) : ITimetableSource
{
    public async Task<IReadOnlyList<TimetableSession>> GetSessionsAsync(TimetableQuery query, CancellationToken ct)
    {
        if (query.UserId == null) return [];

        var faculties = await db.ManualFaculties.AsNoTracking()
            .Where(f => f.OwnerId == query.UserId && f.TermStart <= query.To && f.TermEnd >= query.From)
            .Include(f => f.Subjects).ThenInclude(s => s.Slots)
            .ToListAsync(ct);

        return faculties.SelectMany(f => Expand(f, query.From, query.To)).ToList();
    }

    private static IEnumerable<TimetableSession> Expand(ManualFaculty faculty, DateOnly from, DateOnly to)
    {
        var source = new SessionSource($"manual:{faculty.Id}", "manual", faculty.Name);
        var first = from > faculty.TermStart ? from : faculty.TermStart;
        var last = to < faculty.TermEnd ? to : faculty.TermEnd;

        for (var date = first; date <= last; date = date.AddDays(1))
        {
            if (faculty.SkippedDates.Contains(date)) continue;
            var isoDay = date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;

            foreach (var subject in faculty.Subjects)
            foreach (var slot in subject.Slots.Where(s => s.DayOfWeek == isoDay))
                yield return new TimetableSession(
                    Id: $"manual:{slot.Id}:{date:yyyy-MM-dd}",
                    Source: source,
                    SubjectKey: $"manual:{subject.Id}",
                    Subject: subject.Name,
                    Code: null,
                    Type: slot.Type,
                    Room: slot.Room ?? "",
                    Lecturers: slot.Lecturer == null ? [] : [slot.Lecturer],
                    Groups: slot.Group == null ? [] : [slot.Group],
                    StartAt: WallTime(date, slot.StartTime),
                    FinishAt: WallTime(date, slot.EndTime),
                    Status: TimetableSession.Scheduled,
                    SlotId: slot.Id,
                    OccurrenceDate: date);
        }
    }

    private static string WallTime(DateOnly date, TimeOnly time) => date.ToDateTime(time).ToString("yyyy-MM-ddTHH:mm:ss", System.Globalization.CultureInfo.InvariantCulture);
}
