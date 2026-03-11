using NetTopologySuite.Geometries;
using Src.Common;

namespace Src.Services;

public sealed class FlightRoute
{
    /// <summary>一意の連番（必須）</summary>
    public int id { get; set; }

    /// <summary>調査箇所連番（null 可）</summary>
    public int? no { get; set; }

    /// <summary>優先度（Src.Common.調査優先度Enum）</summary>
    public 調査優先度Enum? priority { get; set; }

    /// <summary>調査方法（Src.Common.調査手法Enum）</summary>
    public 調査手法Enum? survey { get; set; }

    /// <summary>搭乗人数（null 可）</summary>
    public int? persons { get; set; }

    /// <summary>調査箇所名</summary>
    public string name { get; set; } = string.Empty;

    /// <summary>種別: 1=起点, 2=終点, 3=調査箇所, 4=通過</summary>
    public int type { get; set; }

    /// <summary>ジオメトリ (NetTopologySuite)</summary>
    public Geometry? geometry { get; set; }
}
