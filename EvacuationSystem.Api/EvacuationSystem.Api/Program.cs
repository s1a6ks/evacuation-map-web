using EvacuationSystem.Api.Data;
using EvacuationSystem.Api.Contracts.Buildings;
using EvacuationSystem.Api.Contracts.Floors;
using EvacuationSystem.Api.Contracts.Rooms;
using EvacuationSystem.Api.Contracts.Nodes;
using EvacuationSystem.Api.Contracts.Edges;
using EvacuationSystem.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using EvacuationSystem.Api.Services.Navigation;
using EvacuationSystem.Api.Contracts.Navigation;
using EvacuationSystem.Api.Contracts.Maps;
using EvacuationSystem.Api.Services.Simulation;
using EvacuationSystem.Api.Contracts.Simulation;
using Microsoft.AspNetCore.Mvc;


var builder = WebApplication.CreateBuilder(args);

// DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    options.UseSqlServer(connectionString);
});

// Services
builder.Services.AddScoped<INavigationService, NavigationService>();
builder.Services.AddScoped<ISimulationService, SimulationService>();

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();


// ######################################################################################################
// BUILDINGS
// ######################################################################################################

var buildingsGroup = app.MapGroup("/api/buildings");

// GET all buildings
buildingsGroup.MapGet("/", async (AppDbContext db) =>
{
    var buildings = await db.Buildings
        .Select(b => new BuildingDto(b.Id, b.Name, b.Address))
        .ToListAsync();

    return Results.Ok(buildings);
});

// GET building by ID
buildingsGroup.MapGet("/{id:int}", async (int id, AppDbContext db) =>
{
    var building = await db.Buildings
        .Where(b => b.Id == id)
        .Select(b => new BuildingDto(b.Id, b.Name, b.Address))
        .FirstOrDefaultAsync();

    return building is null ? Results.NotFound() : Results.Ok(building);
});

// POST create building
buildingsGroup.MapPost("/", async (CreateBuildingRequest request, AppDbContext db) =>
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

// PUT update building
buildingsGroup.MapPut("/{id:int}", async (int id, UpdateBuildingRequest request, AppDbContext db) =>
{
    var building = await db.Buildings.FindAsync(id);
    if (building is null) return Results.NotFound();

    building.Name = request.Name;
    building.Address = request.Address;

    await db.SaveChangesAsync();

    return Results.Ok(new BuildingDto(building.Id, building.Name, building.Address));
});

// DELETE building
buildingsGroup.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
{
    var building = await db.Buildings.FindAsync(id);
    if (building is null) return Results.NotFound();

    db.Buildings.Remove(building);
    await db.SaveChangesAsync();

    return Results.NoContent();
});


// ######################################################################################################
// FLOORS
// ######################################################################################################

var floorsGroup = app.MapGroup("/api/floors");

// GET floors of a building
buildingsGroup.MapGet("/{buildingId:int}/floors", async (int buildingId, AppDbContext db) =>
{
    var floors = await db.Floors
        .Where(f => f.BuildingId == buildingId)
        .Select(f => new FloorDto(f.Id, f.Number, f.Name, f.BuildingId))
        .ToListAsync();

    return Results.Ok(floors);
});

// POST create floor for building
buildingsGroup.MapPost("/{buildingId:int}/floors", async (int buildingId, CreateFloorRequest request, AppDbContext db) =>
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

// GET floor by ID
floorsGroup.MapGet("/{id:int}", async (int id, AppDbContext db) =>
{
    var floor = await db.Floors
        .Where(f => f.Id == id)
        .Select(f => new FloorDto(f.Id, f.Number, f.Name, f.BuildingId))
        .FirstOrDefaultAsync();

    return floor is null ? Results.NotFound() : Results.Ok(floor);
});

// PUT update floor
floorsGroup.MapPut("/{id:int}", async (int id, UpdateFloorRequest request, AppDbContext db) =>
{
    var floor = await db.Floors.FindAsync(id);
    if (floor is null) return Results.NotFound();

    floor.Number = request.Number;
    floor.Name = request.Name;

    await db.SaveChangesAsync();

    return Results.Ok(new FloorDto(floor.Id, floor.Number, floor.Name, floor.BuildingId));
});

// DELETE floor
floorsGroup.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
{
    var floor = await db.Floors.FindAsync(id);
    if (floor is null) return Results.NotFound();

    db.Floors.Remove(floor);
    await db.SaveChangesAsync();

    return Results.NoContent();
});


// ######################################################################################################
// ROOMS
// ######################################################################################################

var roomsGroup = app.MapGroup("/api/rooms");

// GET rooms of a floor
floorsGroup.MapGet("/{floorId:int}/rooms", async (int floorId, AppDbContext db) =>
{
    var rooms = await db.Rooms
        .Where(r => r.FloorId == floorId)
        .Select(r => new RoomDto(r.Id, r.Number, r.Type, r.FloorId))
        .ToListAsync();

    return Results.Ok(rooms);
});

// POST create room for floor
floorsGroup.MapPost("/{floorId:int}/rooms", async (int floorId, CreateRoomRequest request, AppDbContext db) =>
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

// GET room
roomsGroup.MapGet("/{id:int}", async (int id, AppDbContext db) =>
{
    var room = await db.Rooms
        .Where(r => r.Id == id)
        .Select(r => new RoomDto(r.Id, r.Number, r.Type, r.FloorId))
        .FirstOrDefaultAsync();

    return room is null ? Results.NotFound() : Results.Ok(room);
});

// PUT update room
roomsGroup.MapPut("/{id:int}", async (int id, UpdateRoomRequest request, AppDbContext db) =>
{
    var room = await db.Rooms.FindAsync(id);
    if (room is null) return Results.NotFound();

    room.Number = request.Number;
    room.Type = request.Type;

    await db.SaveChangesAsync();

    return Results.Ok(new RoomDto(room.Id, room.Number, room.Type, room.FloorId));
});

// DELETE room
roomsGroup.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
{
    var room = await db.Rooms.FindAsync(id);
    if (room is null) return Results.NotFound();

    db.Rooms.Remove(room);
    await db.SaveChangesAsync();

    return Results.NoContent();
});


// ######################################################################################################
// NODES
// ######################################################################################################

var nodesGroup = app.MapGroup("/api/nodes");

// GET nodes of floor
floorsGroup.MapGet("/{floorId:int}/nodes", async (int floorId, AppDbContext db) =>
{
    var nodes = await db.Nodes
        .Where(n => n.FloorId == floorId)
        .Select(n => new NodeDto(n.Id, n.X, n.Y, n.IsExit, n.IsStair, n.FloorId, n.RoomId))
        .ToListAsync();

    return Results.Ok(nodes);
});

// POST create node for floor
floorsGroup.MapPost("/{floorId:int}/nodes", async (int floorId, CreateNodeRequest request, AppDbContext db) =>
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

// GET node
nodesGroup.MapGet("/{id:int}", async (int id, AppDbContext db) =>
{
    var node = await db.Nodes
        .Where(n => n.Id == id)
        .Select(n => new NodeDto(n.Id, n.X, n.Y, n.IsExit, n.IsStair, n.FloorId, n.RoomId))
        .FirstOrDefaultAsync();

    return node is null ? Results.NotFound() : Results.Ok(node);
});

// PUT update node
nodesGroup.MapPut("/{id:int}", async (int id, UpdateNodeRequest request, AppDbContext db) =>
{
    var node = await db.Nodes.FindAsync(id);
    if (node is null) return Results.NotFound();

    node.X = request.X;
    node.Y = request.Y;
    node.IsExit = request.IsExit;
    node.IsStair = request.IsStair;
    node.RoomId = request.RoomId;

    await db.SaveChangesAsync();

    return Results.Ok(new NodeDto(node.Id, node.X, node.Y, node.IsExit, node.IsStair, node.FloorId, node.RoomId));
});

// DELETE node
nodesGroup.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
{
    var node = await db.Nodes.FindAsync(id);
    if (node is null) return Results.NotFound();

    db.Nodes.Remove(node);
    await db.SaveChangesAsync();

    return Results.NoContent();
});


// ######################################################################################################
// EDGES
// ######################################################################################################

var edgesGroup = app.MapGroup("/api/edges");

// GET edges of node
nodesGroup.MapGet("/{nodeId:int}/edges", async (int nodeId, AppDbContext db) =>
{
    var edges = await db.Edges
        .Where(e => e.FromNodeId == nodeId)
        .Select(e => new EdgeDto(e.Id, e.FromNodeId, e.ToNodeId, e.Length, e.Cost, e.IsBlocked))
        .ToListAsync();

    return Results.Ok(edges);
});

// POST create edge
edgesGroup.MapPost("/", async (CreateEdgeRequest request, AppDbContext db) =>
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

// GET edge
edgesGroup.MapGet("/{id:int}", async (int id, AppDbContext db) =>
{
    var edge = await db.Edges
        .Where(e => e.Id == id)
        .Select(e => new EdgeDto(e.Id, e.FromNodeId, e.ToNodeId, e.Length, e.Cost, e.IsBlocked))
        .FirstOrDefaultAsync();

    return edge is null ? Results.NotFound() : Results.Ok(edge);
});

// PUT update edge
edgesGroup.MapPut("/{id:int}", async (int id, UpdateEdgeRequest request, AppDbContext db) =>
{
    var edge = await db.Edges.FindAsync(id);
    if (edge is null) return Results.NotFound();

    edge.Length = request.Length;
    edge.Cost = request.Cost;
    edge.IsBlocked = request.IsBlocked;

    await db.SaveChangesAsync();

    return Results.Ok(new EdgeDto(edge.Id, edge.FromNodeId, edge.ToNodeId, edge.Length, edge.Cost, edge.IsBlocked));
});

// DELETE edge
edgesGroup.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
{
    var edge = await db.Edges.FindAsync(id);
    if (edge is null) return Results.NotFound();

    db.Edges.Remove(edge);
    await db.SaveChangesAsync();

    return Results.NoContent();
});

// ######################################################################################################
// NAVIGATION
// ######################################################################################################


var navigationGroup = app.MapGroup("/api/navigation");

// GET /api/navigation/path?fromNodeId=1&toNodeId=10&algorithm=astar|dijkstra
navigationGroup.MapGet("/path", async (
    int fromNodeId,
    int toNodeId,
    string? algorithm,
    [FromServices] INavigationService navigationService,
    [FromServices] AppDbContext db) =>
{
    var algo = algorithm?.ToLower() switch
    {
        "dijkstra" => NavigationAlgorithm.Dijkstra,
        "astar" => NavigationAlgorithm.AStar,
        null => NavigationAlgorithm.AStar,
        _ => NavigationAlgorithm.AStar
    };

    var result = await navigationService.FindPathAsync(fromNodeId, toNodeId, algo);

    if (result is null || result.PathNodes.Count == 0)
        return Results.NotFound("Path not found");

    var dto = new NavigationPathDto(
        result.PathNodes.Select(n =>
            new NavigationPathNodeDto(
                n.Id,
                n.X,
                n.Y,
                n.IsExit,
                n.IsStair,
                n.FloorId,
                n.RoomId
            )
        ).ToList(),
        result.TotalLength,
        result.TotalCost
    );

    return Results.Ok(dto);
});

// GET /api/navigation/room-to-room?fromRoomId=1&toRoomId=5&algorithm=astar|dijkstra
navigationGroup.MapGet("/room-to-room", async (
    int fromRoomId,
    int toRoomId,
    string? algorithm,
    INavigationService navigationService,
    AppDbContext db) =>
{
    var algo = algorithm?.ToLower() switch
    {
        "dijkstra" => NavigationAlgorithm.Dijkstra,
        "astar" => NavigationAlgorithm.AStar,
        null => NavigationAlgorithm.AStar,
        _ => NavigationAlgorithm.AStar
    };

    var fromRoomNodes = await db.Nodes
        .Where(n => n.RoomId == fromRoomId)
        .ToListAsync();

    var toRoomNodes = await db.Nodes
        .Where(n => n.RoomId == toRoomId)
        .ToListAsync();

    if (!fromRoomNodes.Any() || !toRoomNodes.Any())
        return Results.BadRequest("One or both rooms do not have any nodes");

    NavigationResult? bestResult = null;

    // шукаємо найкоротший маршрут між усіма парами вузлів
    foreach (var start in fromRoomNodes)
    {
        foreach (var end in toRoomNodes)
        {
            var result = await navigationService.FindPathAsync(start.Id, end.Id, algo);
            if (result is null || !result.PathNodes.Any())
                continue;

            if (bestResult is null || result.TotalCost < bestResult.TotalCost)
            {
                bestResult = result;
            }
        }
    }

    if (bestResult is null)
        return Results.NotFound("Path between rooms not found");

    var dto = new NavigationPathDto(
        bestResult.PathNodes.Select(n =>
            new NavigationPathNodeDto(
                n.Id,
                n.X,
                n.Y,
                n.IsExit,
                n.IsStair,
                n.FloorId,
                n.RoomId
            )
        ).ToList(),
        bestResult.TotalLength,
        bestResult.TotalCost
    );

    return Results.Ok(dto);
});


// GET /api/navigation/room-to-exit?roomId=1&algorithm=astar|dijkstra
navigationGroup.MapGet("/room-to-exit", async (
    int roomId,
    string? algorithm,
    INavigationService navigationService,
    AppDbContext db) =>
{
    var algo = algorithm?.ToLower() switch
    {
        "dijkstra" => NavigationAlgorithm.Dijkstra,
        "astar" => NavigationAlgorithm.AStar,
        null => NavigationAlgorithm.AStar,
        _ => NavigationAlgorithm.AStar
    };

    var roomNodes = await db.Nodes
        .Where(n => n.RoomId == roomId)
        .ToListAsync();

    if (!roomNodes.Any())
        return Results.BadRequest("Room has no nodes");

    // беремо поверх кімнати (виходимо з першого вузла)
    var floorId = roomNodes.First().FloorId;

    var exitNodes = await db.Nodes
        .Where(n => n.FloorId == floorId && n.IsExit)
        .ToListAsync();

    if (!exitNodes.Any())
        return Results.BadRequest("No exits defined on this floor");

    NavigationResult? bestResult = null;

    foreach (var start in roomNodes)
    {
        foreach (var exit in exitNodes)
        {
            var result = await navigationService.FindPathAsync(start.Id, exit.Id, algo);
            if (result is null || !result.PathNodes.Any())
                continue;

            if (bestResult is null || result.TotalCost < bestResult.TotalCost)
            {
                bestResult = result;
            }
        }
    }

    if (bestResult is null)
        return Results.NotFound("Path from room to exit not found");

    var dto = new NavigationPathDto(
        bestResult.PathNodes.Select(n =>
            new NavigationPathNodeDto(
                n.Id,
                n.X,
                n.Y,
                n.IsExit,
                n.IsStair,
                n.FloorId,
                n.RoomId
            )
        ).ToList(),
        bestResult.TotalLength,
        bestResult.TotalCost
    );

    return Results.Ok(dto);
});




var fullMapGroup = app.MapGroup("/api/maps");

// GET /api/maps/floor/5
fullMapGroup.MapGet("/floor/{floorId:int}", async (int floorId, AppDbContext db) =>
{
    var floor = await db.Floors
        .Where(f => f.Id == floorId)
        .Select(f => new
        {
            f.Id,
            f.Number,
            f.Name,
            f.BuildingId
        })
        .FirstOrDefaultAsync();

    if (floor is null)
        return Results.NotFound("Floor not found");

    var rooms = await db.Rooms
        .Where(r => r.FloorId == floorId)
        .Select(r => new
        {
            r.Id,
            r.Number,
            r.Type,
            r.FloorId
        })
        .ToListAsync();

    var nodes = await db.Nodes
        .Where(n => n.FloorId == floorId)
        .Select(n => new
        {
            n.Id,
            n.X,
            n.Y,
            n.IsExit,
            n.IsStair,
            n.FloorId,
            n.RoomId
        })
        .ToListAsync();

    var edges = await db.Edges
        .Where(e =>
            nodes.Select(n => n.Id).Contains(e.FromNodeId) &&
            nodes.Select(n => n.Id).Contains(e.ToNodeId))
        .Select(e => new
        {
            e.Id,
            e.FromNodeId,
            e.ToNodeId,
            e.Length,
            e.Cost,
            e.IsBlocked
        })
        .ToListAsync();

    var result = new
    {
        Floor = floor,
        Rooms = rooms,
        Nodes = nodes,
        Edges = edges
    };

    return Results.Ok(result);
});

fullMapGroup.MapGet("/floor/{floorId:int}/validate", async (int floorId, AppDbContext db) =>
{
    var errors = new List<string>();

    var floor = await db.Floors.FindAsync(floorId);
    if (floor is null)
        return Results.NotFound("Floor not found");

    // Rooms
    var rooms = await db.Rooms.Where(r => r.FloorId == floorId).ToListAsync();

    // Nodes
    var nodes = await db.Nodes.Where(n => n.FloorId == floorId).ToListAsync();

    // Edges
    var nodeIds = nodes.Select(n => n.Id).ToList();
    var edges = await db.Edges
        .Where(e => nodeIds.Contains(e.FromNodeId) || nodeIds.Contains(e.ToNodeId))
        .ToListAsync();

    // ───────────────────────────────────────────────────────────────
    // 1. Room has no nodes
    // ───────────────────────────────────────────────────────────────
    foreach (var room in rooms)
    {
        var roomNodes = nodes.Where(n => n.RoomId == room.Id).ToList();
        if (roomNodes.Count == 0)
            errors.Add($"Room {room.Number} (ID {room.Id}) has no nodes");
    }

    // ───────────────────────────────────────────────────────────────
    // 2. Node has no edges
    // ───────────────────────────────────────────────────────────────
    foreach (var node in nodes)
    {
        var connected = edges.Any(e => e.FromNodeId == node.Id || e.ToNodeId == node.Id);
        if (!connected)
            errors.Add($"Node {node.Id} has no edges (isolated node)");
    }

    // ───────────────────────────────────────────────────────────────
    // 3. Floor has no exit nodes
    // ───────────────────────────────────────────────────────────────
    var exitNodes = nodes.Where(n => n.IsExit).ToList();
    if (exitNodes.Count == 0)
        errors.Add($"Floor {floor.Number} has no exit nodes");

    // ───────────────────────────────────────────────────────────────
    // 4. Isolated graph components (unreachable)
    // ───────────────────────────────────────────────────────────────
    if (nodes.Count > 0)
    {
        var visited = new HashSet<int>();
        var queue = new Queue<int>();

        // стартуємо BFS з першого нода
        queue.Enqueue(nodes.First().Id);
        visited.Add(nodes.First().Id);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();

            var neighbors = edges
                .Where(e => e.FromNodeId == current || e.ToNodeId == current)
                .Select(e => e.FromNodeId == current ? e.ToNodeId : e.FromNodeId)
                .Where(id => !visited.Contains(id));

            foreach (var next in neighbors)
            {
                visited.Add(next);
                queue.Enqueue(next);
            }
        }

        // ноди, до яких не можна дістатися
        var isolated = nodes.Where(n => !visited.Contains(n.Id)).ToList();
        foreach (var bad in isolated)
        {
            errors.Add($"Node {bad.Id} is unreachable from the rest of the graph");
        }
    }

    // ───────────────────────────────────────────────────────────────
    // 5. Orphan edges (point to nodes not on this floor)
    // ───────────────────────────────────────────────────────────────
    foreach (var edge in edges)
    {
        if (!nodeIds.Contains(edge.FromNodeId))
            errors.Add($"Edge {edge.Id} references missing FromNodeId {edge.FromNodeId}");

        if (!nodeIds.Contains(edge.ToNodeId))
            errors.Add($"Edge {edge.Id} references missing ToNodeId {edge.ToNodeId}");
    }

    // ───────────────────────────────────────────────────────────────

    var result = new MapValidationResultDto(
        IsValid: errors.Count == 0,
        Errors: errors
    );

    return Results.Ok(result);
});

navigationGroup.MapGet("/room-to-exit-multi", async (
    int roomId,
    string? algorithm,
    INavigationService navigationService,
    AppDbContext db) =>
{
    var algo = algorithm?.ToLower() switch
    {
        "dijkstra" => NavigationAlgorithm.Dijkstra,
        "astar" => NavigationAlgorithm.AStar,
        _ => NavigationAlgorithm.AStar
    };

    // nodes in selected room
    var roomNodes = await db.Nodes
        .Where(n => n.RoomId == roomId)
        .ToListAsync();

    if (!roomNodes.Any())
        return Results.BadRequest("Room has no nodes");

    // ALL exits in the entire building
    var exitNodes = await db.Nodes
        .Where(n => n.IsExit)
        .ToListAsync();

    if (!exitNodes.Any())
        return Results.BadRequest("Building has no exit nodes");

    NavigationResult? bestResult = null;

    foreach (var start in roomNodes)
    {
        foreach (var exit in exitNodes)
        {
            var result = await navigationService.FindPathAsync(start.Id, exit.Id, algo);
            if (result is null || !result.PathNodes.Any())
                continue;

            if (bestResult is null || result.TotalCost < bestResult.TotalCost)
                bestResult = result;
        }
    }

    if (bestResult is null)
        return Results.NotFound("Path to exit not found");

    var dto = new NavigationPathDto(
        bestResult.PathNodes.Select(n =>
            new NavigationPathNodeDto(
                n.Id,
                n.X,
                n.Y,
                n.IsExit,
                n.IsStair,
                n.FloorId,
                n.RoomId
            )
        ).ToList(),
        bestResult.TotalLength,
        bestResult.TotalCost
    );

    return Results.Ok(dto);
});

var simulationGroup = app.MapGroup("/api/simulation");

// POST /api/simulation/run
simulationGroup.MapPost("/run", async (
    SimulationRequest request,
    ISimulationService simulationService) =>
{
    var result = await simulationService.RunSimulationAsync(request);
    return Results.Ok(result);
});


// ######################################################################################################

app.Run();
