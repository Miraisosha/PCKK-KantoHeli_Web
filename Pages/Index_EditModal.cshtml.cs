using System.ComponentModel.DataAnnotations;
using System.Data.Common;
using DapperAid;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Src.Common;
using Src.Services;
using Src.Validation;
using Src.Validation.CustomValidators;
using ZLogger;

namespace Pages;

/// <summary>
/// 防災情報一覧・スレッド編集Modal
/// </summary>
///
public class Index_EditModalModel(ILogger<Index_EditModalModel> logger, DbConnection con, LoginService login, ProviderService provider) : PageModel
{
    #region --- DI ------------------------------------------------------------
    private readonly AppSettings _settings = provider.GetSettings();
    #endregion ----------------------------------------------------------------

    #region 画面入力内容 ------------------------------------------------------
    [BindProperty()]
    public ViewModel Input { get; set; } = new();
    public class ViewModel
    {
        public int? スレッドid { get; set; } // hidden
        [Accept("dt"), Required] public string? 災害発生日時 { get; set; }
        [Display(Name = "災害区分"), Required] public int? 災害区分id { get; set; }
        [MaxLength(50), Required] public string? スレッド名 { get; set; }
        [Display(Name = "特定初動調査")] public int? 特定初動調査区分id { get; set; }
        [Display(Name = "初動調査ルート")] public int? 初動調査ルートid { get; set; }
        public 調査状況Enum? 初動調査状況 { get; set; }
        public string? 調査ルート名 { get; set; }
        public string? 調査状況 { get; set; }
        [MaxLength(100)] public string? 備考 { get; set; }
        [Display(Name = "作成日時", Prompt = "登録完了時に設定"), Accept("dt")] public string? created_at { get; set; }
        [Display(Name = "最終更新日時", Prompt = "登録完了時に設定"), Accept("dt")] public string? updated_at { get; set; }
    }
    #endregion ----------------------------------------------------------------

    #region 画面表示内容 ------------------------------------------------------
    public bool Is新規 { get; set; }
    public IReadOnlyList<T_災害区分> 災害区分Records { get; set; } = [];
    public IReadOnlyList<T_特定初動調査区分> 特定初動調査区分Records { get; set; } = [];
    public IReadOnlyList<T_初動調査ルート> 初動調査ルートRecords { get; set; } = [];
    #endregion ----------------------------------------------------------------

    /// <summary>
    /// get : partial内容初期表示
    /// </summary>
    public async Task<IActionResult> OnGetAsync(int? id)
    {
        if (!login.Isログイン済)
        {
            return BadRequest("編集する権限がありません。");
        }
        Is新規 = id is null;

        var rec = Is新規
            ? new T_スレッド { 災害発生日時 = provider.GetNow() }
            : await con.SelectFirstOrDefaultAsync<T_スレッド>(r => r.スレッドid == id && r.deleted_at == null);
        if (rec is null)
        {
            logger.ZLogWarning($"編集対象データ不存在：{id}");
            return BadRequest("編集対象のデータが存在していません。");
        }

        // 画面表示できる形式にする
        var vf = new ValueFormatter();
        Input.スレッドid = Is新規 ? null : rec.スレッドid;
        vf.Set(rec.災害発生日時, () => Input.災害発生日時);
        vf.Set(rec.災害区分id, () => Input.災害区分id);
        vf.Set(rec.スレッド名, () => Input.スレッド名);
        vf.Set(rec.特定初動調査区分id, () => Input.特定初動調査区分id);
        vf.Set(rec.初動調査ルートid, () => Input.初動調査ルートid);
        vf.Set(rec.備考, () => Input.備考);
        if (!Is新規)
        {
            vf.Set(rec.初動調査状況, () => Input.初動調査状況);
            vf.Set(rec.調査ルート名, () => Input.調査ルート名);
            vf.Set(rec.調査状況, () => Input.調査状況);
            vf.Set(rec.created_at, () => Input.created_at);
            vf.Set(rec.updated_at, () => Input.updated_at);
        }

        // プルダウン選択肢も設定
        災害区分Records = await con.SelectAsync<T_災害区分>(r => r.deleted_at == null && r.表示順 != null, otherClauses: $"ORDER BY {nameof(T_災害区分.表示順)}");
        特定初動調査区分Records = await con.SelectAsync<T_特定初動調査区分>(r => r.deleted_at == null && r.表示順 != null, otherClauses: $"ORDER BY {nameof(T_特定初動調査区分.表示順)}");
        初動調査ルートRecords = await con.SelectAsync<T_初動調査ルート>(r => r.deleted_at == null && r.表示順 != null, otherClauses: $"ORDER BY {nameof(T_初動調査ルート.表示順)}");

        return Page();
    }

    /// <summary>
    /// ajax(post) : 表示内容登録
    /// </summary>
    /// <returns></returns>
    public async Task<IActionResult> OnPostAsync()
    {
        Is新規 = Input.スレッドid is null;

        var rec = Is新規
            ? new T_スレッド { 災害発生日時 = provider.GetNow() }
            : await con.SelectFirstOrDefaultAsync<T_スレッド>(r => r.スレッドid == Input.スレッドid && r.deleted_at == null);
        if (rec is null)
        {
            logger.ZLogWarning($"編集対象データ不存在：{Input.スレッドid}");
            return BadRequest("編集対象のデータが存在していません。");
        }

        // 入力値検証
        T_初動調査ルート? t初動調査ルートRec = null;

        //TODO 調査状況によっては災害区分や特定初動調査区分など変更不可にする可能性あり？

        var iv = provider.CreateValidator();
        iv.CurrentMemberNamePrefix = $"{nameof(Input)}.";
        rec.災害発生日時 = iv.Parse<DateTime>(() => Input.災害発生日時);
        rec.災害区分id = iv.ValidateNotNull(() => Input.災害区分id);
        rec.スレッド名 = iv.Parse<string>(() => Input.スレッド名);
        rec.特定初動調査区分id = iv.Validate(() => Input.特定初動調査区分id);
        rec.初動調査ルートid = await iv.ValidateAsync(() => Input.初動調査ルートid,
            // 特定初動調査区分指定有なら必須チェック＆コード値存在チェック
            additionalValidations: rec.特定初動調査区分id is null ? [] : [new RequiredAttribute()],
            customValidation: async (id) =>
            {
                t初動調査ルートRec = await con.SelectFirstOrDefaultAsync<T_初動調査ルート>(r => r.初動調査ルートid == id && r.deleted_at == null);
                if (t初動調査ルートRec is null)
                {
                    logger.ZLogWarning($"初動調査ルートid指定不正を検出：id={id}");
                    return "{0} の指定が正しくありません。";
                }
                return null;
            });
        rec.備考 = iv.Parse<string>(() => Input.備考);
        // エラー有ならエラーメッセージを返して終了
        if (iv.Errors.Count > 0)
        {
            return new JsonResult(iv.GetErrorJson());
        }

        // 初動調査ルートが変更になったと思われる場合は、調査ルート名を書き換え
        //TODO 条件は後で精査
        if (rec.初動調査状況 is null or 調査状況Enum.ルート作成中)
        {
            rec.調査ルート名 = t初動調査ルートRec?.初動調査ルート名;
        }

        // DBに登録
        if (Is新規)
        {
            await con.InsertAndRetrieveIdAsync(rec);
        }
        else
        {
            await con.UpdateAsync(rec);
        }

        return new JsonResult(new
        {
            title = "登録完了",
            success = Is新規 ? "スレッドを追加しました。" : "スレッドを修正しました。",
        });
    }

    /// <summary>
    /// ajax(post) : 削除
    /// </summary>
    /// <returns></returns>
    public async Task<IActionResult> OnPostDeleteAsync()
    {
        var rec = await con.SelectFirstOrDefaultAsync<T_スレッド>(r => r.スレッドid == Input.スレッドid && r.deleted_at == null);
        if (rec is null)
        {
            logger.ZLogWarning($"削除対象データ不存在：{Input.スレッドid}");
            return BadRequest("削除対象のデータが存在していません。");
        }

        // DB登録
        await con.UpdateAsync(
            () => new T_スレッド { deleted_at = provider.GetNow(), },
            r => r.スレッドid == Input.スレッドid);

        return new JsonResult(new
        {
            title = "削除完了",
            success = "スレッドを削除しました。",
        });
    }
}
