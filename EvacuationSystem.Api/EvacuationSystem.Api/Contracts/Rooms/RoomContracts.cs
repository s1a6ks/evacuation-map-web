namespace EvacuationSystem.Api.Contracts.Rooms;

public record RoomDto(
    int Id,
    string Number,
    string? Type,
    int FloorId
);

public record CreateRoomRequest(
    string Number,
    string? Type
);

public record UpdateRoomRequest(
    string Number,
    string? Type
);
