using System.Security.Claims;
using System.Security.Cryptography;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace backend.Controllers;

/// <summary>
/// Device-code sign-in for the `wiser` command-line tool (the flow `gh auth login` uses).
/// The CLI usually runs on a machine whose browser is somewhere else, so it cannot receive a
/// redirect: it asks for a code, the owner approves that code on the site while signed in, and
/// the CLI polls until the approval turns into a token.
/// </summary>
[ApiController]
[Route("auth/cli")]
public class CliAuthController : ControllerBase
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    // No 0/O, 1/I/L: the code is read off a terminal and compared by eye.
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    private readonly IMemoryCache _cache;
    private readonly UserManager<AppUser> _users;
    private readonly TokenService _tokens;
    private readonly IConfiguration _config;

    public CliAuthController(IMemoryCache cache, UserManager<AppUser> users, TokenService tokens, IConfiguration config)
    {
        _cache = cache;
        _users = users;
        _tokens = tokens;
        _config = config;
    }

    // shortcut: pending requests live in this process's memory, so a backend restart cancels them
    // and a second backend replica would not see them; move to the database if either happens.
    private sealed class Pending
    {
        public required string DeviceCode { get; init; }
        public volatile string? UserId;
    }

    [HttpPost("start")]
    public IActionResult Start()
    {
        var deviceCode = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var raw = RandomNumberGenerator.GetString(Alphabet, 8);
        var userCode = $"{raw[..4]}-{raw[4..]}";

        var pending = new Pending { DeviceCode = deviceCode };
        _cache.Set(UserKey(userCode), pending, Lifetime);
        _cache.Set(DeviceKey(deviceCode), pending, Lifetime);

        var frontend = (_config["Frontend:Url"] ?? "http://localhost:5173").TrimEnd('/');
        return Ok(new
        {
            deviceCode,
            userCode,
            verificationUrl = $"{frontend}/cli?code={userCode}",
            interval = 3,
            expiresIn = (int)Lifetime.TotalSeconds,
        });
    }

    public record ApproveRequest(string UserCode);

    [Authorize]
    [HttpPost("approve")]
    public IActionResult Approve([FromBody] ApproveRequest req)
    {
        if (!_cache.TryGetValue(UserKey(req.UserCode.Trim().ToUpperInvariant()), out Pending? pending) || pending == null)
            return NotFound(new { message = "This code has expired or was never issued. Run `wiser login` again." });

        pending.UserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return NoContent();
    }

    public record TokenRequest(string DeviceCode);

    [HttpPost("token")]
    public async Task<IActionResult> Token([FromBody] TokenRequest req)
    {
        if (!_cache.TryGetValue(DeviceKey(req.DeviceCode), out Pending? pending) || pending == null)
            return BadRequest(new { error = "expired_token" });

        var userId = pending.UserId;
        if (userId == null)
            return BadRequest(new { error = "authorization_pending" });

        // One approval, one token.
        _cache.Remove(DeviceKey(req.DeviceCode));

        var user = await _users.FindByIdAsync(userId);
        if (user == null) return BadRequest(new { error = "access_denied" });

        // Accounts made before stamps were set would sign a token with an empty one; give them a
        // real stamp so revoking has something to rotate.
        if (string.IsNullOrEmpty(user.SecurityStamp))
            await _users.UpdateSecurityStampAsync(user);

        return Ok(new { token = _tokens.CreateCliToken(user) });
    }

    /// <summary>Revokes every CLI token on the account. Web sign-ins are unaffected.</summary>
    [Authorize]
    [HttpPost("revoke")]
    public async Task<IActionResult> Revoke()
    {
        var user = await _users.FindByIdAsync(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (user == null) return NotFound();

        await _users.UpdateSecurityStampAsync(user);
        return NoContent();
    }

    private static string UserKey(string userCode) => $"cli-auth:user:{userCode}";
    private static string DeviceKey(string deviceCode) => $"cli-auth:device:{deviceCode}";
}
