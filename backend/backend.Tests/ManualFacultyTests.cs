using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace backend.Tests;

[Collection("api")]
public sealed class ManualFacultyTests(ApiFactory api)
{
    private const string Faculties = "/api/manual-faculties";

    private static async Task<int> CreateAsync(HttpClient client, string url, object body)
    {
        var res = await client.PostAsJsonAsync(url, body);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private static Task<int> CreateFacultyAsync(HttpClient client, string name = "FIN",
        string termStart = "2026-11-02", string termEnd = "2026-11-25", string[]? skipped = null) =>
        CreateAsync(client, Faculties, new {name, termStart, termEnd, skippedDates = skipped ?? []});

    private static Task<int> CreateSubjectAsync(HttpClient client, int facultyId, string name = "Arapski") =>
        CreateAsync(client, $"{Faculties}/{facultyId}/subjects", new {name});

    private static object Slot(int dayOfWeek, string start, string end, string type = "PR", string? group = null) =>
        new {type, group, dayOfWeek, startTime = start, endTime = end, room = "S1", lecturer = "Prof"};

    private static Task<int> CreateSlotAsync(HttpClient client, int subjectId, object slot) =>
        CreateAsync(client, $"{Faculties}/subjects/{subjectId}/slots", slot);

    private static async Task<JsonElement[]> TimetableAsync(HttpClient client, string from, string to, params int[] wiseSubjects)
    {
        var res = await client.PostAsJsonAsync("/api/timetable", new
        {
            from,
            to,
            selections = wiseSubjects.Select(id => new {subjectId = id, picks = new Dictionary<string, string>()}),
        });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<JsonElement[]>())!;
    }

    private static string Key(JsonElement s) => s.GetProperty("source").GetProperty("key").GetString()!;

    [Fact]
    public async Task Slots_repeat_weekly_within_the_term_except_on_skipped_dates()
    {
        var client = await api.CreateSignedInClientAsync();
        var faculty = await CreateFacultyAsync(client, "Fakultet islamskih nauka",
            termStart: "2026-11-02", termEnd: "2026-11-25", skipped: ["2026-11-10"]);
        var subject = await CreateSubjectAsync(client, faculty);
        var tuesday = await CreateSlotAsync(client, subject, Slot(2, "09:00", "11:00"));
        await CreateSlotAsync(client, subject, Slot(3, "13:30", "14:30", "VJ", "II"));

        var sessions = await TimetableAsync(client, "2026-10-26", "2026-12-06");

        Assert.Equal(
            [
                "2026-11-03T09:00:00", "2026-11-04T13:30:00",
                "2026-11-11T13:30:00",
                "2026-11-17T09:00:00", "2026-11-18T13:30:00",
                "2026-11-24T09:00:00", "2026-11-25T13:30:00",
            ],
            sessions.Select(s => s.GetProperty("startAt").GetString()));

        var first = sessions[0];
        Assert.Equal($"manual:{faculty}", Key(first));
        Assert.Equal("manual", first.GetProperty("source").GetProperty("kind").GetString());
        Assert.Equal("Fakultet islamskih nauka", first.GetProperty("source").GetProperty("name").GetString());
        Assert.Equal("Arapski", first.GetProperty("subject").GetString());
        Assert.Equal("PR", first.GetProperty("type").GetString());
        Assert.Equal("2026-11-03T11:00:00", first.GetProperty("finishAt").GetString());
        Assert.Equal(tuesday, first.GetProperty("slotId").GetInt32());
        Assert.Equal("2026-11-03", first.GetProperty("occurrenceDate").GetString());
        Assert.Equal("scheduled", first.GetProperty("status").GetString());
        Assert.Equal(["II"], sessions[1].GetProperty("groups").EnumerateArray().Select(g => g.GetString()));
    }

    [Fact]
    public async Task Wise_and_manual_sessions_come_back_together_each_with_its_source_key()
    {
        var client = await api.CreateSignedInClientAsync();
        var faculty = await CreateFacultyAsync(client);
        await CreateSlotAsync(client, await CreateSubjectAsync(client, faculty), Slot(1, "11:00", "12:00"));

        var sessions = await TimetableAsync(client, "2026-11-16", "2026-11-22", 101);

        Assert.Equal(["wise", $"manual:{faculty}"], sessions.Select(Key));
    }

    [Fact]
    public async Task Signed_out_requests_get_wise_sessions_only()
    {
        var owner = await api.CreateSignedInClientAsync();
        var faculty = await CreateFacultyAsync(owner);
        await CreateSlotAsync(owner, await CreateSubjectAsync(owner, faculty), Slot(1, "11:00", "12:00"));

        var sessions = await TimetableAsync(api.CreateClient(), "2026-11-16", "2026-11-22", 101);

        Assert.Equal(["wise"], sessions.Select(Key));
    }

    [Fact]
    public async Task Another_users_faculty_is_invisible_and_every_edit_is_404()
    {
        var owner = await api.CreateSignedInClientAsync();
        var faculty = await CreateFacultyAsync(owner);
        var subject = await CreateSubjectAsync(owner, faculty);
        var slot = await CreateSlotAsync(owner, subject, Slot(1, "11:00", "12:00"));
        var intruder = await api.CreateSignedInClientAsync();

        Assert.Empty(await TimetableAsync(intruder, "2026-11-16", "2026-11-22"));
        Assert.Empty((await intruder.GetFromJsonAsync<JsonElement[]>(Faculties))!);

        var facultyBody = new {name = "X", termStart = "2026-11-02", termEnd = "2026-11-25", skippedDates = Array.Empty<string>()};
        var responses = new[]
        {
            await intruder.PutAsJsonAsync($"{Faculties}/{faculty}", facultyBody),
            await intruder.DeleteAsync($"{Faculties}/{faculty}"),
            await intruder.PostAsJsonAsync($"{Faculties}/{faculty}/subjects", new {name = "X"}),
            await intruder.PutAsJsonAsync($"{Faculties}/subjects/{subject}", new {name = "X"}),
            await intruder.DeleteAsync($"{Faculties}/subjects/{subject}"),
            await intruder.PostAsJsonAsync($"{Faculties}/subjects/{subject}/slots", Slot(2, "08:00", "09:00")),
            await intruder.PutAsJsonAsync($"{Faculties}/slots/{slot}", Slot(2, "08:00", "09:00")),
            await intruder.DeleteAsync($"{Faculties}/slots/{slot}"),
        };
        Assert.All(responses, r => Assert.Equal(HttpStatusCode.NotFound, r.StatusCode));

        // Untouched for the owner.
        var mine = await TimetableAsync(owner, "2026-11-16", "2026-11-22");
        Assert.Equal(["2026-11-16T11:00:00"], mine.Select(s => s.GetProperty("startAt").GetString()));
        Assert.Equal("FIN", mine[0].GetProperty("source").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Signed_out_callers_cannot_use_the_faculty_api()
    {
        var res = await api.CreateClient().GetAsync(Faculties);

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Owner_can_edit_and_delete_and_the_timetable_follows()
    {
        var client = await api.CreateSignedInClientAsync();
        var faculty = await CreateFacultyAsync(client);
        var subject = await CreateSubjectAsync(client, faculty);
        var slot = await CreateSlotAsync(client, subject, Slot(1, "11:00", "12:00"));

        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"{Faculties}/subjects/{subject}", new {name = "Tefsir"})).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"{Faculties}/slots/{slot}", Slot(2, "08:00", "09:30", "VJ", "I"))).StatusCode);
        var moved = await TimetableAsync(client, "2026-11-16", "2026-11-22");
        Assert.Equal(["2026-11-17T08:00:00"], moved.Select(s => s.GetProperty("startAt").GetString()));
        Assert.Equal("Tefsir", moved[0].GetProperty("subject").GetString());

        var listed = (await client.GetFromJsonAsync<JsonElement[]>(Faculties))!;
        Assert.Equal("VJ", listed.Single().GetProperty("subjects")[0].GetProperty("slots")[0].GetProperty("type").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"{Faculties}/{faculty}")).StatusCode);
        Assert.Empty(await TimetableAsync(client, "2026-11-16", "2026-11-22"));
        Assert.Empty((await client.GetFromJsonAsync<JsonElement[]>(Faculties))!);
    }

    private static Task<HttpResponseMessage> PickAsync(HttpClient client, int subjectId, string? pickedGroup, string name = "Arapski") =>
        client.PutAsJsonAsync($"{Faculties}/subjects/{subjectId}", new {name, pickedGroup});

    private static string[] Starts(JsonElement[] sessions) =>
        sessions.Select(s => s.GetProperty("startAt").GetString()!).ToArray();

    [Fact]
    public async Task Picked_group_is_shown_and_the_subjects_other_groups_are_hidden_but_ungrouped_slots_stay()
    {
        var client = await api.CreateSignedInClientAsync();
        var faculty = await CreateFacultyAsync(client);
        var arapski = await CreateSubjectAsync(client, faculty);
        await CreateSlotAsync(client, arapski, Slot(1, "09:00", "11:00"));
        await CreateSlotAsync(client, arapski, Slot(1, "13:30", "14:30", "VJ", "III"));
        await CreateSlotAsync(client, arapski, Slot(1, "14:30", "15:30", "VJ", "II"));
        var engleski = await CreateSubjectAsync(client, faculty, "Engleski");
        await CreateSlotAsync(client, engleski, Slot(2, "13:30", "14:30", "VJ"));

        Assert.Equal(HttpStatusCode.OK, (await PickAsync(client, arapski, "II")).StatusCode);

        Assert.Equal(
            ["2026-11-16T09:00:00", "2026-11-16T14:30:00", "2026-11-17T13:30:00"],
            Starts(await TimetableAsync(client, "2026-11-16", "2026-11-22")));
    }

    [Fact]
    public async Task Subject_with_no_pick_shows_every_group()
    {
        var client = await api.CreateSignedInClientAsync();
        var subject = await CreateSubjectAsync(client, await CreateFacultyAsync(client));
        await CreateSlotAsync(client, subject, Slot(1, "13:30", "14:30", "VJ", "III"));
        await CreateSlotAsync(client, subject, Slot(1, "14:30", "15:30", "VJ", "II"));
        Assert.Equal(HttpStatusCode.OK, (await PickAsync(client, subject, "II")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await PickAsync(client, subject, null)).StatusCode);

        Assert.Equal(["2026-11-16T13:30:00", "2026-11-16T14:30:00"],
            Starts(await TimetableAsync(client, "2026-11-16", "2026-11-22")));
    }

    [Fact]
    public async Task Renaming_a_subject_keeps_the_pick_it_is_sent_with()
    {
        var client = await api.CreateSignedInClientAsync();
        var subject = await CreateSubjectAsync(client, await CreateFacultyAsync(client));
        await CreateSlotAsync(client, subject, Slot(1, "13:30", "14:30", "VJ", "III"));
        await CreateSlotAsync(client, subject, Slot(1, "14:30", "15:30", "VJ", "II"));
        await PickAsync(client, subject, "II");

        var res = await PickAsync(client, subject, "II", name: "Tefsir");

        Assert.Equal("II", (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("pickedGroup").GetString());
        var sessions = await TimetableAsync(client, "2026-11-16", "2026-11-22");
        Assert.Equal(["2026-11-16T14:30:00"], Starts(sessions));
        Assert.Equal("Tefsir", sessions[0].GetProperty("subject").GetString());
    }

    [Fact]
    public async Task A_pick_whose_last_slot_was_deleted_hides_nothing()
    {
        var client = await api.CreateSignedInClientAsync();
        var subject = await CreateSubjectAsync(client, await CreateFacultyAsync(client));
        await CreateSlotAsync(client, subject, Slot(1, "13:30", "14:30", "VJ", "III"));
        var picked = await CreateSlotAsync(client, subject, Slot(1, "14:30", "15:30", "VJ", "II"));
        await PickAsync(client, subject, "II");

        await client.DeleteAsync($"{Faculties}/slots/{picked}");

        Assert.Equal(["2026-11-16T13:30:00"], Starts(await TimetableAsync(client, "2026-11-16", "2026-11-22")));
    }

    [Theory]
    [InlineData("IV")] // no slot of this subject has it
    [InlineData("I")]  // another subject's group
    public async Task Rejects_picking_a_group_the_subject_does_not_have(string group)
    {
        var client = await api.CreateSignedInClientAsync();
        var faculty = await CreateFacultyAsync(client);
        var subject = await CreateSubjectAsync(client, faculty);
        await CreateSlotAsync(client, subject, Slot(1, "13:30", "14:30", "VJ", "II"));
        await CreateSlotAsync(client, await CreateSubjectAsync(client, faculty, "Hadis"), Slot(2, "12:00", "13:00", "VJ", "I"));

        var res = await PickAsync(client, subject, group);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal(["2026-11-16T13:30:00", "2026-11-17T12:00:00"],
            Starts(await TimetableAsync(client, "2026-11-16", "2026-11-22")));
    }

    [Theory]
    [InlineData(1, "10:00", "09:00")] // end before start
    [InlineData(1, "10:00", "10:00")] // zero length
    [InlineData(0, "08:00", "09:00")] // no such day
    [InlineData(8, "08:00", "09:00")]
    public async Task Rejects_invalid_slots(int day, string start, string end)
    {
        var client = await api.CreateSignedInClientAsync();
        var subject = await CreateSubjectAsync(client, await CreateFacultyAsync(client));

        var res = await client.PostAsJsonAsync($"{Faculties}/subjects/{subject}/slots", Slot(day, start, end));

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Rejects_a_term_that_ends_before_it_starts()
    {
        var client = await api.CreateSignedInClientAsync();

        var res = await client.PostAsJsonAsync(Faculties,
            new {name = "FIN", termStart = "2026-11-25", termEnd = "2026-11-02", skippedDates = Array.Empty<string>()});

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }
}
