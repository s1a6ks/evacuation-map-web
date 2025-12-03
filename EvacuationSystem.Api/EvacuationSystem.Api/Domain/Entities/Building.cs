using System.Drawing;

namespace EvacuationSystem.Api.Domain.Entities;

public class Building
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;        // Наприклад: "Корпус ФМФ"
    public string Address { get; set; } = null!;     // Опціонально

    public ICollection<Floor> Floors { get; set; } = new List<Floor>();
}
