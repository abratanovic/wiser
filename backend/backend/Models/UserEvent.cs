namespace backend.Models;

public class UserEvent
{
    public int Id { get; set; }
    public string UserId { get; set; } = null!;
    // Never serialized: endpoints return events directly, and when EF has the owner loaded this
    // would emit a cycle, or worse, the password hash and security stamp.
    [System.Text.Json.Serialization.JsonIgnore]
    public AppUser User { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset FinishAt { get; set; }
    public string Color { get; set; } = "#3B82F6";
}
