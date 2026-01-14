using System.Globalization;

namespace Src.Util;

/// <summary>
/// 日付汎用ユーティリティ（拡張メソッド含む）
/// </summary>
public static class DateUtil
{
    /// <summary>
    /// 「令和7」などの和暦年表記文字列を返します
    /// </summary>
    /// <param name="value">日付</param>
    /// <returns>和暦年表記文字列</returns>
    public static string? To和暦年Text(this DateTime? value)
    {
        if (value is null) { return null; }
        var jpCulture = new CultureInfo("ja-JP", true);
        jpCulture.DateTimeFormat.Calendar = new JapaneseCalendar();
        return value.Value.ToString("ggy", jpCulture);
    }

    /// <summary>
    /// 「令和7年度」などの和暦年度表記文字列を返します
    /// </summary>
    /// <param name="year">年</param>
    /// <returns>和暦年度表記文字列</returns>
    public static string To和暦年度Text(this int year)
    {
        return $"{To和暦年Text(new DateTime(year, 4, 1))}年度";
    }
}
