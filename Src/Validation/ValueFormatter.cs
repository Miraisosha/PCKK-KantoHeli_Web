using System.Linq.Expressions;
using System.Reflection;
using Src.Validation.CustomValidators;

namespace Src.Validation;

/// <summary>
/// 書式設定クラス。
/// AcceptAttributeの設定に基づき値を書式設定します。
/// </summary>
/// <param name="isDisplayMode">表示専用モードで書式設定する場合はtrue</param>
public class ValueFormatter(bool isDisplayMode = false)
{
    /// <summary>
    /// 設定対象のプロパティ項目に値をセットします。
    /// </summary>
    /// <param name="value">設定値</param>
    /// <param name="setTargetExpression">設定対象のプロパティ項目を指すラムダ式</param>
    /// <exception cref="ArgumentException">ラムダ式がプロパティ項目を指していない場合</exception>
    public void Set<T>(T value, Expression<Func<T>> setTargetExpression)
    {
        // 設定対象のプロパティを把握
        var expression = setTargetExpression.Body;
        while (expression is UnaryExpression unary && expression.NodeType == ExpressionType.Convert)
        {
            expression = unary.Operand;
        }
        MemberExpression me = expression as MemberExpression
            ?? throw new ArgumentException("設定対象のプロパティ項目をラムダ式で指定してください。", nameof(setTargetExpression));
        // 設定対象のオブジェクトを把握し値設定
        object? instance = me.Expression?.EvaluateValue();
        MemberInfo mi = me.Member;
        if (mi is PropertyInfo pi)
        {
            pi.SetValue(instance, value);
        }
        else if (mi is FieldInfo fi)
        {
            fi.SetValue(instance, value);
        }
        else
        {
            throw new ArgumentException("設定対象の項目がプロパティではありません。", nameof(setTargetExpression));
        }
    }

    /// <summary>
    /// 設定対象のプロパティ項目に値を書式設定してセットします。
    /// </summary>
    /// <param name="value">設定値</param>
    /// <param name="setTargetExpression">設定対象のプロパティ項目を指すラムダ式</param>
    /// <exception cref="ArgumentException">ラムダ式がプロパティ項目を指していない場合</exception>
    public void Set(object? value, Expression<Func<string?>> setTargetExpression)
    {
        // 設定対象のプロパティを把握
        var expression = setTargetExpression.Body;
        while (expression is UnaryExpression unary && expression.NodeType == ExpressionType.Convert)
        {
            expression = unary.Operand;
        }
        MemberExpression me = expression as MemberExpression
            ?? throw new ArgumentException("設定対象のプロパティ項目をラムダ式で指定してください。", nameof(setTargetExpression));
        // 設定対象のオブジェクトを把握し値設定
        object? instance = me.Expression?.EvaluateValue();
        MemberInfo mi = me.Member;
        if (mi is PropertyInfo pi)
        {
            pi.SetValue(instance, Format(setTargetExpression, value));
        }
        else if (mi is FieldInfo fi)
        {
            fi.SetValue(instance, Format(setTargetExpression, value));
        }
        else
        {
            throw new ArgumentException("設定対象の項目がプロパティではありません。", nameof(setTargetExpression));
        }
    }

    /// <summary>
    /// 設定対象のプロパティ項目の書式に基づき値を書式設定して返します。
    /// </summary>
    /// <param name="setTargetExpression">設定対象のプロパティ項目を指すラムダ式</param>
    /// <param name="value">値</param>
    /// <returns>書式設定後の表示値</returns>
    /// <exception cref="ArgumentException">ラムダ式がプロパティ項目を指していない場合</exception>
    public string? Format(LambdaExpression setTargetExpression, object? value)
    {
        // 設定対象のプロパティを把握
        MemberInfo mi = (setTargetExpression?.Body as MemberExpression)?.Member
            ?? throw new ArgumentException("設定対象のプロパティ項目をラムダ式で指定してください。", nameof(setTargetExpression));

        return Format(mi.GetCustomAttribute<AcceptAttribute>(), value);
    }

    /// <summary>
    /// 引数の入力可能文字種属性の書式に基づき値を書式設定して返します。
    /// </summary>
    /// <param name="attr">入力可能文字種属性</param>
    /// <param name="value">値</param>
    /// <returns>書式設定後の表示値</returns>
    public string? Format(AcceptAttribute? attr, object? value)
    {
        return attr?.GetFormat(isDisplayMode) is string format
            ? string.Format("{0:" + format + "}", value)
            : $"{value}";
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
