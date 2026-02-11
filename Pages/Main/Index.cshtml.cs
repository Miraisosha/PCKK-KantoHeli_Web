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
using GeoCoordinatePortable;
using Google.OrTools.ConstraintSolver;

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


    public IReadOnlyList<T_調査依頼> 一時保存調査箇所Records { get; set; } = [];
    public IReadOnlyList<T_調査予定> 一時保存調査予定Records { get; set; } = [];

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

    /// <summary>
    /// (private) 調査箇所をFeatureCollectionに編集して返す
    /// </summary>
    /// <param name="records"></param>
    /// <returns></returns>
    private async Task<dynamic> ToFearureCollectionAsync(IEnumerable<T_調査箇所> records)
    {
        var t組織Records = await con.SelectAsync<T_組織>(r => r.表示順 != null && r.deleted_at == null,
                otherClauses: $"ORDER BY {nameof(T_組織.表示順)}");

        List<Feature> features = [];
        foreach (var rec in records)
        {
            var color = t組織Records.FirstOrDefault(r => r.組織id == rec.組織id)?.ピン表示色;
            features.Add(new Feature(rec.ジオメトリ, new AttributesTable
            {
                {"irai", rec.調査依頼id },
                {"id", rec.調査箇所id },
                {"name", rec.地点名 },
                {"priority", $"{rec.優先度}" },
                {"persons", rec.搭乗希望人数 },
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

    /// <summary>
    /// (private) 引数で指定されたidの調査依頼について、ステータスを調査箇所の最新状態に基づき更新します。
    /// </summary>
    /// <param name="tran">DBトランザクション</param>
    /// <param name="arg調査依頼ids">更新対象の調査依頼</param>
    /// <returns></returns>
    /// <exception cref="ArgumentException"></exception>
    private async Task Update調査依頼Status(DbTransaction tran, params int[] arg調査依頼ids)
    {
        var records依頼 = await tran.SelectAsync<T_調査依頼>(r => r.調査依頼id == SqlExpr.In(arg調査依頼ids), otherClauses: $"FOR UPDATE");
        foreach (var id in arg調査依頼ids)
        {
            var t調査箇所Records = await tran.SelectAsync<T_調査箇所>(r => r.調査依頼id == id && r.deleted_at == null);
            var t依頼Rec = records依頼.FirstOrDefault(r => r.調査依頼id == id && (t調査箇所Records.Count == 0 || r.deleted_at == null));
            if (t依頼Rec is null)
            {
                logger.ZLogError($"調査依頼レコード更新失敗(データ不存在)：調査依頼id={id}");
                throw new ArgumentException($"想定外の調査依頼データ不存在：調査依頼id={id}");
            }
            if (t調査箇所Records.Count == 0)
            {   // 紐づいている調査箇所レコードがなくなった：調査依頼も削除状態にする
                if (t依頼Rec.deleted_at == null)
                {
                    await tran.UpdateAsync(
                        () => new T_調査依頼 { deleted_at = SqlExpr.Eval<DateTime>("CURRENT_TIMESTAMP"), },
                        r => r.調査依頼id == id);
                }
            }
            else
            {
                // 更新日時ないしステータスが更新されている：調査依頼も更新する
                var latestUpdatedAt = t調査箇所Records.Max(r => r.updated_at);
                var latestStatus = t調査箇所Records.Min(r => r.調査状況);
                if (latestUpdatedAt > t依頼Rec.updated_at || latestStatus != t依頼Rec.ステータス)
                {
                    await tran.UpdateAsync(
                        () => new T_調査依頼 { ステータス = latestStatus, updated_at = SqlExpr.Eval<DateTime>("CURRENT_TIMESTAMP"), },
                        r => r.調査依頼id == id);
                }
            }
        }
    }

    /// <summary>
    /// 
    /// </summary>
    /// <param name="id"></param>
    /// <param name="status"></param>
    /// <returns></returns>
    public async Task<IActionResult> OnGetUpdateStatusAsync(int id, 調査ステータスEnum? status = null)
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

//        var records = await con.SelectAsync<T_調査箇所>(
//            r => r.調査依頼id == id && (status == null || r.調査状況 == status) && r.deleted_at == null,
//            otherClauses: $"ORDER BY {nameof(T_調査箇所.調査箇所id)}");

        return new JsonResult(new
        {
            success = new
            {
                title = rec.調査依頼名,
//                features = await dataService.ToFearureCollectionAsync(records, "#FF0000"),
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

    #region 依頼状況タブ ------------------------------------------------------------------------
    /// <summary>
    /// ajax(post): 調査箇所の削除（依頼取消）
    /// </summary>
    /// <param name="id">削除対象の調査箇所id（複数可）</param>
    /// <returns></returns>
    public async Task<IActionResult> OnPostDeleteSpotAsync([FromForm] int[] id)
    {
        if (!login.Isログイン済)
        {
            return BadRequest("ログインが無効です。調査箇所を削除できません。");
        }
        var userRec = await login.Getユーザー情報Async();

        if (id == null || id.Length == 0)
        {
            return new JsonResult(new { error = "削除対象が指定されていません。" });
        }

        con.Open();
        using var tran = await con.BeginTransactionAsync();
        // 対象レコードをロックして取得
        var targets = await tran.SelectAsync<T_調査箇所>(r => r.調査箇所id == SqlExpr.In(id), otherClauses: "FOR UPDATE");
        if (targets.Count == 0)
        {
            return new JsonResult(new { error = "指定された調査箇所は存在しないか既に削除されています。" });
        }

        // 権限チェック：自部署のみ削除可能（必要なら管理者判定を追加）
        foreach (var rec in targets)
        {
            if (rec.組織id != userRec.組織id)
            {
                logger.ZLogWarning($"調査箇所削除権限違反: 調査箇所id={rec.調査箇所id}, 組織id={rec.組織id}, ユーザ={userRec.ユーザーid}");
                return new JsonResult(new { error = "選択したデータを削除する権限がありません。" });
            }
        }

        // 論理削除
        var idsToDelete = targets.Select(r => r.調査箇所id).ToArray();
        await tran.UpdateAsync(() => new T_調査箇所 { deleted_at = SqlExpr.Eval<DateTime>("CURRENT_TIMESTAMP") },
            r => r.調査箇所id == SqlExpr.In(idsToDelete));

        // 親の調査依頼ステータスを更新
        var parentIraiIds = targets.Select(r => r.調査依頼id).Where(v => v != 0).Distinct().ToArray();
        if (parentIraiIds.Length > 0)
        {
            await Update調査依頼Status(tran, parentIraiIds);
        }

        await tran.CommitAsync();

        return new JsonResult(new { success = "削除しました。" });
    }
    #endregion ----------------------------------------------------------------

    #region 調査ルートタブ ------------------------------------------------------------------------
    /// <summary>
    /// ajax(get): 調査ルート作成用の情報を返す
    /// </summary>
    /// <param name="tempid">一時保存状態を復元する場合、一時保存された調査予定id</param>
    /// <returns></returns>
    public async Task<IActionResult> OnGetPlanAsync(int? tempid)
    {
        if (!login.Isログイン済)
        {
            return BadRequest("ログインが無効です。調査依頼を編集できません。");
        }
        var userRec = await login.Getユーザー情報Async();

        // 選択可能な調査箇所を全取得する
        var records = await con.SelectAsync<T_調査箇所>(r => r.調査状況 == 調査ステータスEnum.依頼中 && r.deleted_at == null,
            otherClauses: $"ORDER BY {nameof(T_調査箇所.調査箇所id)}");

        // 一時保存の呼び出しの場合、調査予定データを把握
        T_調査予定? t調査予定Rec = null;
        T_調査予定ルート? t始点Rec = null;
        T_調査予定ルート? t終点Rec = null;
        int[] id = [];
        if (tempid is not null)
        {
            // 編集対象一時保存データの取得＆状態チェック
            t調査予定Rec = await con.SelectFirstOrDefaultAsync<T_調査予定>(r => r.調査予定id == tempid && r.deleted_at == null);
            if (t調査予定Rec is null)
            {
                return new JsonResult(new { error = "一時保存データは既に削除済です。編集できません。" });
            }
            else if (t調査予定Rec.ステータス != 調査ステータスEnum.一時保存)
            {
                return new JsonResult(new { error = "一時保存データは既に調査依頼済です。編集できません。" });
            }
            //
            var tルートRecords = await con.SelectAsync<T_調査予定ルート>(r => r.調査予定id == tempid,
                otherClauses: $"ORDER BY {nameof(T_調査予定ルート.連番)}");
            t始点Rec = tルートRecords.FirstOrDefault(r => r.調査箇所id == null && r.連番 == 0);
            t終点Rec = tルートRecords.FirstOrDefault(r => r.調査箇所id == null && r.連番 > 0);
            id = [.. tルートRecords.Select(r => r.調査箇所id).OfType<int>()];
        }

        return new JsonResult(new
        {
            success = new
            {
                // 選択可能な調査箇所
                features = await ToFearureCollectionAsync(records),
                // 画面入力項目
                startid = t調査予定Rec?.起点id,
                endid = t調査予定Rec?.終点id,
                auto = t調査予定Rec?.is自動作成ルート ?? false,
                title = t調査予定Rec?.調査予定名,
                startx = t始点Rec?.ジオメトリ.Coordinate.X,
                starty = t始点Rec?.ジオメトリ.Coordinate.Y,
                endx = t終点Rec?.ジオメトリ.Coordinate.X,
                endy = t終点Rec?.ジオメトリ.Coordinate.Y,
                drawroute = t調査予定Rec?.手動描画調査ルート,
                // 選択状態の調査箇所
                id,
            }
        });
    }




    public class Input調査予定
    {
#pragma warning disable IDE1006 // 命名スタイル

        // 以下、選択項目(ルート描画に直接かかわらない項目)
        [Display(Name = "始点")]
        public int startid { get; set; }

        [Display(Name = "終点")]
        public int endid { get; set; }

        [Display(Name = "ルート自動作成")]
        public bool auto { get; set; }

        // 以下、入力/選択項目
        [MaxLength(50), Required, Display(Name = "調査ルート名")]
        public string? title { get; set; }
#pragma warning restore IDE1006 // 命名スタイル
    }

    /// <summary>
    /// ajax(post): 調査予定距離等算出／調査予定登録
    /// </summary>
    /// <param name="mode">モード</param>
    /// <param name="input">入力内容</param>
    /// <param name="startx">始点の経度</param>
    /// <param name="starty">始点の緯度</param>
    /// <param name="endx">終点の経度</param>
    /// <param name="endy">終点の緯度</param>
    /// <param name="id">調査箇所idの一覧(調査ルート順)</param>
    /// <param name="drawroute">調査ルートを手動描画した場合、そのジオメトリ情報</param>
    /// <param name="tempid">一時保存からの登録の場合、一時保存時の調査予定id</param>
    /// <returns></returns>
    public async Task<IActionResult> OnPostPlanAsync([FromForm] string? mode, [FromForm] Input調査予定 input,
        [FromForm] double? startx,
        [FromForm] double? starty,
        [FromForm] double? endx,
        [FromForm] double? endy,
        [FromForm] int[] id,
        [FromForm] string? drawroute,
        [FromForm] int? tempid)
    {
        // ---------------------------------------------
        // 入力値取得検証
        // ---------------------------------------------
        調査ステータスEnum? status = mode switch
        {
            "tempsave" => 調査ステータスEnum.一時保存,
            "register" => 調査ステータスEnum.調査予定,
            "check" => (調査ステータスEnum)(-1), // 登録前の入力値チェックのみ
            "calc" => (調査ステータスEnum)(-2), // ルート自動作成→ルート表示
            _ => null, // それ以外は単純なルート表示のみであるとみなす（この際には始点・終点・調査地点の未指定をエラーにはしない）
        };


        // 調査予定ルートの構築を試みる
        var iv = provider.CreateValidator();
        List<T_調査予定ルート> tルートRecords = [];
        T_調査予定ルート? t始点Rec = null;
        T_調査予定ルート? t終点Rec = null;

        LineString? line手動描画ルート = null;
        if (!string.IsNullOrEmpty(drawroute))
        {
            var geojsonReader = new GeoJsonReader();
            line手動描画ルート = geojsonReader.Read<LineString>(drawroute);
        }

        // 始点が指定されていれば経路に追加
        if (startx is not null && starty is not null)
        {
            t始点Rec = new T_調査予定ルート
            {
                連番 = 0,
                調査箇所id = null,
                ジオメトリ = new Point(startx.Value, starty.Value) { SRID = 4326 },
            };
            tルートRecords.Add(t始点Rec);
        }
        else if (status is not null && line手動描画ルート is null)
        {
            iv.AddError("selルート作成起点", "ルート起点を指定してください。");
        }
        // 経路のステータスをチェックしながら追加
        int no = 1;
        IReadOnlyList<T_調査箇所> t調査箇所Records = [];
        if (id.Length > 0)
        {
            t調査箇所Records = await con.SelectAsync<T_調査箇所>(r => r.調査箇所id == SqlExpr.In(id));
            for (int i = 0; i < id.Length; i++)
            {
                var rec = t調査箇所Records.FirstOrDefault(r => r.調査箇所id == id[i]);
                if (rec is null)
                {
                    logger.ZLogWarning($"データ不整合(調査箇所不在)検出：調査箇所id={id[i]}");
                    iv.AddError($"データ不整合を検出しました。(調査箇所id={id[i]})");
                }
                else if (rec.deleted_at is not null)
                {
                    iv.AddError($"調査箇所「{rec.地点名}」はすでに削除されています。指定できません。(id={id[i]})");
                }
                else if (rec.調査状況 != 調査ステータスEnum.依頼中)
                {
                    iv.AddError($"調査箇所「{rec.地点名}」はすでに{rec.調査状況}です。指定できません。(id={id[i]})");
                }
                else
                {
                    tルートRecords.Add(new()
                    {
                        連番 = no,
                        調査箇所id = rec.調査箇所id,
                        ジオメトリ = rec.ジオメトリ,
                    });
                    no++;
                }
            }
        }
        else if (status is not null)
        {
            iv.AddError("調査地点を１箇所以上指定してください。");
        }
        // 終点が指定されていれば経路に追加
        if (endx is not null && endy is not null)
        {
            t終点Rec = new T_調査予定ルート
            {
                連番 = no,
                調査箇所id = null,
                ジオメトリ = new Point(endx.Value, endy.Value) { SRID = 4326 },
            };
            tルートRecords.Add(t終点Rec);
        }
        else if (status is not null && line手動描画ルート is null)
        {
            iv.AddError("selルート作成終点", "ルート終点を指定してください。");
        }


        // ルート自動作成であれば、ルート一覧を最短経路通りに並べ直す
        if (mode == "calc" && iv.Errors.Count == 0)
        {
            tルートRecords = Get最短経路(tルートRecords);
        }


        // 調査ルートのfeatureを生成(ただし手動描画ルートがあるならそれを優先)
        LineString? route = line手動描画ルート ?? Get調査ルートLineString(tルートRecords);
        // 距離や飛行情報を把握
        var distance = Calc距離(route) / 1000;
        var val飛行時間_分 = distance is not null ? ((decimal)distance.Value / _settings.ヘリ時速_毎時 * 60) : (decimal?)null;
        var recヘリ飛行設定 = await con.SelectFirstOrDefaultAsync<T_ヘリ飛行設定>(
            r => r.飛行可能時間_分 >= val飛行時間_分,
            otherClauses: $"ORDER BY {nameof(T_ヘリ飛行設定.搭乗者人数)} DESC LIMIT 1");

        // 調査ルート表示 or 最短経路探索であれば successのjsonを返して終了
        if (status is null || mode == "calc")
        {
            // 調査ルートのfeatureが出来ていればそれを
            List<Feature> features = [];
            if (route is not null)
            {
                features.Add(new Feature(route, new AttributesTable { }));
                if (line手動描画ルート is null)
                {
                    features.AddRange(Get調査ルートPoints(tルートRecords));
                }
            }

            // エラーがあればエラーメッセージを組み立て
            var error = (iv.Errors.Count > 0)
                ? "・" + string.Join(Environment.NewLine + "・", iv.Errors.Select(e => e.ErrorMessage))
                : null;

            return new JsonResult(new
            {
                success = new
                {
                    経路 = new
                    {
                        type = "FeatureCollection",
                        crs = new { type = "name", properties = new { name = "urn:ogc:def:crs:OGC:1.3:CRS84" } },
                        features,
                    },
                    総飛行距離 = distance is not null ? $"{distance:#0.0}Km" : null,
                    調査箇所 = id.Length > 0 ? $"{id.Length}箇所" : null,
                    飛行時間 = val飛行時間_分 is not null ? $"{Math.Floor(val飛行時間_分.Value / 60):0}時間{val飛行時間_分 % 60:0}分" : null,
                    同乗可能人数 = val飛行時間_分 is not null && recヘリ飛行設定?.搭乗者人数 > 0 ? $"{recヘリ飛行設定.搭乗者人数}人以下" : null,
                    id = tルートRecords.Select(r => r.調査箇所id).OfType<int>().Select(v => $"{v}"),
                    error,
                    erroritems = iv.GetErrorItemNames(),
                }
            });
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
        var t予定Rec = new T_調査予定
        {
            調査予定名 = iv.Parse<string>(() => input.title),
            ステータス = status.Value,
            is自動作成ルート = iv.Validate(() => input.auto),
            起点id = iv.Validate(() => input.startid),
            終点id = iv.Validate(() => input.endid),
            手動描画調査ルート = line手動描画ルート,
        };
        if (iv.Errors.Count == 0)
        {
            var dupe = await con.SelectFirstOrDefaultAsync<T_調査予定>(
                r => r.調査予定名 == t予定Rec.調査予定名 && t予定Rec.ステータス >= 調査ステータスEnum.依頼中 && r.deleted_at == null);
            if (dupe is not null)
            {
                iv.AddError("input.title", "同じ調査ルート名が既に存在します。調査ルート名を変更してください。");
            }
        }
        if (iv.Errors.Count > 0)
        {   // 調査予定サマリの入力エラー有
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
            var oldRec = await tran.SelectFirstOrDefaultAsync<T_調査予定>(r => r.調査予定id == tempid && r.deleted_at == null,
                otherClauses: "FOR UPDATE");
            if (oldRec is null)
            {
                return new JsonResult(new { error = "編集した一時保存データは他ユーザが既に操作済です。更新できません。" });
            }
            else if (oldRec.ステータス != 調査ステータスEnum.一時保存)
            {
                logger.ZLogWarning($"一次保存調査予定のステータス不正を検出：調査予定id={tempid},ステータス={oldRec.ステータス}");
                return new JsonResult(new { error = "編集した一時保存データは他ユーザが既に更新済です。更新できません。" });
            }
            // 更新元一時保存データを削除
            await tran.UpdateAsync(() => new T_調査予定 { deleted_at = SqlExpr.Eval<DateTime>("CURRENT_TIMESTAMP") }, r => r.調査予定id == tempid);
            await tran.DeleteAsync<T_調査予定ルート>(r => r.調査予定id == tempid);
        }
        await tran.InsertAndRetrieveIdAsync(t予定Rec);
        foreach (var rec in tルートRecords)
        {
            rec.調査予定id = t予定Rec.調査予定id;
        }
        await tran.InsertRowsAsync(tルートRecords);

        if (t予定Rec.ステータス == 調査ステータスEnum.調査予定)
        {
            // 調査箇所データ側のステータスも更新する
            foreach (var rec in tルートRecords.Where(r => r.調査箇所id is not null))
            {
                var updated = await tran.UpdateAsync(() => new T_調査箇所
                {
                    調査予定id = rec.調査予定id,
                    調査状況 = 調査ステータスEnum.調査予定,
                    updated_at = SqlExpr.Eval<DateTime>("CURRENT_TIMESTAMP"),
                }, r => r.調査箇所id == rec.調査箇所id && r.調査状況 == 調査ステータスEnum.依頼中 && r.deleted_at == null);
                if (updated != 1)
                {
                    // ※厳密に考えるとデータ同時更新時にここのロジックに落ちる可能性はある・・・いちおうログを出す形で対策としておく
                    logger.ZLogError($"調査箇所レコード更新失敗：調査箇所id={rec.調査箇所id}");
                    return BadRequest("システムエラー（調査箇所データ不正）が発生しました。登録できません。");
                }
            }
            // 調査依頼データのステータスも更新する
            await Update調査依頼Status(tran, [.. t調査箇所Records.Select(r => r.調査依頼id).Distinct()]);
        }

        await tran.CommitAsync();

        return new JsonResult(new
        {
            success = status switch
            {
                調査ステータスEnum.一時保存 => "一時保存が完了しました。",
                _ => "調査予定ルートの公開が完了しました。",
            }
        });
    }

    /// <summary>
    /// (private) 調査予定ルートの最短経路を探索して返します。
    /// </summary>
    /// <param name="tルートRecords">調査予定ルート</param>
    /// <returns>最短経路準に並び替えられた調査予定ルート</returns>
    private List<T_調査予定ルート> Get最短経路(IReadOnlyList<T_調査予定ルート> tルートRecords)
    {
        // 各地点の座標をListにする（LineStringは始点と終点の両方を登録）
        List<(GeoCoordinate geo, T_調査予定ルート rec)> points = [];
        foreach (var rec in tルートRecords)
        {
            if (rec.ジオメトリ is LineString ls && ls.Coordinates.Length >= 2)
            {
                var coord1 = ls.Coordinates.First();
                var coord2 = ls.Coordinates.Last();
                points.Add((new GeoCoordinate(coord1.Y, coord1.X), rec));
                points.Add((new GeoCoordinate(coord2.Y, coord2.X), rec));
            }
            else
            {
                var coord = rec.ジオメトリ.Coordinate;
                points.Add((new GeoCoordinate(coord.Y, coord.X), rec));
            }
        }

        // 全地点について２点間の距離を計算しGoogleOrTools用の距離配列を作成
        long[,] distances = new long[points.Count, points.Count];
        for (int i1 = 0; i1 < points.Count; i1++)
        {
            for (int i2 = i1; i2 < points.Count; i2++)
            {
                var distance = (points[i1].rec == points[i2].rec)
                    ? 0 // 同一地点(ないし同一LineString)の場合はゼロ距離とみなす
                    : 1_000_000 + points[i1].geo.GetDistanceTo(points[i2].geo); // 同一LineStringが確実に最短経路と選択されるよう加算値を設定
                distances[i1, i2] = (long)distance;
                distances[i2, i1] = (long)distance;
            }
        }

        // GoogleOrToolsの経路探索オブジェクトを生成
        // （詳細は、 https://developers.google.com/optimization/routing/tsp?hl=ja#c を参照）
        RoutingIndexManager routingManager = new(points.Count, 1, [0], [points.Count - 1]); // 機器台数は1台、始点ノードは配列の[0]のノード、終点ノードは配列の末端のノード
        RoutingModel routingModel = new(routingManager);
        int transitCallbackIndex = routingModel.RegisterTransitCallback((fromIndex, toIndex) =>
        {
            var fromNode = routingManager.IndexToNode(fromIndex);
            var toNode = routingManager.IndexToNode(toIndex);
            return distances[fromNode, toNode];
        });
        routingModel.SetArcCostEvaluatorOfAllVehicles(transitCallbackIndex);
        RoutingSearchParameters searchParameters = operations_research_constraint_solver.DefaultRoutingSearchParameters();
        searchParameters.FirstSolutionStrategy = FirstSolutionStrategy.Types.Value.PathCheapestArc;
        // 経路探索の精度を向上させるため「ガイド付きローカル検索」を使用する。以下の設定で指定秒まで最善ルートの探索を諦めずに行う
        searchParameters.LocalSearchMetaheuristic = LocalSearchMetaheuristic.Types.Value.GuidedLocalSearch;
        searchParameters.TimeLimit = new Google.Protobuf.WellKnownTypes.Duration { Seconds = 1 };

        // 経路探索実行
        Assignment solution = routingModel.SolveWithParameters(searchParameters);

        // 最短経路の調査予定ルートListを生成
        int no = 1;
        List<T_調査予定ルート> shortest = [];
        var index = routingModel.Start(0);
        while (!routingModel.IsEnd(index))
        {
            int node = routingManager.IndexToNode(index);
            var rec = points[node].rec;
            if (!shortest.Contains(rec)) // LineStringで既に同一調査箇所(もう一方の端点)が登録済であればSkipする
            {
                if (rec.調査箇所id is not null)
                {   // 始点・終点以外は連番をリナンバリング
                    rec.連番 = no;
                    no++;
                }
                shortest.Add(rec);
            }
            // 次の地点へ
            index = solution.Value(routingModel.NextVar(index));
        }
        // 終点座標も追加する
        int endNode = routingManager.IndexToNode(index);
        shortest.Add(points[endNode].rec);
        // 生成されたListを返す
        return shortest;
    }

    /// <summary>
    /// ajax(post): 一時保存調査予定の削除
    /// </summary>
    /// <param name="tempid">一時保存時の調査予定id</param>
    /// <returns></returns>
    public async Task<IActionResult> OnPostDeletePlanAsync([FromForm] int? tempid)
    {
        if (!login.Isログイン済)
        {
            return BadRequest("ログインが無効です。調査予定を削除できません。");
        }
        var userRec = await login.Getユーザー情報Async();

        con.Open();
        using var tran = await con.BeginTransactionAsync();
        // 削除対象一時保存データの存在チェック
        var oldRec = await tran.SelectFirstOrDefaultAsync<T_調査予定>(r => r.調査予定id == tempid && r.deleted_at == null,
            otherClauses: "FOR UPDATE");
        if (oldRec is null)
        {
            return new JsonResult(new { error = "編集した一時保存データは他ユーザが既に操作済です。更新できません。" });
        }
        else if (oldRec.ステータス != 調査ステータスEnum.一時保存)
        {
            logger.ZLogWarning($"一次保存調査依頼のステータス不正を検出：調査予定id={tempid},ステータス={oldRec.ステータス}");
            return new JsonResult(new { error = "編集した一時保存データは他ユーザが既に更新済です。更新できません。" });
        }
        // 削除対象一時保存データを削除
        await tran.UpdateAsync(() => new T_調査予定 { deleted_at = SqlExpr.Eval<DateTime>("CURRENT_TIMESTAMP") }, r => r.調査予定id == tempid);
        await tran.DeleteAsync<T_調査予定ルート>(r => r.調査予定id == tempid);
        await tran.CommitAsync();

        return new JsonResult(new { success = "削除しました。" });
    }

    #endregion ------------------------------------------------------------------------------------


    /// <summary>
    /// (private) 調査ルートの経路を生成して返します。
    /// </summary>
    /// <param name="tルートRecords">調査予定ルート</param>
    /// <returns>経路。調査予定ルート未設定の場合はnull</returns>
    /// <exception cref="InvalidDataException"></exception>
    private LineString? Get調査ルートLineString(IReadOnlyList<T_調査予定ルート> tルートRecords)
    {
        // まず経路の線を引きつつ、LineStringの経路追加時に前/後ろどちらから経路追加するか決定する
        List<Coordinate> lineCoordinates = [];
        for (int i = 0; i < tルートRecords.Count; i++)
        {
            var rec = tルートRecords[i];
            if (rec.ジオメトリ is Point p)
            {
                lineCoordinates.Add(p.Coordinate); // 点であれば単純にその地点を追加
            }
            else if (rec.ジオメトリ is LineString ls && ls.Coordinates.FirstOrDefault() is Coordinate coord前 && ls.Coordinates.LastOrDefault() is Coordinate coord後ろ)
            {
                // 前/後ろどちらから経路に追加したほうが距離が短くなるか判断する
                double distance前から追加した場合 = 0;
                double distance後ろから追加した場合 = 0;
                var geo前 = new GeoCoordinate(coord前.Y, coord前.X);
                var geo後ろ = new GeoCoordinate(coord後ろ.Y, coord後ろ.X);

                // 直前の座標が分かっていれば距離を算出
                if (lineCoordinates.LastOrDefault() is Coordinate prev)
                {
                    var prevGeo = new GeoCoordinate(prev.Y, prev.X);
                    distance前から追加した場合 += prevGeo.GetDistanceTo(geo前);
                    distance後ろから追加した場合 += prevGeo.GetDistanceTo(geo後ろ);
                }
                // それより後ろにも座標があるならさらに距離を算出して加算
                var nextジオメトリ = (i + 1 < tルートRecords.Count) ? tルートRecords[i + 1].ジオメトリ : null;
                if (nextジオメトリ is Point)
                {
                    var nextGeo = new GeoCoordinate(nextジオメトリ.Coordinate.Y, nextジオメトリ.Coordinate.X);
                    distance前から追加した場合 += nextGeo.GetDistanceTo(geo後ろ);
                    distance後ろから追加した場合 += nextGeo.GetDistanceTo(geo前);
                }
                else if (rec.ジオメトリ is LineString ls2 && ls2.Coordinates.FirstOrDefault() is Coordinate coord前2 && ls.Coordinates.LastOrDefault() is Coordinate coord後ろ2)
                {
                    // 後続のジオメトリも線の場合は、その後続の線の前/後ろどちらに繋げるほうがより短いかをさらに考慮する
                    // (厳密にやるのであれば始点～終点までGoogleOrTool等で最短経路を算出する必要があるが、ここでは妥協して直前直後のみを考慮した最短経路を導出する)
                    var nextGeo前 = new GeoCoordinate(coord前2.Y, coord前2.X);
                    var nextGeo後ろ = new GeoCoordinate(coord後ろ2.Y, coord後ろ2.X);
                    distance前から追加した場合 += Math.Min(nextGeo前.GetDistanceTo(geo前), nextGeo後ろ.GetDistanceTo(geo前));
                    distance後ろから追加した場合 += Math.Min(nextGeo前.GetDistanceTo(geo後ろ), nextGeo後ろ.GetDistanceTo(geo後ろ));
                }

                rec.is後ろから経路追加 = distance後ろから追加した場合 < distance前から追加した場合;
                if (rec.is後ろから経路追加 == true)
                {
                    for (int i2 = rec.ジオメトリ.Coordinates.Length - 1; i2 >= 0; i2--)
                    {   // 座標の配列の後ろから追加していく
                        lineCoordinates.Add(rec.ジオメトリ.Coordinates[i2]);
                    }
                }
                else
                {
                    lineCoordinates.AddRange(rec.ジオメトリ.Coordinates);
                }
            }
            else
            {
                logger.ZLogError($"想定外のジオメトリが登録されている。型:{rec.ジオメトリ.GetType()}, 調査箇所id:{rec.調査箇所id}, 連番:{rec.連番}");
                throw new InvalidDataException($"想定外のジオメトリが登録されている。型:{rec.ジオメトリ.GetType()}, 調査箇所id:{rec.調査箇所id}, 連番:{rec.連番}");
            }
        }
        return lineCoordinates.Count >= 2
            ? new LineString([.. lineCoordinates]) { SRID = 4326 }
            : null;
    }

    /// <summary>
    /// (private) 調査予定ルートの経由地点PointのFeatureを生成して返します。
    /// </summary>
    /// <param name="tルートRecords">調査予定ルート</param>
    /// <returns>Featureの一覧</returns>
    private IEnumerable<Feature> Get調査ルートPoints(IReadOnlyList<T_調査予定ルート> tルートRecords)
    {
        // まず経路の点をプロット
        foreach (var rec in tルートRecords.Where(r => r.調査箇所id is not null))
        {
            if (rec.ジオメトリ is Point point)
            {
                yield return new Feature(point, new AttributesTable { { "text", $"{rec.連番}" } });
            }
            else if (rec.ジオメトリ is LineString line && line.Coordinates.Length >= 2)
            {
                var point1 = new Point(line.Coordinates.First());
                var point2 = new Point(line.Coordinates.Last());
                yield return new Feature(point1, new AttributesTable { { "text", $"{rec.連番}" } });
                yield return new Feature(point2, new AttributesTable { { "text", $"{rec.連番}" } });
            }
        }
        // 始点と終点を最後にプロットし前面に表示されるようにする
        if (tルートRecords.Count >= 2)
        {
            T_調査予定ルート? start = tルートRecords[0];
            T_調査予定ルート? end = tルートRecords[tルートRecords.Count - 1];
            // 始点/終点ではなかった場合nullとする
            if (start.調査箇所id is not null) { start = null; }
            if (end.調査箇所id is not null) { end = null; }
            // 始点と終点が同一座標の場合
            if (start is not null)
            {
                yield return new Feature(start.ジオメトリ, new AttributesTable { { "text", "始" } });
            }
            if (end is not null && (start?.ジオメトリ != end.ジオメトリ))
            {
                yield return new Feature(end.ジオメトリ, new AttributesTable { { "text", "終" } });
            }
        }
    }


    /// <summary>
    /// (private) 引数で指定されたLineStringの経路の距離をメートル単位で算出して返します。
    /// </summary>
    /// <param name="ls">経路</param>
    /// <returns>距離。経路になっていない場合はnull</returns>
    private double? Calc距離(LineString? ls)
    {
        if (ls is null || ls.Coordinates.Length < 2) { return null; }

        double totalDistance = 0;
        for (int i = 1; i < ls.Coordinates.Length; i++)
        {
            var coord1 = ls.Coordinates[i - 1];
            var coord2 = ls.Coordinates[i];
            var geo1 = new GeoCoordinate(coord1.Y, coord1.X);
            var geo2 = new GeoCoordinate(coord2.Y, coord2.X);
            totalDistance += geo1.GetDistanceTo(geo2);
        }
        return totalDistance;
    }

}
