using EvacuationSystem.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace EvacuationSystem.Api.Endpoints;

public static class MapEndpoints
{
    public static void MapFloorPlanEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/maps");

        // GET /api/maps/floor/{floorId}
        group.MapGet("/floor/{floorId:int}", async (int floorId, AppDbContext db) =>
        {
            var floor = await db.Floors
                .Where(f => f.Id == floorId)
                .Select(f => new { f.Id, f.Number, f.Name, f.BuildingId })
                .FirstOrDefaultAsync();

            if (floor is null)
                return Results.NotFound("Floor not found");

            var rooms = await db.Rooms
                .Where(r => r.FloorId == floorId)
                .Select(r => new { r.Id, r.Number, r.Type, r.FloorId })
                .ToListAsync();

            var nodes = await db.Nodes
                .Where(n => n.FloorId == floorId)
                .Select(n => new { n.Id, n.X, n.Y, n.IsExit, n.IsStair, n.FloorId, n.RoomId })
                .ToListAsync();

            var nodeIds = nodes.Select(n => n.Id).ToList();
            var edges = await db.Edges
                .Where(e => nodeIds.Contains(e.FromNodeId) && nodeIds.Contains(e.ToNodeId))
                .Select(e => new { e.Id, e.FromNodeId, e.ToNodeId, e.Length, e.Cost, e.IsBlocked })
                .ToListAsync();

            return Results.Ok(new { Floor = floor, Rooms = rooms, Nodes = nodes, Edges = edges });
        });
    }
}
