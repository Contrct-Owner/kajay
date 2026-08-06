namespace Kajay.Definitions;

internal sealed record DefinitionClassDescriptor(
    string Name,
    string? Parent,
    bool IsAbstract,
    IReadOnlyList<DefinitionPropertyDescriptor> DeclaredProperties,
    IReadOnlyList<DefinitionChildCollectionDescriptor> DeclaredChildCollections);
