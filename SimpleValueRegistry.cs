using System.Dynamic;

public interface ValueRegistry
{
    Value GetValue(string valueId);
    void AddValue(Value value);
    void Invalidate(Value value);
}

class SimpleValueRegistry : ValueRegistry
{
    private Dictionary<string, Value> values = new();
    private Dictionary<string, HashSet<string>> dependencies = new();

    private HashSet<string> GetDependencies(string valueId)
    {
        if (!dependencies.TryGetValue(valueId, out var deps))
        {
            deps = new HashSet<string>();
            dependencies[valueId] = deps;
        }
        return deps;
    }

    public Value GetValue(string valueId)
    {
        if (!values.TryGetValue(valueId, out var value))
        {
            throw new KeyNotFoundException($"Value with ID '{valueId}' not found in registry");
        }
        return value;
    }

    public Value AddFormula(string valueId, string expression)
    {
        if (values.TryGetValue(valueId, out Value? value))
        {
            Console.WriteLine($"Value {valueId} already added");
            // Already added
            return value;
        }

        var result = ExpressionParser.ParseWithDependencies(expression);
        var formulaValue = new FormulaValue(valueId, result.Function);
        Console.WriteLine(
            $"Adding formula {valueId} with dependencies {string.Join(", ", result.Dependencies)}"
        );

        foreach (var dependency in result.Dependencies)
            GetDependencies(dependency).Add(valueId);
        AddValue(formulaValue);
        return formulaValue;
    }

    public ResourceValue AddResource(
        string valueId,
        string deltaExpression = "0",
        string baseExpression = "0",
        string multExpression = "1",
        string flatExpression = "0"
    )
    {
        Console.WriteLine($"Adding resource {valueId}");
        AddFormula($"{valueId}_delta", deltaExpression);
        AddFormula($"{valueId}_base", baseExpression);
        AddFormula($"{valueId}_mult", multExpression);
        AddFormula($"{valueId}_flat", flatExpression);
        AddFormula($"{valueId}_calculated", $"{valueId}_base * {valueId}_mult + {valueId}_flat");

        var resource = new ResourceValue(valueId);
        GetDependencies($"{valueId}_calculated").Add(valueId);
        AddValue(resource);

        return resource;
    }

    public void AddValue(Value value)
    {
        if (!values.ContainsKey(value.ValueId))
        {
            values[value.ValueId] = value;
        }
    }

    public void PrintOutDependencies()
    {
        foreach (var dependency in dependencies)
        {
            Console.WriteLine($"{dependency.Key} -> {string.Join(", ", dependency.Value)}");
        }
    }

    public void Invalidate(Value value)
    {
        Console.WriteLine(
            $"Invalidating {value.ValueId} -> {string.Join(", ", GetDependencies(value.ValueId))}"
        );
        foreach (var dependency in GetDependencies(value.ValueId))
        {
            values[dependency].Invalidate(this);
        }
    }

    public void Update()
    {
        foreach (var value in values.Values)
        {
            if (value is ResourceValue resource)
            {
                resource.Update(this, 1);
            }
        }
    }
}
