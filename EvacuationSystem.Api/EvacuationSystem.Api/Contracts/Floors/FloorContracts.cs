namespace EvacuationSystem.Api.Contracts.Floors;

public record FloorDto(
    int Id,
    int Number,
    string? Name,
    int BuildingId
);

public record CreateFloorRequest(
    int Number,
    string? Name
);

public record UpdateFloorRequest(
    int Number,
    string? Name
);
