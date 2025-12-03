namespace EvacuationSystem.Api.Contracts.Buildings;

public record BuildingDto(
    int Id,
    string Name,
    string Address
);

public record CreateBuildingRequest(
    string Name,
    string Address
);

public record UpdateBuildingRequest(
    string Name,
    string Address
);
