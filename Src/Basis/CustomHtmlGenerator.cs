
using System.ComponentModel.DataAnnotations;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.Extensions.Options;
using Src.Validation.CustomValidators;

namespace Src.Basis;

/// <summary>
/// TagHelper出力値カスタマイズ
/// </summary>
/// <param name="logger"></param>
public class CustomHtmlGenerator(IAntiforgery antiforgery, IOptions<MvcViewOptions> optionsAccessor, IModelMetadataProvider metadataProvider, IUrlHelperFactory urlHelperFactory, HtmlEncoder htmlEncoder, ValidationHtmlAttributeProvider validationAttributeProvider)
    : DefaultHtmlGenerator(antiforgery, optionsAccessor, metadataProvider, urlHelperFactory, htmlEncoder, validationAttributeProvider)
{
    // カスタマイズ１：
    //  idにnameと同一値が設定されるようカスタマイズ
    //  （デフォルトのid命名ルールがいまだにHTML4.1ベースのため、
    //    「.」も全角文字もすべて「_」に置き換えられてしまうのを回避し
    //    nameに設定されるべき値をそのままidにも準用することとする）

    // カスタマイズ２：
    //  AcceptAttributeの値をaccept属性へ転記するよう、また
    //  UneditableAttributeが設定されている場合はreadonly/disabled属性を設定するよう、カスタマイズ
    //  （JavaScriptによる入力制御が自動で行われるようにする）

    // カスタマイズ３：
    //   書式未設定と思われる場合はAcceptAttributeのFormat設定を適用

    protected override TagBuilder GenerateInput(ViewContext viewContext, InputType inputType, ModelExplorer modelExplorer, string expression, object value, bool useViewData, bool isChecked, bool setId, bool isExplicitValue, string format, IDictionary<string, object> htmlAttributes)
    {
        var ret = base.GenerateInput(viewContext, inputType, modelExplorer, expression, value, useViewData, isChecked, setId, isExplicitValue, format, htmlAttributes);
        if (setId)
        {
            ret.Attributes["id"] = expression; // idを強制的にexpressionで上書きする
        }
        foreach (var attribute in modelExplorer.Metadata.ValidatorMetadata)
        {
            if (attribute is AcceptAttribute accept && !string.IsNullOrEmpty(accept.Types))
            {
                ret.MergeAttribute("accept", accept.Types); // AcceptAttributeの値をaccept属性へ転記

                // 値がstring型ではない(=Modelの値を直接表示)＆表示書式未指定の場合は、書式反映
                if (inputType == InputType.Text && value is not string && value is not null && accept.GetFormat(false) is string acceptFormat && string.IsNullOrEmpty(format) && string.IsNullOrEmpty(modelExplorer.Metadata.DisplayFormatString))
                {
                    ret.MergeAttribute("value", string.Format("{0:" + acceptFormat + "}", value), true);
                }
            }
            else if (attribute is UneditableAttribute)
            {   // 編集不可にする
                var tagAttributeName = (inputType == InputType.Text) ? "readonly" : "disabled";
                ret.MergeAttribute(tagAttributeName, tagAttributeName);
            }
            else if (attribute is RequiredAttribute)
            {   // 入力必須にする
                ret.MergeAttribute("data-val-required", "");
            }
        }

        return ret;
    }

    public override TagBuilder GenerateTextArea(ViewContext viewContext, ModelExplorer modelExplorer, string expression, int rows, int columns, object htmlAttributes)
    {
        var ret = base.GenerateTextArea(viewContext, modelExplorer, expression, rows, columns, htmlAttributes);
        ret.Attributes["id"] = expression; // idを強制的にexpressionで上書きする
        foreach (var attribute in modelExplorer.Metadata.ValidatorMetadata)
        {
            if (attribute is UneditableAttribute)
            {   // 編集不可にする
                ret.MergeAttribute("readonly", "readonly");
            }
            else if (attribute is RequiredAttribute)
            {   // 入力必須にする
                ret.MergeAttribute("data-val-required", "");
            }
        }

        return ret;
    }

    public override TagBuilder GenerateSelect(ViewContext viewContext, ModelExplorer modelExplorer, string optionLabel, string expression, IEnumerable<SelectListItem> selectList, ICollection<string> currentValues, bool allowMultiple, object htmlAttributes)
    {
        var ret = base.GenerateSelect(viewContext, modelExplorer, optionLabel, expression, selectList, currentValues, allowMultiple, htmlAttributes);
        ret.Attributes["id"] = expression; // idを強制的にexpressionで上書きする
        foreach (var attribute in modelExplorer.Metadata.ValidatorMetadata)
        {
            if (attribute is UneditableAttribute)
            {   // 編集不可にする
                ret.MergeAttribute("disabled", "disabled");
            }
            else if (attribute is RequiredAttribute)
            {   // 入力必須にする
                ret.MergeAttribute("data-val-required", "");
            }
        }
        return ret;
    }

    public override TagBuilder GenerateLabel(ViewContext viewContext, ModelExplorer modelExplorer, string expression, string labelText, object htmlAttributes)
    {
        var ret = base.GenerateLabel(viewContext, modelExplorer, expression, labelText, htmlAttributes);
        ret.Attributes["for"] = expression; // forに設定するidを強制的にexpressionで上書きする
        return ret;
    }
}
