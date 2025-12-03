namespace EvacuationSystem.Api.Contracts.Nodes;

public record NodeDto(
    int Id,
    double X,
    double Y,
    bool IsExit,
    bool IsStair,
    int FloorId,
    int? RoomId
);

public record CreateNodeRequest(
    double X,
    double Y,
    bool IsExit,
    bool IsStair,
    int? RoomId
);

public record UpdateNodeRequest(
    double X,
    double Y,
    bool IsExit,
    bool IsStair,
    int? RoomId
);
