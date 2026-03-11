using System.Diagnostics;
using System.Text;
using System.Xml.Linq;
using NetTopologySuite.Geometries;
using Src.Services;

public sealed class FlightRouteKmlGenerator
{
    private readonly List<string> _palette = new()
    {
        "#e6194b","#3cb44b","#ffe119","#4363d8","#f58231",
        "#911eb4","#46f0f0","#f032e6","#bcf60c","#fabebe",
        "#008080","#e6beff","#9a6324","#fffac8","#800000",
        "#aaffc3","#808000","#ffd8b1","#000075","#808080",
        "#ff4500","#2e8b57","#daa520","#1e90ff","#ff1493",
        "#9400d3","#00ced1","#ff69b4","#7cfc00","#ffb6c1",
        "#20b2aa","#dda0dd","#cd853f","#fafad2","#b22222",
        "#98fb98","#6b8e23","#ffdead","#191970","#a9a9a9",
        "#ff6347","#228b22","#b8860b","#4169e1","#ff00ff",
        "#8a2be2","#00ffff","#adff2f","#ffc0cb"
    };

    public byte[] Generate(List<FlightRoute> routes)
    {
        var sorted = routes.OrderBy(x => x.id).ToList();

        XNamespace ns = "http://www.opengis.net/kml/2.2";
        var document = new XElement(ns + "Document");

        foreach (var r in sorted)
        {
            switch (r.type)
            {
                case 1:
                    document.Add(CreateStartEnd(ns, r, "始"));
                    break;
                case 2:
                    document.Add(CreateStartEnd(ns, r, "終"));
                    break;
                case 3:
                    document.Add(CreateSurvey(ns, r));
                    break;
                case 4:
                    document.Add(CreatePassLine(ns, r));
                    break;
            }
        }

        var kml = new XDocument(
            new XDeclaration("1.0", "UTF-8", "yes"),
            new XElement(ns + "kml", document)
        );

        return Encoding.UTF8.GetBytes(kml.ToString());
    }
    /// <summary>
    /// 始点・終点　「H」ヘリポート
    /// </summary>
    /// <param name="ns"></param>
    /// <param name="r"></param>
    /// <param name="sub"></param>
    /// <returns></returns>
    private XElement CreateStartEnd(XNamespace ns, FlightRoute r, string sub)
    {
        if (r.geometry is not Point pt)
            return new XElement(ns + "Folder");

        var svg = CreateCircleSvg("#ffffff", "#0000ff", "H", null);

        // 円(H)
        var circle =
            new XElement(ns + "Placemark",
                CreateSvgStyle(ns, svg, 0.4),
                new XElement(ns + "Point",
                    new XElement(ns + "coordinates", $"{pt.X},{pt.Y},0"))
            );

        // offset設定
        double offset = sub == "始" ? 40 : -40;
        string anchor = sub == "始" ? "start" : "end";

        var labelSvg = CreateOutlinedTextSvg(sub, sub == "始");

        var label =
            new XElement(ns + "Placemark",
                CreateSvgStyle(ns, labelSvg, 0.7),
                new XElement(ns + "Point",
                    new XElement(ns + "coordinates",
                        $"{pt.X},{pt.Y},0"))
            );

        return new XElement(ns + "Folder", circle, label);
    }

    /// <summary>
    /// 点検箇所
    /// </summary>
    /// <param name="ns"></param>
    /// <param name="r"></param>
    /// <returns></returns>
    private XElement CreateSurvey(XNamespace ns, FlightRoute r)
    {
        if (r.geometry is Point pt)
            return CreateSurveyPoint(ns, r, pt);

        if (r.geometry is LineString line)
            return CreateSurveyLine(ns, r, line);

        return new XElement(ns + "Folder");
    }

    private XElement CreateSurveyPoint(XNamespace ns, FlightRoute r, Point pt)
    {
        var hex = _palette[Math.Abs(r.no ?? 0) % _palette.Count];
        //var svg = CreateCircleSvg(hex, "#000000", r.no?.ToString() ?? "");
        var svg = CreateCircleSvg("#FF0000", "#FF0000", r.no?.ToString() ?? "");

        return new XElement(ns + "Placemark",
            //CreateDescription(ns, r),
            CreateSvgStyle(ns, svg, 0.5),
            new XElement(ns + "name", r.name ?? $"Route {r.no}"),
            new XElement(ns + "Point",
                new XElement(ns + "coordinates", $"{pt.X},{pt.Y},0"))
        );
    }

    /// <summary>
    /// 点検箇所　ライン
    /// </summary>
    /// <param name="ns"></param>
    /// <param name="r"></param>
    /// <param name="line"></param>
    /// <returns></returns>
    private XElement CreateSurveyLine(XNamespace ns, FlightRoute r, LineString line)
    {
        //var hex = _palette[Math.Abs(r.no ?? 0) % _palette.Count];
        var hex = "#FF0000";
        var kmlColor = ToKmlColor(hex);

        Debug.WriteLine(r);
        // --- ライン ---
        var lineElement =
            new XElement(ns + "Placemark",
                new XElement(ns + "name", r.name ?? $"Route {r.no}"),
                //CreateDescription(ns, r),
                new XElement(ns + "Style",
                    new XElement(ns + "LineStyle",
                        new XElement(ns + "color", kmlColor),
                        new XElement(ns + "width", 10))),
                new XElement(ns + "LineString",
                    new XElement(ns + "coordinates",
                        string.Join(" ",
                            line.Coordinates.Select(c => $"{c.X},{c.Y},0")))));

        if (line.Coordinates.Length < 2)
            return lineElement;

        var start = line.StartPoint;
        var end = line.EndPoint;

        // --- 文字のみSVG（丸なし） ---
        var startTextSvg = CreateOutlinedTextSvg(
            r.no?.ToString() ?? "",
            offsetRight: true);

        var endTextSvg = CreateOutlinedTextSvg(
            r.no?.ToString() ?? "",
            offsetRight: false);

        var startLabel =
            new XElement(ns + "Placemark",
                CreateSvgStyle(ns, startTextSvg, 1.0),
                new XElement(ns + "Point",
                    new XElement(ns + "coordinates",
                        $"{start.X},{start.Y},0")));

        var endLabel =
            new XElement(ns + "Placemark",
                CreateSvgStyle(ns, endTextSvg, 1.0),
                new XElement(ns + "Point",
                    new XElement(ns + "coordinates",
                        $"{end.X},{end.Y},0")));

        return new XElement(ns + "Folder",
            lineElement,
            startLabel,
            endLabel
        );
    }
    /// <summary>
    /// 移動ライン
    /// </summary>
    /// <param name="ns"></param>
    /// <param name="r"></param>
    /// <returns></returns>
    private XElement CreatePassLine(XNamespace ns, FlightRoute r)
    {
        double lineWidth = 4.5;
        string lineColor = "#0000FF";
        string lineKmlColor = ToKmlColor(lineColor);

        // 矢印サイズ
        double arrowLength = 0.012;
        double arrowWidth = arrowLength * 0.5;
        double notchDepth = arrowLength * 0.35;

        if (r.geometry is not LineString line)
            return new XElement(ns + "Folder");

        var coords = line.Coordinates;

        if (coords.Length < 2)
            return new XElement(ns + "Folder");

        //----------------------------------
        // ライン
        //----------------------------------
        var lineElement =
            new XElement(ns + "Placemark",
                //CreateDescription(ns, r),
                new XElement(ns + "Style",
                    new XElement(ns + "LineStyle",
                        new XElement(ns + "color", lineKmlColor),
                        new XElement(ns + "width", lineWidth)
                    )
                ),
                new XElement(ns + "LineString",
                    new XElement(ns + "coordinates",
                        string.Join(" ",
                            coords.Select(c => $"{c.X},{c.Y},0")))
                )
            );

        //----------------------------------
        // 終点と方向
        //----------------------------------
        var end = coords[^1];
        var prev = coords[^2];

        double dx = end.X - prev.X;
        double dy = end.Y - prev.Y;

        double len = Math.Sqrt(dx * dx + dy * dy);
        if (len == 0)
            return lineElement;

        dx /= len;
        dy /= len;

        // 垂直ベクトル
        double px = -dy;
        double py = dx;

        //----------------------------------
        // 矢印先端 = ライン終点
        //----------------------------------
        double tipX = end.X;
        double tipY = end.Y;

        // 矢印の基準点（後ろ）
        double baseX = tipX - dx * arrowLength;
        double baseY = tipY - dy * arrowLength;

        // 左右
        double leftX = baseX + px * arrowWidth;
        double leftY = baseY + py * arrowWidth;

        double rightX = baseX - px * arrowWidth;
        double rightY = baseY - py * arrowWidth;

        // ノッチ
        double notchX = baseX + dx * notchDepth;
        double notchY = baseY + dy * notchDepth;

        //----------------------------------
        // 矢印Polygon
        //----------------------------------
        var arrow =
            new XElement(ns + "Placemark",
                new XElement(ns + "Style",
                    new XElement(ns + "LineStyle",
                        new XElement(ns + "width", 0)   // ←これ重要
                    ),
                    new XElement(ns + "PolyStyle",
                        new XElement(ns + "color", lineKmlColor),
                        new XElement(ns + "fill", 1),
                        new XElement(ns + "outline", 0)
                    )
                ),
                new XElement(ns + "Polygon",
                    new XElement(ns + "outerBoundaryIs",
                        new XElement(ns + "LinearRing",
                            new XElement(ns + "coordinates",
                                $"{tipX},{tipY},0 " +
                                $"{leftX},{leftY},0 " +
                                $"{notchX},{notchY},0 " +
                                $"{rightX},{rightY},0 " +
                                $"{tipX},{tipY},0"
                            )
                        )
                    )
                )
            );

        return new XElement(ns + "Folder",
            lineElement,
            arrow
        );
    }

    private XElement CreateSvgStyle(
    XNamespace ns,
    string svg,
    double scale,
    double heading = 0)
    {
        return new XElement(ns + "Style",
            new XElement(ns + "IconStyle",
                new XElement(ns + "scale", scale),
                new XElement(ns + "heading", heading),
                new XElement(ns + "Icon",
                    new XElement(ns + "href", svg)
                ),
                new XElement(ns + "hotSpot",
                    new XAttribute("x", "0.5"),
                    new XAttribute("y", "0.5"),
                    new XAttribute("xunits", "fraction"),
                    new XAttribute("yunits", "fraction")
                )
            ),
            new XElement(ns + "LabelStyle",
                new XElement(ns + "scale", 0)
            )
        );
    }

    /// <summary>
    /// 点検箇所　点
    /// </summary>
    /// <param name="fill"></param>
    /// <param name="stroke"></param>
    /// <param name="text"></param>
    /// <param name="subText"></param>
    /// <returns></returns>
    /// <summary>
    /// 点検箇所　点
    /// </summary>
    /// <summary>
    /// 点検箇所　点
    /// </summary>
    private string CreateCircleSvg(
    string fill,
    string stroke,
    string text,
    string subText = null)
    {
        // 円サイズ
        double r = 14;

        double svgWidth = 140;
        double svgHeight = 80;

        // SVG中心
        double cx = svgWidth / 2;
        double cy = svgHeight / 2;

        var svg =
    $@"<svg xmlns='http://www.w3.org/2000/svg' width='{svgWidth}' height='{svgHeight}'>
    <circle cx='{cx}' cy='{cy}' r='{r}'
        fill='{fill}'
        stroke='{stroke}'
        stroke-width='2'/>

    <text x='{cx}' y='{cy}'
        font-size='{r * 1.3}'
        font-family='Arial'
        font-weight='bold'
        text-anchor='middle'
        dominant-baseline='central'
        fill='black'
        stroke='white'
        stroke-width='2'
        paint-order='stroke'>
        {text}
    </text>

    {(string.IsNullOrEmpty(subText) ? "" :
    $@"<text x='{cx + r + 10}' y='{cy + 5}'
        font-size='{r * 1.05}'
        font-family='Arial'
        font-weight='bold'
        fill='black'>
        {subText}
    </text>")}

</svg>";

        return "data:image/svg+xml;base64," +
               Convert.ToBase64String(Encoding.UTF8.GetBytes(svg));
    }

    private XElement CreateDescription(XNamespace ns, FlightRoute r)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"名称: {r.name}");
        sb.AppendLine($"ID: {r.id}");
        sb.AppendLine($"No: {r.no}");
        sb.AppendLine($"優先度: {r.priority}");
        sb.AppendLine($"調査方法: {r.survey}");
        sb.AppendLine($"搭乗人数: {r.persons}");

        return new XElement(ns + "description", sb.ToString());
    }

    private string ToKmlColor(string hex)
    {
        hex = hex.Replace("#", "");
        return $"ff{hex.Substring(4, 2)}{hex.Substring(2, 2)}{hex.Substring(0, 2)}";
    }
    private double CalculateBearing(
    double lon1, double lat1,
    double lon2, double lat2)
    {
        double rad = Math.PI / 180;

        var φ1 = lat1 * rad;
        var φ2 = lat2 * rad;
        var Δλ = (lon2 - lon1) * rad;

        var y = Math.Sin(Δλ) * Math.Cos(φ2);
        var x = Math.Cos(φ1) * Math.Sin(φ2) -
                Math.Sin(φ1) * Math.Cos(φ2) * Math.Cos(Δλ);

        var θ = Math.Atan2(y, x);
        var bearing = (θ * 180 / Math.PI + 360) % 360;

        return bearing;
    }
    private string CreateArrowSvg(string color, double rotationDegrees)
    {
        double center = 30;

        var svg =
    $@"<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>
    <g transform='rotate({rotationDegrees} {center} {center})'>
        <polygon points='15,30 45,20 45,27 55,27 55,33 45,33 45,40'
            fill='{color}' />
    </g>
</svg>";

        return "data:image/svg+xml;base64," +
               Convert.ToBase64String(Encoding.UTF8.GetBytes(svg));
    }

    private string CreateOutlinedTextSvg(string text, bool offsetRight)
    {
        int width = 140;
        int height = 80;

        int textX = offsetRight ? 90 : 45;
        string anchor = offsetRight ? "start" : "end";

        var svg =
    $@"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}'>
    <text x='{textX}' y='40'
        font-size='24'
        font-family='Arial'
        font-weight='bold'
        text-anchor='{anchor}'
        fill='black'
        stroke='white'
        stroke-width='3'
        paint-order='stroke'
        dominant-baseline='central'>
        {text}
    </text>
</svg>";

        return "data:image/svg+xml;base64," +
               Convert.ToBase64String(Encoding.UTF8.GetBytes(svg));
    }
}
