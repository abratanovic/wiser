using System.Security.Claims;
using backend.Services.Timetable;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

/// <summary>
/// The student's timetable from every source at once. Open to signed-out visitors: the Wise
/// selections travel in the body, so the timetable works without an account.
/// </summary>
[ApiController]
[Route("api/timetable")]
public class TimetableController(IEnumerable<ITimetableSource> sources) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Get([FromBody] TimetableRequest request, CancellationToken ct)
    {
        if (request.To < request.From)
            return BadRequest(new {message = "'to' falls before 'from'"});

        if (request.To.DayNumber - request.From.DayNumber > 400)
            return BadRequest(new {message = "Range is longer than 400 days"});

        var query = new TimetableQuery(request.From, request.To,
            User.FindFirstValue(ClaimTypes.NameIdentifier), request.Selections);

        var perSource = await Task.WhenAll(sources.Select(s => s.GetSessionsAsync(query, ct)));
        return Ok(perSource.SelectMany(s => s).OrderBy(s => s.StartAt, StringComparer.Ordinal));
    }
}
