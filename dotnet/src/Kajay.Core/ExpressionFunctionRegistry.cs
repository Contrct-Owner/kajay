namespace Kajay;

/// <summary>An immutable set of host-defined expression functions.</summary>
public sealed class ExpressionFunctionRegistry
{
    private readonly Dictionary<string, ExpressionFunction> _functions;
    private readonly Dictionary<string, AsyncExpressionFunction> _asyncFunctions;

    private ExpressionFunctionRegistry(
        Dictionary<string, ExpressionFunction> functions,
        Dictionary<string, AsyncExpressionFunction> asyncFunctions)
    {
        _functions = functions;
        _asyncFunctions = asyncFunctions;
    }

    /// <summary>Gets an empty registry that can be safely reused.</summary>
    public static ExpressionFunctionRegistry Empty { get; } = new(
        new Dictionary<string, ExpressionFunction>(StringComparer.OrdinalIgnoreCase),
        new Dictionary<string, AsyncExpressionFunction>(StringComparer.OrdinalIgnoreCase));

    /// <summary>Returns a new registry containing a synchronous function.</summary>
    /// <param name="name">An ASCII expression identifier.</param>
    /// <param name="implementation">The function implementation.</param>
    /// <returns>A new immutable registry.</returns>
    /// <exception cref="ArgumentException">
    /// The name is invalid, reserved, or already registered.
    /// </exception>
    public ExpressionFunctionRegistry Add(string name, ExpressionFunction implementation)
    {
        ValidateRegistration(name, implementation);
        Dictionary<string, ExpressionFunction> functions = new(
            _functions,
            StringComparer.OrdinalIgnoreCase)
        {
            [name] = implementation,
        };
        return new ExpressionFunctionRegistry(functions, _asyncFunctions);
    }

    /// <summary>Returns a new registry containing an asynchronous function.</summary>
    /// <param name="name">An ASCII expression identifier.</param>
    /// <param name="implementation">The cancellation-aware function implementation.</param>
    /// <returns>A new immutable registry.</returns>
    /// <exception cref="ArgumentException">
    /// The name is invalid, reserved, or already registered.
    /// </exception>
    public ExpressionFunctionRegistry AddAsync(
        string name,
        AsyncExpressionFunction implementation)
    {
        ValidateRegistration(name, implementation);
        Dictionary<string, AsyncExpressionFunction> functions = new(
            _asyncFunctions,
            StringComparer.OrdinalIgnoreCase)
        {
            [name] = implementation,
        };
        return new ExpressionFunctionRegistry(_functions, functions);
    }

    internal ExpressionFunction? Get(string name)
    {
        return _functions.TryGetValue(name, out ExpressionFunction? implementation)
            ? implementation
            : null;
    }

    internal bool IsAsync(string name)
    {
        return _asyncFunctions.ContainsKey(name);
    }

    private void ValidateRegistration(string name, Delegate implementation)
    {
        ArgumentNullException.ThrowIfNull(name);
        ArgumentNullException.ThrowIfNull(implementation);
        if (!IsIdentifier(name))
        {
            throw new ArgumentException(
                "An expression function name must be an ASCII identifier.",
                nameof(name));
        }

        if (KajayBuiltInFunctions.IsRegistered(name)
            || _functions.ContainsKey(name)
            || _asyncFunctions.ContainsKey(name))
        {
            throw new ArgumentException(
                $"The expression function '{name}' is already registered or reserved.",
                nameof(name));
        }
    }

    private static bool IsIdentifier(string name)
    {
        if (name.Length == 0 || !IsIdentifierStart(name[0]))
        {
            return false;
        }

        for (int index = 1; index < name.Length; index += 1)
        {
            char character = name[index];
            if (!IsIdentifierStart(character) && character is not (>= '0' and <= '9'))
            {
                return false;
            }
        }

        return true;
    }

    private static bool IsIdentifierStart(char value)
    {
        return value is >= 'A' and <= 'Z' or >= 'a' and <= 'z' or '_';
    }
}
