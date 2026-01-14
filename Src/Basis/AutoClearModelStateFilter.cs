using Microsoft.AspNetCore.Mvc.Filters;

namespace Src.Basis;

/// <summary>
/// ModelState.Clear()を自動的に実行するFilter
/// </summary>
public class AutoClearModelStateFilter : IPageFilter
{
    public void OnPageHandlerSelected(PageHandlerSelectedContext context) { }

    public void OnPageHandlerExecuting(PageHandlerExecutingContext context)
    {
        context.ModelState.Clear();
    }

    public void OnPageHandlerExecuted(PageHandlerExecutedContext context) { }
}
