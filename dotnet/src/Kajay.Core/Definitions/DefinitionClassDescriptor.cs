namespace Kajay.Definitions;

internal sealed record DefinitionClassDescriptor(
    string Name,
    string? Parent,
    bool IsAbstract,
    bool AllowsInline,
    IReadOnlyList<DefinitionPropertyDescriptor> DeclaredProperties,
    IReadOnlyList<DefinitionChildCollectionDescriptor> DeclaredChildCollections);
