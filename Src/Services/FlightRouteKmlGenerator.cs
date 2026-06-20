using System.Diagnostics;
using System.Text;
using System.Xml.Linq;
using NetTopologySuite.Geometries;
using Src.Common;
using Src.Services;

public sealed class FlightRouteKmlGenerator
{
    private const string PassLineArrowIconFolderPath = "icons/";
    private const string PassLineArrowStylePrefix = "PassLineArrow";
    private static readonly int[] PassLineArrowDirections =
        [0, 22, 45, 68, 90, 112, 135, 158, 180, 202, 225, 248, 270, 292, 315, 338];
    private readonly Func<int, string> passLineArrowIconHrefFactory;

    public FlightRouteKmlGenerator(string? passLineArrowIconFolderUrl = null)
    {
        var normalizedIconFolderUrl = NormalizeIconFolderUrl(passLineArrowIconFolderUrl);
        passLineArrowIconHrefFactory = directionDegrees => $"{normalizedIconFolderUrl}pass_arrow_{directionDegrees:000}.png";
    }

    public FlightRouteKmlGenerator(Func<int, string> passLineArrowIconHrefFactory)
    {
        this.passLineArrowIconHrefFactory = passLineArrowIconHrefFactory;
    }

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
            )
        );

        foreach (var arrowStyle in CreatePassLineArrowStyles(ns, sorted))
        {
            document.Add(arrowStyle);
        }

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
        var name = r.name?.ToString() ?? $"{r.name}";
        name += "（" + ((r.survey == 調査手法Enum.通過) ? "通過" : "周回") + "）";
        // --- ライン ---
        var lineElement = new XElement(ns + "Placemark",
            new XElement(ns + "name", name),
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

        //----------------------------------
        // 矢印アイコン
        //----------------------------------
        var directionDegrees = GetPassLineArrowDirectionDegrees(CalcHeading(prev, end));
        var arrow = new XElement(ns + "Placemark",
            new XElement(ns + "styleUrl", $"#{GetPassLineArrowStyleId(directionDegrees)}"),
            new XElement(ns + "Point",
                new XElement(ns + "coordinates", $"{end.X},{end.Y},0"))
        );

        return new XElement(ns + "Folder",
            lineElement,
            arrow
        );
    }

    private IEnumerable<XElement> CreatePassLineArrowStyles(XNamespace ns, IEnumerable<FlightRoute> routes)
    {
        var headings = routes
            .Where(r => r.type == 4)
            .Select(r => r.geometry as LineString)
            .Where(line => line?.Coordinates.Length >= 2)
            .Select(line => GetPassLineArrowDirectionDegrees(CalcHeading(line!.Coordinates[^2], line.Coordinates[^1])))
            .Distinct()
            .OrderBy(directionDegrees => directionDegrees);

        foreach (var directionDegrees in headings)
        {
            yield return CreateIconStyle(ns, GetPassLineArrowStyleId(directionDegrees), GetPassLineArrowIconUrl(directionDegrees), 1.0, 0, 0.5, 0.5);
        }
    }

    private XElement CreateSvgStyle(
    XNamespace ns,
    string svg,
    double scale,
    double heading = 0,
    double hotSpotX = 0.5,
    double hotSpotY = 0.5)
        => CreateIconStyle(ns, null, svg, scale, heading, hotSpotX, hotSpotY);

    private XElement CreateIconStyle(
    XNamespace ns,
    string? id,
    string iconUrl,
    double scale,
    double heading = 0,
    double hotSpotX = 0.5,
    double hotSpotY = 0.5)
    {
        return new XElement(ns + "Style",
            id is null ? null : new XAttribute("id", id),
            new XElement(ns + "IconStyle",
                new XElement(ns + "scale", scale),
                new XElement(ns + "heading", heading),
                new XElement(ns + "Icon",
                    new XElement(ns + "href", iconUrl)
                ),
                new XElement(ns + "hotSpot",
                    new XAttribute("x", hotSpotX),
                    new XAttribute("y", hotSpotY),
                    new XAttribute("xunits", "fraction"),
                    new XAttribute("yunits", "fraction")
                )
            ),
            new XElement(ns + "LabelStyle",
                new XElement(ns + "scale", 0)
            )
        );
    }
    private static string GetPassLineArrowStyleId(int directionDegrees) => $"{PassLineArrowStylePrefix}{directionDegrees:000}";
    private string GetPassLineArrowIconUrl(int directionDegrees) => passLineArrowIconHrefFactory(directionDegrees);
    private static string NormalizeIconFolderUrl(string? iconFolderUrl)
    {
        if (string.IsNullOrWhiteSpace(iconFolderUrl))
            return PassLineArrowIconFolderPath;

        return iconFolderUrl.TrimEnd('/') + "/";
    }
    private static int GetPassLineArrowDirectionDegrees(double heading)
    {
        var normalized = ((heading % 360.0) + 360.0) % 360.0;
        var directionIndex = (int)Math.Round(normalized / 22.5, MidpointRounding.AwayFromZero) % PassLineArrowDirections.Length;
        return PassLineArrowDirections[directionIndex];
    }
    private static double CalcHeading(Coordinate from, Coordinate to)
    {
        double lat1 = ToRadians(from.Y);
        double lat2 = ToRadians(to.Y);
        double dLon = ToRadians(to.X - from.X);

        double y = Math.Sin(dLon) * Math.Cos(lat2);
        double x = Math.Cos(lat1) * Math.Sin(lat2)
                 - Math.Sin(lat1) * Math.Cos(lat2) * Math.Cos(dLon);

        return (Math.Atan2(y, x) * 180.0 / Math.PI + 360.0) % 360.0;
    }
    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
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
