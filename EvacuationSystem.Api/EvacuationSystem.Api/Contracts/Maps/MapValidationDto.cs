namespace EvacuationSystem.Api.Contracts.Maps;

public record MapValidationResultDto(
    bool IsValid,
    List<string> Errors
);