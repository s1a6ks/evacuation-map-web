namespace EvacuationSystem.Api.Contracts.Navigation;

public record NavigationPathNodeDto(
    int Id,
    double X,
    double Y,
    bool IsExit,
    bool IsStair,
    int FloorId,
    int? RoomId
);

public record NavigationPathDto(
    IReadOnlyList<NavigationPathNodeDto> Nodes,
    double TotalLength,
    double TotalCost
);
