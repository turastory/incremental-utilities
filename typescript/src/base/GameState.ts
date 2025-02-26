import { Decimal } from "decimal.js";
import { ValueRegistry } from "./ValueRegistry";
import { ConstantValue, ResourceValue } from "./Value";
import { ExpressionParser } from "@/base/ExpressionParser";
import {
  LogSubject,
  ResourceData,
  FeatureData,
  GoalData,
  TriggerData,
  RawData,
  UpgradeData,
  CoreData,
} from "@/base/GameData";

export class GameState {
  private static instance: GameState;
  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  private registry: ValueRegistry;
  private logSubjects: Map<string, LogSubject>;
  private resources: Map<string, ResourceData>;
  private upgrades: Map<string, UpgradeData>;
  private features: Map<string, FeatureData>;
  private cores: Map<string, CoreData>;
  private goals: Map<string, GoalData>;
  private triggers: Map<string, TriggerData>;

  private activeGoalId: string | null = null;
  private eventQueue: Array<{
    eventId: string;
    type: string;
    who?: string;
    text?: string;
    id?: string;
    delay?: number;
    conditions?: string[];
  }> = [];

  private constructor() {
    this.registry = new ValueRegistry();
    this.logSubjects = new Map();
    this.resources = new Map();
    this.upgrades = new Map();
    this.features = new Map();
    this.cores = new Map();
    this.goals = new Map();
    this.triggers = new Map();
  }

  public get Registry(): ValueRegistry {
    return this.registry;
  }

  public async initialize(data: RawData): Promise<void> {
    // Initialize log subjects
    data.logSubjects.forEach((subject) => {
      this.logSubjects.set(subject.who, subject);
    });

    // Initialize values
    data.values.forEach((value) => {
      if (value.expression) {
        this.registry.addFormula(value.id, value.expression);
      } else if (value.value) {
        this.registry.add(
          new ConstantValue(value.id, new Decimal(value.value))
        );
      }
    });

    // Initialize resources
    data.resources.forEach((resource) => {
      this.resources.set(
        resource.id,
        ResourceData.register(this.registry, resource)
      );
    });

    // Initialize upgrades
    data.upgrades.forEach((upgrade) => {
      const upgradeData = UpgradeData.register(this.registry, upgrade);
      this.upgrades.set(upgrade.id, upgradeData);
    });

    // Initialize features
    data.features.forEach((feature) => {
      const featureData = FeatureData.register(this.registry, feature);
      this.features.set(feature.id, featureData);
    });

    // Initialize cores
    data.cores.forEach((core) => {
      const coreData = CoreData.register(this.registry, core);
      this.cores.set(core.id, coreData);
    });

    // Initialize goals
    data.goals.forEach((goal) => {
      this.goals.set(goal.id, goal);
    });

    // Initialize triggers
    data.triggers.forEach((trigger) => {
      this.triggers.set(trigger.id, trigger);
    });

    this.registry.printOutDependencies();
  }

  public update(deltaTime: number): void {
    this.registry.update(deltaTime);
  }

  public getResource(id: string): ResourceData | undefined {
    return this.resources.get(id);
  }

  public getUpgrade(id: string): UpgradeData | undefined {
    return this.upgrades.get(id);
  }

  public getFeature(id: string): FeatureData | undefined {
    return this.features.get(id);
  }

  public getCore(id: string): CoreData | undefined {
    return this.cores.get(id);
  }

  public getGoal(id: string): GoalData | undefined {
    return this.goals.get(id);
  }

  public getTrigger(id: string): TriggerData | undefined {
    return this.triggers.get(id);
  }

  public getLogSubject(who: string): LogSubject | undefined {
    return this.logSubjects.get(who);
  }

  public newGoal(id: string): void {
    const goal = this.getGoal(id);
    if (!goal || this.activeGoalId === id) {
      return;
    }

    // TODO: Implement goal activation logic
    this.activeGoalId = id;
  }

  public queueEvent(event: {
    eventId: string;
    type: string;
    who?: string;
    text?: string;
    id?: string;
    delay?: number;
    conditions?: string[];
  }): void {
    this.eventQueue.push(event);
  }

  public purchaseUpgrade(upgradeId: string): void {
    const upgrade = this.getUpgrade(upgradeId);
    if (!upgrade) {
      console.error(`PurchaseUpgrade: Upgrade ${upgradeId} not found`);
      return;
    }

    console.log("PurchaseUpgrade - " + upgradeId);

    // TODO: Implement purchase logic
  }

  public totalCost(upgradeId: string, level: number): Decimal {
    const upgrade = this.getUpgrade(upgradeId);
    if (!upgrade) {
      console.error(`TotalCost: Upgrade ${upgradeId} not found`);
      return new Decimal(0);
    }

    let totalCost = new Decimal(0);
    const initialLevel = upgrade.level.getValue(this.registry);
    const cost = upgrade.costs[0];
    for (let i = 0; i < level; i++) {
      const costValue = this.registry.get(cost.costId);
      upgrade.setValue(this.registry, new Decimal(i));
      totalCost = totalCost.plus(costValue.getValue(this.registry));

      console.log(
        "TotalCost - " +
          upgradeId +
          " " +
          i +
          " " +
          costValue.getValue(this.registry)
      );
    }
    upgrade.setValue(this.registry, initialLevel);

    return totalCost;
  }
}
