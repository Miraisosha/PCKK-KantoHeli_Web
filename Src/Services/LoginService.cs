using System.Data.Common;
using System.Security.Claims;
using DapperAid;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Src.Common;

namespace Src.Services;

/// <summary>
/// ログインユーザに関する情報／ログイン・ログアウト処理を提供します。
/// </summary>
public class LoginService(DbConnection con, IHttpContextAccessor httpContextAccessor)
{
    #region --- DI ------------------------------------------------------------
    private readonly HttpContext _httpContext = httpContextAccessor.HttpContext!;
    #endregion ----------------------------------------------------------------

    // ------------------------------------------------
    // ログインユーザの情報を返すメソッド各種
    // ------------------------------------------------
    public bool Isログイン済 => !string.IsNullOrEmpty(GetユーザーIdOrNull());
    public string? GetユーザーIdOrNull() => _httpContext!.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    public string GetユーザーId() => GetユーザーIdOrNull() ?? throw new InvalidOperationException("未ログインです。ログイン前提の機能でGetユーザーId()は使用できません。");
    public string? Getユーザー名() => _httpContext.User.Identity?.Name;

    public async Task<T_ユーザー> Getユーザー情報Async()
    {
        return await con.SelectFirstOrDefaultAsync<T_ユーザー>(r => r.ユーザーid == GetユーザーIdOrNull())
            ?? throw new InvalidOperationException("未ログインです。ログイン前提の機能でGetユーザー情報()は使用できません。");
    }

    public string? Get権限() => _httpContext.User.FindFirst(ClaimTypes.Role)?.Value;

    // ------------------------------------------------
    // ログイン実行関連
    // ------------------------------------------------
    /// <summary>
    /// 引数で指定されたユーザid/パスワードでログインを試みます。
    /// </summary>
    /// <param name="userId"></param>
    /// <param name="password"></param>
    /// <returns>ログイン成功時はログインユーザの情報／失敗時はnull</returns>
    public async Task<T_ユーザー?> TryLoginAsync(string userId, string password)
    {
        var user = await con.SelectFirstOrDefaultAsync<T_ユーザー>(
            r => r.ユーザーid == userId
                && r.パスワード == SqlExpr.Eval<string>("CRYPT(", password, $", {nameof(r.パスワード)})")
                && r.deleted_at == null);

        // ログインチェック結果を保存
        var loginResult = new T_ログイン履歴
        {
            ログイン操作日時 = DateTime.Now,
            ユーザーid = userId,
            ログイン成否 = user is not null,
            アプリ名 = GetType().Assembly.GetName().Name!,
            アプリバージョン = GetType().Assembly.GetName().Version!.ToString(),
            remote_addr = _httpContext.Connection.RemoteIpAddress?.ToString(),
            http_user_agent = _httpContext.Request.Headers.UserAgent,
        };
        await con.InsertAsync(loginResult);

        // ログイン失敗なら処理打ち切り
        if (user is null) { return user; }

        // ログイン情報を生成しサインイン
        List<Claim> claims = [
            new Claim(ClaimTypes.NameIdentifier, user.ユーザーid),
            new Claim(ClaimTypes.Name, user.ユーザー名 ?? ""),
        ];
        var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var authProperties = new AuthenticationProperties
        {
            IsPersistent = false,
            AllowRefresh = true,
        };
        await _httpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(claimsIdentity), authProperties);
        return user;
    }

    /// <summary>
    /// ログアウトします。
    /// </summary>
    /// <returns></returns>
    public async Task LogoutAsync()
    {
        await _httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }
}
