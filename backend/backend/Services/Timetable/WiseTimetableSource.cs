using backend.Services.Wise;

namespace backend.Services.Timetable;

/// <summary>The Wise school configured for this deployment, read through <see cref="WiseClient"/>.</summary>
public sealed class WiseTimetableSource(WiseClient wise) : ITimetableSource
{
    public async Task<IReadOnlyList<TimetableSession>> GetSessionsAsync(TimetableQuery query, CancellationToken ct) =>
        query.WiseSelections.Count == 0 ? [] : await wise.GetTimetableAsync(query, ct);
}
