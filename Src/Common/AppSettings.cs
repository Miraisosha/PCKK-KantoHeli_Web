using System.Reflection;

namespace Src.Common;

/// <summary>
/// 環境設定値
/// </summary>
public class AppSettings
{
    // 地図表示時の初期座標既定値
    public decimal MapInitX { get; set; } = 139.750m;
    public decimal MapInitY { get; set; } = 35.685m;
    public decimal MapInitZ { get; set; } = 13;

    public int リアルタイム情報有効時間_分 = 1440;
    public int リアルタイム情報更新間隔_秒 = 5;

    // 以下、暫定固定値
    public decimal ヘリ時速_毎時 { get; set; } = 129.64m;


    // -------------------------------------------------------------------------
    // その他システム運用設定
    // -------------------------------------------------------------------------
    public string システム名 { get; set; } = Assembly.GetExecutingAssembly().GetCustomAttribute<AssemblyProductAttribute>()?.Product ?? string.Empty;

    // ログ関連
    public string LogDir { get; set; } = Path.Join(AppDomain.CurrentDomain.BaseDirectory, "logs");
    public bool ログHttpError出力 { get; set; } // = defaultではfalse

    // Https
    public bool ForceHttps接続 { get; set; } // = defaultではfalse

    // Basic認証(どちらも空文字の場合は認証無し)
    public string BasicAuthUsername { get; set; } = string.Empty;
    public string BasicAuthPassword { get; set; } = string.Empty;

    /// <summary>
    /// Cookie認証によるログインが有効か否かを判定するClaimで保持するべき値
    /// </summary>
    /// <remarks>
    /// この値を書き換えることで既にログイン中のユーザのログインを強制的に無効化しログアウトさせることができます。
    /// </remarks>
    public string AuthValidationClaimValue { get; set; } = string.Empty;

    public static bool IsApplicationStopping { get; set; } = false;

    public string? FlightRouteKMLPath { get; set; }
}
