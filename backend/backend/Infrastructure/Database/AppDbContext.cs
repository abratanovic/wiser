using backend.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace backend.Infrastructure.Database;

public class AppDbContext : IdentityDbContext<AppUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {}
    
    public DbSet<UserEvent> UserEvents { get; set; }
    public DbSet<ManualFaculty> ManualFaculties { get; set; }
    public DbSet<ManualSubject> ManualSubjects { get; set; }
    public DbSet<ManualSlot> ManualSlots { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
    }
}