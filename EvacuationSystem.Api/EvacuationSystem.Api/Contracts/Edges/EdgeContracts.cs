namespace EvacuationSystem.Api.Contracts.Edges;

public record EdgeDto(
    int Id,
    int FromNodeId,
    int ToNodeId,
    double Length,
    double Cost,
    bool IsBlocked
);

public record CreateEdgeRequest(
    int FromNodeId,
    int ToNodeId,
    double Length,
    double Cost,
    bool IsBlocked
);

public record UpdateEdgeRequest(
    double Length,
    double Cost,
    bool IsBlocked
);
