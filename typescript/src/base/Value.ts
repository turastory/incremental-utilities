import { Decimal } from 'decimal.js';
import { ValueRegistry } from './ValueRegistry';

export interface Value {
  readonly valueId: string;
  getValue(valueRegistry: ValueRegistry): Decimal;
  invalidate(valueRegistry: ValueRegistry): void;
}

export abstract class DependentValue implements Value {
  private isDirty = false;
  protected computedValue: Decimal | null = null;

  protected get IsDirty(): boolean {
    return this.isDirty;
  }

  constructor(private readonly _valueId: string) {}

  get valueId(): string {
    return this._valueId;
  }

  getValue(valueRegistry: ValueRegistry): Decimal {
    if (this.computedValue === null || this.IsDirty) {
      this.computedValue = this.computeValue(valueRegistry);
      this.isDirty = false;
    }
    return this.computedValue;
  }

  protected abstract computeValue(valueRegistry: ValueRegistry): Decimal;

  invalidate(valueRegistry: ValueRegistry): void {
    this.isDirty = true;
    valueRegistry.invalidate(this);
  }
}

export class ConstantValue extends DependentValue {
  constructor(valueId: string, private value: Decimal) {
    super(valueId);
  }

  setValue(valueRegistry: ValueRegistry, value: Decimal): void {
    this.value = value;
    this.invalidate(valueRegistry);
  }

  protected override computeValue(): Decimal {
    return this.value;
  }
}

export class FormulaValue extends DependentValue {
  constructor(
    valueId: string,
    private formula: (valueRegistry: ValueRegistry) => Decimal
  ) {
    super(valueId);
  }

  protected override computeValue(valueRegistry: ValueRegistry): Decimal {
    if (!this.formula) return new Decimal(0);
    console.log(`Recomputing formula for ${this.valueId}`);
    return this.formula(valueRegistry);
  }
}

export class ResourceValue extends DependentValue {
  private amount = new Decimal(0);

  constructor(valueId: string) {
    super(valueId);
  }

  update(valueRegistry: ValueRegistry, tick: number): void {
    const delta = valueRegistry.get(`${this.valueId}_delta`).getValue(valueRegistry);
    if (delta.equals(0)) {
      return;
    }

    this.amount = this.amount.plus(delta.times(tick));
    this.invalidate(valueRegistry);
  }

  setValue(valueRegistry: ValueRegistry, value: Decimal): void {
    this.amount = value;
    this.invalidate(valueRegistry);
  }

  protected override computeValue(valueRegistry: ValueRegistry): Decimal {
    return valueRegistry.get(`${this.valueId}_calculated`).getValue(valueRegistry).plus(this.amount);
  }
}

export class ConditionValue extends FormulaValue {
  private isMet = false;
  private onConditionMet?: (valueRegistry: ValueRegistry) => void;

  get IsMet(): boolean {
    return this.isMet;
  }

  protected override get IsDirty(): boolean {
    return this.isMet || super.IsDirty;
  }

  constructor(
    valueId: string,
    condition: (valueRegistry: ValueRegistry) => Decimal,
    isMet = false,
    onConditionMet?: (valueRegistry: ValueRegistry) => void
  ) {
    super(valueId, condition);
    this.isMet = isMet;
    this.onConditionMet = onConditionMet;
  }

  protected override computeValue(valueRegistry: ValueRegistry): Decimal {
    if (this.isMet) {
      return new Decimal(1);
    }

    const result = super.computeValue(valueRegistry);
    if (result.greaterThanOrEqualTo(1)) {
      this.isMet = true;
      this.onConditionMet?.(valueRegistry);
    }

    return result;
  }
} 