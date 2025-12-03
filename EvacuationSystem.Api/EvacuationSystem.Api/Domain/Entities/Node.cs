namespace EvacuationSystem.Api.Domain.Entities;

public class Node
{
    public int Id { get; set; }

    // Координати на плані (в пікселях або у відносних одиницях 0..1)
    public double X { get; set; }
    public double Y { get; set; }

    public bool IsExit { get; set; }       // true – це вихід назовні
    public bool IsStair { get; set; }      // true – це сходи

    public int FloorId { get; set; }
    public Floor Floor { get; set; } = null!;

    public ICollection<Edge> FromEdges { get; set; } = new List<Edge>();
    public ICollection<Edge> ToEdges { get; set; } = new List<Edge>();

    public int? RoomId { get; set; }
    public Room? Room { get; set; }        // якщо вузол знаходиться в кімнаті або біля дверей кімнати
}
