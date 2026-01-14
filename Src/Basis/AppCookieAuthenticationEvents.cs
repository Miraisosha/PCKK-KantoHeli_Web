using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http.Extensions;
using Src.Common;
using Src.Services;
using ZLogger;

namespace Src.Basis;

/// <summary>
/// Cookie認証によるログインについて、AppSettingの値を書き換えることで強制的にログインを無効化するための仕組みを提供します。
/// </summary>
public class AppCookieAuthenticationEvents(ILogger<AppCookieAuthenticationEvents> logger, ProviderService provider, LoginService login) : CookieAuthenticationEvents
{
    #region --- DI ------------------------------------------------------------
    private readonly AppSettings _settings = provider.GetSettings();
    #endregion ----------------------------------------------------------------

    public override async Task SigningIn(CookieSigningInContext context)
    {
        // ログイン時のClaimを1項目追加
        context.Principal?.Identities.First().AddClaim(new Claim(ClaimTypes.Authentication, _settings.AuthValidationClaimValue));
        await base.SigningIn(context);
    }

    public override async Task ValidatePrincipal(CookieValidatePrincipalContext context)
    {
        // ログイン時に設定されるべきClaimの値が設定されていなければ強制的にログアウトする
        if (context.Principal?.FindFirstValue(ClaimTypes.Authentication) != _settings.AuthValidationClaimValue)
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        }
    }

    /// <summary>
    /// 権限無し画面へのアクセスでログ出力
    /// </summary>
    /// <param name="context"></param>
    /// <returns></returns>
    public override Task RedirectToAccessDenied(RedirectContext<CookieAuthenticationOptions> context)
    {
        logger.ZLogWarning($"権限無しユーザ「{login.GetユーザーIdOrNull() ?? "(未ログイン)"}」が「{context.Request.GetDisplayUrl()}」へアクセス。");
        return base.RedirectToAccessDenied(context);
    }
}
