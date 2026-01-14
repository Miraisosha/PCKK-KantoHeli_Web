using System.Data.Common;
using DapperAid;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Src.Common;
using Src.Services;

namespace Pages;

/// <summary>
/// 防災情報一覧画面
/// </summary>
public class IndexModel(ILogger<IndexModel> logger, DbConnection con, LoginService login, ProviderService provider) : PageModel
{
    #region --- DI ------------------------------------------------------------
    private readonly AppSettings _settings = provider.GetSettings();
    #endregion ----------------------------------------------------------------


    #region 画面入力内容 ------------------------------------------------------
    [BindProperty(SupportsGet = true)]
    public int Year { get; set; }
    [BindProperty(SupportsGet = true)]
    public int? Disaster { get; set; }
    #endregion ----------------------------------------------------------------


    #region 画面表示内容 ------------------------------------------------------
    public int 年度Min { get; set; }
    public int 年度Max { get; set; }
    public IReadOnlyList<T_災害区分> 災害区分Records { get; set; } = [];
    public IReadOnlyList<T_スレッド> スレッドRecords { get; set; } = [];
    #endregion ----------------------------------------------------------------

    public async Task OnGetAsync()
    {
        年度Min = 2020; //TODO 後日設定ファイル化の可能性あり？
        年度Max = provider.GetToday().AddMonths(-3).Year; // 今年度を最大値とする
        if (Year < 年度Min || Year > 年度Max)
        {
            Year = 年度Max; // 年度指定値が無効なら今年度を選択値
        }

        災害区分Records = await con.SelectAsync<T_災害区分>(r => r.deleted_at == null, otherClauses: $"ORDER BY {nameof(T_災害区分.表示順)}");
        if (Disaster is not null && 災害区分Records.Count(r => r.災害区分id == Disaster) == 0)
        {
            Disaster = null; // 災害区分指定値が無効ならクリア
        }

        var dtFrom = new DateTime(Year, 4, 1);
        var dtTo = dtFrom.AddYears(1);

        スレッドRecords = await con.SelectAsync<T_スレッド>(
            r => r.deleted_at == null && r.災害発生日時 >= dtFrom && r.災害発生日時 < dtTo
                && (Disaster == null || r.災害区分id == Disaster),
            otherClauses: $"ORDER BY {nameof(T_スレッド.災害発生日時)} DESC, {nameof(T_スレッド.スレッドid)} DESC");
    }
}
