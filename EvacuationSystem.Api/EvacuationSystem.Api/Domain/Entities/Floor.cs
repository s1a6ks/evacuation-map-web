using System.Xml.Linq;

namespace EvacuationSystem.Api.Domain.Entities;

public class Floor
{
    public int Id { get; set; }
    public int Number { get; set; }                  // 0 – цоколь, 1, 2, 3...
    public string? Name { get; set; }                // Напр. "1 поверх"

    public int BuildingId { get; set; }
    public Building Building { get; set; } = null!;

    public ICollection<Room> Rooms { get; set; } = new List<Room>();
    public ICollection<Node> Nodes { get; set; } = new List<Node>();
}
