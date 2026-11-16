using System.Net.Http.Headers;
using System.Net.Http.Json;
using backend.Services.Timetable;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace backend.Tests;

/// <summary>
/// Boots the real app in-process against a throwaway Postgres, with the Wise source swapped for
/// <see cref="StubWiseSource"/> so no test reaches wise-tt.com. One instance (and one database)
/// is shared by every test class in the "api" collection; tests isolate themselves by signing
/// up fresh users rather than by resetting the database.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _db = new PostgreSqlBuilder().WithImage("postgres:16").Build();

    public async Task InitializeAsync()
    {
        await _db.StartAsync();

        // Program.cs reads these straight from the environment while it builds the host.
        Environment.SetEnvironmentVariable("DB_CONNECTION_STRING", _db.GetConnectionString());
        Environment.SetEnvironmentVariable("Jwt__Secret", "test-secret-test-secret-test-secret-123");
        Environment.SetEnvironmentVariable("Jwt__Issuer", "wiser-test");
        Environment.SetEnvironmentVariable("Jwt__Audience", "wiser-test");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.ConfigureServices(services =>
        {
            var wise = services.Single(d => d.ImplementationType == typeof(WiseTimetableSource));
            services.Remove(wise);
            services.AddSingleton<ITimetableSource, StubWiseSource>();
        });

    /// <summary>A client signed in as a brand-new user, so tests never see each other's data.</summary>
    public async Task<HttpClient> CreateSignedInClientAsync()
    {
        var client = CreateClient();
        var res = await client.PostAsJsonAsync("/auth/register", new
        {
            name = "Test User",
            email = $"{Guid.NewGuid():N}@test.local",
            password = "Passw0rd!",
        });
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<TokenResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Token);
        return client;
    }

    private sealed record TokenResponse(string Token);

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _db.DisposeAsync();
    }
}

[CollectionDefinition("api")]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>;
