using System.Data.Common;
using System.Net;
using System.Net.Mime;
using System.Text.Encodings.Web;
using System.Text.Unicode;
using DapperAid.DbAccess;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.Extensions.WebEncoders;
using NetTopologySuite.Geometries;
using Npgsql;
using Src.Basis;
using Src.Common;
using Src.Services;
using Utf8StringInterpolation;
using ZLogger;
using ZLogger.Formatters;
using ZLogger.Providers;

// -----------------------------------------------------------------------------
var builder = WebApplication.CreateBuilder(args);

// 設定情報
var appSettingsSection = builder.Configuration.GetSection("AppSettings");
builder.Services.Configure<AppSettings>(appSettingsSection);
var settings = appSettingsSection?.Get<AppSettings>() ?? new AppSettings();

// ログ設定
static void SetPlainTextFormatterMethod(PlainTextZLoggerFormatter formatter)
{
    formatter.SetPrefixFormatter($"{0:yyyy-MM-dd HH:mm:ss.fff}|{1:short}|{2}{3}{4}| ",
        (in MessageTemplate template, in LogInfo info) => template.Format(info.Timestamp.Local, info.LogLevel,
            info.Category,
            info.MemberName == null ? null : "-" + info.MemberName,
            info.LineNumber == 0 ? null : "(#" + info.LineNumber + ")"
        ));
    formatter.SetExceptionFormatter((writer, ex) => Utf8String.Format(writer, $"{ex.ToString()}"));
}
builder.Logging
    .ClearProviders()
    .AddZLoggerFile($"{settings.LogDir}/{DateTime.Now:yyyy-MM-dd}.log", options =>
        // 通常ログは日付別に出力（IISのアプリケーションプールが再起動されるタイミングでログファイル切り替え）
        options.UsePlainTextFormatter(SetPlainTextFormatterMethod)
    )
    .AddZLoggerRollingFile(options =>
    {   // エラーログは年ごとに別ファイルとなるよう設定して出力
        options.UsePlainTextFormatter(SetPlainTextFormatterMethod);
        options.RollingSizeKB = 10_000; // そうそうログファイルが育つことはないはずだが通常のテキストエディタで困らずに開けるサイズとなるよう分割
        options.RollingInterval = RollingInterval.Year;
        options.FilePathSelector = (timestamp, sequenceNumber) => $"{settings.LogDir}/error{timestamp.ToLocalTime():yyyy}_{sequenceNumber:000}.log";
    })
    .AddFilter<ZLoggerRollingFileLoggerProvider>((loglevel) => loglevel >= LogLevel.Warning);


// RazorPageで開発
builder.Services.AddRazorPages(options =>
    {
        // ModelState.Clear()を自動的に実行
        options.Conventions.ConfigureFilter(new AutoClearModelStateFilter());
    })
    .AddMvcOptions(options =>
        // ASPNETCoreデフォルトのモデル検証をすべて無効化する（処理速度が異様に遅いため）
        // ※PageModelのModelState.IsValidが(検証を行わないため)常にtrueになってしまうのでModelStateは使用しないこと
        options.ModelValidatorProviders.Clear())
    .AddViewOptions(options =>
        // 検証属性からのクライアント側検証htmlの出力を抑止
        options.HtmlHelperOptions.ClientValidationEnabled = false);

// WebAPIも使用
builder.Services.AddControllers().AddJsonOptions(options =>
    // （Geometry型をそのままJsonで送出するようなこともありうる？）
    options.JsonSerializerOptions.Converters.Add(new NetTopologySuite.IO.Converters.GeoJsonConverterFactory())
);

// Cookie認証を使用
builder.Services.AddScoped<AppCookieAuthenticationEvents>();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    // アプリケーション差し替え時などに既存のCookie認証を破棄できるようにする
    options.EventsType = typeof(AppCookieAuthenticationEvents);
    // ログインURL等を変更する
    options.LoginPath = "/Index";
    options.LogoutPath = "/Index";
    options.AccessDeniedPath = "/Index"; // またCookieAuthenticationEventsにてログも取得する
});

// css/jsのminify
builder.Services.AddWebOptimizer(pipeline =>
{
    pipeline.MinifyCssFiles("css/**/*.css");
    pipeline.MinifyJsFiles("js/**/*.js");
});

// DB接続(DbConnectionのDI)
var dataSourceBuilder = new NpgsqlDataSourceBuilder(builder.Configuration.GetConnectionString("DefaultConnection"));
dataSourceBuilder.UseNetTopologySuite(); // Geometry型を有効化する
var dataSource = dataSourceBuilder.Build();
builder.Services.AddSingleton<DbLogService>();
builder.Services.AddScoped<DbConnection>(serviceProvider =>
{
    var dbLog = serviceProvider.GetRequiredService<DbLogService>();
    var innerConnection = dataSource.CreateConnection();
    var connection = new LoggableDbConnection(innerConnection, errorLogger: dbLog.LogError, traceLogger: dbLog.LogTrace);
    return connection;
});
// DB接続設定付帯１(DapperAidでDB操作できるようにする)
var queryBuilderInstance = new DapperAid.QueryBuilder.Postgres();
// DB接続設定付帯２(Dapper/DapperAidでもGeometry型を扱えるようにする)
Dapper.SqlMapper.AddTypeHandler(new GeometryTypeMapper<Geometry>());
Dapper.SqlMapper.AddTypeHandler(new GeometryTypeMapper<Point>());
Dapper.SqlMapper.AddTypeHandler(new GeometryTypeMapper<LineString>());
Dapper.SqlMapper.AddTypeHandler(new GeometryTypeMapper<MultiLineString>());
Dapper.SqlMapper.AddTypeHandler(new GeometryTypeMapper<Polygon>());
Dapper.SqlMapper.AddTypeHandler(new GeometryTypeMapper<MultiPolygon>());
queryBuilderInstance.AddSqlLiteralConverter<Geometry>(geom =>
{
    var binaryHex = string.Concat(geom.AsBinary().Select(b => $"{b:X2}"));
    return $"'{binaryHex}'::geometry";
});

// HttpContextをDIできるようにする
builder.Services.AddHttpContextAccessor();
// TimeProvider
builder.Services.AddSingleton(TimeProvider.System);

// HTML出力時、日本語等をエンコード(htmlエスケープ)対象外にする
builder.Services.Configure<WebEncoderOptions>(options => options.TextEncoderSettings = new TextEncoderSettings(UnicodeRanges.All));

// TagHelperをカスタマイズ版に差し替える
builder.Services.Remove(builder.Services.First(s => s.ServiceType == typeof(IHtmlGenerator) && s.ImplementationType == typeof(DefaultHtmlGenerator)));
builder.Services.AddSingleton<IHtmlGenerator, CustomHtmlGenerator>();
// その他自前のService各種を登録
builder.Services.AddSingleton<ProviderService>(); // 各種オブジェクト等汎用提供サービス
builder.Services.AddScoped<LoginService>(); // ログイン認証関連機能
builder.Services.AddScoped<DataService>(); // 各種データ加工機能

// -----------------------------------------------------------------------------
var app = builder.Build();

// アプリケーションのシャットダウンを検知しAppSettingsの静的プロパティの値を書き換え
var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
lifetime.ApplicationStopping.Register(() =>
{
    app.Logger.ZLogInformation($"App Stopping. (Version={typeof(Program).Assembly.GetName().Version!.ToString()})"); // 停止ログを出力（アプリケーションプール停止時などに呼び出される?）
    AppSettings.IsApplicationStopping = true;
});

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    // エラーページはシンプル表示のものを採用
    // app.UseExceptionHandler("/Error");

    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    if (settings.ForceHttps接続)
    {
        app.UseHsts();
    }
}

// レスポンスボディがないhttpエラーはページはステータスコードのみ簡易表示
app.UseStatusCodePages(async context =>
{
    var statusCode = (HttpStatusCode)context.HttpContext.Response.StatusCode;
    if (settings.ログHttpError出力)
    {
        // 設定ファイルで指定されているならログもとる。
        if (statusCode == HttpStatusCode.Unauthorized && !string.IsNullOrEmpty(context.HttpContext.Response.Headers.WWWAuthenticate))
        {
            return; //ただしHTTP認証(Basic等)認証に関するエラーはログ取得対象外とする。この場合はレスポンス表示も一切行わない。
        }
        app.Logger.ZLogWarning($"HTTPERROR: {statusCode:d} {context.HttpContext.Request.Method}"
            + $" {context.HttpContext.Request.GetEncodedPathAndQuery()}"
            + $"  from:{context.HttpContext.Connection.RemoteIpAddress} {context.HttpContext.Request.Headers.UserAgent}");
    }
    context.HttpContext.Response.ContentType = MediaTypeNames.Text.Html;
    await context.HttpContext.Response.WriteAsync($"<h1>{statusCode:d} {statusCode}</h1>");
});

if (settings.ForceHttps接続)
{
    app.UseHttpsRedirection();
}

app.UseMiddleware<BasicAuthMiddleware>(); // 自前で書いたBasic認証モジュールでアクセス制限できるようにする

app.UseWebOptimizer(); // css/jsのminify
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication(); // 認証を有効化
app.UseAuthorization();

app.MapRazorPages();
app.MapControllers(); // WebAPIを有効化

app.Logger.ZLogInformation($"");
app.Logger.ZLogInformation($"App Starting. (Version={typeof(Program).Assembly.GetName().Version!.ToString()})"); // 起動ログを出力
app.Run();
app.Logger.ZLogInformation($"App Stopped. (Version={typeof(Program).Assembly.GetName().Version!.ToString()})"); // 停止ログを出力（アプリケーションプール停止時などに呼び出される）
