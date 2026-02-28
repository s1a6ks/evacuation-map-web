using EvacuationSystem.Api.Contracts.Buildings;
using EvacuationSystem.Api.Contracts.Floors;
using EvacuationSystem.Api.Data;
using EvacuationSystem.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EvacuationSystem.Api.Endpoints;

public static class BuildingEndpoints
{
    public static void MapBuildingEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/buildings");

        // POST /api/buildings
        group.MapPost("/", async (CreateBuildingRequest request, AppDbContext db) =>
        {
            var building = new Building
            {
                Name = request.Name,
                Address = request.Address
            };

            db.Buildings.Add(building);
            await db.SaveChangesAsync();

            return Results.Created($"/api/buildings/{building.Id}",
                new BuildingDto(building.Id, building.Name, building.Address));
        });

        // DELETE /api/buildings/{id} (cascade)
        group.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            var building = await db.Buildings.FindAsync(id);
            if (building is null) return Results.NotFound();

            var floorIds = await db.Floors
                .Where(f => f.BuildingId == id)
                .Select(f => f.Id)
                .ToListAsync();

            var nodeIds = await db.Nodes
                .Where(n => floorIds.Contains(n.FloorId))
                .Select(n => n.Id)
                .ToListAsync();

            // 1. Видаляємо ребра (мають FK на nodes)
            var edges = await db.Edges
                .Where(e => nodeIds.Contains(e.FromNodeId) || nodeIds.Contains(e.ToNodeId))
                .ToListAsync();
            db.Edges.RemoveRange(edges);

            // 2. Видаляємо вузли
            var nodes = await db.Nodes
                .Where(n => floorIds.Contains(n.FloorId))
                .ToListAsync();
            db.Nodes.RemoveRange(nodes);

            // 3. Видаляємо кімнати
            var rooms = await db.Rooms
                .Where(r => floorIds.Contains(r.FloorId))
                .ToListAsync();
            db.Rooms.RemoveRange(rooms);

            // 4. Видаляємо поверхи
            var floors = await db.Floors
                .Where(f => f.BuildingId == id)
                .ToListAsync();
            db.Floors.RemoveRange(floors);

            // 5. Видаляємо будівлю
            db.Buildings.Remove(building);

            await db.SaveChangesAsync();

            return Results.NoContent();
        });

        // POST /api/buildings/{buildingId}/floors
        group.MapPost("/{buildingId:int}/floors", async (int buildingId, CreateFloorRequest request, AppDbContext db) =>
        {
            var building = await db.Buildings.FindAsync(buildingId);
            if (building is null) return Results.NotFound();

            var floor = new Floor
            {
                Number = request.Number,
                Name = request.Name,
                BuildingId = buildingId
            };

            db.Floors.Add(floor);
            await db.SaveChangesAsync();

            return Results.Created($"/api/floors/{floor.Id}",
                new FloorDto(floor.Id, floor.Number, floor.Name, floor.BuildingId));
        });
    }
}
