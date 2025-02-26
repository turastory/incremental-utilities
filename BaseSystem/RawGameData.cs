using System;

namespace BaseSystem
{
    [Serializable]
    public class RawData
    {
        public RawLogSubject[] logSubjects;
        public RawValue[] values;
        public RawResourceData[] resources;
        public RawUpgradeData[] upgrades;
        public RawFeatureData[] features;
        public RawCoreData[] cores;
        public RawGoalData[] goals;
        public RawTriggerData[] triggers;
    }

    [Serializable]
    public class RawLogSubject
    {
        public string who;
        public int typingSpeed;
        public string color;
    }

    [Serializable]
    public class RawValue
    {
        public string id;

        // Either expression or value must be set.
        // If both are set, expression takes precedence.
        public string expression;
        public string value;
    }

    [Serializable]
    public class RawResourceData
    {
        public string id;
        public string name;
        public string description;
        public string shortName;
        public string deltaExpression;
        public string baseExpression;
        public string multExpression;
        public string flatExpression;
    }

    [Serializable]
    public class RawUpgradeData
    {
        public string id;
        public string name;
        public string description;
        public int maxLevel;
        public RawUpgradeCost[] costs;
        public RawCondition[] revealConditions;
        public RawCondition[] activationConditions;
        public string[] effects;
    }

    [Serializable]
    public class RawUpgradeCost
    {
        public string resourceId;
        public string expression;
    }

    [Serializable]
    public class RawCondition
    {
        public string type;
        public string targetId;
        public string amount = "1";
        public string text;
    }

    [Serializable]
    public class RawFeatureData
    {
        public string id;
        public string name;
        public string description;
        public RawCondition[] requirements;
    }

    [Serializable]
    public class RawCoreData
    {
        public string id;
        public string name;
        public string description;
        public string episodicDescription;
        public string wittyDescription;
        public RawUpgradeCost[] costs;
        public RawCondition[] revealConditions;
        public RawCondition[] requirements;
    }

    [Serializable]
    public class RawTriggerData
    {
        public string id;
        public RawCondition[] conditions;
        public RawEvent[] events;
    }

    [Serializable]
    public class RawGoalData : RawTriggerData { }

    [Serializable]
    public class RawEvent
    {
        public string eventId;
        public string type;
        public string delay;

        // For unlock event
        public string id;

        // For log event
        public string who;
        public string text;

        // For wait event
        public string[] conditions;
    }
}
