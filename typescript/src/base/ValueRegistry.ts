import { Decimal } from 'decimal.js';
import { Value, FormulaValue, ConditionValue, ResourceValue } from './Value';
import { ExpressionParser, ParseResult } from './ExpressionParser';

export class ValueRegistry {
  private values: Map<string, Value> = new Map();
  private dependencies: Map<string, Set<string>> = new Map();

  get Values(): Map<string, Value> {
    return this.values;
  }

  private getDependencies(valueId: string): Set<string> {
    let deps = this.dependencies.get(valueId);
    if (!deps) {
      deps = new Set();
      this.dependencies.set(valueId, deps);
    }
    return deps;
  }

  getWrappedValue(valueId: string): Decimal {
    return this.get(valueId).getValue(this);
  }

  get(valueId: string): Value {
    const value = this.values.get(valueId);
    if (!value) {
      throw new Error(`Value with ID '${valueId}' not found in registry`);
    }
    return value;
  }

  getTyped<T extends Value>(valueId: string): T {
    const value = this.values.get(valueId);
    if (!value) {
      throw new Error(`Value with ID '${valueId}' not found in registry`);
    }
    return value as T;
  }

  addFormula(valueId: string, expression: string): FormulaValue {
    const existingValue = this.values.get(valueId);
    if (existingValue) {
      console.log(`Value ${valueId} already added`);
      return existingValue as FormulaValue;
    }

    const result = ExpressionParser.parseWithDependencies(expression);
    const formulaValue = new FormulaValue(valueId, result.function);
    console.log(
      `Adding formula ${valueId} with dependencies ${Array.from(result.dependencies).join(', ')}`
    );

    for (const dependency of result.dependencies) {
      this.getDependencies(dependency).add(valueId);
    }
    this.add(formulaValue);
    return formulaValue;
  }

  addCondition(
    valueId: string,
    expression: string,
    isMet = false,
    onConditionMet?: (valueRegistry: ValueRegistry) => void
  ): ConditionValue {
    if (this.values.has(valueId)) {
      // Remove old value since condition value has state
      this.values.delete(valueId);
    }

    const result = ExpressionParser.parseWithDependencies(expression);
    const conditionValue = new ConditionValue(
      valueId,
      result.function,
      isMet,
      onConditionMet
    );
    console.log(
      `Adding condition ${valueId} with dependencies ${Array.from(result.dependencies).join(', ')}`
    );

    for (const dependency of result.dependencies) {
      this.getDependencies(dependency).add(valueId);
    }
    this.add(conditionValue);

    return conditionValue;
  }

  addResource(
    valueId: string,
    deltaExpression = '0',
    baseExpression = '0',
    multExpression = '1',
    flatExpression = '0'
  ): ResourceValue {
    console.log(`Adding resource ${valueId}`);
    this.addFormula(`${valueId}_delta`, deltaExpression);
    this.addFormula(`${valueId}_base`, baseExpression);
    this.addFormula(`${valueId}_mult`, multExpression);
    this.addFormula(`${valueId}_flat`, flatExpression);
    this.addFormula(
      `${valueId}_calculated`,
      `${valueId}_base * ${valueId}_mult + ${valueId}_flat`
    );

    const resource = new ResourceValue(valueId);
    this.getDependencies(`${valueId}_calculated`).add(valueId);
    this.add(resource);

    return resource;
  }

  add(value: Value): void {
    if (!this.values.has(value.valueId)) {
      this.values.set(value.valueId, value);
    }
  }

  printOutDependencies(): void {
    for (const [key, value] of this.dependencies) {
      console.log(`${key} -> ${Array.from(value).join(', ')}`);
    }
  }

  invalidate(value: Value): void {
    for (const dependency of this.getDependencies(value.valueId)) {
      this.values.get(dependency)?.invalidate(this);
    }
  }

  update(tick: number): void {
    for (const value of this.values.values()) {
      if (value instanceof ResourceValue) {
        value.update(this, tick);
      }
    }
  }

  remove(valueId: string): boolean {
    if (!this.values.has(valueId)) {
      return false;
    }

    // Check dependencies
    const deps = this.dependencies.get(valueId);
    if (deps && deps.size > 0) {
      console.log(`Cannot remove ${valueId} because other values depend on it`);
      return false;
    }

    // Remove from other values' dependencies
    for (const deps of this.dependencies.values()) {
      deps.delete(valueId);
    }

    // Remove value
    this.values.delete(valueId);

    return true;
  }
} 