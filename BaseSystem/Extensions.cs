using BreakInfinity;

namespace BaseSystem
{
    public static class StringExtensions
    {
        public static string Capitalize(this string str)
        {
            return str[..1].ToUpper() + str[1..];
        }
    }

    public static class BigDoubleExtensions
    {
        private static readonly string precision = "G4";

        public static string SignedString(this BigDouble value)
        {
            if (BigDouble.IsNaN(value))
                return "NaN";
            return value.Sign() > 0 ? $"+{value.ToString(precision)}" : value.ToString(precision);
        }

        public static string UnsignedString(this BigDouble value)
        {
            if (BigDouble.IsNaN(value))
                return "NaN";
            return value.ToString(precision);
        }

        public static BigDouble Clamp(this BigDouble value, BigDouble min, BigDouble max)
        {
            return BigDouble.Max(BigDouble.Min(value, max), min);
        }

        public static BigDouble ZeroIfNearZero(this BigDouble value)
        {
            if (value.Abs() < 1e-8)
                return 0;
            return value;
        }
    }
}
