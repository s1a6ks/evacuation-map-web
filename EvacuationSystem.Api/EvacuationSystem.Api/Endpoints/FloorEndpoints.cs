using EvacuationSystem.Api.Contracts.Nodes;
using EvacuationSystem.Api.Contracts.Rooms;
using EvacuationSystem.Api.Data;
using EvacuationSystem.Api.Domain.Entities;

namespace EvacuationSystem.Api.Endpoints;

public static class FloorEndpoints
{
    public static void MapFloorEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/floors");

        // POST /api/floors/{floorId}/rooms
        group.MapPost("/{floorId:int}/rooms", async (int floorId, CreateRoomRequest request, AppDbContext db) =>
        {
            var floor = await db.Floors.FindAsync(floorId);
            if (floor is null) return Results.NotFound();

            var room = new Room
            {
                Number = request.Number,
                Type = request.Type,
                FloorId = floorId
            };

            db.Rooms.Add(room);
            await db.SaveChangesAsync();

            return Results.Created($"/api/rooms/{room.Id}",
                new RoomDto(room.Id, room.Number, room.Type, room.FloorId));
        });

        // POST /api/floors/{floorId}/nodes
        group.MapPost("/{floorId:int}/nodes", async (int floorId, CreateNodeRequest request, AppDbContext db) =>
        {
            var floor = await db.Floors.FindAsync(floorId);
            if (floor is null) return Results.NotFound();

            var node = new Node
            {
                X = request.X,
                Y = request.Y,
                IsExit = request.IsExit,
                IsStair = request.IsStair,
                FloorId = floorId,
                RoomId = request.RoomId
            };

            db.Nodes.Add(node);
            await db.SaveChangesAsync();

            return Results.Created($"/api/nodes/{node.Id}",
                new NodeDto(node.Id, node.X, node.Y, node.IsExit, node.IsStair, node.FloorId, node.RoomId));
        });
    }
}
