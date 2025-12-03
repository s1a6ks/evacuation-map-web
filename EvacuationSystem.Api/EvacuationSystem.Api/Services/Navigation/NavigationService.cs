using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EvacuationSystem.Api.Data;
using EvacuationSystem.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EvacuationSystem.Api.Services.Navigation;

public class NavigationService : INavigationService
{
    private readonly AppDbContext _dbContext;

    public NavigationService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<NavigationResult?> FindPathAsync(int fromNodeId, int toNodeId, NavigationAlgorithm algorithm)
    {
        var nodes = await _dbContext.Nodes.AsNoTracking().ToListAsync();
        var edges = await _dbContext.Edges
            .AsNoTracking()
            .Where(e => !e.IsBlocked)
            .ToListAsync();

        var fromNode = nodes.FirstOrDefault(n => n.Id == fromNodeId);
        var toNode = nodes.FirstOrDefault(n => n.Id == toNodeId);

        if (fromNode is null || toNode is null)
            return null;

        var adjacency = BuildAdjacency(edges);

        return algorithm switch
        {
            NavigationAlgorithm.Dijkstra => RunDijkstra(fromNode, toNode, adjacency, nodes),
            NavigationAlgorithm.AStar => RunAStar(fromNode, toNode, adjacency, nodes),
            _ => RunAStar(fromNode, toNode, adjacency, nodes)
        };
    }

    private static Dictionary<int, List<Edge>> BuildAdjacency(IEnumerable<Edge> edges)
    {
        var adjacency = new Dictionary<int, List<Edge>>();

        foreach (var edge in edges)
        {
            if (!adjacency.TryGetValue(edge.FromNodeId, out var list))
            {
                list = new List<Edge>();
                adjacency[edge.FromNodeId] = list;
            }

            list.Add(edge);
        }

        return adjacency;
    }

    private NavigationResult? RunDijkstra(Node start, Node goal, Dictionary<int, List<Edge>> adjacency, List<Node> allNodes)
    {
        var dist = new Dictionary<int, double>();
        var prev = new Dictionary<int, int?>();
        var visited = new HashSet<int>();

        foreach (var n in allNodes)
        {
            dist[n.Id] = double.PositiveInfinity;
            prev[n.Id] = null;
        }

        dist[start.Id] = 0;

        var pq = new PriorityQueue<int, double>();
        pq.Enqueue(start.Id, 0);

        while (pq.TryDequeue(out var currentId, out _))
        {
            if (visited.Contains(currentId))
                continue;

            visited.Add(currentId);

            if (currentId == goal.Id)
                return BuildResult(prev, dist[goal.Id], start, goal, allNodes);

            if (!adjacency.TryGetValue(currentId, out var neighbors))
                continue;

            foreach (var edge in neighbors)
            {
                var neighborId = edge.ToNodeId;
                if (visited.Contains(neighborId))
                    continue;

                var tentative = dist[currentId] + edge.Cost;

                if (tentative < dist[neighborId])
                {
                    dist[neighborId] = tentative;
                    prev[neighborId] = currentId;
                    pq.Enqueue(neighborId, tentative);
                }
            }
        }

        return null;
    }

    private NavigationResult? RunAStar(Node start, Node goal, Dictionary<int, List<Edge>> adjacency, List<Node> allNodes)
    {
        var gScore = new Dictionary<int, double>();
        var fScore = new Dictionary<int, double>();
        var cameFrom = new Dictionary<int, int?>();

        foreach (var n in allNodes)
        {
            gScore[n.Id] = double.PositiveInfinity;
            fScore[n.Id] = double.PositiveInfinity;
            cameFrom[n.Id] = null;
        }

        gScore[start.Id] = 0;
        fScore[start.Id] = Heuristic(start, goal);

        var openSet = new PriorityQueue<int, double>();
        openSet.Enqueue(start.Id, fScore[start.Id]);

        var openSetIds = new HashSet<int> { start.Id };

        while (openSet.TryDequeue(out var currentId, out _))
        {
            openSetIds.Remove(currentId);

            if (currentId == goal.Id)
                return BuildResult(cameFrom, gScore[goal.Id], start, goal, allNodes);

            if (!adjacency.TryGetValue(currentId, out var neighbors))
                continue;

            foreach (var edge in neighbors)
            {
                var neighborId = edge.ToNodeId;

                var neighborNode = allNodes.First(n => n.Id == neighborId);
                var currentNode = allNodes.First(n => n.Id == currentId);

                var tentativeG = gScore[currentId] + edge.Cost;

                if (tentativeG < gScore[neighborId])
                {
                    cameFrom[neighborId] = currentId;
                    gScore[neighborId] = tentativeG;
                    fScore[neighborId] = tentativeG + Heuristic(neighborNode, goal);

                    if (!openSetIds.Contains(neighborId))
                    {
                        openSet.Enqueue(neighborId, fScore[neighborId]);
                        openSetIds.Add(neighborId);
                    }
                }
            }
        }

        return null;
    }

    private static double Heuristic(Node a, Node b)
    {
        var dx = a.X - b.X;
        var dy = a.Y - b.Y;
        return Math.Sqrt(dx * dx + dy * dy);
    }

    private NavigationResult BuildResult(
        Dictionary<int, int?> prev,
        double totalCost,
        Node start,
        Node goal,
        List<Node> allNodes)
    {
        var pathIds = new List<int>();
        var currentId = goal.Id;

        while (currentId != start.Id)
        {
            pathIds.Add(currentId);
            var p = prev[currentId];
            if (p is null)
                break;
            currentId = p.Value;
        }

        pathIds.Add(start.Id);
        pathIds.Reverse();

        var nodesInPath = allNodes
            .Where(n => pathIds.Contains(n.Id))
            .OrderBy(n => pathIds.IndexOf(n.Id))
            .ToList();

        // довжину рахуємо за Length ребер, якщо є, або по евклідовій відстані
        double totalLength = 0;
        for (int i = 0; i < nodesInPath.Count - 1; i++)
        {
            var fromId = nodesInPath[i].Id;
            var toId = nodesInPath[i + 1].Id;

            var edge = _dbContext.Edges
                .AsNoTracking()
                .FirstOrDefault(e => e.FromNodeId == fromId && e.ToNodeId == toId && !e.IsBlocked);

            if (edge is not null)
            {
                totalLength += edge.Length;
            }
            else
            {
                var a = nodesInPath[i];
                var b = nodesInPath[i + 1];
                totalLength += Heuristic(a, b);
            }
        }

        return new NavigationResult
        {
            PathNodes = nodesInPath,
            TotalLength = totalLength,
            TotalCost = totalCost
        };
    }
}
