using System;
using System.Linq;
using BreakInfinity;

namespace BaseSystem
{
    public interface IGameState
    {
        ValueRegistry Registry { get; }
        FeatureData GetFeature(string id);
        UpgradeData GetUpgrade(string id);
        CoreData GetCore(string id);
        ResourceData GetResource(string id);
        void QueueEvent(Event eventItem);

        void AddLog(string who, string text);
        void NewGoal(string id);
    }

    public class LogSubject
    {
        public string who;
        public int typingSpeed;

        // public Color color;

        public static LogSubject FromRawLogSubject(RawLogSubject raw)
        {
            // ColorUtility.TryParseHtmlString(raw.color, out var color);
            return new LogSubject
            {
                who = raw.who,
                typingSpeed = raw.typingSpeed,
                // color = color,
            };
        }
    }

    public class ResourceData
    {
        public string id;

        // These values might be null (intermediate values)
        public string name;
        public string description;
        public string shortName;

        public BigDouble GetValue(ValueRegistry valueRegistry)
        {
            return valueRegistry.Get(id).GetValue(valueRegistry);
        }

        public static ResourceData Register(ValueRegistry registry, RawResourceData resource)
        {
            registry.AddResource(
                resource.id,
                deltaExpression: resource.deltaExpression ?? "0",
                baseExpression: resource.baseExpression ?? "0",
                multExpression: resource.multExpression ?? "1",
                flatExpression: resource.flatExpression ?? "0"
            );

            return new ResourceData
            {
                id = resource.id,
                name = resource.name,
                description = resource.description,
                shortName = resource.shortName,
            };
        }
    }

    public class CostData
    {
        public string resourceId;
        public string costId;

        public static CostData Register(ValueRegistry registry, RawUpgradeCost cost, string id)
        {
            var costId = id + "_cost_" + cost.resourceId;
            cost.expression = cost.expression.Replace("level", id);
            registry.AddFormula(costId, cost.expression);
            return new CostData { resourceId = cost.resourceId, costId = costId };
        }

        public static CostData[] RegisterGroup(
            ValueRegistry registry,
            string id,
            RawUpgradeCost[] costs
        )
        {
            if (costs == null)
                return Array.Empty<CostData>();

            return costs.Select(cost => Register(registry, cost, id)).ToArray();
        }

        public bool Affordable(ValueRegistry valueRegistry)
        {
            return GetDiff(valueRegistry) >= 0;
        }

        private BigDouble GetDiff(ValueRegistry valueRegistry)
        {
            var resourceValue = valueRegistry.Get<ResourceValue>(resourceId);
            var costValue = valueRegistry.Get(costId);
            return resourceValue.GetValue(valueRegistry) - costValue.GetValue(valueRegistry);
        }

        public void Pay(ValueRegistry valueRegistry)
        {
            valueRegistry
                .Get<ResourceValue>(resourceId)
                .SetValue(valueRegistry, GetDiff(valueRegistry));
        }
    }

    public class ConditionData
    {
        public enum Type
        {
            ResourceSufficient,
            UpgradeUnlocked,
            FeatureUnlocked,
            CoreUnlocked,
        }

        public string id;
        public Type type;
        public string targetId;
        public BigDouble amount;
        public string text;

        public bool IsMet(ValueRegistry valueRegistry)
        {
            return valueRegistry.Get(id).GetValue(valueRegistry) >= 1;
        }

        public static ConditionData Register(
            ValueRegistry registry,
            RawCondition condition,
            string prefix = ""
        )
        {
            var key = prefix + "_" + condition.type + "_" + condition.targetId;
            var amount = condition.amount ?? "1";

            // TODO: Move >= to data.json. This is possible.
            //       Replace GetConditionString with ConditionData.text
            registry.AddCondition(key, $"{condition.targetId} >= {amount}");

            return new ConditionData
            {
                id = key,
                type = (Type)
                    Enum.Parse(
                        typeof(Type),
                        string.Join("", condition.type.Split("_").Select(s => s.Capitalize()))
                    ),
                targetId = condition.targetId,
                amount = BigDouble.Parse(amount),
                text = condition.text,
            };
        }

        public static ConditionData[] RegisterGroup(
            ValueRegistry registry,
            string id,
            RawCondition[] conditions
        )
        {
            var conditionData =
                conditions?.Select(condition => Register(registry, condition, id)).ToArray()
                ?? Array.Empty<ConditionData>();

            registry.AddCondition(
                id,
                Expression.And(conditionData.Select(condition => condition.id).ToArray())
            );

            return conditionData;
        }
    }

    public abstract class UnlockableData
    {
        public string id;
        public string name;
        public string description;
        public CostData[] costs;
        public ConditionData[] revealConditions;
        public ConditionData[] activationConditions;
        public ConstantValue level;

        public bool IsUnlocked(ValueRegistry valueRegistry)
        {
            return valueRegistry.Get(id).GetValue(valueRegistry) >= 1;
        }

        public bool IsRevealed(ValueRegistry registry)
        {
            return registry.Get(id + "_reveal").GetValue(registry) >= 1;
        }

        public bool IsActivated(ValueRegistry registry)
        {
            return registry.Get(id + "_activate").GetValue(registry) >= 1;
        }

        public virtual void Purchase(ValueRegistry valueRegistry)
        {
            if (!CanPurchase(valueRegistry))
                return;

            // 비용 지불
            foreach (var cost in costs)
            {
                cost.Pay(valueRegistry);
            }

            level.SetValue(valueRegistry, 1);
        }

        public virtual bool CanPurchase(ValueRegistry valueRegistry)
        {
            if (!IsActivated(valueRegistry))
                return false;

            if (costs == null)
                return true;

            foreach (var cost in costs)
            {
                if (!cost.Affordable(valueRegistry))
                {
                    return false;
                }
            }

            return true;
        }
    }

    public class UpgradeData : UnlockableData
    {
        public int maxLevel;
        public string[] effects;

        public override void Purchase(ValueRegistry valueRegistry)
        {
            if (!CanPurchase(valueRegistry))
                return;

            foreach (var cost in costs)
            {
                cost.Pay(valueRegistry);
            }

            level.SetValue(valueRegistry, level.GetValue(valueRegistry) + 1);
        }

        public override bool CanPurchase(ValueRegistry valueRegistry)
        {
            var nextLevel = level.GetValue(valueRegistry) + 1;
            if (nextLevel > maxLevel)
                return false;

            return base.CanPurchase(valueRegistry);
        }

        public static UpgradeData Register(ValueRegistry registry, RawUpgradeData upgrade)
        {
            var upgradeLevel = new ConstantValue(upgrade.id, 0);
            registry.Add(upgradeLevel);

            var revealConditions = ConditionData.RegisterGroup(
                registry,
                upgrade.id + "_reveal",
                upgrade.revealConditions
            );
            var activationConditions = ConditionData.RegisterGroup(
                registry,
                upgrade.id + "_activate",
                upgrade.activationConditions
            );

            return new UpgradeData
            {
                id = upgrade.id,
                name = upgrade.name,
                description = upgrade.description,
                maxLevel = upgrade.maxLevel,
                level = upgradeLevel,
                costs = CostData.RegisterGroup(registry, upgrade.id, upgrade.costs),
                revealConditions = revealConditions,
                activationConditions = activationConditions,
                effects = upgrade.effects,
            };
        }
    }

    public class CoreData : UnlockableData
    {
        public string episodicDescription;
        public string wittyDescription;

        public static CoreData Register(ValueRegistry registry, RawCoreData core)
        {
            var coreLevel = new ConstantValue(core.id, 0);
            registry.Add(coreLevel);

            var revealConditions = ConditionData.RegisterGroup(
                registry,
                core.id + "_reveal",
                core.revealConditions
            );
            var activationConditions = ConditionData.RegisterGroup(
                registry,
                core.id + "_activate",
                core.requirements
            );

            return new CoreData
            {
                id = core.id,
                name = core.name,
                description = core.description,
                episodicDescription = core.episodicDescription,
                wittyDescription = core.wittyDescription,
                level = coreLevel,
                costs = CostData.RegisterGroup(registry, core.id, core.costs),
                revealConditions = revealConditions,
                activationConditions = activationConditions,
            };
        }
    }

    public class FeatureData
    {
        public string id;
        public string name;
        public string description;
        public ConditionData[] requirements;

        public void Unlock(ValueRegistry valueRegistry)
        {
            if (requirements.Length == 0)
            {
                valueRegistry.Get<ConstantValue>(id).SetValue(valueRegistry, 1);
            }
            else
            {
                Console.WriteLine($"Manual unlock is not supported for feature {id}");
            }
        }

        public bool IsUnlocked(ValueRegistry valueRegistry)
        {
            return valueRegistry.Get(id).IsMet(valueRegistry);
        }

        public static FeatureData Register(ValueRegistry registry, RawFeatureData feature)
        {
            if (feature.requirements != null)
            {
                var conditions = ConditionData.RegisterGroup(
                    registry,
                    feature.id,
                    feature.requirements
                );

                return new FeatureData
                {
                    id = feature.id,
                    name = feature.name,
                    description = feature.description,
                    requirements = conditions,
                };
            }
            else
            {
                var featureLevel = new ConstantValue(feature.id, 0);
                registry.Add(featureLevel);

                return new FeatureData
                {
                    id = feature.id,
                    name = feature.name,
                    description = feature.description,
                    requirements = Array.Empty<ConditionData>(),
                };
            }
        }
    }

    public enum EventType
    {
        Log,
        FeatureUnlock,
        NewGoal,
        WaitUntil,
    }

    public abstract class Event
    {
        public EventType type;
        public string eventId;
        public int delay = 0;

        public async Task Apply(IGameState gameState)
        {
            await ApplyInternal(gameState);

            if (delay > 0)
                await Task.Delay(delay);
        }

        public abstract Task ApplyInternal(IGameState gameState);

        public static Event Parse(RawEvent rawEvent, string prefix = "")
        {
            var type = (EventType)
                Enum.Parse(
                    typeof(EventType),
                    string.Join("", rawEvent.type.Split("_").Select(s => s.Capitalize()))
                );

            var delay =
                rawEvent.delay != null ? int.Parse(rawEvent.delay)
                : type == EventType.Log ? 1000
                : 0;

            var eventId = prefix != null ? prefix + "_" + rawEvent.eventId : rawEvent.eventId;

            return type switch
            {
                EventType.Log => new LogEvent
                {
                    eventId = eventId,
                    type = type,
                    delay = delay,
                    text = rawEvent.text,
                    who = rawEvent.who,
                },
                EventType.FeatureUnlock => new StateChangeEvent
                {
                    eventId = eventId,
                    type = type,
                    delay = delay,
                    id = rawEvent.id,
                },
                EventType.NewGoal => new StateChangeEvent
                {
                    eventId = eventId,
                    type = type,
                    delay = delay,
                    id = rawEvent.id,
                },
                EventType.WaitUntil => new WaitEvent
                {
                    eventId = eventId,
                    type = type,
                    delay = delay,
                    conditions = rawEvent.conditions,
                },
                _ => throw new NotImplementedException(
                    $"Event type {rawEvent.type} not implemented"
                ),
            };
        }
    }

    public class LogEvent : Event
    {
        public string who = "system";
        public string text;

        public override async Task ApplyInternal(IGameState gameState)
        {
            Console.WriteLine($"Applying {type} event: {who} - {text}");

            // 로그 추가
            // var listText = gameState.AddLog(who, text);
            // if (listText == null)
            // return;

            // 타이핑 대기
            // var typewriter = listText.ContentText;
            // if (typewriter != null)
            // {
            //     await Task.WaitUntil(() => !typewriter.IsTyping);
            // }
        }
    }

    public class StateChangeEvent : Event
    {
        public string id;

        public override Task ApplyInternal(IGameState gameState)
        {
            Console.WriteLine($"Applying {type} event: {id}");
            switch (type)
            {
                case EventType.FeatureUnlock:
                    gameState.GetFeature(id).Unlock(gameState.Registry);
                    break;
                case EventType.NewGoal:
                    gameState.NewGoal(id);
                    break;
            }

            return Task.CompletedTask;
        }
    }

    public class WaitEvent : Event
    {
        public string[] conditions;

        public override async Task ApplyInternal(IGameState gameState)
        {
            Console.WriteLine($"Waiting for {conditions.Length} conditions to be met");
            await Task.WhenAll(
                conditions.Select(condition =>
                    Task.Run(async () =>
                    {
                        while (gameState.Registry.Get(condition).GetValue(gameState.Registry) < 1)
                        {
                            await Task.Delay(100); // Check every 100ms
                        }
                    })
                )
            );
        }
    }

    public class TriggerData
    {
        public string id;
        public ConditionData[] conditions;
        public Event[] events;

        public static TriggerData Register(
            ValueRegistry registry,
            RawTriggerData trigger,
            Action<ValueRegistry, string, Event[]> onConditionMet = null
        )
        {
            var conditionsData = trigger
                .conditions.Select(condition =>
                    ConditionData.Register(registry, condition, trigger.id)
                )
                .ToArray();

            var eventsData = trigger
                .events.Select(eventItem => Event.Parse(eventItem, trigger.id))
                .ToArray();

            registry.AddCondition(
                trigger.id,
                Expression.And(conditionsData.Select(condition => condition.id).ToArray()),
                isMet: false, // TODO: Get from saved data
                onConditionMet: (reg) =>
                {
                    Console.WriteLine($"Trigger {trigger.id} met");
                    onConditionMet?.Invoke(reg, trigger.id, eventsData);
                }
            );

            return new TriggerData
            {
                id = trigger.id,
                conditions = conditionsData,
                events = eventsData,
            };
        }
    }

    public class GoalData
    {
        public string id;
        public ConditionData[] conditions;
        public Event[] events;

        public bool IsMet(ValueRegistry valueRegistry)
        {
            return valueRegistry.Get(id).IsMet(valueRegistry);
        }

        public void SetActive(ValueRegistry valueRegistry)
        {
            valueRegistry.Get<ConstantValue>($"{id}_active").SetValue(valueRegistry, 1);
        }

        public static GoalData Register(
            ValueRegistry registry,
            RawGoalData goal,
            Action<ValueRegistry, string, Event[]> onConditionMet = null
        )
        {
            var conditionsData = goal
                .conditions.Select(condition =>
                    ConditionData.Register(registry, condition, goal.id)
                )
                .ToArray();

            // Only evaluate when 'isActive' is true
            var isActive = new ConstantValue($"{goal.id}_active", 0);
            var conditionExpression = Expression.And(
                new[] { isActive.ValueId }
                    .Concat(conditionsData.Select(condition => condition.id))
                    .ToArray()
            );

            var eventsData = goal
                .events.Select(eventItem => Event.Parse(eventItem, goal.id))
                .ToArray();

            registry.Add(isActive);
            registry.AddCondition(
                goal.id,
                conditionExpression,
                isMet: false, // TODO: Get from saved data
                onConditionMet: (reg) => onConditionMet?.Invoke(reg, goal.id, eventsData)
            );

            return new GoalData
            {
                id = goal.id,
                conditions = conditionsData,
                events = eventsData,
            };
        }
    }

    public static class GameDataExtensions
    {
        public static bool IsMet(this Value value, ValueRegistry registry)
        {
            return value.GetValue(registry) >= 1;
        }

        public static string GetCostString(this UpgradeData upgrade, IGameState gameState)
        {
            var registry = gameState.Registry;
            return string.Join(
                "\n",
                upgrade.costs.Select(cost =>
                    $"{registry.Get(cost.costId).GetValue(registry).UnsignedString()} {gameState.GetResource(cost.resourceId).shortName}"
                )
            );
        }

        public static string GetConditionsString(
            this ConditionData[] conditions,
            IGameState gameState
        )
        {
            return string.Join(
                "\n",
                conditions.Select(condition => GetConditionString(condition, gameState))
            );
        }

        public static string GetConditionString(this ConditionData condition, IGameState gameState)
        {
            if (condition.text != null)
                return condition.text;

            return condition.type switch
            {
                ConditionData.Type.ResourceSufficient =>
                    $"{condition.amount} {gameState.GetResource(condition.targetId).shortName}",
                ConditionData.Type.UpgradeUnlocked =>
                    $"Upgrade {gameState.GetUpgrade(condition.targetId).name}{(condition.amount > 1 ? $" LV.{condition.amount}" : "")}",
                ConditionData.Type.FeatureUnlocked =>
                    $"Unlock {gameState.GetFeature(condition.targetId).name}",
                ConditionData.Type.CoreUnlocked =>
                    $"Unlock {gameState.GetCore(condition.targetId).name}",
                _ => "",
            };
        }
    }
}
