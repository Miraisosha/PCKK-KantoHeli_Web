namespace Src.Validation.CustomValidators;

/// <summary>
/// 入力エラーメッセージのMemberNameを強制的に上書きするための属性
/// </summary>
/// <param name="name">MemberNameを書き換える場合、その項目名</param>
/// <param name="index">MemberNameに添え字を付加する場合、その添え字の値</param>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field)]
public class MemberNameAttribute() : Attribute
{
    /// <summary>
    /// エラーメッセージの冒頭に付加する項目名の接頭語を書き換える場合、その接頭語
    /// </summary>
    public string? OverwritePrefix { get; set; }
    /// <summary>
    /// MemberNameを書き換える場合、その項目名
    /// </summary>
    public string? OverwriteName { get; set; }
    /// <summary>
    /// MemberNameに添え字を付加する場合、その添え字の値
    /// </summary>
    public int? Index { get; set; }
}
