using EvacuationSystem.Api.Data;
using EvacuationSystem.Api.Contracts.Buildings;
using EvacuationSystem.Api.Contracts.Floors;
using EvacuationSystem.Api.Contracts.Rooms;
using EvacuationSystem.Api.Contracts.Nodes;
using EvacuationSystem.Api.Contracts.Edges;
using EvacuationSystem.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// DbContext -----
builder.Services.AddDbContext<AppDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    options.UseSqlServer(connectionString);
});

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

app.Run();
