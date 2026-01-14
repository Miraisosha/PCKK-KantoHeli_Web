using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;
using System.Reflection;
using Src.Validation.CustomValidators;

namespace Src.Validation;

public partial class InputValidator
{
    // 入力値検証メソッドの非同期版を追加するためpartial化したソースコード。
    // (customValidationをTaskとしてasyncに呼び出せるようにメソッド名/シグニチャを調整している)


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
    public async Task<T> ParseAsync<T>(Expression<Func<string?>> getterExpression, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null)
        where T : class
        => await ParseOrNullAsync(getterExpression, customValidation, additionalValidations, parser) ?? default!;


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
    public async Task<T> ParseAsync<T>(Expression<Func<string?>> getterExpression, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
        => await ParseOrNullAsync(getterExpression, customValidation, additionalValidations, parser) ?? default!;

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
    public async Task<T> ParseAsync<T>(string? value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null)
        where T : class
        => await ParseOrNullAsync(value, getterExpression, customValidation, additionalValidations, parser) ?? default!;

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
    public async Task<T> ParseAsync<T>(string? value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
        => await ParseOrNullAsync(value, getterExpression, customValidation, additionalValidations, parser) ?? default!;

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
    public async Task<T?> ParseOrNullAsync<T>(Expression<Func<string?>> getterExpression, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null)
        where T : class
        => await ParseOrNullAsync(getterExpression.Body.EvaluateValue<string>(), getterExpression, customValidation, additionalValidations, parser);

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
    public async Task<T?> ParseOrNullAsync<T>(Expression<Func<string?>> getterExpression, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
        => await ParseOrNullAsync(getterExpression.Body.EvaluateValue<string>(), getterExpression, customValidation, additionalValidations, parser);

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
    public async Task<T?> ParseOrNullAsync<T>(string? value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null)
        where T : class
    {
        var (result, parsedValue) = await TryParseAsync(value, getterExpression, customValidation, additionalValidations, parser);
        return result ? parsedValue : null;
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
    public async Task<T?> ParseOrNullAsync<T>(string? value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
    {
        var (result, parsedValue) = await TryParseAsync(value, getterExpression, customValidation, additionalValidations, parser);
        return result ? parsedValue : null;
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
    public async Task<(bool, T)> TryParseAsync<T>(string? value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, Func<string?, (T parsedValue, string? errorMessageTemplate)>? parser = null)
        where T : notnull
    {
        var itemValidator = CreateItemValidator(value, getterExpression, additionalValidations);

        // 入力値検証実施
        if (itemValidator.Validate(value) is ValidationResult error)
        {
            _validationResults.Add(error);
            return (false, default!);
        }
        // 入力値が空ならparseせずにfalseを返す
        if (string.IsNullOrEmpty(value))
        {
            return (false, default!);
        }

        // 改行文字があれば\nに正規化する。いまどき\rのみで改行している環境のことは考慮しない
        if (value.Contains('\r'))
        {
            value = value.Replace("\r", "");
        }

        // 型変換を試みる
        T parsedValue;
        if (parser != null)
        {
            (parsedValue, string? errorMessageTemplate) = parser(value);
            if (errorMessageTemplate is not null)
            {
                _validationResults.Add(itemValidator.CreateError(errorMessageTemplate));
                return (false, parsedValue);
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
                return (false, parsedValue);
            }
        }
        // カスタム検証が指定されていれば実施
        if (customValidation is not null && await customValidation(parsedValue) is string errorMessage)
        {
            _validationResults.Add(itemValidator.CreateError(errorMessage));
        }
        // 型変換後の値を戻り値として返す
        return (true, parsedValue);
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
    public async Task<T> ValidateNotNullAsync<T>(Expression<Func<T?>> getterExpression, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : class
        => await ValidateNotNullAsync(getterExpression.Body.EvaluateValue<T?>()!, getterExpression, customValidation, additionalValidations);

    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="getterExpression">入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public async Task<T> ValidateNotNullAsync<T>(Expression<Func<T?>> getterExpression, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : struct
        => await ValidateNotNullAsync(getterExpression.Body.EvaluateValue<T?>(), getterExpression, customValidation, additionalValidations);

    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public async Task<T> ValidateNotNullAsync<T>(T? value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : class
    {
        if (await GetValidationResult<T>(value, getterExpression, customValidation, additionalValidations) is ValidationResult error)
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
    public async Task<T> ValidateNotNullAsync<T>(T? value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : struct
    {
        if (await GetValidationResult<T>(value, getterExpression, customValidation, additionalValidations) is ValidationResult error)
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
    public async Task<T> ValidateAsync<T>(Expression<Func<T>> getterExpression, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : class
        => await ValidateAsync(getterExpression.Body.EvaluateValue<T>()!, getterExpression, customValidation, additionalValidations);

    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="getterExpression">入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public async Task<T> ValidateAsync<T>(Expression<Func<T>> getterExpression, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
        => await ValidateAsync(getterExpression.Body.EvaluateValue<T>()!, getterExpression, customValidation, additionalValidations);

    /// <summary>
    /// 引数で指定された入力項目の入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="getterExpression">入力値を取得するラムダ式</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public async Task<T?> ValidateAsync<T>(Expression<Func<T?>> getterExpression, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : struct
        => await ValidateAsync(getterExpression.Body.EvaluateValue<T?>(), getterExpression, customValidation, additionalValidations);

    /// <summary>
    /// 引数で指定された入力値を検証し、エラーがあればエラー一覧に追加します。
    /// </summary>
    /// <typeparam name="T">入力値の型</typeparam>
    /// <param name="value">入力値</param>
    /// <param name="getterExpression">入力値の取得元項目を表現するラムダ式（検証属性の把握に使用）</param>
    /// <param name="customValidation">カスタム検証処理</param>
    /// <param name="additionalValidations">追加で検証すべき検証属性</param>
    /// <returns>引数で指定された入力値をそのまま返す</returns>
    public async Task<T> ValidateAsync<T>(T value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null)
        where T : class
    {
        if (await GetValidationResult(value, getterExpression, customValidation, additionalValidations) is ValidationResult error)
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
    public async Task<T> ValidateAsync<T>(T value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
    {
        if (await GetValidationResult(value, getterExpression, customValidation, additionalValidations) is ValidationResult error)
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
    public async Task<T?> ValidateAsync<T>(T? value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null, object? 値型Parse処理用dummy引数 = null)
        where T : struct
    {
        if (await GetValidationResult(value, getterExpression, customValidation, additionalValidations) is ValidationResult error)
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
    public async Task<ValidationResult?> GetValidationResult<T>(T? value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null)
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
        if (value is not null && customValidation is not null && await customValidation(value) is string errorMessage)
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
    public async Task<ValidationResult?> GetValidationResult<T>(T? value, LambdaExpression? getterExpression = null, Func<T, Task<string?>>? customValidation = null, Attribute?[]? additionalValidations = null)
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
        if (value is not null && customValidation is not null && await customValidation(value.Value) is string errorMessage)
        {
            return itemValidator.CreateError(errorMessage);
        }
        //
        return null;
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
