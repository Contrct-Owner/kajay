namespace Kajay;

/// <summary>Identifies one member of the closed Kajay expression value algebra.</summary>
public enum KajayValueKind
{
    /// <summary>No value is present.</summary>
    Absent,

    /// <summary>An explicit JSON null value.</summary>
    Null,

    /// <summary>A Boolean value.</summary>
    Boolean,

    /// <summary>A finite IEEE-754 binary64 number.</summary>
    Number,

    /// <summary>A UTF-16 string.</summary>
    Text,

    /// <summary>A UTC instant with millisecond precision.</summary>
    Instant,

    /// <summary>An ordered collection of Kajay values.</summary>
    Array,

    /// <summary>An object with exact, ordinal property names.</summary>
    Map,
}
