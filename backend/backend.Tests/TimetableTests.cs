using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace backend.Tests;

[Collection("api")]
public sealed class TimetableTests(ApiFactory api)
{
    private static object Body(string from, string to) => new
    {
        from,
        to,
        selections = new object[]
        {
            new {subjectId = 101, picks = new Dictionary<string, string>()},
            new {subjectId = 202, picks = new Dictionary<string, string> {["RV"] = "RV 2"}},
        },
    };

    [Fact]
    public async Task Returns_the_wise_sessions_for_the_posted_selections()
    {
        var res = await api.CreateClient().PostAsJsonAsync("/api/timetable", Body("2026-11-16", "2026-11-22"));

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var sessions = (await res.Content.ReadFromJsonAsync<JsonElement[]>())!;
        Assert.Equal(["wise:101", "wise:202"], sessions.Select(s => s.GetProperty("subjectKey").GetString()));
        Assert.Equal("RV 2", sessions[1].GetProperty("groups")[0].GetString());
        Assert.All(sessions, s => Assert.Equal("wise", s.GetProperty("source").GetProperty("key").GetString()));
    }

    [Fact]
    public async Task Signed_in_users_get_the_same_wise_sessions()
    {
        var client = await api.CreateSignedInClientAsync();

        var res = await client.PostAsJsonAsync("/api/timetable", Body("2026-11-16", "2026-11-22"));

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var sessions = (await res.Content.ReadFromJsonAsync<JsonElement[]>())!;
        Assert.Equal(["wise:101", "wise:202"], sessions.Select(s => s.GetProperty("subjectKey").GetString()));
    }

    [Theory]
    [InlineData("2026-11-22", "2026-11-16")] // to before from
    [InlineData("2026-01-01", "2027-02-06")] // 401 days
    public async Task Rejects_invalid_ranges(string from, string to)
    {
        var res = await api.CreateClient().PostAsJsonAsync("/api/timetable", Body(from, to));

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Accepts_a_range_of_exactly_400_days()
    {
        var res = await api.CreateClient().PostAsJsonAsync("/api/timetable", Body("2026-01-01", "2027-02-05"));

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }
}
