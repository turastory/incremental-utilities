using System;
using BreakInfinity;
using DynamicExpresso;

[Serializable]
public class ExpressionCache
{
    public string expression;

    // DynamicExpresso에서 파싱 완료된 람다를 보관
    private Lambda parsedLambda;

    private Func<long, BigDouble> compiledLambda;

    // 파서 준비용 Interpreter (static 한 번만 만드는 방식도 가능)
    private static Interpreter interpreter;

    // 생성자 or 메서드
    public void ParseExpression()
    {
        if (string.IsNullOrEmpty(expression))
        {
            // 비어있는 경우, 예외 처리(또는 디폴트값)
            parsedLambda = interpreter.Parse("0");
            return;
        }

        if (interpreter == null)
        {
            interpreter = new Interpreter()
                // 필요한 클래스나 함수 레퍼런스 추가
                // .Reference(typeof(Math)) // "Math" 클래스의 메서드들 사용 가능
                // .Reference(typeof(Mathf)) // UnityEngine.Mathf 도 가능
                .Reference(typeof(BigDouble))
                .SetFunction(
                    "Pow",
                    (Func<double, double, BigDouble>)((x, y) => BigDouble.Pow(x, y))
                );
        }

        // 이 예시는 "level" 하나의 파라미터만 받는다고 가정
        // 만약 여러 변수를 쓰고 싶다면 .Parse(expression, new Parameter("level", typeof(BigDouble)), new Parameter("stability", typeof(BigDouble)), ...) 식으로 확장
        parsedLambda = interpreter.Parse(
            $"new BigDouble({expression})",
            new Parameter("level", typeof(long))
        );
        compiledLambda = parsedLambda.Compile<Func<long, BigDouble>>();
    }

    public BigDouble Evaluate(long level)
    {
        if (parsedLambda == null)
        {
            // 파싱되지 않은 경우, 안전장치
            return BigDouble.Zero;
        }

        var result = parsedLambda.Invoke(level);

        // result는 이미 BigDouble 타입일 가능성이 높으므로
        // Convert.ToSingle()을 사용하면 정밀도가 손실될 수 있습니다.
        if (result is BigDouble bigDoubleResult)
        {
            return bigDoubleResult;
        }

        // 다른 숫자 타입인 경우 BigDouble로 변환
        return new BigDouble(Convert.ToDouble(result));
    }
}
