using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace backend.Tests;

/// <summary>Cancelling or moving one occurrence of a manual slot.</summary>
[Collection("api")]
public sealed class SlotExceptionTests(ApiFactory api)
{
    private const string Faculties = "/api/manual-faculties";
    private const string FacultyBody = """{"name":"FIN","termStart":"2026-11-02","termEnd":"2026-11-25","skippedDates":[]}""";

    private static async Task<int> CreateAsync(HttpClient client, string url, object body)
    {
        var res = await client.PostAsJsonAsync(url, body);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private static object Slot(int dayOfWeek, string start = "09:00", string end = "11:00") =>
        new {type = "PR", dayOfWeek, startTime = start, endTime = end, room = "S1"};

    /// <summary>A faculty (term 2026-11-02..25) with one Monday 09:00-11:00 slot; returns (faculty, slot).</summary>
    private static async Task<(int Faculty, int Slot)> MondaySlotAsync(HttpClient client)
    {
        var faculty = await CreateAsync(client, Faculties, JsonSerializer.Deserialize<JsonElement>(FacultyBody));
        var subject = await CreateAsync(client, $"{Faculties}/{faculty}/subjects", new {name = "Arapski"});
        return (faculty, await CreateAsync(client, $"{Faculties}/subjects/{subject}/slots", Slot(1)));
    }

    private static string Exception(int slot, string date) => $"{Faculties}/slots/{slot}/exceptions/{date}";

    private static Task<HttpResponseMessage> CancelAsync(HttpClient client, int slot, string date) =>
        client.PutAsJsonAsync(Exception(slot, date), new {kind = "cancelled"});

    private static Task<HttpResponseMessage> MoveAsync(HttpClient client, int slot, string date, string newStart, string newEnd, string? newRoom = null) =>
        client.PutAsJsonAsync(Exception(slot, date), new {kind = "moved", newStart, newEnd, newRoom});

    private static async Task<(string Start, string Status)[]> TimetableAsync(HttpClient client, string from, string to)
    {
        var res = await client.PostAsJsonAsync("/api/timetable", new {from, to, selections = Array.Empty<object>()});
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<JsonElement[]>())!
            .Select(s => (s.GetProperty("startAt").GetString()!, s.GetProperty("status").GetString()!))
            .ToArray();
    }

    [Fact]
    public async Task Cancelled_occurrence_comes_back_with_status_cancelled()
    {
        var client = await api.CreateSignedInClientAsync();
        var (_, slot) = await MondaySlotAsync(client);

        Assert.Equal(HttpStatusCode.OK, (await CancelAsync(client, slot, "2026-11-16")).StatusCode);

        Assert.Equal(
            [("2026-11-09T09:00:00", "scheduled"), ("2026-11-16T09:00:00", "cancelled"), ("2026-11-23T09:00:00", "scheduled")],
            await TimetableAsync(client, "2026-11-09", "2026-11-29"));
    }

    [Fact]
    public async Task Moved_occurrence_comes_back_at_its_new_time_and_room_and_is_gone_from_the_old_time()
    {
        var client = await api.CreateSignedInClientAsync();
        var (_, slot) = await MondaySlotAsync(client);

        Assert.Equal(HttpStatusCode.OK,
            (await MoveAsync(client, slot, "2026-11-16", "2026-11-18T14:00:00", "2026-11-18T15:30:00", "A2")).StatusCode);

        var res = await client.PostAsJsonAsync("/api/timetable", new {from = "2026-11-16", to = "2026-11-22", selections = Array.Empty<object>()});
        var moved = (await res.Content.ReadFromJsonAsync<JsonElement[]>())!.Single();
        Assert.Equal("moved", moved.GetProperty("status").GetString());
        Assert.Equal("2026-11-18T14:00:00", moved.GetProperty("startAt").GetString());
        Assert.Equal("2026-11-18T15:30:00", moved.GetProperty("finishAt").GetString());
        Assert.Equal("A2", moved.GetProperty("room").GetString());
        Assert.Equal(slot, moved.GetProperty("slotId").GetInt32());
        Assert.Equal("2026-11-16", moved.GetProperty("occurrenceDate").GetString());
    }

    [Fact]
    public async Task Moving_into_another_week_shows_it_in_that_weeks_range()
    {
        var client = await api.CreateSignedInClientAsync();
        var (_, slot) = await MondaySlotAsync(client);

        await MoveAsync(client, slot, "2026-11-16", "2026-11-27T10:00:00", "2026-11-27T12:00:00");

        Assert.Empty(await TimetableAsync(client, "2026-11-16", "2026-11-22"));
        // Friday 27th is after the term end, yet the make-up class still shows.
        Assert.Equal(
            [("2026-11-23T09:00:00", "scheduled"), ("2026-11-27T10:00:00", "moved")],
            await TimetableAsync(client, "2026-11-23", "2026-11-29"));
    }

    [Fact]
    public async Task Undo_restores_the_original_occurrence()
    {
        var client = await api.CreateSignedInClientAsync();
        var (_, slot) = await MondaySlotAsync(client);
        await MoveAsync(client, slot, "2026-11-16", "2026-11-18T14:00:00", "2026-11-18T15:00:00");
        await CancelAsync(client, slot, "2026-11-23");

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(Exception(slot, "2026-11-16"))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(Exception(slot, "2026-11-23"))).StatusCode);

        Assert.Equal(
            [("2026-11-16T09:00:00", "scheduled"), ("2026-11-23T09:00:00", "scheduled")],
            await TimetableAsync(client, "2026-11-16", "2026-11-29"));
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync(Exception(slot, "2026-11-16"))).StatusCode);
    }

    [Fact]
    public async Task A_second_change_replaces_the_first()
    {
        var client = await api.CreateSignedInClientAsync();
        var (_, slot) = await MondaySlotAsync(client);
        await MoveAsync(client, slot, "2026-11-16", "2026-11-18T14:00:00", "2026-11-18T15:00:00");

        Assert.Equal(HttpStatusCode.OK, (await CancelAsync(client, slot, "2026-11-16")).StatusCode);

        Assert.Equal([("2026-11-16T09:00:00", "cancelled")], await TimetableAsync(client, "2026-11-16", "2026-11-22"));
    }

    [Fact]
    public async Task Changing_a_slots_day_drops_its_exceptions_and_leaves_other_slots_alone()
    {
        var client = await api.CreateSignedInClientAsync();
        var (_, slot) = await MondaySlotAsync(client);
        var subject = (await (await client.GetAsync(Faculties)).Content.ReadFromJsonAsync<JsonElement[]>())!
            .Single().GetProperty("subjects")[0].GetProperty("id").GetInt32();
        var other = await CreateAsync(client, $"{Faculties}/subjects/{subject}/slots", Slot(1, "13:00", "14:00"));
        await CancelAsync(client, slot, "2026-11-16");
        await CancelAsync(client, other, "2026-11-16");

        // Monday -> Wednesday and back: the Monday cancellation must not come back.
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"{Faculties}/slots/{slot}", Slot(3))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"{Faculties}/slots/{slot}", Slot(1))).StatusCode);

        Assert.Equal(
            [("2026-11-16T09:00:00", "scheduled"), ("2026-11-16T13:00:00", "cancelled")],
            await TimetableAsync(client, "2026-11-16", "2026-11-22"));
    }

    [Fact]
    public async Task Skipping_a_date_or_shrinking_the_term_drops_exceptions_there()
    {
        var client = await api.CreateSignedInClientAsync();
        var (faculty, slot) = await MondaySlotAsync(client);
        await CancelAsync(client, slot, "2026-11-09");
        await CancelAsync(client, slot, "2026-11-16");
        await CancelAsync(client, slot, "2026-11-23");

        await client.PutAsJsonAsync($"{Faculties}/{faculty}",
            new {name = "FIN", termStart = "2026-11-02", termEnd = "2026-11-20", skippedDates = new[] {"2026-11-09"}});
        await client.PutAsJsonAsync($"{Faculties}/{faculty}", JsonSerializer.Deserialize<JsonElement>(FacultyBody));

        Assert.Equal(
            [("2026-11-09T09:00:00", "scheduled"), ("2026-11-16T09:00:00", "cancelled"), ("2026-11-23T09:00:00", "scheduled")],
            await TimetableAsync(client, "2026-11-09", "2026-11-29"));
    }

    [Fact]
    public async Task Another_users_exceptions_are_404()
    {
        var owner = await api.CreateSignedInClientAsync();
        var (_, slot) = await MondaySlotAsync(owner);
        await CancelAsync(owner, slot, "2026-11-16");
        var intruder = await api.CreateSignedInClientAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await CancelAsync(intruder, slot, "2026-11-23")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await MoveAsync(intruder, slot, "2026-11-16", "2026-11-18T14:00:00", "2026-11-18T15:00:00")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await intruder.DeleteAsync(Exception(slot, "2026-11-16"))).StatusCode);

        Assert.Equal(
            [("2026-11-16T09:00:00", "cancelled"), ("2026-11-23T09:00:00", "scheduled")],
            await TimetableAsync(owner, "2026-11-16", "2026-11-29"));
    }

    [Theory]
    [InlineData("2026-11-17", "cancelled", null, null)] // a Tuesday: the slot is on Mondays
    [InlineData("2026-10-26", "cancelled", null, null)] // before the term
    [InlineData("2026-11-16", "postponed", null, null)] // unknown kind
    [InlineData("2026-11-16", "moved", null, null)] // move without a time
    [InlineData("2026-11-16", "moved", "2026-11-18T15:00:00", "2026-11-18T14:00:00")] // ends before it starts
    public async Task Rejects_invalid_exceptions(string date, string kind, string? newStart, string? newEnd)
    {
        var client = await api.CreateSignedInClientAsync();
        var (_, slot) = await MondaySlotAsync(client);

        var res = await client.PutAsJsonAsync(Exception(slot, date), new {kind, newStart, newEnd});

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }
}
