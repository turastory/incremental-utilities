import { Decimal } from "decimal.js";
import { ValueRegistry } from "./ValueRegistry";
import { ConstantValue, ResourceValue } from "./Value";
import { Expression } from "./ExpressionParser";

export interface LogSubject {
  who: string;
  typingSpeed: number;
  color: string;
}

export class ResourceData {
  constructor(
    public id: string,
    public name: string,
    public description: string,
    public shortName: string
  ) {}

  getValue(valueRegistry: ValueRegistry): Decimal {
    return valueRegistry.get(this.id).getValue(valueRegistry);
  }

  static register(
    registry: ValueRegistry,
    resource: RawResourceData
  ): ResourceData {
    registry.addResource(
      resource.id,
      resource.deltaExpression ?? "0",
      resource.baseExpression ?? "0",
      resource.multExpression ?? "1",
      resource.flatExpression ?? "0"
    );

    return new ResourceData(
      resource.id,
      resource.name,
      resource.description,
      resource.shortName
    );
  }
}

export interface Condition {
  type: string;
  targetId: string;
  amount?: string;
  text?: string;
}

export interface Cost {
  resourceId: string;
  expression: string;
  note?: string;
}

export class CostData {
  constructor(
    public resourceId: string,
    public costId: string,
    public expression: string
  ) {}

  static register(registry: ValueRegistry, cost: Cost, id: string): CostData {
    const costId = `${id}_cost_${cost.resourceId}`;
    const expression = cost.expression.replace("level", id);
    registry.addFormula(costId, expression);
    return new CostData(cost.resourceId, costId, cost.expression);
  }

  static registerGroup(
    registry: ValueRegistry,
    id: string,
    costs: Cost[] | undefined
  ): CostData[] {
    if (!costs) return [];
    return costs.map((cost) => CostData.register(registry, cost, id));
  }

  affordable(valueRegistry: ValueRegistry): boolean {
    return this.getDiff(valueRegistry).greaterThanOrEqualTo(0);
  }

  private getDiff(valueRegistry: ValueRegistry): Decimal {
    const resourceValue = valueRegistry.get(this.resourceId);
    const costValue = valueRegistry.get(this.costId);
    return resourceValue
      .getValue(valueRegistry)
      .minus(costValue.getValue(valueRegistry));
  }

  pay(valueRegistry: ValueRegistry): void {
    const resourceValue = valueRegistry.getTyped<ResourceValue>(
      this.resourceId
    );
    resourceValue.setValue(valueRegistry, this.getDiff(valueRegistry));
  }
}

export class ConditionData {
  constructor(
    public id: string,
    public type: string,
    public targetId: string,
    public amount: string,
    public text?: string
  ) {}

  isMet(valueRegistry: ValueRegistry): boolean {
    return valueRegistry
      .get(this.id)
      .getValue(valueRegistry)
      .greaterThanOrEqualTo(1);
  }

  static register(
    registry: ValueRegistry,
    condition: Condition,
    prefix = ""
  ): ConditionData {
    const key = `${prefix}_${condition.type}_${condition.targetId}`;
    const amount = condition.amount ?? "1";

    registry.addCondition(key, `${condition.targetId} >= ${amount}`);

    return new ConditionData(
      key,
      condition.type,
      condition.targetId,
      amount,
      condition.text
    );
  }

  static registerGroup(
    registry: ValueRegistry,
    id: string,
    conditions: Condition[] | undefined
  ): ConditionData[] {
    if (!conditions) return [];

    const conditionData = conditions.map((condition) =>
      ConditionData.register(registry, condition, id)
    );

    registry.addCondition(
      id,
      Expression.and(...conditionData.map((condition) => condition.id))
    );

    return conditionData;
  }
}

export abstract class UnlockableData {
  constructor(
    public id: string = "",
    public name: string = "",
    public description: string = "",
    public costs: CostData[] = [],
    public revealConditions: ConditionData[] = [],
    public activationConditions: ConditionData[] = [],
    public level: ConstantValue = new ConstantValue("", new Decimal(0))
  ) {}

  isUnlocked(valueRegistry: ValueRegistry): boolean {
    return valueRegistry
      .get(this.id)
      .getValue(valueRegistry)
      .greaterThanOrEqualTo(1);
  }

  isRevealed(registry: ValueRegistry): boolean {
    return registry
      .get(`${this.id}_reveal`)
      .getValue(registry)
      .greaterThanOrEqualTo(1);
  }

  isActivated(registry: ValueRegistry): boolean {
    return registry
      .get(`${this.id}_activate`)
      .getValue(registry)
      .greaterThanOrEqualTo(1);
  }

  canPurchase(valueRegistry: ValueRegistry): boolean {
    if (!this.isActivated(valueRegistry)) return false;
    if (!this.costs) return true;
    return this.costs.every((cost) => cost.affordable(valueRegistry));
  }

  purchase(valueRegistry: ValueRegistry): void {
    if (!this.canPurchase(valueRegistry)) return;
    this.costs.forEach((cost) => cost.pay(valueRegistry));
    this.level.setValue(valueRegistry, new Decimal(1));
  }
}

export class UpgradeData extends UnlockableData {
  constructor(
    public override id: string = "",
    public override name: string = "",
    public override description: string = "",
    public maxLevel: number = 0,
    public effects: string[] = [],
    public override costs: CostData[] = [],
    public override revealConditions: ConditionData[] = [],
    public override activationConditions: ConditionData[] = [],
    public override level: ConstantValue,
  ) {
    super(
      id,
      name,
      description,
      costs,
      revealConditions,
      activationConditions,
      level
    );
  }

  public setValue(valueRegistry: ValueRegistry, value: Decimal): void {
    valueRegistry.getTyped<ConstantValue>(this.id).setValue(valueRegistry, value);
  }

  static register(
    registry: ValueRegistry,
    upgrade: RawUpgradeData
  ): UpgradeData {
    const upgradeLevel = new ConstantValue(upgrade.id, new Decimal(0));
    registry.add(upgradeLevel);

    const revealConditions = ConditionData.registerGroup(
      registry,
      `${upgrade.id}_reveal`,
      upgrade.revealConditions
    );

    const activationConditions = ConditionData.registerGroup(
      registry,
      `${upgrade.id}_activate`,
      upgrade.activationConditions
    );

    const costs = CostData.registerGroup(registry, upgrade.id, upgrade.costs);

    return new UpgradeData(
      upgrade.id,
      upgrade.name,
      upgrade.description,
      upgrade.maxLevel,
      upgrade.effects,
      costs,
      revealConditions,
      activationConditions,
      upgradeLevel
    );
  }

  override canPurchase(valueRegistry: ValueRegistry): boolean {
    const nextLevel = this.level.getValue(valueRegistry).plus(1);
    if (nextLevel.greaterThan(this.maxLevel)) return false;
    return super.canPurchase(valueRegistry);
  }

  override purchase(valueRegistry: ValueRegistry): void {
    if (!this.canPurchase(valueRegistry)) return;
    this.costs.forEach((cost) => cost.pay(valueRegistry));
    this.level.setValue(
      valueRegistry,
      this.level.getValue(valueRegistry).plus(1)
    );
  }
}

export class CoreData extends UnlockableData {
  constructor(
    public override id: string = "",
    public override name: string = "",
    public override description: string = "",
    public episodic_description: string = "",
    public witty_description: string = "",
    public override costs: CostData[] = [],
    public override revealConditions: ConditionData[] = [],
    public requirements: ConditionData[] = [],
    public override level: ConstantValue = new ConstantValue("", new Decimal(0))
  ) {
    super(id, name, description, costs, revealConditions, requirements, level);
  }

  static register(registry: ValueRegistry, core: RawCoreData): CoreData {
    const coreLevel = new ConstantValue(core.id, new Decimal(0));
    registry.add(coreLevel);

    const revealConditions = ConditionData.registerGroup(
      registry,
      `${core.id}_reveal`,
      core.revealConditions
    );

    const activationConditions = ConditionData.registerGroup(
      registry,
      `${core.id}_activate`,
      core.requirements
    );

    const costs = CostData.registerGroup(registry, core.id, core.costs);

    return new CoreData(
      core.id,
      core.name,
      core.description,
      core.episodic_description,
      core.witty_description,
      costs,
      revealConditions,
      activationConditions,
      coreLevel
    );
  }
}

export class FeatureData {
  constructor(
    public id: string = "",
    public name: string = "",
    public description: string = "",
    public requirements: ConditionData[] = []
  ) {}

  static register(
    registry: ValueRegistry,
    feature: RawFeatureData
  ): FeatureData {
    if (feature.requirements) {
      const requirements = ConditionData.registerGroup(
        registry,
        feature.id,
        feature.requirements
      );

      return new FeatureData(
        feature.id,
        feature.name,
        feature.description,
        requirements
      );
    } else {
      const featureLevel = new ConstantValue(feature.id, new Decimal(0));
      registry.add(featureLevel);

      return new FeatureData(
        feature.id,
        feature.name,
        feature.description,
        []
      );
    }
  }

  unlock(valueRegistry: ValueRegistry): void {
    if (this.requirements.length === 0) {
      const value = valueRegistry.get(this.id) as ConstantValue;
      value.setValue(valueRegistry, new Decimal(1));
    } else {
      console.error(`Manual unlock is not supported for feature ${this.id}`);
    }
  }

  isUnlocked(valueRegistry: ValueRegistry): boolean {
    return valueRegistry
      .get(this.id)
      .getValue(valueRegistry)
      .greaterThanOrEqualTo(1);
  }
}

export interface GoalEvent {
  eventId: string;
  type: string;
  who?: string;
  text?: string;
  id?: string;
  delay?: string;
  conditions?: string[];
}

export interface GoalData {
  id: string;
  conditions: Condition[];
  events: GoalEvent[];
}

export interface TriggerData {
  id: string;
  conditions: Condition[];
  events: GoalEvent[];
}

export interface RawValue {
  id: string;
  expression?: string;
  value?: string;
}

export interface RawResourceData {
  id: string;
  name: string;
  description: string;
  shortName: string;
  deltaExpression?: string;
  baseExpression?: string;
  multExpression?: string;
  flatExpression?: string;
}

export interface RawUpgradeData {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  revealConditions: Condition[];
  activationConditions: Condition[];
  costs: Cost[];
  effects: string[];
}

export interface RawFeatureData {
  id: string;
  name: string;
  description: string;
  requirements?: Condition[];
}

export interface RawCoreData {
  id: string;
  name: string;
  description: string;
  episodic_description: string;
  witty_description: string;
  revealConditions: Condition[];
  requirements?: Condition[];
  costs?: Cost[];
}

export interface RawData {
  logSubjects: LogSubject[];
  values: RawValue[];
  resources: RawResourceData[];
  upgrades: RawUpgradeData[];
  features: RawFeatureData[];
  cores: RawCoreData[];
  goals: GoalData[];
  triggers: TriggerData[];
}
