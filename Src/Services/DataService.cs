using System.Data.Common;
using DapperAid;
using NetTopologySuite.Features;
using Src.Common;

namespace Src.Services;

/// <summary>
/// 各種データ加工処理を提供します。
/// </summary>
public class DataService(ILogger<DataService> logger, DbConnection con, ProviderService provider)
{
    #region --- DI ------------------------------------------------------------
    private readonly AppSettings _settings = provider.GetSettings();
    #endregion ----------------------------------------------------------------

    /// <summary>
    /// (private) 調査箇所をFeatureCollectionに編集して返す
    /// </summary>
    /// <param name="records"></param>
    /// <returns></returns>
    public async Task<dynamic> ToFearureCollectionAsync(IEnumerable<T_調査箇所> records, string? fixedColor = null)
    {
        var t組織Records = await con.SelectAsync<T_組織>(r => r.表示順 != null && r.deleted_at == null,
                otherClauses: $"ORDER BY {nameof(T_組織.表示順)}");

        List<Feature> features = [];
        foreach (var rec in records)
        {
            var t組織Rec = t組織Records.FirstOrDefault(r => r.組織id == rec.組織id);
            var color = fixedColor ?? t組織Rec?.ピン表示色;
            features.Add(new Feature(rec.ジオメトリ, new AttributesTable
            {
                {"irai", rec.調査依頼id },
                {"id", rec.調査箇所id },
                {"name", rec.地点名 },
                {"requester", t組織Rec?.組織名 },
                {"priority", $"{rec.優先度}" },
                {"survey", $"{rec.調査手法}" },
                {"persons", rec.搭乗希望人数 },
                {"spottype", $"{rec.登録方法}" },
                {"remarks", rec.備考 },
                {"status", $"{rec.調査状況}" },
                {"updated", $"{rec.updated_at:yyyy.M.d HH:mm}" },
                {"color", color},
            }));
        }

        // FeatureCollection相当のオブジェクトを返す
        return new
        {
            type = "FeatureCollection",
            crs = new { type = "name", properties = new { name = "urn:ogc:def:crs:OGC:1.3:CRS84" } },
            features,
        };
    }
}
