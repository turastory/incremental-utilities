using BreakInfinity;

Func<double, BigDouble> result = ExpressionParser.Parse(
    "2 + level * 5 - 2^3 + min(level^2, 100, 50, 25, 20, 10)"
);

Console.WriteLine(result(5));
