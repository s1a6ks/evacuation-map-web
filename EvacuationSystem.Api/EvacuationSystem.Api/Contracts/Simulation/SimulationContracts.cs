namespace EvacuationSystem.Api.Contracts.Simulation;

public record SimulationPersonRequest(
    int PersonId,
    int StartRoomId
);

public record SimulationRequest(
    List<SimulationPersonRequest> People,
    int MaxTimeSeconds = 1200
);

public record SimulationPersonResult(
    int PersonId,
    int TimeSeconds,
    List<int> PathNodeIds
);

public record SimulationResultDto(
    List<SimulationPersonResult> PeopleResults,
    int TotalEvacuationTime,
    List<BottleneckInfo> Bottlenecks
);

public record BottleneckInfo(
    int NodeId,
    int MaxQueue
);
