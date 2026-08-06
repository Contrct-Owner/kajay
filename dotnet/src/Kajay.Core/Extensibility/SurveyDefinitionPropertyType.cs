namespace Kajay.Extensibility;

/// <summary>The JSON value kind accepted by a registered definition property.</summary>
public enum SurveyDefinitionPropertyType
{
    /// <summary>A JSON string.</summary>
    Text,

    /// <summary>A finite JSON number.</summary>
    Number,

    /// <summary>A JSON boolean.</summary>
    Boolean,

    /// <summary>A JSON string, finite number, or boolean scalar.</summary>
    Scalar,

    /// <summary>Any JSON value, preserved without interpretation.</summary>
    Json,
}
