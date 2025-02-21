using BreakInfinity;

public interface Value
{
    string ValueId { get; }
    BigDouble GetValue(ValueRegistry valueRegistry);
    void Invalidate(ValueRegistry valueRegistry);
}

public abstract class DependentValue : Value
{
    private string valueId;

    private bool isDirty = false;

    protected BigDouble? computedValue = null;
    protected virtual bool IsDirty => isDirty;

    public DependentValue(string valueId)
    {
        this.valueId = valueId;
    }

    public string ValueId => valueId;

    public BigDouble GetValue(ValueRegistry valueRegistry)
    {
        if (computedValue == null || isDirty)
        {
            computedValue = ComputeValue(valueRegistry);
            isDirty = false;
        }

        return computedValue.Value;
    }

    protected abstract BigDouble ComputeValue(ValueRegistry valueRegistry);

    public virtual void Invalidate(ValueRegistry valueRegistry)
    {
        isDirty = true;
        valueRegistry.Invalidate(this);
    }
}

public class ConstantValue : DependentValue
{
    private BigDouble value;

    public ConstantValue(string valueId, BigDouble value)
        : base(valueId)
    {
        this.value = value;
    }

    public void SetValue(ValueRegistry valueRegistry, BigDouble value)
    {
        this.value = value;
        Invalidate(valueRegistry);
    }

    protected override BigDouble ComputeValue(ValueRegistry valueRegistry) => value;
}

public class FormulaValue : DependentValue
{
    private Func<ValueRegistry, BigDouble> formula;

    public FormulaValue(string valueId, Func<ValueRegistry, BigDouble> formula)
        : base(valueId)
    {
        this.formula = formula;
    }

    protected override BigDouble ComputeValue(ValueRegistry valueRegistry)
    {
        if (formula == null)
            return 0;
        Console.WriteLine($"Recomputing value for {ValueId}");
        return formula(valueRegistry);
    }
}

public class ResourceValue : DependentValue
{
    BigDouble amount = 0;

    public ResourceValue(string valueId)
        : base(valueId) { }

    public void Update(ValueRegistry valueRegistry, float tick)
    {
        amount += valueRegistry.GetValue($"{ValueId}_delta").GetValue(valueRegistry) * tick;
        Invalidate(valueRegistry);
    }

    protected override BigDouble ComputeValue(ValueRegistry valueRegistry)
    {
        Console.WriteLine("Computing value for {ValueId}");
        return valueRegistry.GetValue($"{ValueId}_calculated").GetValue(valueRegistry) + amount;
    }
}
