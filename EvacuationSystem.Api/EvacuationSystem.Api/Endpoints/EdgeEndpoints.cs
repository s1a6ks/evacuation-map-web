using EvacuationSystem.Api.Contracts.Edges;
using EvacuationSystem.Api.Data;
using EvacuationSystem.Api.Domain.Entities;

namespace EvacuationSystem.Api.Endpoints;

public static class EdgeEndpoints
{
    public static void MapEdgeEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/edges");

        // POST /api/edges
        group.MapPost("/", async (CreateEdgeRequest request, AppDbContext db) =>
        {
            var fromNode = await db.Nodes.FindAsync(request.FromNodeId);
            var toNode = await db.Nodes.FindAsync(request.ToNodeId);

            if (fromNode is null || toNode is null)
                return Results.BadRequest("One or both nodes do not exist");

            var edge = new Edge
            {
                FromNodeId = request.FromNodeId,
                ToNodeId = request.ToNodeId,
                Length = request.Length,
                Cost = request.Cost,
                IsBlocked = request.IsBlocked
            };

            db.Edges.Add(edge);
            await db.SaveChangesAsync();

            return Results.Created($"/api/edges/{edge.Id}",
                new EdgeDto(edge.Id, edge.FromNodeId, edge.ToNodeId, edge.Length, edge.Cost, edge.IsBlocked));
        });
    }
}
