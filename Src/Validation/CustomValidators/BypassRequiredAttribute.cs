namespace Src.Validation.CustomValidators;

/// <summary>
/// [Required]属性で指示された必須入力チェックを無効化する属性
/// </summary>
/// <remarks>
/// InputValidator呼び出し時、必須チェックをさせたくない項目についてはadditionalValidationsにこの属性のインスタンスを指定すること。
/// </remarks>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field)]
public class BypassRequiredAttribute : Attribute;
