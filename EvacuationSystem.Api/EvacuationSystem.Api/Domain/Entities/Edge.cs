namespace EvacuationSystem.Api.Domain.Entities;

public class Edge
{
    public int Id { get; set; }

    public int FromNodeId { get; set; }
    public Node FromNode { get; set; } = null!;

    public int ToNodeId { get; set; }
    public Node ToNode { get; set; } = null!;

    public double Length { get; set; }         // умовна довжина в метрах або одиницях плану
    public double Cost { get; set; }          // "вартість" для алгоритму: можна = Length, а можна додати коефіцієнти

    public bool IsBlocked { get; set; }       // для моделювання перекритих проходів
}
