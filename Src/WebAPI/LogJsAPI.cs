using Microsoft.AspNetCore.Mvc;
using ZLogger;

namespace Src.WebAPI;

/// <summary>
/// JavaScript(site.js)から送信されたログ内容を出力するWebAPI
/// </summary>
/// <remarks>
/// appSettings「Src.WebAPI.JsLogAPI」のログレベル設定により出力対象ログを制御すること
/// error指定時=エラー/infoどちらも出力対象外、warn指定時=エラーのみログ出力、info指定時=すべて出力あり
/// <remarks>
[ApiController]
public class LogJsAPI(ILogger<LogJsAPI> logger) : ControllerBase
{
    /// <summary>
    /// JavaScriptエラーをログ出力します。
    /// </summary>
    [HttpPost]
    [Route("api/LogJsError")]
    public IActionResult LogJsError([FromForm] string message)
    {
        logger.ZLogWarning($"JavaScriptError: {message} ({Request.Headers.Referer.FirstOrDefault() ?? "URL不明"})");
        logger.ZLogWarning($"    from:{HttpContext.Connection.RemoteIpAddress} {HttpContext.Request.Headers.UserAgent}");
        return new OkResult();
    }

    /// <summary>
    /// JavaScriptからのinfoログをログ出力します。
    /// </summary>
    [HttpPost]
    [Route("api/LogJsInfo")]
    public IActionResult LogJsInfo([FromForm] string message)
    {
        logger.ZLogInformation($"JavaScriptInfo: {message} ({Request.Headers.Referer.FirstOrDefault() ?? "URL不明"})");
        logger.ZLogInformation($"    from:{HttpContext.Connection.RemoteIpAddress} {HttpContext.Request.Headers.UserAgent}");
        return new OkResult();
    }
}
