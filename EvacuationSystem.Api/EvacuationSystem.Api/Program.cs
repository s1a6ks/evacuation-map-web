using EvacuationSystem.Api.Data;
using EvacuationSystem.Api.Contracts.Buildings;
using EvacuationSystem.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using EvacuationSystem.Api.Contracts.Floors;
using EvacuationSystem.Api.Domain.Entities;
using EvacuationSystem.Api.Contracts.Rooms;
using EvacuationSystem.Api.Contracts.Nodes;
using EvacuationSystem.Api.Contracts.Edges;

var builder = WebApplication.CreateBuilder(args);

// DbContext
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

//######################################################################################################
var buildingsGroup = app.MapGroup("/api/buildings");

// GET /api/buildings Ц отримати вс≥ буд≥вл≥
buildingsGroup.MapGet("/", async (AppDbContext db) =>
{
    var buildings = await db.Buildings
        .Select(b => new BuildingDto(b.Id, b.Name, b.Address))
        .ToListAsync();

    return Results.Ok(buildings);
});

// GET /api/buildings/{id} Ц одна буд≥вл€
buildingsGroup.MapGet("/{id:int}", async (int id, AppDbContext db) =>
{
    var building = await db.Buildings
        .Where(b => b.Id == id)
        .Select(b => new BuildingDto(b.Id, b.Name, b.Address))
        .FirstOrDefaultAsync();

    return building is null
        ? Results.NotFound()
        : Results.Ok(building);
});

// POST /api/buildings Ц створити буд≥влю
buildingsGroup.MapPost("/", async (CreateBuildingRequest request, AppDbContext db) =>
{
    var building = new Building
    {
        Name = request.Name,
        Address = request.Address
    };

    db.Buildings.Add(building);
    await db.SaveChangesAsync();

    var dto = new BuildingDto(building.Id, building.Name, building.Address);

    return Results.Created($"/api/buildings/{building.Id}", dto);
});

// PUT /api/buildings/{id} Ц оновити буд≥влю
buildingsGroup.MapPut("/{id:int}", async (int id, UpdateBuildingRequest request, AppDbContext db) =>
{
    var building = await db.Buildings.FindAsync(id);

    if (building is null)
    {
        return Results.NotFound();
    }

    building.Name = request.Name;
    building.Address = request.Address;

    await db.SaveChangesAsync();

    var dto = new BuildingDto(building.Id, building.Name, building.Address);

    return Results.Ok(dto);
});

// DELETE /api/buildings/{id} Ц видалити буд≥влю
buildingsGroup.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
{
    var building = await db.Buildings.FindAsync(id);

    if (building is null)
    {
        return Results.NotFound();
    }

    db.Buildings.Remove(building);
    await db.SaveChangesAsync();

    return Results.NoContent();
});

//  floor

var floorsGroup = app.MapGroup("/api/floors");

// GET: вс≥ поверхи буд≥вл≥
app.MapGet("/api/buildings/{buildingId:int}/floors", async (int buildingId, AppDbContext db) =>
{
    var floors = await db.Floors
        .Where(f => f.BuildingId == buildingId)
        .Select(f => new FloorDto(f.Id, f.Number, f.Name, f.BuildingId))
        .ToListAsync();

    return Results.Ok(floors);
});

// POST: створити поверх у буд≥вл≥
app.MapPost("/api/buildings/{buildingId:int}/floors", async (int buildingId, CreateFloorRequest request, AppDbContext db) =>
{
    var building = await db.Buildings.FindAsync(buildingId);
    if (building is null)
        return Results.NotFound($"Building {buildingId} not found");

    var floor = new Floor
    {
        Number = request.Number,
        Name = request.Name,
        BuildingId = buildingId
    };

    db.Floors.Add(floor);
    await db.SaveChangesAsync();

    var dto = new FloorDto(floor.Id, floor.Number, floor.Name, floor.BuildingId);

    return Results.Created($"/api/floors/{floor.Id}", dto);
});

// GET: один поверх
floorsGroup.MapGet("/{id:int}", async (int id, AppDbContext db) =>
{
    var floor = await db.Floors
        .Where(f => f.Id == id)
        .Select(f => new FloorDto(f.Id, f.Number, f.Name, f.BuildingId))
        .FirstOrDefaultAsync();

    return floor is null ? Results.NotFound() : Results.Ok(floor);
});

// PUT: оновити поверх
floorsGroup.MapPut("/{id:int}", async (int id, UpdateFloorRequest request, AppDbContext db) =>
{
    var floor = await db.Floors.FindAsync(id);
    if (floor is null)
        return Results.NotFound();

    floor.Number = request.Number;
    floor.Name = request.Name;

    await db.SaveChangesAsync();

    var dto = new FloorDto(floor.Id, floor.Number, floor.Name, floor.BuildingId);

    return Results.Ok(dto);
});

// DELETE: видалити поверх
floorsGroup.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
{
    var floor = await db.Floors.FindAsync(id);
    if (floor is null)
        return Results.NotFound();

    db.Floors.Remove(floor);
    await db.SaveChangesAsync();

    return Results.NoContent();
});


// ### rooms

var roomsGroup = app.MapGroup("/api/rooms");

// GET: вс≥ к≥мнати поверху
app.MapGet("/api/floors/{floorId:int}/rooms", async (int floorId, AppDbContext db) =>
{
    var rooms = await db.Rooms
        .Where(r => r.FloorId == floorId)
        .Select(r => new RoomDto(r.Id, r.Number, r.Type, r.FloorId))
        .ToListAsync();

    return Results.Ok(rooms);
});

// POST: створити к≥мнату у поверху
app.MapPost("/api/floors/{floorId:int}/rooms", async (int floorId, CreateRoomRequest request, AppDbContext db) =>
{
    var floor = await db.Floors.FindAsync(floorId);
    if (floor is null)
        return Results.NotFound($"Floor {floorId} not found");

    var room = new Room
    {
        Number = request.Number,
        Type = request.Type,
        FloorId = floorId
    };

    db.Rooms.Add(room);
    await db.SaveChangesAsync();

    var dto = new RoomDto(room.Id, room.Number, room.Type, room.FloorId);

    return Results.Created($"/api/rooms/{room.Id}", dto);
});

// GET: одна к≥мната
roomsGroup.MapGet("/{id:int}", async (int id, AppDbContext db) =>
{
    var room = await db.Rooms
        .Where(r => r.Id == id)
        .Select(r => new RoomDto(r.Id, r.Number, r.Type, r.FloorId))
        .FirstOrDefaultAsync();

    return room is null ? Results.NotFound() : Results.Ok(room);
});

// PUT: оновити к≥мнату
roomsGroup.MapPut("/{id:int}", async (int id, UpdateRoomRequest request, AppDbContext db) =>
{
    var room = await db.Rooms.FindAsync(id);
    if (room is null)
        return Results.NotFound();

    room.Number = request.Number;
    room.Type = request.Type;

    await db.SaveChangesAsync();

    var dto = new RoomDto(room.Id, room.Number, room.Type, room.FloorId);

    return Results.Ok(dto);
});

// DELETE: видалити к≥мнату
roomsGroup.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
{
    var room = await db.Rooms.FindAsync(id);
    if (room is null)
        return Results.NotFound();

    db.Rooms.Remove(room);
    await db.SaveChangesAsync();

    return Results.NoContent();
});

// Nodes

var nodesGroup = app.MapGroup("/api/nodes");

// GET: вс≥ вузли поверху
app.MapGet("/api/floors/{floorId:int}/nodes", async (int floorId, AppDbContext db) =>
{
    var nodes = await db.Nodes
        .Where(n => n.FloorId == floorId)
        .Select(n => new NodeDto(
            n.Id, n.X, n.Y, n.IsExit, n.IsStair, n.FloorId, n.RoomId
        ))
        .ToListAsync();

    return Results.Ok(nodes);
});

// POST: створити вузол у поверху
app.MapPost("/api/floors/{floorId:int}/nodes", async (int floorId, CreateNodeRequest request, AppDbContext db) =>
{
    var floor = await db.Floors.FindAsync(floorId);
    if (floor is null)
        return Results.NotFound($"Floor {floorId} not found");

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

    var dto = new NodeDto(node.Id, node.X, node.Y, node.IsExit, node.IsStair, node.FloorId, node.RoomId);

    return Results.Created($"/api/nodes/{node.Id}", dto);
});

// GET: один вузол
nodesGroup.MapGet("/{id:int}", async (int id, AppDbContext db) =>
{
    var node = await db.Nodes
        .Where(n => n.Id == id)
        .Select(n => new NodeDto(
            n.Id, n.X, n.Y, n.IsExit, n.IsStair, n.FloorId, n.RoomId
        ))
        .FirstOrDefaultAsync();

    return node is null ? Results.NotFound() : Results.Ok(node);
});

// PUT: оновити вузол
nodesGroup.MapPut("/{id:int}", async (int id, UpdateNodeRequest request, AppDbContext db) =>
{
    var node = await db.Nodes.FindAsync(id);
    if (node is null)
        return Results.NotFound();

    node.X = request.X;
    node.Y = request.Y;
    node.IsExit = request.IsExit;
    node.IsStair = request.IsStair;
    node.RoomId = request.RoomId;

    await db.SaveChangesAsync();

    var dto = new NodeDto(node.Id, node.X, node.Y, node.IsExit, node.IsStair, node.FloorId, node.RoomId);

    return Results.Ok(dto);
});

// DELETE: видалити вузол
nodesGroup.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
{
    var node = await db.Nodes.FindAsync(id);
    if (node is null)
        return Results.NotFound();

    db.Nodes.Remove(node);
    await db.SaveChangesAsync();

    return Results.NoContent();
});

// Edges

var edgesGroup = app.MapGroup("/api/edges");

// GET: вс≥ ребра певного вузла (опц≥онально)
app.MapGet("/api/nodes/{nodeId:int}/edges", async (int nodeId, AppDbContext db) =>
{
    var edges = await db.Edges
        .Where(e => e.FromNodeId == nodeId)
        .Select(e => new EdgeDto(
            e.Id, e.FromNodeId, e.ToNodeId, e.Length, e.Cost, e.IsBlocked
        ))
        .ToListAsync();

    return Results.Ok(edges);
});

// POST: створити ребро
app.MapPost("/", async (CreateEdgeRequest request, AppDbContext db) =>
{
    // ѕерев≥рку вузл≥в теж треба виконувати
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

    var dto = new EdgeDto(edge.Id, edge.FromNodeId, edge.ToNodeId, edge.Length, edge.Cost, edge.IsBlocked);

    return Results.Created($"/api/edges/{edge.Id}", dto);
});

// GET: одне ребро
edgesGroup.MapGet("/{id:int}", async (int id, AppDbContext db) =>
{
    var edge = await db.Edges
        .Where(e => e.Id == id)
        .Select(e => new EdgeDto(
            e.Id, e.FromNodeId, e.ToNodeId, e.Length, e.Cost, e.IsBlocked
        ))
        .FirstOrDefaultAsync();

    return edge is null ? Results.NotFound() : Results.Ok(edge);
});

// PUT: оновити ребро
edgesGroup.MapPut("/{id:int}", async (int id, UpdateEdgeRequest request, AppDbContext db) =>
{
    var edge = await db.Edges.FindAsync(id);
    if (edge is null)
        return Results.NotFound();

    edge.Length = request.Length;
    edge.Cost = request.Cost;
    edge.IsBlocked = request.IsBlocked;

    await db.SaveChangesAsync();

    var dto = new EdgeDto(edge.Id, edge.FromNodeId, edge.ToNodeId, edge.Length, edge.Cost, edge.IsBlocked);

    return Results.Ok(dto);
});

// DELETE: видалити ребро
edgesGroup.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
{
    var edge = await db.Edges.FindAsync(id);
    if (edge is null)
        return Results.NotFound();

    db.Edges.Remove(edge);
    await db.SaveChangesAsync();

    return Results.NoContent();
});



//######################################################################################################

app.Run();
