using System;
using BreakInfinity;

namespace BaseSystem
{
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
            if (computedValue == null || IsDirty)
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
            Console.WriteLine($"Recomputing formula for {ValueId}");
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
            var delta = valueRegistry.Get($"{ValueId}_delta").GetValue(valueRegistry);
            if (delta == 0)
            {
                return;
            }

            amount += delta * tick;
            Invalidate(valueRegistry);
        }

        public void SetValue(ValueRegistry valueRegistry, BigDouble value)
        {
            amount = value;
            Invalidate(valueRegistry);
        }

        protected override BigDouble ComputeValue(ValueRegistry valueRegistry)
        {
            return valueRegistry.Get($"{ValueId}_calculated").GetValue(valueRegistry) + amount;
        }
    }

    public class ConditionValue : FormulaValue
    {
        private Action<ValueRegistry> onConditionMet;

        private bool isMet = false;
        public bool IsMet => isMet;

        // Once condition is met, we don't need to calculate it anymore
        protected override bool IsDirty => isMet || base.IsDirty;

        public ConditionValue(
            string valueId,
            Func<ValueRegistry, BigDouble> condition,
            // This value comes from saved data
            bool isMet = false,
            Action<ValueRegistry> onConditionMet = null
        )
            : base(valueId, condition)
        {
            this.onConditionMet = onConditionMet;
            this.isMet = isMet;
        }

        protected override BigDouble ComputeValue(ValueRegistry valueRegistry)
        {
            if (isMet)
                return 1;

            var result = base.ComputeValue(valueRegistry);
            if (result >= 1)
            {
                isMet = true;
                onConditionMet?.Invoke(valueRegistry);
            }

            return result;
        }
    }
}
