using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Linq.Expressions;
using System.Reflection;
using Src.Validation.CustomValidators;
using ZLogger;

namespace Src.Validation;

/// <summary>
/// 入力値検証機能。
/// 検証対象プロパティの属性、および引数で追加指定された検証属性／カスタム検証処理による検証を実施します。
/// </summary>
/// <param name="logger"></param>
/// <param name="provider">ServiceProvider（検証等で一切ServiceProviderを使わないようであればnullでもよい）</param>
/// <remarks>
///
/// 以下共通事項：
///
/// ・入力検証にあたり、
///   入力項目の入力値を取得するラムダ式（入力値の取得元項目を表現するラムダ式）をもとに
///   そのプロパティ/フィールドに指定された検証属性に基づく検証が行われ、
///   エラーがある場合には当該フィールド名に紐づいた検証エラーオブジェクトが生成される。
///   （検証エラーオブジェクトの項目名に「Input.」のプレフィックスも付加したい場合は
///     CurrentMemberNamePrefixにその値を指定すること）
///
/// ・入力項目の入力値を取得するラムダ式（入力値の取得元項目を表現するラムダ式）は、
/// 　「() => Input.登録年月日」のようなプロパティorフィールド値を単純取得するもののみ使用可能である。
/// 　（ローカル変数の指定、三項演算子による取得元項目分岐などを指定すると例外となる）
///
/// ・ただし特例として、
///   「() => Input.商品明細_個数[i]」による配列添字/List等のindexerへのアクセスは許容する。
///   この場合には配列自体に指定されている検証属性が各添字の保持値の検証に利用される。
///   （厳密には検証属性の使い方として正しくなくなってしまうのだが、開発の簡便のため妥協する）
///   検証エラーオブジェクトの項目名にも「商品明細_個数[2]」のようにindex値が自動付加される。
///
/// ・エラーメッセージはValidationMessageLocalizerクラスにより日本語化される前提である。
///   また利用可能な検証属性は上記クラスに記載ある属性とすること。
///   （記載ない検証属性を利用する場合にはエラーメッセージを上記クラスに追加すること）
///
/// ・インスタンスは原則としてProviderService.CreateValidator()により取得すること。
///
/// <remarks>
public partial class InputValidator(ILogger? logger, IServiceProvider? provider)
{
    #region --- DI ------------------------------------------------------------
    private readonly ILogger? _logger = logger;
    private readonly IServiceProvider? _provider = provider;
    #endregion ----------------------------------------------------------------

    /// <summary>
    /// 検出された入力エラーです。
    /// </summary>
    public IReadOnlyList<ValidationResult> Errors => _validationResults;

    /// <summary>
    /// 検出された入力エラーメッセージをAP共通のErrorJsonにして返します。
    /// </summary>
    /// <returns></returns>
    public dynamic GetErrorJson(string? headText = "入力値に誤りがあります：")
    {
        return new
        {
            error = headText + Environment.NewLine + "・" + string.Join(Environment.NewLine + "・", _validationResults.Select(v => v.ErrorMessage)),
            erroritems = GetErrorItemNames(),
        };
    }

    /// <summary>
    /// 入力エラーが検出された項目名の一覧を返します。
    /// </summary>
    /// <returns></returns>
    public IEnumerable<string> GetErrorItemNames() => _validationResults.SelectMany(r => r.MemberNames).Distinct();


    // --------------------------------------------------------------------------------------------
    // 以下、エラーメッセージ追加関連
    // --------------------------------------------------------------------------------------------

    // ※入力エラーはこのクラス内からのみ追加可能としておく。
    private readonly List<ValidationResult> _validationResults = [];

    /// <summary>
    /// エラーメッセージの冒頭に付加する項目名の接頭語を設定します。
    /// </summary>
    public string? CurrentDisplayNamePrefix { get; set; } //= null;

    /// <summary>
    /// エラーオブジェクトの項目名冒頭に付加する値（「Input.」など）を設定します。
    /// </summary>
    public string? CurrentMemberNamePrefix { get; set; } //= null;


    /// <summary>
    /// 入力項目に紐づかないエラーメッセージをエラー一覧に追加します。
    /// </summary>
    /// <param name="errorMessage"></param>
    public void AddError(string errorMessage)
    {
        _validationResults.Add(new ValidationResult(errorMessage));
    }

    /// <summary>
    /// 入力項目を明示的に指定したエラーメッセージをエラー一覧に追加します。
    /// </summary>
    /// <param name="itemFullName">エラーとする項目名（エラーオブジェクトの項目名冒頭に付加する文字列がある場合はそれも指定すること）</param>
    /// <param name="errorMessage"></param>
    public void AddError(string itemFullName, string errorMessage)
    {
        _validationResults.Add(new ValidationResult(errorMessage, [itemFullName]));
    }

    /// <summary>
    /// 引数で指定された入力項目に紐づくエラーメッセージをエラー一覧に追加します。
    /// </summary>
    /// <param name="getterExpression">入力項目の入力値を取得するラムダ式</param>
    /// <param name="errorMessageTemplate">エラーメッセージ雛形（{0}を入力項目名に置き換え）</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性（入力項目名を属性で上書きする場合に指定）</param>
    public void AddError(LambdaExpression getterExpression, string errorMessageTemplate, Attribute?[]? additionalValidations = null)
    {
        var itemValidator = CreateItemValidator(this, getterExpression, additionalValidations);
        _validationResults.Add(itemValidator.CreateError(errorMessageTemplate));
    }


    // --------------------------------------------------------------------------------------------
    // 以下、型変換を伴う検証メソッド各種
    // --------------------------------------------------------------------------------------------
    // ※Parse処理を参照型/値型で別メソッドとしておく必要があるが、
    //   C#においては型パラメータ制約違いの同一シグニチャメソッドを定義できないという制約があるため
    //   値型のメソッド引数末尾にダミー引数を追加することで対応した

    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// 型指定の型へ変換した値を戻り値として返します。
    /// </summary>
    /// <typeparam name="T">変換後の型</typeparam>
    /// <param name="getterExpression">入力項目の入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <param name="parser">型変換メソッドを明示的に指定する場合は、文字列を引数にとり、（変換後の値, 変換失敗時のエラーメッセージ雛形）を返す処理</param>
    /// <returns>型変換後の値、ただし未入力の場合／型変換等に失敗した場合はdefault!</returns>
    public T Parse<T>(Expression<Func<string?>> getterExpression, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null)
        where T : class
        => ParseOrNull(getterExpression, customValidation, additionalValidations, parser) ?? default!;


    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// 型指定の型へ変換した値を戻り値として返します。
    /// </summary>
    /// <typeparam name="T">変換後の型</typeparam>
    /// <param name="getterExpression">入力項目の入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <param name="parser">型変換メソッドを明示的に指定する場合は、文字列を引数にとり、（変換後の値, 変換失敗時のエラーメッセージ雛形）を返す処理</param>
    /// <returns>型変換後の値、ただし未入力の場合／型変換等に失敗した場合はdefault!</returns>
    public T Parse<T>(Expression<Func<string?>> getterExpression, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
        => ParseOrNull(getterExpression, customValidation, additionalValidations, parser) ?? default!;

    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// 型指定の型へ変換した値を戻り値として返します。
    /// </summary>
    /// <typeparam name="T">変換後の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <param name="parser">型変換メソッドを明示的に指定する場合は、文字列を引数にとり、（変換後の値, 変換失敗時のエラーメッセージ雛形）を返す処理</param>
    /// <returns>型変換後の値、ただし未入力の場合／型変換等に失敗した場合はdefault!</returns>
    public T Parse<T>(string? value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null)
        where T : class
        => ParseOrNull(value, getterExpression, customValidation, additionalValidations, parser) ?? default!;

    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// 型指定の型へ変換した値を戻り値として返します。
    /// </summary>
    /// <typeparam name="T">変換後の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <param name="parser">型変換メソッドを明示的に指定する場合は、文字列を引数にとり、（変換後の値, 変換失敗時のエラーメッセージ雛形）を返す処理</param>
    /// <returns>型変換後の値、ただし未入力の場合／型変換等に失敗した場合はdefault!</returns>
    public T Parse<T>(string? value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
        => ParseOrNull(value, getterExpression, customValidation, additionalValidations, parser) ?? default!;

    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// 型指定の型へ変換した値を戻り値として返します。
    /// </summary>
    /// <typeparam name="T">変換後の型</typeparam>
    /// <param name="getterExpression">入力項目の入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <param name="parser">型変換メソッドを明示的に指定する場合は、文字列を引数にとり、（変換後の値, 変換失敗時のエラーメッセージ雛形）を返す処理</param>
    /// <returns>型変換後の値、ただし未入力の場合／型変換等に失敗した場合はnull</returns>
    public T? ParseOrNull<T>(Expression<Func<string?>> getterExpression, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null)
        where T : class
        => ParseOrNull(getterExpression.Body.EvaluateValue<string>(), getterExpression, customValidation, additionalValidations, parser);

    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// 型指定の型へ変換した値を戻り値として返します。
    /// </summary>
    /// <typeparam name="T">変換後の型</typeparam>
    /// <param name="getterExpression">入力項目の入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <param name="parser">型変換メソッドを明示的に指定する場合は、文字列を引数にとり、（変換後の値, 変換失敗時のエラーメッセージ雛形）を返す処理</param>
    /// <returns>型変換後の値、ただし未入力の場合／型変換等に失敗した場合はnull</returns>
    public T? ParseOrNull<T>(Expression<Func<string?>> getterExpression, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
        => ParseOrNull(getterExpression.Body.EvaluateValue<string>(), getterExpression, customValidation, additionalValidations, parser);

    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// 型指定の型へ変換した値を戻り値として返します。
    /// </summary>
    /// <typeparam name="T">変換後の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <param name="parser">型変換メソッドを明示的に指定する場合は、文字列を引数にとり、（変換後の値, 変換失敗時のエラーメッセージ雛形）を返す処理</param>
    /// <returns>型変換後の値、ただし未入力の場合／型変換等に失敗した場合はnull</returns>
    public T? ParseOrNull<T>(string? value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null)
        where T : class
    {
        return TryParse(out var parsedValue, value, getterExpression, customValidation, additionalValidations, parser) ? parsedValue : null;
    }

    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// 型指定の型へ変換した値を戻り値として返します。
    /// </summary>
    /// <typeparam name="T">変換後の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <param name="parser">型変換メソッドを明示的に指定する場合は、文字列を引数にとり、（変換後の値, 変換失敗時のエラーメッセージ雛形）を返す処理</param>
    /// <returns>型変換後の値、ただし未入力の場合／型変換等に失敗した場合はnull</returns>
    public T? ParseOrNull<T>(string? value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
    {
        return TryParse(out var parsedValue, value, getterExpression, customValidation, additionalValidations, parser) ? parsedValue : null;
    }


    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// 型変換できなかった場合／入力値が空だった場合はfalseを返します。
    /// </summary>
    /// <typeparam name="T">変換後の型</typeparam>
    /// <param name="ParseOrNull">型変換後の値</param>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <param name="parser">型変換メソッドを明示的に指定する場合は、文字列を引数にとり、（変換後の値, 変換失敗時のエラーメッセージ雛形）を返す処理</param>
    /// <returns>型変換後の値、ただし未入力の場合／型変換等に失敗した場合はnull</returns>
    public bool TryParse<T>(out T parsedValue, string? value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null)
        where T : notnull
    {
        var itemValidator = CreateItemValidator(value, getterExpression, additionalValidations);

        // 入力値検証実施
        if (itemValidator.Validate(value) is ValidationResult error)
        {
            _validationResults.Add(error);
            parsedValue = default!;
            return false;
        }
        // 入力値が空ならparseせずにfalseを返す
        if (string.IsNullOrEmpty(value))
        {
            parsedValue = default!;
            return false;
        }

        // 改行文字があれば\nに正規化する。いまどき\rのみで改行している環境のことは考慮しない
        if (value.Contains('\r'))
        {
            value = value.Replace("\r", "");
        }

        // 型変換を試みる
        if (parser != null)
        {
            (parsedValue, string? errorMessageTemplate) = parser(value);
            if (errorMessageTemplate is not null)
            {
                _validationResults.Add(itemValidator.CreateError(errorMessageTemplate));
                return false;
            }
        }
        else
        {
            try
            {
                parsedValue = (T)TypeDescriptor.GetConverter(typeof(T)).ConvertFrom(value)!;
            }
            catch (Exception ex)
            {
                if (ex.InnerException is OverflowException)
                {
                    _validationResults.Add(itemValidator.CreateError("{0} の入力値が大きすぎます。"));
                }
                else
                {
                    // AcceptAttributeのエラーメッセージが設定されていればそれを準用、なければ固定エラーメッセージ
                    var acceptErrorMessage = itemValidator.Attributes.OfType<AcceptAttribute>().FirstOrDefault()?.ErrorMessage;
                    if (string.IsNullOrEmpty(acceptErrorMessage)) { acceptErrorMessage = "{0} の入力値の形式が正しくありません。"; }
                    _validationResults.Add(itemValidator.CreateError(acceptErrorMessage));
                }
                parsedValue = default!;
                return false;
            }
        }
        // カスタム検証が指定されていれば実施
        if (customValidation is not null && customValidation(parsedValue) is string errorMessage)
        {
            _validationResults.Add(itemValidator.CreateError(errorMessage));
        }
        // 型変換後の値を戻り値として返す
        return true;
    }


    // --------------------------------------------------------------------------------------------
    // 以下、型変換を伴わない検証メソッド各種
    // --------------------------------------------------------------------------------------------
    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="getterExpression">入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public T ValidateNotNull<T>(Expression<Func<T?>> getterExpression, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : class
        => ValidateNotNull(getterExpression.Body.EvaluateValue<T?>()!, getterExpression, customValidation, additionalValidations);

    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="getterExpression">入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public T ValidateNotNull<T>(Expression<Func<T?>> getterExpression, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : struct
        => ValidateNotNull(getterExpression.Body.EvaluateValue<T?>(), getterExpression, customValidation, additionalValidations);

    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public T ValidateNotNull<T>(T? value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : class
    {
        if (GetValidationResult<T>(value, getterExpression, customValidation, additionalValidations) is ValidationResult error)
        {
            _validationResults.Add(error);
        }
        return value!;
    }

    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public T ValidateNotNull<T>(T? value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : struct
    {
        if (GetValidationResult<T>(value, getterExpression, customValidation, additionalValidations) is ValidationResult error)
        {
            _validationResults.Add(error);
        }
        return value.GetValueOrDefault();
    }

    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="getterExpression">入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public T Validate<T>(Expression<Func<T>> getterExpression, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : class
        => Validate(getterExpression.Body.EvaluateValue<T>()!, getterExpression, customValidation, additionalValidations);

    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="getterExpression">入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public T Validate<T>(Expression<Func<T>> getterExpression, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
        => Validate(getterExpression.Body.EvaluateValue<T>()!, getterExpression, customValidation, additionalValidations);

    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="getterExpression">入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public T? Validate<T>(Expression<Func<T?>> getterExpression, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : struct
        => Validate(getterExpression.Body.EvaluateValue<T?>(), getterExpression, customValidation, additionalValidations);

    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public T Validate<T>(T value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : class
    {
        if (GetValidationResult(value, getterExpression, customValidation, additionalValidations) is ValidationResult error)
        {
            _validationResults.Add(error);
        }
        return value;
    }

    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public T Validate<T>(T value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
    {
        if (GetValidationResult(value, getterExpression, customValidation, additionalValidations) is ValidationResult error)
        {
            _validationResults.Add(error);
        }
        return value;
    }

    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public T? Validate<T>(T? value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
    {
        if (GetValidationResult(value, getterExpression, customValidation, additionalValidations) is ValidationResult error)
        {
            _validationResults.Add(error);
        }
        return value;
    }

    /// <summary>
    /// 引数で指定された入力値の検証を行い検証結果を返します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>検証エラーがあればそのエラー</returns>
    public ValidationResult? GetValidationResult<T>(T? value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : class
    {
        // 単項目検証オブジェクト生成
        var itemValidator = CreateItemValidator(value, getterExpression, additionalValidations);

        // 入力値検証実施
        if (itemValidator.Validate(value) is ValidationResult error)
        {
            return error;
        }
        // カスタム検証が指定されていれば実施
        if (value is not null && customValidation is not null && customValidation(value) is string errorMessage)
        {
            return itemValidator.CreateError(errorMessage);
        }
        //
        return null;
    }

    /// <summary>
    /// 引数で指定された入力値の検証を行い検証結果を返します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>検証エラーがあればそのエラー</returns>
    public ValidationResult? GetValidationResult<T>(T? value, LambdaExpression? getterExpression = null, Func<T, string?>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : struct
    {
        // 単項目検証オブジェクト生成
        var itemValidator = CreateItemValidator(value, getterExpression, additionalValidations);

        // 入力値検証実施
        if (itemValidator.Validate(value) is ValidationResult error)
        {
            return error;
        }
        // カスタム検証が指定されていれば実施
        if (value is not null && customValidation is not null && customValidation(value.Value) is string errorMessage)
        {
            return itemValidator.CreateError(errorMessage);
        }
        //
        return null;
    }

    // --------------------------------------------------------------------------------------------
    // 以下、内部処理
    // --------------------------------------------------------------------------------------------

    /// <summary>
    /// private：単項目検証オブジェクトを生成します。
    /// </summary>
    /// <param name="value">検証対象の値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="additionalValidations">付加検証属性</param>
    /// <returns>単項目検証オブジェクト</returns>
    private ItemValidator CreateItemValidator(object? value, LambdaExpression? getterExpression, Attribute?[]? additionalValidations)
    {
        // 取得元項目のプロパティを把握
        Expression? expression = getterExpression?.Body;
        while (expression is UnaryExpression unary && expression.NodeType == ExpressionType.Convert)
        {
            expression = unary.Operand;
        }
        MemberInfo? mi = (expression as MemberExpression)?.Member;
        object? arrayIndex = null;

        if (mi == null && expression is not null)
        {
            if (expression is BinaryExpression be && be.NodeType == ExpressionType.ArrayIndex && be.Left is MemberExpression beMe)
            {
                // 取得元項目が配列[添字]の場合
                mi = beMe.Member;
                arrayIndex = be.Right.EvaluateValue(); // ※DapperAid内のヘルパーメソッドを呼び出して添え字の具体的な値を取得
            }
            else if (expression is MethodCallExpression mce && mce.Object is MemberExpression mceMe && mce.Method.Name == "get_Item" && mce.Arguments.Count == 1)
            {
                // 取得元項目がコレクション[添字]の場合
                mi = mceMe.Member;
                arrayIndex = mce.Arguments[0].EvaluateValue(); ; // ※DapperAid内のヘルパーメソッドを呼び出して添え字の具体的な値を取得
            }
            else
            {
                _logger?.ZLogWarning($"入力値の取得元項目を表現するラムダ式から取得元項目が特定できません：{getterExpression?.Body}");
            }
        }

        // 属性を把握（当該メンバーの属性＋ロジックで追加指定された属性）
        List<Attribute> attributes = [];
        if (mi != null)
        {
            attributes.AddRange(mi.GetCustomAttributes());
            if (attributes.OfType<UneditableAttribute>().Any())
            {
                _logger?.ZLogWarning($"Uneditable編集不可項目を入力検証しています。修正してください：{getterExpression?.Body}");
            }
        }

        foreach (var attr in additionalValidations?.OfType<Attribute>() ?? [])
        {
            if (attr.GetType().GetCustomAttribute<AttributeUsageAttribute>()?.AllowMultiple != true
                && attributes.FindIndex(a => a.GetType() == attr.GetType()) is int index
                && index >= 0)
            {
                attributes[index] = attr; // 重複不可の属性が追加で指定されていた場合は置き換え
            }
            else
            {
                attributes.Add(attr); // そうでなければ属性付加
            }
        }

        // 検証コンテキストを作成
        ValidationContext validationContext = new(value ?? new object(), _provider, null);
        // DisplayNameを決定
        if (attributes.OfType<DisplayAttribute>().FirstOrDefault()?.Name is string displayName)
        {
            validationContext.DisplayName = $"{CurrentDisplayNamePrefix}{displayName}";
        }
        else if (mi?.Name is not null)
        {
            validationContext.DisplayName = $"{CurrentDisplayNamePrefix}{mi.Name}";
        }
        // MemberNameを決定
        if (attributes.OfType<MemberNameAttribute>().FirstOrDefault() is { } memberName)
        {
            validationContext.MemberName = $"{memberName.OverwritePrefix ?? CurrentMemberNamePrefix}{memberName.OverwriteName ?? mi?.Name}";
            arrayIndex = memberName.Index;
        }
        else if (mi?.Name is not null)
        {
            validationContext.MemberName = $"{CurrentMemberNamePrefix}{mi.Name}";
        }
        // 添字指定有なら添字も追加
        if (arrayIndex is not null)
        {
            validationContext.MemberName += $"[{arrayIndex}]";
        }

        // 単項目検証オブジェクトを生成して返す
        return new ItemValidator(validationContext, attributes);
    }


    /// <summary>
    /// private：単項目検証クラス
    /// </summary>
    private class ItemValidator
    {
        /// <summary>検証コンテキスト</summary>
        public readonly ValidationContext Context;

        /// <summary>検証すべき属性</summary>
        public readonly List<Attribute> Attributes;

        // 必須チェック属性
        private readonly RequiredAttribute? _requiredAttribute = null;

        // 入力形式チェック属性
        private readonly AcceptAttribute? _acceptAttribute = null;

        /// <summary>
        /// コンストラクタ
        /// </summary>
        /// <param name="context"></param>
        /// <param name="attributes"></param>
        public ItemValidator(ValidationContext context, List<Attribute> attributes)
        {
            Context = context;
            Attributes = attributes;

            // 検証属性のエラーメッセージをローカライズ、必須チェック／入力可能文字チェックを把握
            foreach (var attr in attributes.OfType<ValidationAttribute>())
            {
                ValidationMessageLocalizer.Localize(attr);
                _requiredAttribute ??= attr as RequiredAttribute;
                _acceptAttribute ??= attr as AcceptAttribute;
            }
            // ただしBypassRequiredAttributeの指定がある場合は必須チェックを省略
            if (attributes.Any(a => a is BypassRequiredAttribute))
            {
                _requiredAttribute = null;
            }
        }

        /// <summary>
        /// 入力チェックを実施
        /// </summary>
        /// <returns></returns>
        public ValidationResult? Validate(object? value)
        {
            // まず最初に必須チェック/入力可能文字チェック
            ValidationResult? error =
                _requiredAttribute?.GetValidationResult(value, Context)
                ?? _acceptAttribute?.GetValidationResult(value, Context);
            if (error != null) { return error; }

            // 必須チェック/入力可能文字チェック以外のチェックを実施
            foreach (var attr in Attributes.OfType<ValidationAttribute>())
            {
                if (attr is not RequiredAttribute && attr is not AcceptAttribute)
                {
                    error = attr.GetValidationResult(value, Context);
                    if (error != null) { return error; }
                }
            }
            return null;
        }

        /// <summary>
        /// バリデーションエラーを生成
        /// </summary>
        /// <param name="message"></param>
        /// <returns></returns>
        public ValidationResult CreateError(string message) => new(
            string.Format(CultureInfo.CurrentCulture, message, Context?.DisplayName),
            (Context?.MemberName is string memberName) ? [memberName] : null);
    }
}

// ------------------------------------------------------------------------------------------------
// 以下、DapperAid.Helpers.ExpressionHelperを参照せずに使用できるようにするためfile classとして定義
// ------------------------------------------------------------------------------------------------
/// <summary>
/// Expressionについてのヘルパーメソッドを提供します。
/// </summary>
file static class ExpressionHelper
{
    /// <summary>
    /// 式木が表している具体的な値を返します。
    /// </summary>
    /// <param name="exp">値を指定している式木</param>
    /// <returns>値</returns>
    public static T? EvaluateValue<T>(this Expression exp) => (T?)EvaluateValue(exp);

    /// <summary>
    /// 式木が表している具体的な値を返します。
    /// </summary>
    /// <param name="exp">値を指定している式木</param>
    /// <returns>値</returns>
    public static object? EvaluateValue(this Expression exp)
    {
        // Boxingを展開
        var expression = exp;
        while (expression is UnaryExpression unary && expression.NodeType == ExpressionType.Convert)
        {
            expression = unary.Operand;
        }

        if (expression is ConstantExpression constantExpression)
        {   // 定数：値を返す
            return constantExpression.Value;
        }
        if (expression is NewExpression newExpression)
        {   // インスタンス生成：生成されたインスタンスを返す
            var parameters = newExpression.Arguments.Select(EvaluateValue).ToArray();
            return newExpression.Constructor!.Invoke(parameters);
        }
        if (expression is NewArrayExpression newArrayExpression)
        {   // 配列生成：生成された配列を返す
            return newArrayExpression.Expressions.Select(EvaluateValue).ToArray();
        }
        if (expression is MethodCallExpression methodCallExpression)
        {   // メソッド呼び出し：呼び出し結果を返す
            var parameters = methodCallExpression.Arguments.Select(EvaluateValue).ToArray();
            var obj = (methodCallExpression.Object == null) ? null : EvaluateValue(methodCallExpression.Object);
            if (obj is null && methodCallExpression.Object is not null && Nullable.GetUnderlyingType(methodCallExpression.Object!.Type) is not null)
            {   // 2022.12 null許容値型のnullである場合はメソッド呼び出しができないので、メソッド名に応じた値を自前で返す。
                return methodCallExpression.Method.Name switch
                {
                    "GetValueOrDefault" => (parameters.Length > 0) ? parameters[0] : Activator.CreateInstance(methodCallExpression.Method.ReturnType),
                    "GetHashCode" => 0,
                    _ => throw new NullReferenceException(methodCallExpression.Method.DeclaringType?.FullName + "." + methodCallExpression.Method.Name),
                };
            }
            return methodCallExpression.Method.Invoke(obj, parameters);
        }
        if (expression is InvocationExpression invocation)
        {   // ラムダ等の呼び出し：呼び出し結果を返す
            var parameters = invocation.Arguments.Select(x => Expression.Parameter(x.Type)).ToArray();
            var arguments = invocation.Arguments.Select(EvaluateValue).ToArray();
            var lambda = Expression.Lambda(invocation, parameters);
            return lambda.Compile().DynamicInvoke(arguments);
        }
        if (expression is BinaryExpression binaryExpression)
        {
            if (expression.NodeType == ExpressionType.ArrayIndex)
            {   // 配列等のインデクサ：そのインデックスの値を返す
                var array = (Array)EvaluateValue(binaryExpression.Left)!;
                var index = Convert.ToInt64(EvaluateValue(binaryExpression.Right));
                return array.GetValue(index);
            }
            if (expression.NodeType == ExpressionType.Coalesce)
            {   // null結合：null結合結果を返す
                return EvaluateValue(binaryExpression.Left) ?? EvaluateValue(binaryExpression.Right);
            }
        }
        if (expression is ConditionalExpression conditional)
        {   // 三項演算子：評価結果に応じた値を返す
            return (EvaluateValue(conditional.Test)) switch
            {
                true => EvaluateValue(conditional.IfTrue),
                _ => EvaluateValue(conditional.IfFalse),
            };
        }

        // メンバ（フィールドまたはプロパティ）：プロパティ/フィールド値を取り出す
        // ※インスタンスメンバならインスタンス値を再帰把握
        if (expression is MemberExpression member)
        {
            if (member.Member is PropertyInfo pi)
            {
                return (member.Expression is not null)
                    ? EvaluateValue(member.Expression) switch
                    {
                        null => pi.Name switch
                        {   // 2022.12 null許容値型のnullである場合はプロパティにアクセスできないので、プロパティ名に応じた値を自前で返す。
                            "HasValue" => false,
                            _ => throw new NullReferenceException(pi.DeclaringType?.FullName + "." + pi.Name),
                        },
                        object obj => pi.GetValue(obj),
                    }
                    : pi.GetValue(null);
            }
            if (member.Member is FieldInfo fi)
            {
                return (member.Expression is not null && EvaluateValue(member.Expression) is object obj)
                    ? fi.GetValue(obj)
                    : fi.GetValue(null);
            }
        }

        // ここまでの処理で値を特定できなかった：実行して値を取り出す
        return Expression.Lambda(expression!).Compile().DynamicInvoke();
    }
}
