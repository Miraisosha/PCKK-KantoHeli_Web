using System.Data.Common;
using ZLogger;

namespace Src.Services;

/// <summary>
/// DBログ出力処理を提供します。
/// </summary>
public class DbLogService(ILogger<DbLogService> logger)
{
    /// <summary>
    /// DB処理エラーログを出力
    /// </summary>
    public void LogError(Exception ex, DbCommand? cmd = null)
    {   // エラーログを出力
        logger.ZLogError($"DB処理エラー:{ex.Message}");
        if (cmd != null)
        {
            logger.ZLogError($"SQL= {cmd.CommandText}");
            for (int i = 0; i < cmd.Parameters?.Count; i++)
            {
                var param = cmd.Parameters[i];
                logger.ZLogError($" Param[{i}:{param.ParameterName}] = {param.Value}");
            }
        }
    }

    /// <summary>
    /// DB処理トレースログを出力
    /// </summary>
    public void LogTrace(string resultSummary, long mSec, DbCommand? cmd = null)
    {   // トレースログを出力
        logger.ZLogTrace($"{resultSummary}({mSec}ms):{cmd?.CommandText ?? "(not sql)"}");
    }
}
