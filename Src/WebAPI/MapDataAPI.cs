using System.Data.Common;
using Dapper;
using DapperAid;
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Src.Common;
using Src.Services;

namespace Src.WebAPI;

/// <summary>
/// 地図関連汎用のWebAPI
/// </summary>
/// <remarks>
/// _Layout.csのhtmlに従いsite.jsより呼び出される
/// <remarks>
[ApiController]
public class MapDataApi(ILogger<MapDataApi> logger, DbConnection con, LoginService login, ProviderService provider) : ControllerBase
{
    #region --- DI ------------------------------------------------------------
    private readonly AppSettings _settings = provider.GetSettings();
    #endregion ----------------------------------------------------------------

    /// <summary>
    /// Ajax(get) : 震度ポリゴンGeojson取得
    /// </summary>
    /// <param name="quake">震度ポリゴン取得対象の地震id(複数指定可)</param>
    /// <returns>geojson(FeatureCollection)</returns>
    [Route("api/mapdata/Heliport")]
    [HttpGet]
    public async Task<JsonResult> GetHeliportAsync()
    {
        //TODO 暫定メソッドにつき後日抹消する。

        // ヘリポートの一覧を取得する
        var records = await con.SelectAsync<T_起点終点>(r => r.deleted_at == null, otherClauses: $"ORDER BY {nameof(T_起点終点.表示順)}");

        // FeatureCollectionとして返す
        return new JsonResult(new
        {
            type = "FeatureCollection",
            features = records.Select(rec =>
            {
                var point = new Point(rec.経度, rec.緯度);
                return new Feature(point, new AttributesTable
                {
                    {"name", rec.起点終点名}
                });
            })
        });
    }

    /// <summary>
    /// Ajax(get) : 震度ポリゴンGeojson取得
    /// </summary>
    /// <param name="quake">震度ポリゴン取得対象の地震id(複数指定可)</param>
    /// <returns>geojson(FeatureCollection)</returns>
    [Route("api/mapdata/EarthquakePolygon")]
    [HttpGet]
    public async Task<JsonResult> GetEarthquakePolygonAsync([FromQuery] int[] quake)
    {
        // SQLで引数指定された地震の自治体ごと最大震度を把握しジオメトリポリゴンと結合
        //TODO 改善後のポリゴンが届いたら取得元テーブルを変更
        var sql = """
            WITH w_地震明細 AS (
                SELECT
                    LEFT(市区町村コード,5) AS code,
                    MAX(最大震度) AS intensity
                FROM
                    t_地震明細
                WHERE
                    地震ID = ANY(@quake)
                AND
                    最大震度 >= '4'
                AND
                    deleted_at IS NULL
                GROUP BY 1
            )
            SELECT
                w_地震明細.code,
                intensity, wkb_geometry
            FROM
                w_地震明細
            INNER JOIN
                g_市区町村
            on
                w_地震明細.code = g_市区町村.n03_007
            ORDER BY code
            """;
        var records = (quake.Length == 0)
            ? []
            : await con.QueryAsync<Query震度ポリゴン>(sql, new { quake });

        // FeatureCollectionとして返す
        return new JsonResult(new
        {
            type = "FeatureCollection",
            features = records.Select(r =>
            {
                int[] rgb = r.intensity switch
                {
                    "4" => [250, 230, 150],
                    "5-" => [250, 230, 0],
                    "5＋" => [255, 153, 0],
                    "6-" => [255, 40, 0],
                    "6＋" => [165, 0, 33],
                    "7" => [180, 0, 104],
                    _ => [0, 0, 0], // 5?(震度５弱以上未入電)や未定義値は黒色
                };
                return new Feature(r.wkb_geometry, new AttributesTable
                {
                    {"rgb", rgb}
                });
            })
        });
    }
    private class Query震度ポリゴン
    {
#pragma warning disable IDE1006 // 命名スタイル
        public string code { get; set; } = null!;
        public string intensity { get; set; } = null!;
        public Geometry wkb_geometry { get; set; } = null!;
#pragma warning restore IDE1006 // 命名スタイル
    }
}
