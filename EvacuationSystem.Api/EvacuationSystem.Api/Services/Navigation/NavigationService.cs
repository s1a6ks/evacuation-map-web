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

    // ── 1. Централізована формула ваги ребра ──────────────────────
    // Weight = Length × Cost
    // Cost = 1.0 — звичайний прохід
    // Cost > 1.0 — складніший прохід (сходи, вузький коридор тощо)
    private static double GetEdgeWeight(Edge edge)
        => edge.Length * edge.Cost;

    // ── Публічний метод пошуку шляху ──────────────────────────────
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

        // ── 4. Dictionary для O(1) пошуку вузла по Id ─────────────
        var nodeMap = nodes.ToDictionary(n => n.Id);

        // ── 2. Неорієнтований граф ─────────────────────────────────
        var adjacency = BuildAdjacency(edges);

        return algorithm switch
        {
            NavigationAlgorithm.Dijkstra => RunDijkstra(fromNode, toNode, adjacency, nodeMap, edges),
            NavigationAlgorithm.AStar => RunAStar(fromNode, toNode, adjacency, nodeMap, edges),
            _ => RunAStar(fromNode, toNode, adjacency, nodeMap, edges)
        };
    }

    // ── 2. Побудова списку суміжності (неорієнтований граф) ───────
    private static Dictionary<int, List<Edge>> BuildAdjacency(IEnumerable<Edge> edges)
    {
        var adjacency = new Dictionary<int, List<Edge>>();

        foreach (var edge in edges)
        {
            // Пряме ребро A → B
            if (!adjacency.TryGetValue(edge.FromNodeId, out var fwd))
                adjacency[edge.FromNodeId] = fwd = new List<Edge>();
            fwd.Add(edge);

            // Зворотне ребро B → A (граф неорієнтований)
            if (!adjacency.TryGetValue(edge.ToNodeId, out var rev))
                adjacency[edge.ToNodeId] = rev = new List<Edge>();

            rev.Add(new Edge
            {
                Id = edge.Id,
                FromNodeId = edge.ToNodeId,
                ToNodeId = edge.FromNodeId,
                Length = edge.Length,
                Cost = edge.Cost,
                IsBlocked = edge.IsBlocked
            });
        }

        return adjacency;
    }

    // ── Dijkstra ──────────────────────────────────────────────────
    private NavigationResult? RunDijkstra(
        Node start,
        Node goal,
        Dictionary<int, List<Edge>> adjacency,
        Dictionary<int, Node> nodeMap,
        List<Edge> allEdges)
    {
        var dist = nodeMap.Keys.ToDictionary(id => id, _ => double.PositiveInfinity);
        var prev = nodeMap.Keys.ToDictionary(id => id, _ => (int?)null);
        var visited = new HashSet<int>();

        dist[start.Id] = 0;

        var pq = new PriorityQueue<int, double>();
        pq.Enqueue(start.Id, 0);

        while (pq.TryDequeue(out var currentId, out _))
        {
            if (!visited.Add(currentId)) continue;

            if (currentId == goal.Id)
                return BuildResult(prev, dist[goal.Id], start, goal, nodeMap, allEdges);

            if (!adjacency.TryGetValue(currentId, out var neighbors)) continue;

            foreach (var edge in neighbors)
            {
                var neighborId = edge.ToNodeId;
                if (visited.Contains(neighborId)) continue;

                // ── 1. Використовуємо GetEdgeWeight ───────────────
                var tentative = dist[currentId] + GetEdgeWeight(edge);

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

    // ── A* ────────────────────────────────────────────────────────
    private NavigationResult? RunAStar(
        Node start,
        Node goal,
        Dictionary<int, List<Edge>> adjacency,
        Dictionary<int, Node> nodeMap,
        List<Edge> allEdges)
    {
        var gScore = nodeMap.Keys.ToDictionary(id => id, _ => double.PositiveInfinity);
        var fScore = nodeMap.Keys.ToDictionary(id => id, _ => double.PositiveInfinity);
        var cameFrom = nodeMap.Keys.ToDictionary(id => id, _ => (int?)null);

        gScore[start.Id] = 0;
        fScore[start.Id] = Heuristic(start, goal);

        var openSet = new PriorityQueue<int, double>();
        var openSetIds = new HashSet<int> { start.Id };
        openSet.Enqueue(start.Id, fScore[start.Id]);

        while (openSet.TryDequeue(out var currentId, out _))
        {
            openSetIds.Remove(currentId);

            if (currentId == goal.Id)
                return BuildResult(cameFrom, gScore[goal.Id], start, goal, nodeMap, allEdges);

            if (!adjacency.TryGetValue(currentId, out var neighbors)) continue;

            foreach (var edge in neighbors)
            {
                var neighborId = edge.ToNodeId;

                // ── 4. O(1) через nodeMap ──────────────────────────
                if (!nodeMap.TryGetValue(neighborId, out var neighborNode)) continue;

                // ── 1. Використовуємо GetEdgeWeight ───────────────
                var tentativeG = gScore[currentId] + GetEdgeWeight(edge);

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

    // ── Евклідова евристика ───────────────────────────────────────
    private static double Heuristic(Node a, Node b)
    {
        var dx = a.X - b.X;
        var dy = a.Y - b.Y;
        return Math.Sqrt(dx * dx + dy * dy);
    }

    // ── 3. BuildResult — без звернень до DbContext ────────────────
    private static NavigationResult BuildResult(
        Dictionary<int, int?> prev,
        double totalCost,
        Node start,
        Node goal,
        Dictionary<int, Node> nodeMap,
        List<Edge> allEdges)
    {
        // Відновлюємо шлях
        var pathIds = new List<int>();
        var currentId = goal.Id;

        while (currentId != start.Id)
        {
            pathIds.Add(currentId);
            var p = prev[currentId];
            if (p is null) break;
            currentId = p.Value;
        }
        pathIds.Add(start.Id);
        pathIds.Reverse();

        var nodesInPath = pathIds
            .Where(nodeMap.ContainsKey)
            .Select(id => nodeMap[id])
            .ToList();

        // Рахуємо TotalLength по edges у пам'яті — без DbContext
        double totalLength = 0;
        for (int i = 0; i < nodesInPath.Count - 1; i++)
        {
            var fromId = nodesInPath[i].Id;
            var toId = nodesInPath[i + 1].Id;

            var edge = allEdges.FirstOrDefault(e =>
                (e.FromNodeId == fromId && e.ToNodeId == toId) ||
                (e.FromNodeId == toId && e.ToNodeId == fromId));

            totalLength += edge is not null
                ? edge.Length
                : Heuristic(nodesInPath[i], nodesInPath[i + 1]);
        }

        return new NavigationResult
        {
            PathNodes = nodesInPath,
            TotalLength = totalLength,
            TotalCost = totalCost
        };
    }
}