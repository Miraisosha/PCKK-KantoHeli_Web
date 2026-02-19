using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using DapperAid.DataAnnotations;
using NetTopologySuite.Geometries;

namespace Src.Common;

// ============================================================================
// テーブル定義
// ============================================================================
// ※テーブル定義に関しては、命名スタイル/参照型null非許容初期値の警告を一切無効化する
#pragma warning disable IDE1006 // 命名スタイル
#pragma warning disable CS8618 // null 非許容のフィールドには、コンストラクターの終了時に null 以外の値が入っていなければなりません。'required' 修飾子を追加するか、Null 許容として宣言することを検討してください。


[Table("t_ユーザー")]
public partial class T_ユーザー
{
    [Key]
    public string ユーザーid { get; set; }
    /// <summary>(hash)</summary>
    public string パスワード { get; set; }
    public string ユーザー名 { get; set; }
    public int 組織id { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_組織")]
public partial class T_組織
{
    [Key]
    public int 組織id { get; set; }
    public string 組織名 { get; set; }
    public int? 表示順 { get; set; }
    public string ピン表示色 { get; set; }
    public bool isルート作成可 { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_起点終点")]
public partial class T_起点終点
{
    [Key]
    public int 起点終点id { get; set; }
    public string 起点終点名 { get; set; }
    public int? 表示順 { get; set; }
    public double 緯度 { get; set; }
    public double 経度 { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_災害区分")]
public partial class T_災害区分
{
    [Key]
    public int 災害区分id { get; set; }
    public string 災害区分名 { get; set; }
    public int? 表示順 { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_ログイン履歴")]
public partial class T_ログイン履歴
{
    /// <summary>自動連番</summary>
    [Key][InsertValue(false, RetrieveInsertedId = true)]
    public int 履歴id { get; set; }
    public DateTime ログイン操作日時 { get; set; }
    public string? ユーザーid { get; set; }
    public bool? ログイン成否 { get; set; }
    public string? アプリ名 { get; set; }
    public string? アプリバージョン { get; set; }
    public string? remote_addr { get; set; }
    public string? http_user_agent { get; set; }
    public string? 備考 { get; set; }
}
[Table("t_ftp受信履歴")]
public partial class T_ftp受信履歴
{
    [Key]
    public string 受信ファイル名 { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_地震サマリ")]
public partial class T_地震サマリ
{
    /// <summary>自動連番</summary>
    [Key][InsertValue(false, RetrieveInsertedId = true)]
    public int 地震id { get; set; }
    public string 受信ファイル名 { get; set; }
    public DateTime 地震発生日時 { get; set; }
    public string 震央地名 { get; set; }
    public string 震源 { get; set; }
    public string マグニチュード { get; set; }
    public string 最大震度 { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_地震明細")]
public partial class T_地震明細
{
    [Key]
    public int 地震id { get; set; }
    [Key]
    public string 市区町村コード { get; set; }
    /// <summary>1,2,3,4,5-,5＋,6-,6＋,7,5? ※5強,6強のプラスは全角、震度５弱以上未入電は「5?」</summary>
    public string 最大震度 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_特定初動調査区分")]
public partial class T_特定初動調査区分
{
    [Key]
    public int 特定初動調査区分id { get; set; }
    public int 災害区分id { get; set; }
    public string 特定初動調査区分名 { get; set; }
    public string? 初動調査タブ名 { get; set; }
    public int? 表示順 { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_初動調査ルート")]
public partial class T_初動調査ルート
{
    [Key]
    public int 初動調査ルートid { get; set; }
    public int 特定初動調査区分id { get; set; }
    public int? 表示順 { get; set; }
    public string 初動調査ルート名 { get; set; }
    public int 起点id { get; set; }
    public int 終点id { get; set; }
    public double? 総飛行距離 { get; set; }
    public Geometry? ジオメトリ { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_初動調査地点")]
public partial class T_初動調査地点
{
    [Key]
    public int 初動調査ルートid { get; set; }
    [Key]
    public int 連番 { get; set; }
    public string 初動調査地点名 { get; set; }
    public double 緯度 { get; set; }
    public double 経度 { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_スレッド")]
public partial class T_スレッド
{
    /// <summary>自動連番</summary>
    [Key][InsertValue(false, RetrieveInsertedId = true)]
    public int スレッドid { get; set; }
    public string スレッド名 { get; set; }
    public DateTime 災害発生日時 { get; set; }
    public int 災害区分id { get; set; }
    public int? 特定初動調査区分id { get; set; }
    public int? 初動調査ルートid { get; set; }
    public 調査状況Enum? 初動調査状況 { get; set; }
    public string? 調査ルート名 { get; set; }
    public 調査状況Enum? 調査状況 { get; set; }
    public string? 備考 { get; set; }
    public int? 地震id { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_調査依頼")]
public partial class T_調査依頼
{
    /// <summary>自動連番</summary>
    [Key][InsertValue(false, RetrieveInsertedId = true)]
    public int 調査依頼id { get; set; }
    public int スレッドid { get; set; }
    public string 調査依頼名 { get; set; }
    public int 組織id { get; set; }
    public 調査ステータスEnum ステータス { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_調査箇所")]
public partial class T_調査箇所
{
    /// <summary>自動連番</summary>
    [Key][InsertValue(false, RetrieveInsertedId = true)]
    public int 調査箇所id { get; set; }
    public int 調査依頼id { get; set; }
    public string 地点名 { get; set; }
    public 調査優先度Enum 優先度 { get; set; }
    public 調査手法Enum 調査手法 { get; set; }
    public int 搭乗希望人数 { get; set; }
    public 調査箇所登録方法Enum 登録方法 { get; set; }
    public Geometry ジオメトリ { get; set; }
    public int 組織id { get; set; }
    public 調査ステータスEnum 調査状況 { get; set; }
    public int? 調査予定id { get; set; }
    public int? 調査結果id { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_調査予定")]
public partial class T_調査予定
{
    /// <summary>自動連番</summary>
    [Key]
    [InsertValue(false, RetrieveInsertedId = true)]
    public int 調査予定id { get; set; }
    public string 調査予定名 { get; set; }
    public 調査ステータスEnum ステータス { get; set; }
    public bool? is自動作成ルート { get; set; }
    public LineString? 手動描画調査ルート { get; set; }
    public int? 起点id { get; set; }
    public int? 終点id { get; set; }
    public string? 備考 { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue(false)]
    public DateTime created_at { get; set; }
    [InsertValue("CURRENT_TIMESTAMP"), UpdateValue("CURRENT_TIMESTAMP")]
    public DateTime updated_at { get; set; }
    public DateTime? deleted_at { get; set; }
}
[Table("t_調査予定ルート")]
public partial class T_調査予定ルート
{
    [Key]
    public int 調査予定id { get; set; }
    [Key]
    public int 連番 { get; set; }
    public int? 調査箇所id { get; set; }
    public Geometry ジオメトリ { get; set; }
    public bool? is後ろから経路追加 { get; set; }
    public string? 備考 { get; set; }
}
[Table("t_ヘリ飛行設定")]
public partial class T_ヘリ飛行設定
{
    [Key]
    public int 搭乗者人数 { get; set; }
    [Key]
    public int 飛行可能時間_分 { get; set; }
    public string? 表示名 { get; set; }
    public string? 備考 { get; set; }
}

