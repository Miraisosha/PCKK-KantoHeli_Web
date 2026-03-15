using System.Diagnostics;
using System.Text;
using System.Xml.Linq;
using NetTopologySuite.Geometries;
using Src.Common;
using Src.Services;

public sealed class FlightRouteKmlGenerator
{
    public byte[] Generate(List<FlightRoute> routes)
    {
        var sorted = routes.OrderBy(x => x.id).ToList();

        XNamespace ns = "http://www.opengis.net/kml/2.2";

        var document = new XElement(ns + "Document",

            //------------------------------------------------
            // Style定義
            //------------------------------------------------

            // ヘリポート
            new XElement(ns + "Style",
                new XAttribute("id", "IconHeliPort"),
                new XElement(ns + "IconStyle",
                    new XElement(ns + "scale", 1),
                    new XElement(ns + "Icon",
                        new XElement(ns + "href",
                            "https://maps.gsi.go.jp/portal/sys/v4/symbols/067.png")),
                    new XElement(ns + "hotSpot",
                        new XAttribute("x", "0.5"),
                        new XAttribute("y", "0.5"),
                        new XAttribute("xunits", "fraction"),
                        new XAttribute("yunits", "fraction"))
                )
            ),

            // 点検ライン
            new XElement(ns + "Style",
                new XAttribute("id", "SurveyLine"),
                new XElement(ns + "LineStyle",
                    new XElement(ns + "color", "ff0000ff"),
                    new XElement(ns + "width", 10)
                )
            ),

            // 点検ポイント
            new XElement(ns + "Style",
                new XAttribute("id", "SurveyPoint"),
                new XElement(ns + "IconStyle",
                    new XElement(ns + "scale", 1),
                    new XElement(ns + "Icon",
                        new XElement(ns + "href",
                            "https://maps.gsi.go.jp/portal/sys/v4/symbols/080.png")),
                    new XElement(ns + "hotSpot",
                        new XAttribute("x", "0.5"),
                        new XAttribute("y", "0.5"),
                        new XAttribute("xunits", "fraction"),
                        new XAttribute("yunits", "fraction"))
                ),
                new XElement(ns + "LabelStyle",
                    new XElement(ns + "scale", 1.2),
                    new XElement(ns + "color", "ff000000") // 黒
                )
            ),


            // 移動ライン
            new XElement(ns + "Style",
                new XAttribute("id", "PassLine"),
                new XElement(ns + "LineStyle",
                    new XElement(ns + "color", "ffbb1c1c"),
                    new XElement(ns + "width", 10)
                )
            ),

            // 矢印
            new XElement(ns + "Style",
                new XAttribute("id", "ArrowPoly"),
                new XElement(ns + "LineStyle",
                    new XElement(ns + "color", "ffbb1c1c"),
                    new XElement(ns + "width", 3)
                ),
                new XElement(ns + "PolyStyle",
                    new XElement(ns + "color", "ffbb1c1c")
                )
            )
        );

        //------------------------------------------------
        // Placemark生成
        //------------------------------------------------
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

        //------------------------------------------------
        // KML生成
        //------------------------------------------------
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

        return new XElement(ns + "Placemark",
            new XElement(ns + "name", sub),
            new XElement(ns + "styleUrl", "#IconHeliPort"),
            new XElement(ns + "Point",
                new XElement(ns + "coordinates", $"{pt.X},{pt.Y},0"))
        );
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
        var name = r.name?.ToString() ?? $"{r.name}";
        name += "（" + ((r.survey == 調査手法Enum.通過) ? "通過" : "周回") + "）";

        var pointIcon = new XElement(ns + "Placemark",
            new XElement(ns + "name", name),
//            new XElement(ns + "description", r.name),
            new XElement(ns + "styleUrl", "#SurveyPoint"),
            new XElement(ns + "Point",
                new XElement(ns + "coordinates",
                    $"{pt.X},{pt.Y},0")));
        //--------------------------------
        // 右横番号
        //--------------------------------
        var labelSvg = CreateTextSvg(r.no?.ToString() ?? "");

        var label =
            new XElement(ns + "Placemark",
                CreateSvgStyle(ns, labelSvg, 1.0),
                new XElement(ns + "Point",
                    new XElement(ns + "coordinates",
                        $"{pt.X},{pt.Y},0"))
            );

        return new XElement(ns + "Folder",
            pointIcon
    //        label
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
        // --- ライン ---
        var lineElement = new XElement(ns + "Placemark",
            new XElement(ns + "name", r.name ?? $"Route {r.no}"),
            new XElement(ns + "styleUrl", "#SurveyLine"),
            new XElement(ns + "LineString",
                new XElement(ns + "coordinates",
                    string.Join(" ",
                        line.Coordinates.Select(c =>
                            $"{c.X},{c.Y},0")))));

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
            lineElement
//            startLabel,
//            endLabel
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
        var lineElement = new XElement(ns + "Placemark",
            new XElement(ns + "styleUrl", "#PassLine"),
            new XElement(ns + "LineString",
                new XElement(ns + "coordinates",
                    string.Join(" ",
                        coords.Select(c =>
                            $"{c.X},{c.Y},0")))));

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
        var arrow = new XElement(ns + "Placemark",
            new XElement(ns + "styleUrl", "#ArrowPoly"),
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
    private string CreateTextSvg(string text)
    {
        int width = 140;
        int height = 80;

        int textX = 90;

        var svg =
    $@"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}'>
    <text x='{textX}' y='40'
        font-size='26'
        font-family='Arial'
        font-weight='bold'
        text-anchor='start'
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
