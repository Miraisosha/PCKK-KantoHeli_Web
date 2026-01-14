using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Src.Services;
using ZLogger;

namespace Src.WebAPI;

/// <summary>
/// ログイン/ログアウトを行うWebAPI
/// </summary>
/// <remarks>
/// _Layout.csのhtmlに従いsite.jsより呼び出される
/// <remarks>
[ApiController]
public class LoginAPI(LoginService login) : ControllerBase
{
    /// <summary>
    /// ajax(post): ログイン
    /// </summary>
    [HttpPost]
    [Route("api/Login")]
    public async Task<IActionResult> Login([FromForm] string id, [FromForm] string pw)
    {
        return await login.TryLoginAsync(id, pw) is not null
            ? new OkResult()
            : BadRequest("ID/PWが正しくありません。ログインできません。");
    }

    /// <summary>
    /// ajax(get): ログアウトしトップ画面にリダイレクト
    /// </summary>
    [HttpGet]
    [Route("api/Login")] // ?Logout
    public async Task<IActionResult> Logout()
    {
        await login.LogoutAsync();
        // トップ画面に再遷移
        return LocalRedirect(Url.Page("/Index")!);
    }
}
