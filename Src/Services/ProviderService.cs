using System.Net.Http.Headers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Options;
using Src.Common;
using Src.Validation;

namespace Src.Services;

/// <summary>
/// アプリケーション処理で使用する各種オブジェクトを提供します。
/// </summary>
public class ProviderService(ILogger<InputValidator> inputValidatorlogger, TimeProvider timeProvider, IServiceProvider serviceProvider, IOptions<AppSettings> optionAccessor, IOptionsMonitor<AppSettings> currentOptionAccessor)
{
    // ------------------------------------------------
    // 日付関係
    // ------------------------------------------------

    /// <summary>現在日時を返します。</summary>
    public DateTime GetNow() => timeProvider.GetLocalNow().DateTime;

    /// <summary>今日日付を返します。</summary>
    public DateOnly GetToday() => DateOnly.FromDateTime(GetNow());


    // ------------------------------------------------
    // 設定ファイル関係
    // ------------------------------------------------

    /// <summary>設定ファイルの保持値を返します。</summary>
    public AppSettings GetSettings() => optionAccessor.Value;

    /// <summary>このメソッドを呼び出した時点での最新の設定ファイルの記入値を返します。</summary>
    public AppSettings GetCurrentSettings() => currentOptionAccessor.CurrentValue;


    // ------------------------------------------------
    // 入力検証関係
    // ------------------------------------------------

    /// <summary>
    /// 新たに入力値検証オブジェクトを生成して返します。
    /// </summary>
    /// <returns>入力値検証オブジェクト</returns>
    public InputValidator CreateValidator() => new(inputValidatorlogger, serviceProvider);


    // ------------------------------------------------
    // レスポンス関係
    // ------------------------------------------------

    /// <summary>
    /// FileContentResultオブジェクトを生成して返します。
    /// </summary>
    /// <param name="httpContext">HttpContext</param>
    /// <param name="filename">ファイル名</param>
    /// <param name="content">ファイル内容</param>
    /// <param name="lastModified">LastModifiedを設定する場合はその日時</param>
    /// <param name="isAttachment">ContentDispositionをattachmentに設定する場合はtrueを明示</param>
    /// <returns>FileContentResult</returns>
    public FileContentResult CreateFileResult(HttpContext httpContext, string filename, byte[] content, DateTime? lastModified = null, bool isAttachment = false)
    {
        var contentDisposition = new ContentDispositionHeaderValue(isAttachment ? "attachment" : "inline") { FileName = filename };
        httpContext.Response.Headers.ContentDisposition = $"{contentDisposition}";
        new FileExtensionContentTypeProvider().TryGetContentType($"{filename}", out var contentTypeText);
        var ret = new FileContentResult(content, contentTypeText ?? "application/octet-stream");
        if (lastModified is not null)
        {
            ret.LastModified = lastModified;
        }
        return ret;
    }
}
