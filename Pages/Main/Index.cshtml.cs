using System.ComponentModel.DataAnnotations;
using System.Data.Common;
using System.Text.Json;
using DapperAid;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using Src.Common;
using Src.Services;
using Src.Validation.CustomValidators;
using ZLogger;

namespace Pages.Main;

/// <summary>
/// メイン画面
/// </summary>
public class IndexModel(ILogger<IndexModel> logger, DbConnection con, LoginService login, ProviderService provider, DataService dataService) : PageModel
{
    #region --- DI ------------------------------------------------------------
    private readonly AppSettings _settings = provider.GetSettings();
    #endregion ----------------------------------------------------------------


    // タブ名(タブ選択ボタンのvalue=タブ内容表示領域divのid)
    public const string TabName調査依頼 = "tab調査依頼";
    public const string TabName依頼状況 = "tab依頼状況";
    public const string TabName特定初動調査 = "tab特定初動調査";
    public const string TabNameルート作成 = "tabルート作成";

    #region 画面表示内容 ------------------------------------------------------
    public T_スレッド スレッドRec { get; set; } = null!;

    public IReadOnlyList<T_組織> 組織Records { get; set; } = [];
    public T_ユーザー? ユーザーRec { get; set; }
    public T_組織? 所属組織Rec { get; set; }

    public IReadOnlyList<T_調査依頼> 調査依頼Records { get; set; } = [];
    //public IReadOnlyList<T_調査予定> 調査予定Records { get; set; } = [];

    // 以下、特定初動調査で参照するテーブル
    public T_特定初動調査区分? 特定初動調査区分Rec { get; set; }
    public IReadOnlyList<T_初動調査ルート> 初動調査ルートRecords { get; set; } = [];

    // 以下、調査ルート作成で参照するテーブル
    public IReadOnlyList<T_起点終点> 起点終点Records { get; set; } = [];

    // 初期表示タブ
    public string BottomTab { get; set; } = string.Empty;
    #endregion ----------------------------------------------------------------

    /// <summary>
    /// get : 画面初期表示
    /// </summary>
    /// <param name="thread">スレッドID</param>
    /// <param name="partial">防災ヘリ関連情報のみpartialで返す場合true</param>
    /// <returns></returns>
    public async Task<IActionResult> OnGetAsync([FromRoute] int thread, [FromQuery] bool partial = false, string tab = "")
    {
        var rec = await con.SelectFirstOrDefaultAsync<T_スレッド>(r => r.スレッドid == thread && r.deleted_at == null);
        if (rec is null)
        {
            logger.ZLogWarning($"編集対象データ不存在：{thread}");
            return BadRequest("指定されたスレッドがありません。");
        }
        スレッドRec = rec;

        // ログイン情報を取得
        組織Records = await con.SelectAsync<T_組織>(r => r.表示順 != null && r.deleted_at == null,
            otherClauses: $"ORDER BY {nameof(T_組織.表示順)}");
        ユーザーRec = login.Isログイン済 ? await login.Getユーザー情報Async() : null;
        所属組織Rec = 組織Records.FirstOrDefault(r => r.組織id == ユーザーRec?.組織id);

        // 表示対象データを取得（当該スレッドのもの全件。表示時に振り分けフィルタする）
        調査依頼Records = await con.SelectAsync<T_調査依頼>(r => r.スレッドid == thread && r.deleted_at == null,
            otherClauses: $"ORDER BY {nameof(T_調査依頼.updated_at)} DESC");
        // 調査予定Records = await con.SelectAsync<T_調査予定>(r => r.スレッドid == thread && r.deleted_at == null,
        //     otherClauses: $"ORDER BY {nameof(T_調査予定.updated_at)} DESC");

        // 必要に応じ、特定初動調査タブ/調査ルート作成タブ用の情報も取得
        if (所属組織Rec?.isルート作成可 == true && スレッドRec.特定初動調査区分id is not null)
        {
            特定初動調査区分Rec = await con.SelectFirstOrDefaultAsync<T_特定初動調査区分>(r => r.特定初動調査区分id == スレッドRec.特定初動調査区分id && r.deleted_at == null);
            初動調査ルートRecords = await con.SelectAsync<T_初動調査ルート>(r => r.特定初動調査区分id == スレッドRec.特定初動調査区分id && r.deleted_at == null,
                otherClauses: $"ORDER BY {nameof(T_初動調査ルート.表示順)}");
        }
        if (所属組織Rec?.isルート作成可 == true)
        {
            起点終点Records = await con.SelectAsync<T_起点終点>(r => r.deleted_at == null, otherClauses: $"ORDER BY {nameof(T_起点終点.表示順)}");
        }

        // 選択タブについては一応ログイン済＆ルート作成権限があることをチェックの上で設定
        BottomTab = tab switch
        {
            TabName調査依頼 or TabName依頼状況 when ユーザーRec is not null => tab,
            TabName特定初動調査 or TabNameルート作成 when 所属組織Rec?.isルート作成可 == true => tab,
            _ => "",
        };

        return partial ? Partial("Index_SurveysPartial", this) : Page();
    }

    /// <summary>
    /// event-stream(get) : リアルタイム情報
    /// </summary>
    /// <returns>text/event-stream(リアルタイム情報が更新されたときにdataを送出)</returns>
    public async Task<IActionResult> OnGetRealTimeInfoStreamAsync()
    {
        // ContentTypeをSSE用に設定
        Response.ContentType = "text/event-stream";
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no"); // 必要に応じてバッファ無効化（NGINXなど使用時）

        // 明示的にHTTPレスポンスを非同期で継続送信するため、HTTPレスポンスを閉じないようにする
        // （Action本体終了時にも接続が維持されるようにするためにTaskで無限ループを実行）
        // 実運用ではキャンセルトークンなどで安全に終了可能とすることを推奨
        Response.StatusCode = 200;

        // ※リアルタイム情報の送出内容が変化したときに送信（リクエスト初回は必ず送信される）
        string? prevJsonText = null;

        while (!HttpContext.RequestAborted.IsCancellationRequested && !AppSettings.IsApplicationStopping)
        {
            var from = provider.GetNow().AddMinutes(-_settings.リアルタイム情報有効時間_分);
            var earthquaks = await con.SelectAsync<T_地震サマリ>(
                r => r.deleted_at == null && r.updated_at > from,
                otherClauses: $"ORDER BY {nameof(T_地震サマリ.updated_at)} DESC");

            var jsonData = new
            {
                earthquaks = earthquaks.Select(rec => new
                {
                    id = rec.地震id,
                    text = $"{rec.地震発生日時:yyyy/M/d HH:mm}（最大震度{rec.最大震度 switch
                    {
                        "5-" => "5弱",
                        "5+" or "5＋" => "5強",
                        "6-" => "6弱",
                        "6+" or "6＋" => "6強",
                        "5?" or "震度５弱以上未入電" or "震度5弱以上未入電" => "不明",
                        _ => rec.最大震度
                    }}）"
                }).ToArray(),
            };
            var jsonText = JsonSerializer.Serialize(jsonData);
            if (prevJsonText != jsonText)
            {
                await Response.WriteAsync($"data: {jsonText}\n\n");
                await Response.Body.FlushAsync();
                prevJsonText = jsonText;
            }
            // 指定秒数sleep相当
            for (int i = 0; i < _settings.リアルタイム情報更新間隔_秒 && !AppSettings.IsApplicationStopping; i++)
            {
                await Task.Delay(1000, HttpContext.RequestAborted);
            }
        }
        return new EmptyResult();
    }

    /// <summary>
    /// ajax(get): 表示対象featureを返す
    /// </summary>
    /// <param name="irai">調査依頼idの一覧</param>
    /// <param name="yotei">調査予定idの一覧</param>
    /// <returns></returns>
    public async Task<IActionResult> OnGetFeaturesAsync(
        int[]? irai = null, int[]? yotei = null)
    {
        // プロットすべき調査箇所を取得
        IReadOnlyList<T_調査箇所> t調査箇所Records = [];
        if (irai is not null || yotei is not null)
        {
            t調査箇所Records = await con.SelectAsync<T_調査箇所>(
                r => (irai != null && r.調査依頼id == SqlExpr.In(irai)
                        || yotei != null && r.調査予定id == SqlExpr.In<int>(yotei))
                    && r.deleted_at == null,
                otherClauses: $"ORDER BY {nameof(T_調査箇所.調査箇所id)}");
        }

        // 調査予定ルートがあればFeatureとして取得
        List<Feature> routes = [];
        // if (yotei is not null)
        // {
        //     var t調査予定Records = await con.SelectAsync<T_調査予定>(
        //         r => r.調査予定id == SqlExpr.In(yotei) && r.deleted_at == null,
        //         otherClauses: $"ORDER BY {nameof(T_調査予定.調査予定id)}");
        //     var tルートRecords = await con.SelectAsync<T_調査予定ルート>(
        //         r => r.調査予定id == SqlExpr.In(yotei),
        //         otherClauses: $"ORDER BY {nameof(T_調査予定ルート.調査予定id)},{nameof(T_調査予定ルート.連番)}");

        //     // まず調査ルートの線を格納
        //     foreach (var rec in t調査予定Records)
        //     {
        //         var line = rec.手動描画調査ルート ?? Get調査ルートLineString([.. tルートRecords.Where(r => r.調査予定id == rec.調査予定id)]);
        //         routes.Add(new Feature(line, new AttributesTable { }));
        //     }
        //     // 続いて、手動描画でなければ調査地点を格納
        //     foreach (var rec in t調査予定Records.Where(r => r.手動描画調査ルート is null))
        //     {
        //         var records = tルートRecords.Where(r => r.調査予定id == rec.調査予定id).ToArray();
        //         routes.AddRange(Get調査ルートPoints(records));
        //     }
        // }

        // Jsonでまとめて返す
        return new JsonResult(new
        {
            spots = await dataService.ToFearureCollectionAsync(t調査箇所Records),
            routes = new
            {
                type = "FeatureCollection",
                crs = new { type = "name", properties = new { name = "urn:ogc:def:crs:OGC:1.3:CRS84" } },
                features = routes,
            },
        });
    }

    /// <summary>
    /// ajax(get): 引数で指定された調査依頼データを返す
    /// </summary>
    /// <param name="id">調査依頼id</param>
    /// <param name="status">一時保存の調査依頼のみ取得対象とする場合0、（特定のステータスの調査箇所のみ取得対象とする場合の処理を今後追加する可能性あり）</param>
    /// <returns></returns>
    public async Task<IActionResult> OnGetSurveyRequestAsync(int id, 調査ステータスEnum? status = null)
    {
        if (!login.Isログイン済)
        {
            return BadRequest("ログインが無効です。調査依頼を編集できません。");
        }
        var userRec = await login.Getユーザー情報Async();

        // 編集対象一時保存データの存在チェック
        var rec = await con.SelectFirstOrDefaultAsync<T_調査依頼>(r => r.調査依頼id == id && r.deleted_at == null);
        if (rec is null)
        {
            return new JsonResult(new { error = "データは既に削除済です。編集できません。" });
        }
        else if (status == 調査ステータスEnum.一時保存 && rec.ステータス != 調査ステータスEnum.一時保存)
        {
            return new JsonResult(new { error = "一時保存データは既に調査依頼済です。編集できません。" });
        }
        else if (rec.組織id != userRec.組織id)
        {
            //TODO 管理者に全組織のデータ削除権限を与える場合はこのチェックをバイパスさせること
            logger.ZLogWarning($"調査依頼の組織コード相違を検出：調査依頼id={id},組織id={rec.組織id}、ログインユーザ={userRec.ユーザーid}");
            return new JsonResult(new { error = "データを編集する権限がありません。" });
        }

        var records = await con.SelectAsync<T_調査箇所>(
            r => r.調査依頼id == id && (status == null || r.調査状況 == status) && r.deleted_at == null,
            otherClauses: $"ORDER BY {nameof(T_調査箇所.調査箇所id)}");

        return new JsonResult(new
        {
            success = new
            {
                title = rec.調査依頼名,
                features = await dataService.ToFearureCollectionAsync(records, "#FF0000"),
            }
        });
    }

    #region 特定初動調査タブ --------------------------------------------------
    /// <summary>
    /// ajax(get): 初動調査ルートを返す
    /// </summary>
    /// <param name="route">初動調査ルートid</param>
    /// <param name="yotei">調査予定idの一覧</param>
    /// <returns></returns>
    public async Task<IActionResult> OnGetInitialRouteAsync(int route)
    {
        var rec初動調査ルート = await con.SelectFirstOrDefaultAsync<T_初動調査ルート>(r => r.初動調査ルートid == route && r.deleted_at == null);
        if (rec初動調査ルート is null)
        {
            logger.ZLogWarning($"不明な初動調査ルートを指定：id={route}");
            return BadRequest("指定された初動調査ルートの情報は表示できません。");
        }

        int[] ids起点終点 = [rec初動調査ルート.起点id, rec初動調査ルート.終点id];
        var t起点終点Records = await con.SelectAsync<T_起点終点>(r => r.起点終点id == SqlExpr.In(ids起点終点) && r.deleted_at == null);
        var t調査地点Records = await con.SelectAsync<T_初動調査地点>(r => r.初動調査ルートid == route && r.deleted_at == null,
            otherClauses: $"ORDER BY {nameof(T_初動調査地点.連番)}");

        List<Feature> features = [];
        features.Add(new Feature(rec初動調査ルート.ジオメトリ, null));
        foreach (var rec in t調査地点Records)
        {
            features.Add(new Feature(new Point(rec.経度, rec.緯度), new AttributesTable {
                { "text", $"{rec.連番}" },
                { "name", $"{rec.初動調査地点名}" },
                { "requester", "道路班" },
                { "priority", "高" },
                { "survey", "通過" },
                { "persons", 0 },
                { "spottype", "点" },
                { "remarks", $"{rec.備考}" },
                { "spotColor", "#FF0000" },
            }));
        }
        if (t起点終点Records.FirstOrDefault(r => r.起点終点id == rec初動調査ルート.起点id) is T_起点終点 rec終点)
        {
            features.Add(new Feature(new Point(rec終点.経度, rec終点.緯度), new AttributesTable {
                { "text", "終" },
                { "name", $"{rec終点.起点終点名}" },
            }));
        }
        if (t起点終点Records.FirstOrDefault(r => r.起点終点id == rec初動調査ルート.起点id) is T_起点終点 rec起点)
        {
            features.Add(new Feature(new Point(rec起点.経度, rec起点.緯度), new AttributesTable {
                { "text", "始" },
                { "name", $"{rec起点.起点終点名}" },
            }));
        }

        // Jsonで返す
        return new JsonResult(new
        {
            routes = new
            {
                type = "FeatureCollection",
                crs = new { type = "name", properties = new { name = "urn:ogc:def:crs:OGC:1.3:CRS84" } },
                features,
            },
        });
    }
    #endregion ----------------------------------------------------------------

    #region 調査依頼タブ ------------------------------------------------------
    public class Input調査依頼
    {
#pragma warning disable IDE1006 // 命名スタイル

        // 以下、一覧入力項目（非表示のジオメトリ情報含む）
        [MaxLength(50), Required, Display(Name = "地点名")]
        public string?[] name { get; set; } = [];

        [Required, Display(Name = "優先度")]
        public string?[] priority { get; set; } = [];

        [Required, Display(Name = "調査手法")]
        public string?[] survey { get; set; } = [];

        [Required, Range(0, 8), Display(Name = "搭乗希望")] // 0は搭乗希望なし
        public string?[] persons { get; set; } = [];

        public string?[] spottype { get; set; } = []; // 登録方法
        public string?[] geometry { get; set; } = [];

        [MaxLength(100), Display(Name = "備考")]
        public string?[] remarks { get; set; } = [];

        // 以下、名称入力項目
        [MaxLength(50), Required, Display(Name = "調査依頼名")]
        public string? title { get; set; }
#pragma warning restore IDE1006 // 命名スタイル
    }

    /// <summary>
    /// ajax(post): 調査依頼登録
    /// </summary>
    /// <param name="mode">check=一覧入力内容チェックのみ、register=正式登録、tempsave=一時保存</param>
    /// <param name="tempid">一時保存済データに関する更新の場合、一時保存時の調査依頼id</param>
    /// <param name="input">入力内容</param>
    /// <returns></returns>
    public async Task<IActionResult> OnPostSurveyRequestAsync([FromRoute] int thread, [FromForm] string mode, [FromForm] int? tempid, [FromForm] Input調査依頼 input)
    {
        if (!login.Isログイン済)
        {
            return BadRequest("ログインが無効です。調査依頼を保存できません。");
        }
        var userRec = await login.Getユーザー情報Async();

        // ---------------------------------------------
        // 入力値取得検証
        // ---------------------------------------------
        調査ステータスEnum? status = mode switch
        {
            "tempsave" => 調査ステータスEnum.一時保存,
            "register" => 調査ステータスEnum.依頼中,
            "check" => (調査ステータスEnum)(-1),
            _ => null,
        };
        if (status is null)
        {   // 通常このエラーになることはあり得ないがおかしなデータがDB投入されないようガードをかけておく
            logger.ZLogError($"モード指定不正 mode={mode}");
            return BadRequest("システムエラー（動作モード不正）が発生しました。登録できません。");
        }

        var iv = provider.CreateValidator();
        iv.CurrentMemberNamePrefix = "input.";
        var geojsonReader = new GeoJsonReader();
        List<T_調査箇所> records = [];
        for (int i = 0; i < input.name.Length; i++)
        {
            iv.CurrentDisplayNamePrefix = $"{i + 1}行目の";
            var rec = new T_調査箇所
            {
                地点名 = iv.Parse<string>(() => input.name[i]),
                優先度 = iv.Parse<調査優先度Enum>(() => input.priority[i],
                    additionalValidations: [new MemberNameAttribute { OverwriteName = "prioritygroup", Index = i }]),
                調査手法 = iv.Parse<調査手法Enum>(() => input.survey[i]),
                搭乗希望人数 = iv.Parse<int>(() => input.persons[i]),
                登録方法 = iv.Parse<調査箇所登録方法Enum>(() => input.spottype[i]),
                ジオメトリ = geojsonReader.Read<Geometry>(input.geometry[i]),
                備考 = iv.ParseOrNull<string>(() => input.remarks[i]),

                組織id = userRec.組織id,
                調査状況 = status.Value,
            };
            rec.ジオメトリ.SRID = 4326;
            records.Add(rec);
        }
        if (input.name.Length == 0)
        {
            iv.AddError("調査依頼地点を１つ以上指定してください。");
        }

        if (iv.Errors.Count > 0)
        {   // 明細入力項目エラー有、エラーを返す
            return new JsonResult(iv.GetErrorJson());
        }
        else if (mode == "check")
        {   // 一覧チェックのみ、OKを返す
            return new JsonResult(new { success = true });
        }

        // DB登録時、名称入力チェック
        iv.CurrentDisplayNamePrefix = "";
        var t依頼Rec = new T_調査依頼
        {
            スレッドid = thread,
            調査依頼名 = iv.Parse<string>(() => input.title),

            組織id = userRec.組織id,
            ステータス = status.Value,
        };
        if (iv.Errors.Count == 0)
        {
            var dupe = await con.SelectFirstOrDefaultAsync<T_調査依頼>(
                r => r.調査依頼名 == t依頼Rec.調査依頼名 && t依頼Rec.ステータス >= 調査ステータスEnum.依頼中 && r.deleted_at == null);
            if (dupe is not null)
            {
                iv.AddError("input.title", "同じ調査依頼名が既に存在します。調査依頼名を変更してください。");
            }
        }
        if (iv.Errors.Count > 0)
        {   // 調査依頼サマリの入力エラー有
            return new JsonResult(iv.GetErrorJson());
        }

        //TODO 一時保存の場合、同名の一時保存依頼の存在チェック(warning扱い)

        // ---------------------------------------------
        // DB更新
        // ---------------------------------------------
        con.Open();
        using var tran = await con.BeginTransactionAsync();
        if (tempid is not null)
        {
            // 一時保存データに対する更新の場合、更新元一時保存データの存在チェック
            var oldRec = await tran.SelectFirstOrDefaultAsync<T_調査依頼>(r => r.調査依頼id == tempid && r.deleted_at == null,
                otherClauses: "FOR UPDATE");
            if (oldRec is null)
            {
                return new JsonResult(new { error = "編集した一時保存データは他ユーザが既に操作済です。更新できません。" });
            }
            else if (oldRec.ステータス != 調査ステータスEnum.一時保存)
            {
                logger.ZLogWarning($"一次保存調査依頼のステータス不正を検出：調査依頼id={tempid},ステータス={oldRec.ステータス}");
                return new JsonResult(new { error = "編集した一時保存データは他ユーザが既に更新済です。更新できません。" });
            }
            // 更新元一時保存データを削除
            await tran.UpdateAsync(() => new T_調査依頼 { deleted_at = SqlExpr.Eval<DateTime>("CURRENT_TIMESTAMP") },
                r => r.調査依頼id == tempid);
            await tran.UpdateAsync(() => new T_調査箇所 { deleted_at = SqlExpr.Eval<DateTime>("CURRENT_TIMESTAMP") },
                r => r.調査依頼id == tempid);
        }
        await tran.InsertAndRetrieveIdAsync(t依頼Rec);
        foreach (var rec in records)
        {
            rec.調査依頼id = t依頼Rec.調査依頼id;
        }
        await tran.InsertRowsAsync(records);
        await tran.CommitAsync();

        return new JsonResult(new
        {
            success = status switch
            {
                調査ステータスEnum.一時保存 => "一時保存が完了しました。",
                _ => "調査依頼が完了しました。",
            }
        });
    }

    /// <summary>
    /// ajax(post): 一時保存調査依頼の削除
    /// </summary>
    /// <param name="tempid">一時保存時の調査依頼id</param>
    /// <returns></returns>
    public async Task<IActionResult> OnPostDeleteSurveyRequestAsync([FromForm] int tempid)
    {
        if (!login.Isログイン済)
        {
            return BadRequest("ログインが無効です。調査依頼を削除できません。");
        }
        var userRec = await login.Getユーザー情報Async();

        con.Open();
        using var tran = await con.BeginTransactionAsync();
        // 削除対象一時保存データの存在チェック
        var oldRec = await tran.SelectFirstOrDefaultAsync<T_調査依頼>(r => r.調査依頼id == tempid && r.deleted_at == null,
            otherClauses: "FOR UPDATE");
        if (oldRec is null)
        {
            return new JsonResult(new { error = "編集した一時保存データは他ユーザが既に操作済です。更新できません。" });
        }
        else if (oldRec.ステータス != 調査ステータスEnum.一時保存)
        {
            logger.ZLogWarning($"一次保存調査依頼のステータス不正を検出：調査依頼id={tempid},ステータス={oldRec.ステータス}");
            return new JsonResult(new { error = "編集した一時保存データは他ユーザが既に更新済です。更新できません。" });
        }
        else if (oldRec.組織id != userRec.組織id)
        {
            //TODO 管理者に全組織のデータ削除権限を与える場合はこのチェックをバイパスさせること
            logger.ZLogWarning($"一次保存調査依頼の組織コード相違を検出：調査依頼id={tempid},組織id={oldRec.組織id}、ログインユーザ={userRec.ユーザーid}");
            return new JsonResult(new { error = "一時保存データを削除する権限がありません。" });
        }
        // 削除対象一時保存データを削除
        await tran.UpdateAsync(() => new T_調査依頼 { deleted_at = SqlExpr.Eval<DateTime>("CURRENT_TIMESTAMP") },
            r => r.調査依頼id == tempid);
        await tran.UpdateAsync(() => new T_調査箇所 { deleted_at = SqlExpr.Eval<DateTime>("CURRENT_TIMESTAMP") },
            r => r.調査依頼id == tempid);
        await tran.CommitAsync();

        return new JsonResult(new { success = "削除しました。" });
    }
    #endregion ----------------------------------------------------------------
}
