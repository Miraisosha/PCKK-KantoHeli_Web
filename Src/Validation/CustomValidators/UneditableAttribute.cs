using System.ComponentModel.DataAnnotations;

namespace Src.Validation.CustomValidators;

/// <summary>
/// 入力項目をreadonly/disabledにする属性
/// </summary>
/// <remarks>
/// input type="text"/textareaはreadonlyに、それ以外のinput/select/textareaはdisabledになる
/// （なお設定処理はCustomHtmlGeneratorクラスにより実現している）
/// <remarks>
[AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
public class UneditableAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        return null; // 常に検証成功とする
    }
}
