using EvacuationSystem.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Reflection.Emit;

namespace EvacuationSystem.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Building> Buildings => Set<Building>();
    public DbSet<Floor> Floors => Set<Floor>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Node> Nodes => Set<Node>();
    public DbSet<Edge> Edges => Set<Edge>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Edge: один-в-багатьох до Node (From/To)
        modelBuilder.Entity<Edge>()
            .HasOne(e => e.FromNode)
            .WithMany(n => n.FromEdges)
            .HasForeignKey(e => e.FromNodeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Edge>()
            .HasOne(e => e.ToNode)
            .WithMany(n => n.ToEdges)
            .HasForeignKey(e => e.ToNodeId)
            .OnDelete(DeleteBehavior.Restrict);

        // Room – Node: опціональний зв'язок
        modelBuilder.Entity<Node>()
     .HasOne(n => n.Room)
     .WithMany(r => r.ConnectedNodes)
     .HasForeignKey(n => n.RoomId)
     .OnDelete(DeleteBehavior.NoAction);
    }
}
