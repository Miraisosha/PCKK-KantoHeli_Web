using System.ComponentModel.DataAnnotations;
using System.Reflection;

namespace Src.Utils;

/// <summary>
/// Enumの表示名を返す／Enumが特定の条件に該当するか等を返す拡張メソッドを幅広く定義します。
/// </summary>
public static class EnumExtension
{
    /// <summary>
    /// Enumの値としてDisplayAttributeに設定されている表示名を返します。
    /// </summary>
    public static string? GetDisplayName<T>(this T value) where T : Enum
    {
        if (!Enum.IsDefined(typeof(T), value)) { return null; } // Enumとして定義されていない値である

        if (typeof(T).GetField(value.ToString()) is { } field
            && field.GetCustomAttribute<DisplayAttribute>() is { } attr)
        {
            // DisplayAttributeが定義されているばあいはその名前を返すよう試みる
            return attr.GetName() ?? value.ToString();
        }
        return value.ToString();
    }

    /// <summary>
    /// Enumの値としてDisplayAttributeに設定されている表示名(ショートバージョン)を返します。
    /// </summary>
    public static string? GetDisplayShortName<T>(this T value) where T : Enum
    {
        if (!Enum.IsDefined(typeof(T), value)) { return null; } // Enumとして定義されていない値である

        if (typeof(T).GetField(value.ToString()) is { } field
            && field.GetCustomAttribute<DisplayAttribute>() is { } attr)
        {
            // DisplayAttributeが定義されているばあいはその名前を返すよう試みる
            return attr.GetShortName() ?? attr.GetName() ?? value.ToString();
        }
        return value.ToString();
    }
}
