using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.RegularExpressions;

namespace Src.Validation.CustomValidators;

/// <summary>
/// テキスト欄の入力可能文字制御
/// </summary>
/// <param name="types">
/// 入力可能文字種を、「Z(全角)」「d(日付)」「@(メールアドレス)」「0(数字)」「08(数字桁数固定自動0パディング)」あるいは混在で「0Aa(英数大小)」などと、
/// もしくは数値桁数を(小数桁数/マイナス許容あればそれもつけて)「5」「3.4」「-9.2」「2.06(小数桁数固定)」などと指定
/// </param>
/// <remarks>
/// 入力可能文字種がinputタグ等のaccept属性に転記され、JavaScriptにより自動的に入力制御が行われるようになる。
/// 入力制御の詳細仕様はsite.jsのinitInputAssist()を参照のこと。
/// （なお転記処理はCustomHtmlGeneratorクラスにより実現している）
/// 入力検証は日付(d),メールアドレス(@),数字(0)、および数値桁数(-9.9)のみこのクラスにより検証が行われる。
/// それ以外の文字種であるA/a/Zやそれらの混在については別途[RegularExpression]属性にて検証を行いエラーメッセージを出させること。
/// <remarks>
public class AcceptAttribute(string types) : ValidationAttribute
{
    /// <summary>入力可能文字種</summary>
    public string Types { get; init; } = types;

    /// <summary>画面表示時の書式</summary>
    /// <remarks>入力可能文字種既定の書式とは異なる書式を設定する場合に指定</remarks>
    public string? Format { get; init; }

    /// <summary>表示専用モードでの書式（数値のカンマ編集など）</summary>
    /// <remarks>入力可能文字種既定の書式とは異なる書式を設定する場合に指定</remarks>
    public string? DisplayFormat { get; init; }

    /// <summary>
    /// 画面表示時の書式を返します。
    /// </summary>
    /// <param name="isDisplayMode">表示専用モードで書式設定する場合はtrue</param>
    /// <returns>書式。未設定の場合はnull</returns>
    public string? GetFormat(bool isDisplayMode)
    {
        if (isDisplayMode && !string.IsNullOrEmpty(DisplayFormat))
        {   // 表示専用フォーマット指定あり
            return DisplayFormat;
        }
        if (!string.IsNullOrEmpty(Format))
        {   // 表示フォーマット指定あり
            return Format;
        }
        if (Types.StartsWith('d'))
        {   // 日付書式設定
            return Types switch
            {
                "dts" => "yyyy/MM/dd HH:mm:ss",
                "dt" => "yyyy/MM/dd HH:mm",
                _ => "yyyy/MM/dd",               // それ以外(通常の「d」含む)はすべてこの書式とする
                // ※和暦表示など書式をこの要領で案件ごとにカスタム追加する可能性あり
            };
        }
        if (decimal.TryParse(Types, out var digits))
        {   // 数字入力書式設定
            int integerDigits = decimal.ToInt32(Math.Abs(digits));
            if (Types.StartsWith('0'))
            {
                return new string('0', integerDigits); // 数字桁数固定自動0パディング
            }
            var format = isDisplayMode ? "#,##0" : "0";
            if (Types.Contains('.') && int.TryParse(Types[(Types.LastIndexOf('.') + 1)..], out var decimalPlaces))
            {
                format = format + "." + new string(Types.Contains(".0") ? '0' : '#', decimalPlaces);
            }
            return format;
        }
        return null;
    }

    /// <summary>
    /// 入力可能文字のうち本クラス内で検証制御を行う文字の定義
    /// </summary>
    private static class AcceptTypes
    {
        public const string 全角 = "Z";
        public const string 日付 = "d";
        public const string 日時 = "dt";
        public const string メールアドレス = "@";
        public const string 数字 = "0";
    }

    protected override ValidationResult? IsValid(object? value, ValidationContext? validationContext)
    {
        if (value is null or string { Length: 0 })
        {
            return null;
        }

        if (Types == AcceptTypes.全角)
        {
            // ASCII文字及びラテン拡張系の半角文字、半角のカナおよびハングルがあればエラーとする。
            // （本来あるべき半角チェックとしてはUnicodeの定義に従うべきなのだが簡便のため妥協する）
            return $"{value}".Any(ch => (ch >= 0x20 && ch <= 0x036F) || (ch >= 0xFF61 && ch <= 0xFFDF))
                ? Error("{0} は全角文字で入力してください。")
                : ValidationResult.Success;
        }

        if (Types == AcceptTypes.日付)
        {
            return DateOnly.TryParse($"{value}", out _)
                ? ValidationResult.Success
                : Error("{0} が有効な日付ではありません。");
        }

        if (Types.StartsWith(AcceptTypes.日時))
        {
            return DateTime.TryParse($"{value}", out _)
                ? ValidationResult.Success
                : Error("{0} が有効な日時ではありません。");
        }

        if (Types == AcceptTypes.メールアドレス)
        {
            // 「HTML 仕様のメールアドレス正規表現の末尾に、 TLD 必須のルールを加えたもの」の条件を満たすかどうかでチェックする。
            // https://qiita.com/koseki/items/ec2658cea7a900c74365
            // https://zenn.dev/igz0/articles/email-validation-regex-best-practices
            // https://developer.mozilla.org/ja/docs/Web/HTML/Element/input/email#%E5%9F%BA%E6%9C%AC%E7%9A%84%E3%81%AA%E6%A4%9C%E8%A8%BC
            var pattern = @"^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$";
            return Regex.IsMatch($"{value}", pattern)
                ? ValidationResult.Success
                : Error("{0} が有効な形式ではありません。");
        }

        if (Types is AcceptTypes.数字)
        {
            return Regex.IsMatch($"{value}", "^[0-9]+$")
                ? ValidationResult.Success
                : Error("{0} は数字で入力してください。");
        }

        // 数値入力検証
        if (decimal.TryParse(Types, out var digits) && double.TryParse(Types, out _))
        {
            decimal decimalValue;
            try { decimalValue = Convert.ToDecimal(value); }
            catch (Exception)
            {
                return Error("{0} は数値で入力してください。");
            }
            // 形式検証
            int integerDigits = decimal.ToInt32(Math.Abs(digits));
            if (Math.Log10((double)decimalValue) >= integerDigits)
            {
                return Error("{0} は" + (Types.Contains('.') ? "整数部" : "") + $"{integerDigits}桁以内で入力してください。");
            }
            if (decimalValue < 0 && !Types.StartsWith('-'))
            {
                return Error("{0} にマイナス値は入力できません。");
            }
            if (decimalValue != Math.Floor(decimalValue))
            {
                if (!Types.Contains('.'))
                {
                    return Error("{0} は整数で入力してください。");
                }
                if (int.TryParse(Types[(Types.LastIndexOf('.') + 1)..], out var decimalPlaces)
                    && decimalValue != decimal.Round(decimalValue, decimalPlaces))
                {
                    return Error("{0} は" + $"小数{decimalPlaces}桁以内で入力してください。");
                }
            }
        }

        return ValidationResult.Success;


        // ローカル関数定義：ValidationResult生成
        ValidationResult Error(string message) => new(
            string.Format(CultureInfo.CurrentCulture, message, validationContext?.DisplayName),
            (validationContext?.MemberName is string memberName) ? [memberName] : null
        );
    }
}
