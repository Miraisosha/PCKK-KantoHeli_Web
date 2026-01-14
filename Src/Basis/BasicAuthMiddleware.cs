using System.Text;
using Microsoft.Extensions.Options;
using Src.Common;

namespace Src.Basis;

/// <summary>
/// BASIC認証を行うミドルウェア
/// </summary>
public class BasicAuthMiddleware(RequestDelegate next, ILogger<BasicAuthMiddleware> logger, IOptions<AppSettings> optionAccessor)
{
    #region --- DI ------------------------------------------------------------
    private readonly RequestDelegate _next = next;
    private readonly ILogger<BasicAuthMiddleware> _logger = logger;
    private readonly AppSettings _settings = optionAccessor.Value;
    #endregion ----------------------------------------------------------------

    // 以下基本的な実装は
    //  https://tnakamura.hatenablog.com/entry/2017/07/06/aspnetcore-basic-authentication
    // のものを採用し、net6以降で使用できるIHeaderDictionaryのプロパティによりヘッダ値を読み書きしている

    public async Task Invoke(HttpContext context)
    {
        if (string.IsNullOrEmpty(_settings.BasicAuthUsername) || string.IsNullOrEmpty(_settings.BasicAuthPassword))
        {   // BASIC認証を行わない場合、無条件にOKとする
            await _next(context);
            return;
        }

        // Basic 認証のヘッダー
        // Authorization: Basic <userName:password を Base64 エンコードした文字列>
        // からユーザー名とパスワードを取り出してチェックする
        string? header = context.Request.Headers.Authorization;
        if (header != null && header.StartsWith("Basic"))
        {
            var encodedCredentials = header["Basic".Length..].Trim();
            var credentials = Encoding.UTF8.GetString(Convert.FromBase64String(encodedCredentials));
            var separatorIndex = credentials.IndexOf(':');
            var userName = credentials[..separatorIndex];
            var password = credentials[(separatorIndex + 1)..];

            if (userName == _settings.BasicAuthUsername && password == _settings.BasicAuthPassword)
            {

                await _next(context);
                return;
            }
        }

        // ブラウザの認証ダイアログを出すには、レスポンスヘッダーに
        // WWW-Authenticate: Baic が必要
        context.Response.Headers.WWWAuthenticate = "Basic";
        context.Response.Headers.CacheControl = "no-cache";
        context.Response.StatusCode = 401;
    }
}
