# C# Utilities for incremental games

Here're some utilities made for my incremental games.

## [Expression Parser](/ExpressionParser.cs)

A C# mathematical expression parser with large number support.

### Features

- Arithmetic operators (+, -, \*, /, ^)
- Functions (min, max)
- Variable 'level' support
- Large number calculations

### Usage

```csharp
var calculator = ExpressionParser.Parse("2 + level 5");
var result = calculator(5); // level = 5
```

### Examples

- `2 + 3 * 4`
- `min(level^2, 100)`
- `2 + level * 5 - 2^3`
