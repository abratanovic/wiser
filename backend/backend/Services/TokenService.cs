using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using backend.Models;
using Microsoft.IdentityModel.Tokens;

namespace backend.Services;

public class TokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config)
    {
        _config = config;
    }

    public string CreateToken(AppUser user) => Create(user, DateTime.UtcNow.AddDays(30));

    /// <summary>
    /// Long-lived token for the command-line tool, so an agent on the owner's machine does not
    /// need a fresh browser sign-in every month. It carries the account's security stamp, and the
    /// bearer handler refuses it once the stamp changes — that is how it gets revoked.
    /// </summary>
    public string CreateCliToken(AppUser user) => Create(user, DateTime.UtcNow.AddYears(10),
        new Claim(CliClaim, "1"),
        new Claim(StampClaim, user.SecurityStamp ?? ""));

    public const string CliClaim = "cli";
    public const string StampClaim = "stamp";

    private string Create(AppUser user, DateTime expires, params Claim[] extra)
    {
        var claims = new List<Claim>(extra)
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email!),
            new Claim("displayName", user.DisplayName ?? ""),
            new Claim("avatarUrl", user.AvatarUrl ?? ""),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Jwt:Secret"] ?? throw new InvalidOperationException("Jwt:Secret is not configured")));

        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
