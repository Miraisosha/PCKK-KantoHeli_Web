using System.ComponentModel.DataAnnotations;
using System.Reflection;
using Src.Validation.CustomValidators;
using ZLogger;

namespace Src.Validation;

/// <summary>
/// Validatorのエラーメッセージを日本語化します。
/// </summary>
public static class ValidationMessageLocalizer
{
    /// <summary>
    /// 引数で指定されたValidatorのエラーメッセージを日本語化します。
    /// </summary>
    public static void Localize(IEnumerable<ValidationAttribute> validators, ILogger? logger = null)
    {
        foreach (var v in validators)
        {
            try { Localize(v); }
            catch (Exception ex)
            {
                logger?.ZLogWarning($"{ex.Message}");
                v.ErrorMessage = "{0} の入力値が正しくありません。";
            }
        }
    }

    /// <summary>
    /// 引数で指定されたValidatorのエラーメッセージを日本語化します。
    /// </summary>
    public static bool Localize(ValidationAttribute validator)
    {
        // カスタムのエラーメッセージが指定されている場合は上書きしない
        var defaultErrorMessage = typeof(ValidationAttribute).GetField("_defaultErrorMessage", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(validator) as string;
        if (validator.ErrorMessage != defaultErrorMessage || validator.ErrorMessageResourceName is not null)
        {
            return false;
        }

        // 検証の種類に応じたエラーメッセージを設定
        string? message = validator switch
        {
            AcceptAttribute => null, // ※IsValidメソッドにてエラー内容に応じたメッセージが自動設定される
            //
            RequiredAttribute => "{0} が入力されていません。",
            MinLengthAttribute => "{0} は {1} 文字以上で入力してください。",
            MaxLengthAttribute => "{0} は {1} 文字以内で入力してください。",
            StringLengthAttribute sla => sla.MinimumLength switch
            {
                0 => "{0} は {1} 文字以内で入力してください。",
                _ when sla.MinimumLength == sla.MaximumLength => "{0} は {1} 文字で入力してください。", // 固定長
                _ => "{0} は {2} 文字以上 {1} 文字以内で入力してください。"
            },
            RangeAttribute ra => (ra.MinimumIsExclusive, ra.MaximumIsExclusive) switch
            {
                (false, false) => "{0} は {1} 以上 {2} 以下で入力してください。",
                (false, true) => "{0} は {1} 以上 {2} 未満で入力してください。",
                (true, false) => "{0} は {1} より大きく {2} 以下の値で入力してください。",
                (true, true) => "{0} は {1} より大きく {2} より小さい値で入力してください。",
            },
            RegularExpressionAttribute => "{0} の入力値の形式が正しくありません。",
            //EmailAddressAttribute => 『Accept("@")』にて代替すること
            //PhoneAttribute => 『Accept("0"), RegularExpressionAttribute("[0-9]{10,11}", ErrorMessage="・・・")』などにより代替すること。ハイフンを許容する場合は別途考慮のこと
            // ここまででメッセージが定義されていなかった場合は例外を投げる
            _ => throw new ArgumentException($"エラーメッセージ未定義の検証属性が指定されました：{validator.GetType().FullName}。"),
        };
        if (message is not null)
        {
            validator.ErrorMessage = message;
            return true;
        }
        return false;
    }
}
