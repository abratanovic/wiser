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
            // No term filter: an occurrence may be moved into the range from outside the term.
            .Where(f => f.OwnerId == query.UserId)
            .Include(f => f.Subjects).ThenInclude(s => s.Slots).ThenInclude(s => s.Exceptions)
            .ToListAsync(ct);

        return faculties.SelectMany(f => Expand(f, query.From, query.To)).ToList();
    }

    private static IEnumerable<TimetableSession> Expand(ManualFaculty faculty, DateOnly from, DateOnly to)
    {
        var source = new SessionSource($"manual:{faculty.Id}", "manual", faculty.Name);
        for (var date = from; date <= to; date = date.AddDays(1))
        {
            foreach (var subject in faculty.Subjects)
            foreach (var slot in subject.Slots.Where(s => faculty.Occurs(s, date) && InPickedGroup(subject, s)))
            {
                var exception = slot.Exceptions.FirstOrDefault(e => e.OriginalDate == date);
                if (exception?.Kind == SlotException.Moved) continue; // shown at its new time below
                yield return Session(source, subject, slot, date, date.ToDateTime(slot.StartTime), date.ToDateTime(slot.EndTime),
                    slot.Room, exception == null ? TimetableSession.Scheduled : TimetableSession.Cancelled);
            }
        }

        foreach (var subject in faculty.Subjects)
        foreach (var slot in subject.Slots.Where(s => InPickedGroup(subject, s)))
        foreach (var move in slot.Exceptions.Where(e => e.Kind == SlotException.Moved))
        {
            var day = DateOnly.FromDateTime(move.NewStart!.Value);
            if (day >= from && day <= to)
                yield return Session(source, subject, slot, move.OriginalDate, move.NewStart.Value, move.NewEnd!.Value,
                    move.NewRoom ?? slot.Room, TimetableSession.Moved);
        }
    }

    private static TimetableSession Session(SessionSource source, ManualSubject subject, ManualSlot slot, DateOnly date,
        DateTime start, DateTime finish, string? room, string status) =>
        new(
            Id: $"manual:{slot.Id}:{date:yyyy-MM-dd}",
            Source: source,
            SubjectKey: $"manual:{subject.Id}",
            Subject: subject.Name,
            Code: null,
            Type: slot.Type,
            Room: room ?? "",
            Lecturers: slot.Lecturer == null ? [] : [slot.Lecturer],
            Groups: slot.Group == null ? [] : [slot.Group],
            StartAt: WallTime(start),
            FinishAt: WallTime(finish),
            Status: status,
            SlotId: slot.Id,
            OccurrenceDate: date);

    /// <summary>Ungrouped slots always show; a pick no slot uses any more (group renamed or deleted) hides nothing.</summary>
    private static bool InPickedGroup(ManualSubject subject, ManualSlot slot) =>
        slot.Group == null || subject.PickedGroup == null || slot.Group == subject.PickedGroup
        || subject.Slots.All(s => s.Group != subject.PickedGroup);

    private static string WallTime(DateTime time) => time.ToString("yyyy-MM-ddTHH:mm:ss", System.Globalization.CultureInfo.InvariantCulture);
}
