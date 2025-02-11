using BreakInfinity;

// See https://aka.ms/new-console-template for more information
ExpressionCache expressionCache = new ExpressionCache();

// expressionCache.expression = "1000 * Pow(2, level) + 10";
// expressionCache.ParseExpression();
// BigDouble result = expressionCache.Evaluate(5);

// var target = new Interpreter().Reference(typeof(BigDouble));

// var result = target.Eval(
//     "BigDouble.Multiply(BigDouble.Pow(new BigDouble(2), 5), new BigDouble(30))"
// );
Func<double, BigDouble> result = ExpressionParser.Parse(
    "2 + level * 5 - 2^3 + min(level^2, 100, 50, 25, 20, 10)"
);