using EvacuationSystem.Api.Domain.Entities;

namespace EvacuationSystem.Api.Services.Navigation;

public enum NavigationAlgorithm
{
    Dijkstra,
    AStar
}

public class NavigationResult
{
    public List<Node> PathNodes { get; set; } = new();
    public double TotalLength { get; set; }
    public double TotalCost { get; set; }
}

public interface INavigationService
{
    Task<NavigationResult?> FindPathAsync(int fromNodeId, int toNodeId, NavigationAlgorithm algorithm);
}
