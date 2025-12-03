using System.Xml.Linq;

namespace EvacuationSystem.Api.Domain.Entities;

public class Room
{
    public int Id { get; set; }
    public string Number { get; set; } = null!;       // "101", "Ауд. 2-12"
    public string? Type { get; set; }                 // "auditory", "toilet", "deanery", etc.

    public int FloorId { get; set; }
    public Floor Floor { get; set; } = null!;

    // Для зв'язку з графом: в які вузли виходять двері з кімнати
    public ICollection<Node> ConnectedNodes { get; set; } = new List<Node>();
}
