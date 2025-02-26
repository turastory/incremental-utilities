using System;
using System.Collections.Generic;
using System.Linq;
using BreakInfinity;

namespace BaseSystem
{
    public static class Expression
    {
        public static string AlwaysTrue = "1";
        public static string AlwaysFalse = "0";

        public static string And(params string[] expressions) =>
            expressions.Length > 1 ? $"and({string.Join(", ", expressions)})"
            : expressions.Length == 1 ? expressions[0]
            : AlwaysTrue;

        public static string Or(params string[] expressions) =>
            expressions.Length > 1 ? $"or({string.Join(", ", expressions)})"
            : expressions.Length == 1 ? expressions[0]
            : AlwaysFalse;
    }

    public struct ParseResult
    {
        public Func<ValueRegistry, BigDouble> Function { get; set; }
        public HashSet<string> Dependencies { get; set; }
    }

    public class ExpressionParser
    {
        // Input: 2 + level * 5 - 2^3
        public static Func<ValueRegistry, BigDouble> Parse(string input)
        {
            Console.WriteLine($"Parsing expression: {input}");
            var tokens = Tokenize(input);
            var ast = BuildAST(tokens);

            return (valueRegistry) =>
            {
                return EvaluateAST(ast, valueRegistry);
            };
        }

        public static ParseResult ParseWithDependencies(string input)
        {
            Console.WriteLine($"Parsing expression: {input}");
            var tokens = Tokenize(input);
            var ast = BuildAST(tokens);
            var dependencies = new HashSet<string>();

            // 의존성 수집
            CollectDependencies(ast, dependencies);

            return new ParseResult
            {
                Function = (valueRegistry) => EvaluateAST(ast, valueRegistry),
                Dependencies = dependencies,
            };
        }

        private static string[] Tokenize(string input)
        {
            var tokens = new List<string>();
            var currentToken = "";

            for (int i = 0; i < input.Length; i++)
            {
                var c = input[i];

                // 공백은 현재 토큰을 종료하고 건너뜁니다
                if (char.IsWhiteSpace(c))
                {
                    if (currentToken != "")
                    {
                        tokens.Add(currentToken);
                        currentToken = "";
                    }
                    continue;
                }

                // 특수 문자들은 독립적인 토큰으로 처리
                if (c is '(' or ')' or ',')
                {
                    if (currentToken != "")
                    {
                        tokens.Add(currentToken);
                        currentToken = "";
                    }
                    tokens.Add(c.ToString());
                    continue;
                }

                // 두 글자 연산자 체크
                if (i < input.Length - 1)
                {
                    var nextC = input[i + 1];
                    var twoChars = c.ToString() + nextC;
                    if (twoChars is ">=" or "<=" or "==" or "!=")
                    {
                        if (currentToken != "")
                        {
                            tokens.Add(currentToken);
                            currentToken = "";
                        }
                        tokens.Add(twoChars);
                        i++; // 다음 문자는 이미 처리했으므로 건너뜁니다
                        continue;
                    }
                }

                // 한 글자 연산자 체크
                if (c is '+' or '-' or '*' or '/' or '^' or '>' or '<')
                {
                    if (currentToken != "")
                    {
                        tokens.Add(currentToken);
                        currentToken = "";
                    }
                    tokens.Add(c.ToString());
                    continue;
                }

                // 나머지 문자들은 현재 토큰에 추가
                currentToken += c;
            }

            // 마지막 토큰이 남아있다면 추가
            if (currentToken != "")
            {
                tokens.Add(currentToken);
            }

            return tokens.ToArray();
        }

        private static Node BuildAST(string[] tokens)
        {
            var stack = new Stack<Node>();
            var operators = new Stack<string>();
            var functionParams = new Stack<int>(); // 함수 파라미터 개수 추적

            for (int i = 0; i < tokens.Length; i++)
            {
                var token = tokens[i];

                if (IsFunction(token))
                {
                    operators.Push(token);
                    functionParams.Push(0); // 파라미터 카운트 초기화
                }
                else if (token == "(")
                {
                    operators.Push(token);
                }
                else if (token == ")")
                {
                    while (operators.Count > 0 && operators.Peek() != "(")
                    {
                        ProcessOperator(stack, operators.Pop());
                    }
                    operators.Pop(); // "(" 제거

                    if (operators.Count > 0 && IsFunction(operators.Peek()))
                    {
                        var func = operators.Pop();
                        var paramCount = functionParams.Pop() + 1;
                        ProcessFunction(stack, func, paramCount);
                    }
                }
                else if (token == ",")
                {
                    while (operators.Count > 0 && operators.Peek() != "(")
                    {
                        ProcessOperator(stack, operators.Pop());
                    }
                    if (functionParams.Count > 0)
                    {
                        functionParams.Push(functionParams.Pop() + 1);
                    }
                }
                else if (IsOperator(token))
                {
                    while (
                        operators.Count > 0
                        && operators.Peek() != "("
                        && GetPrecedence(operators.Peek()) >= GetPrecedence(token)
                    )
                    {
                        ProcessOperator(stack, operators.Pop());
                    }
                    operators.Push(token);
                }
                else
                {
                    stack.Push(new Node { Value = token });
                }
            }

            while (operators.Count > 0)
            {
                ProcessOperator(stack, operators.Pop());
            }

            return stack.Pop();
        }

        private static void ProcessOperator(Stack<Node> stack, string op)
        {
            var right = stack.Pop();
            var left = stack.Pop();
            stack.Push(
                new Node
                {
                    Value = op,
                    Left = left,
                    Right = right,
                }
            );
        }

        private static void ProcessFunction(Stack<Node> stack, string func, int paramCount)
        {
            var parameters = new Node[paramCount];
            for (int i = paramCount - 1; i >= 0; i--)
            {
                parameters[i] = stack.Pop();
            }
            stack.Push(new Node { Value = func, Parameters = parameters });
        }

        private static bool IsOperator(string token)
        {
            return token
                is "+"
                    or "-"
                    or "*"
                    or "/"
                    or "^"
                    or ">"
                    or "<"
                    or ">="
                    or "<="
                    or "=="
                    or "!=";
        }

        private static bool IsFunction(string token)
        {
            return token is "min" or "max" or "and" or "or";
        }

        private static int GetPrecedence(string op) =>
            op switch
            {
                "==" or "!=" => 1,
                ">" or "<" or ">=" or "<=" => 2,
                "+" or "-" => 3,
                "*" or "/" => 4,
                "^" => 5,
                _ => 0,
            };

        private static BigDouble EvaluateAST(Node node, ValueRegistry valueRegistry)
        {
            if (node == null)
                return 0;

            // 숫자인 경우
            if (double.TryParse(node.Value, out double number))
                return number;

            // 연산자나 함수가 아닌 문자열인 경우 valueRegistry에서 값을 가져옴
            if (!IsOperator(node.Value) && !IsFunction(node.Value) && node.Parameters == null)
                return valueRegistry.Get(node.Value).GetValue(valueRegistry);

            if (node.Parameters != null)
            {
                // Use lazy evaluation to avoid unnecessary computations
                return node.Value switch
                {
                    "min" => node.Parameters.Select(p => EvaluateAST(p, valueRegistry)).Min(),
                    "max" => node.Parameters.Select(p => EvaluateAST(p, valueRegistry)).Max(),
                    "and" => node.Parameters.Any(p => EvaluateAST(p, valueRegistry) < 1) ? 0 : 1,
                    "or" => node.Parameters.Any(p => EvaluateAST(p, valueRegistry) >= 1) ? 1 : 0,
                    _ => throw new ArgumentException($"Unknown function: {node.Value}"),
                };
            }

            return node.Value switch
            {
                "+" => EvaluateAST(node.Left, valueRegistry)
                    + EvaluateAST(node.Right, valueRegistry),
                "-" => EvaluateAST(node.Left, valueRegistry)
                    - EvaluateAST(node.Right, valueRegistry),
                "*" => EvaluateAST(node.Left, valueRegistry)
                    * EvaluateAST(node.Right, valueRegistry),
                "/" => EvaluateAST(node.Left, valueRegistry)
                    / EvaluateAST(node.Right, valueRegistry),
                "^" => BigDouble.Pow(
                    EvaluateAST(node.Left, valueRegistry),
                    EvaluateAST(node.Right, valueRegistry)
                ),
                ">" => EvaluateAST(node.Left, valueRegistry)
                > EvaluateAST(node.Right, valueRegistry)
                    ? 1
                    : 0,
                "<" => EvaluateAST(node.Left, valueRegistry)
                < EvaluateAST(node.Right, valueRegistry)
                    ? 1
                    : 0,
                ">=" => EvaluateAST(node.Left, valueRegistry)
                >= EvaluateAST(node.Right, valueRegistry)
                    ? 1
                    : 0,
                "<=" => EvaluateAST(node.Left, valueRegistry)
                <= EvaluateAST(node.Right, valueRegistry)
                    ? 1
                    : 0,
                "==" => EvaluateAST(node.Left, valueRegistry)
                == EvaluateAST(node.Right, valueRegistry)
                    ? 1
                    : 0,
                "!=" => EvaluateAST(node.Left, valueRegistry)
                != EvaluateAST(node.Right, valueRegistry)
                    ? 1
                    : 0,
                _ => throw new ArgumentException($"Unknown operator: {node.Value}"),
            };
        }

        private static void CollectDependencies(Node node, HashSet<string> dependencies)
        {
            if (node == null)
                return;

            // 숫자가 아니고, 연산자나 함수도 아닌 경우 의존성으로 추가
            if (
                !double.TryParse(node.Value, out _)
                && !IsOperator(node.Value)
                && !IsFunction(node.Value)
            )
            {
                dependencies.Add(node.Value);
            }

            // 재귀적으로 자식 노드들의 의존성도 수집
            if (node.Parameters != null)
            {
                foreach (var param in node.Parameters)
                {
                    CollectDependencies(param, dependencies);
                }
            }
            else
            {
                CollectDependencies(node.Left, dependencies);
                CollectDependencies(node.Right, dependencies);
            }
        }

        private class Node
        {
            public string Value { get; set; }
            public Node Left { get; set; }
            public Node Right { get; set; }
            public Node[] Parameters { get; set; } // 함수 파라미터용
        }
    }
}
