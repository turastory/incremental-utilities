using BreakInfinity;
using DynamicExpresso;

SimpleValueRegistry registry = new();

var cpuClock = new ConstantValue("cpu_clock", 1);
var u_fl = new ConstantValue("u_fl", 0);
registry.AddValue(cpuClock);
registry.AddValue(new ConstantValue("batch", 1));
registry.AddValue(u_fl);

var bits_gain = registry.AddResource(
    valueId: "bits_delta",
    deltaExpression: "u_fl",
    baseExpression: "cpu_clock * batch"
);
var bits = registry.AddResource(valueId: "bits", deltaExpression: "bits_delta");

registry.PrintOutDependencies();

Action<object?> Print = (object? text) =>
{
    Console.WriteLine($"{text}");
};

Action PrintAll = () =>
{
    Console.WriteLine($"-----");
    Console.WriteLine($"{bits_gain.ValueId} - {bits_gain.GetValue(registry)}");
    Console.WriteLine($"{bits.ValueId} - {bits.GetValue(registry)}");
    Console.WriteLine($"-----");
};

PrintAll();

// "Level Up"
Print("Set CPU Clock to 10");
cpuClock.SetValue(registry, 10);
PrintAll();

Print("Do Update!");
bits.Update(registry, 1);
PrintAll();

Print("Set u_fl to 1");
u_fl.SetValue(registry, 1);
PrintAll();

Print("Do Update!");
registry.Update();
PrintAll();

Print("Do Update!");
registry.Update();
PrintAll();

Print("Do Update!");
registry.Update();
PrintAll();

Print("Do Update!");
registry.Update();
PrintAll();
