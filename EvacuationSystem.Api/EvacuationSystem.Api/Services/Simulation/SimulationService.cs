using EvacuationSystem.Api.Contracts.Simulation;
using EvacuationSystem.Api.Data;
using EvacuationSystem.Api.Domain.Entities;
using EvacuationSystem.Api.Services.Navigation;
using Microsoft.EntityFrameworkCore;

namespace EvacuationSystem.Api.Services.Simulation;

public interface ISimulationService
{
    Task<SimulationResultDto> RunSimulationAsync(SimulationRequest request);
}

public class SimulationService : ISimulationService
{
    private readonly AppDbContext _db;
    private readonly INavigationService _navigation;

    public SimulationService(AppDbContext db, INavigationService navigation)
    {
        _db = db;
        _navigation = navigation;
    }

    public async Task<SimulationResultDto> RunSimulationAsync(SimulationRequest request)
    {
        // 1. Load all nodes/exits
        var allNodes = await _db.Nodes.AsNoTracking().ToListAsync();
        var allRooms = await _db.Rooms.AsNoTracking().ToListAsync();

        var peopleRoutes = new List<(int personId, List<Node> route)>();

        // 2. Build initial routes
        foreach (var p in request.People)
        {
            var roomNodes = allNodes.Where(n => n.RoomId == p.StartRoomId).ToList();
            var startNode = roomNodes.First();

            var exitNodes = allNodes.Where(n => n.IsExit).ToList();

            // find best exit
            NavigationResult? best = null;

            foreach (var exit in exitNodes)
            {
                var r = await _navigation.FindPathAsync(startNode.Id, exit.Id, NavigationAlgorithm.AStar);
                if (r is null || r.PathNodes.Count == 0) continue;

                if (best is null || r.TotalCost < best.TotalCost)
                    best = r;
            }

            if (best is null)
                throw new Exception($"No path found for person {p.PersonId}");

            peopleRoutes.Add((p.PersonId, best.PathNodes));
        }

        // 3. Simulation parameters
        var nodeQueues = allNodes.ToDictionary(n => n.Id, n => 0);
        var nodeCapacity = 5; // example: each node can hold 5 people max
        var bottlenecks = new Dictionary<int, int>();

        // person state
        var personPositions = peopleRoutes.ToDictionary(
            x => x.personId,
            x => 0 // index of current node in route
        );

        var finished = new HashSet<int>();
        var personTimes = request.People.ToDictionary(p => p.PersonId, p => 0);

        int time = 0;

        // 4. Main simulation loop
        while (time < request.MaxTimeSeconds && finished.Count < request.People.Count)
        {
            foreach (var person in request.People)
            {
                if (finished.Contains(person.PersonId))
                    continue;

                var route = peopleRoutes.First(r => r.personId == person.PersonId).route;
                var posIndex = personPositions[person.PersonId];

                if (posIndex == route.Count - 1)
                {
                    finished.Add(person.PersonId);
                    continue;
                }

                var currentNode = route[posIndex];
                var nextNode = route[posIndex + 1];

                // If next node has capacity
                if (nodeQueues[nextNode.Id] < nodeCapacity)
                {
                    // Leave current node
                    nodeQueues[currentNode.Id] = Math.Max(0, nodeQueues[currentNode.Id] - 1);

                    // Enter next node
                    nodeQueues[nextNode.Id]++;

                    personPositions[person.PersonId] = posIndex + 1;
                }
                else
                {
                    // record bottleneck
                    if (!bottlenecks.ContainsKey(nextNode.Id))
                        bottlenecks[nextNode.Id] = 0;

                    bottlenecks[nextNode.Id] = Math.Max(bottlenecks[nextNode.Id], nodeQueues[nextNode.Id]);
                }

                personTimes[person.PersonId]++;
            }

            time++;
        }

        // 5. Build response
        var results = new List<SimulationPersonResult>();

        foreach (var p in request.People)
        {
            var route = peopleRoutes.First(r => r.personId == p.PersonId).route;
            results.Add(new SimulationPersonResult(
                p.PersonId,
                personTimes[p.PersonId],
                route.Select(n => n.Id).ToList()
            ));
        }

        var dto = new SimulationResultDto(
            PeopleResults: results,
            TotalEvacuationTime: time,
            Bottlenecks: bottlenecks.Select(b => new BottleneckInfo(b.Key, b.Value)).ToList()
        );

        return dto;
    }
}
