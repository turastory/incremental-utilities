using System;
using System.Collections.Generic;
using BreakInfinity;

namespace BaseSystem
{
    public class ValueRegistry
    {
        private Dictionary<string, Value> values = new();
        public Dictionary<string, Value> Values => values;

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

        public BigDouble GetWrapedValue(string valueId)
        {
            return Get(valueId).GetValue(this);
        }

        public Value Get(string valueId)
        {
            if (!values.TryGetValue(valueId, out var value))
            {
                throw new KeyNotFoundException($"Value with ID '{valueId}' not found in registry");
            }
            return value;
        }

        public T Get<T>(string valueId)
            where T : Value
        {
            if (!values.TryGetValue(valueId, out var value))
            {
                throw new KeyNotFoundException($"Value with ID '{valueId}' not found in registry");
            }
            return (T)value;
        }

        public FormulaValue AddFormula(string valueId, string expression)
        {
            if (values.TryGetValue(valueId, out Value value))
            {
                Console.WriteLine($"Value {valueId} already added");
                return value as FormulaValue;
            }

            var result = ExpressionParser.ParseWithDependencies(expression);
            var formulaValue = new FormulaValue(valueId, result.Function);
            Console.WriteLine(
                $"Adding formula {valueId} with dependencies {string.Join(", ", result.Dependencies)}"
            );

            foreach (var dependency in result.Dependencies)
                GetDependencies(dependency).Add(valueId);
            Add(formulaValue);
            return formulaValue;
        }

        public ConditionValue AddCondition(
            string valueId,
            string expression,
            // This value comes from saved data
            bool isMet = false,
            Action<ValueRegistry> onConditionMet = null
        )
        {
            if (values.TryGetValue(valueId, out Value value))
            {
                // Remove old value since condition value has state
                values.Remove(valueId);
            }

            var result = ExpressionParser.ParseWithDependencies(expression);
            var conditionValue = new ConditionValue(
                valueId,
                result.Function,
                isMet,
                onConditionMet
            );
            Console.WriteLine(
                $"Adding condition {valueId} with dependencies {string.Join(", ", result.Dependencies)}"
            );

            foreach (var dependency in result.Dependencies)
                GetDependencies(dependency).Add(valueId);
            Add(conditionValue);

            return conditionValue;
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
            AddFormula(
                $"{valueId}_calculated",
                $"{valueId}_base * {valueId}_mult + {valueId}_flat"
            );

            var resource = new ResourceValue(valueId);
            GetDependencies($"{valueId}_calculated").Add(valueId);
            Add(resource);

            return resource;
        }

        public void Add(Value value)
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
            foreach (var dependency in GetDependencies(value.ValueId))
            {
                values[dependency].Invalidate(this);
            }
        }

        public void Update(float tick)
        {
            foreach (var value in values.Values)
            {
                if (value is ResourceValue resource)
                {
                    resource.Update(this, tick);
                }
            }
        }

        public bool Remove(string valueId)
        {
            if (!values.ContainsKey(valueId))
                return false;

            // 의존성 정리
            if (dependencies.ContainsKey(valueId) && dependencies[valueId].Count > 0)
            {
                Console.WriteLine($"Cannot remove {valueId} because other values depend on it");
                return false;
            }

            // 다른 값들의 의존성에서도 제거
            foreach (var deps in dependencies.Values)
            {
                deps.Remove(valueId);
            }

            // 값 제거
            values.Remove(valueId);

            return true;
        }
    }
}
