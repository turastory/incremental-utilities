import { Decimal } from 'decimal.js';
import { ValueRegistry } from './ValueRegistry';

export class Expression {
  static readonly AlwaysTrue = '1';
  static readonly AlwaysFalse = '0';

  static and(...expressions: string[]): string {
    if (expressions.length > 1) return `and(${expressions.join(', ')})`;
    if (expressions.length === 1) return expressions[0];
    return this.AlwaysTrue;
  }

  static or(...expressions: string[]): string {
    if (expressions.length > 1) return `or(${expressions.join(', ')})`;
    if (expressions.length === 1) return expressions[0];
    return this.AlwaysFalse;
  }
}

export interface ParseResult {
  function: (valueRegistry: ValueRegistry) => Decimal;
  dependencies: Set<string>;
}

class Node {
  value: string = '';
  left?: Node;
  right?: Node;
  parameters?: Node[]; // For function parameters
}

export class ExpressionParser {
  static parse(input: string): (valueRegistry: ValueRegistry) => Decimal {
    console.log(`Parsing expression: ${input}`);
    const tokens = this.tokenize(input);
    const ast = this.buildAST(tokens);

    return (valueRegistry: ValueRegistry) => {
      return this.evaluateAST(ast, valueRegistry);
    };
  }

  static parseWithDependencies(input: string): ParseResult {
    console.log(`Parsing expression: ${input}`);
    const tokens = this.tokenize(input);
    const ast = this.buildAST(tokens);
    const dependencies = new Set<string>();

    // Collect dependencies
    this.collectDependencies(ast, dependencies);

    return {
      function: (valueRegistry: ValueRegistry) => this.evaluateAST(ast, valueRegistry),
      dependencies,
    };
  }

  private static tokenize(input: string): string[] {
    const tokens: string[] = [];
    let currentToken = '';

    for (let i = 0; i < input.length; i++) {
      const c = input[i];

      // Whitespace terminates current token and is skipped
      if (/\s/.test(c)) {
        if (currentToken !== '') {
          tokens.push(currentToken);
          currentToken = '';
        }
        continue;
      }

      // Special characters are treated as independent tokens
      if (c === '(' || c === ')' || c === ',') {
        if (currentToken !== '') {
          tokens.push(currentToken);
          currentToken = '';
        }
        tokens.push(c);
        continue;
      }

      // Check for two-character operators
      if (i < input.length - 1) {
        const nextC = input[i + 1];
        const twoChars = c + nextC;
        if (twoChars === '>=' || twoChars === '<=' || twoChars === '==' || twoChars === '!=') {
          if (currentToken !== '') {
            tokens.push(currentToken);
            currentToken = '';
          }
          tokens.push(twoChars);
          i++; // Skip next character as it's already processed
          continue;
        }
      }

      // Check for single-character operators
      if (['+', '-', '*', '/', '^', '>', '<'].includes(c)) {
        if (currentToken !== '') {
          tokens.push(currentToken);
          currentToken = '';
        }
        tokens.push(c);
        continue;
      }

      // Add other characters to current token
      currentToken += c;
    }

    // Add final token if any
    if (currentToken !== '') {
      tokens.push(currentToken);
    }

    return tokens;
  }

  private static buildAST(tokens: string[]): Node {
    const stack: Node[] = [];
    const operators: string[] = [];
    const functionParams: number[] = []; // Track function parameter count

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (this.isFunction(token)) {
        operators.push(token);
        functionParams.push(0); // Initialize parameter count
      } else if (token === '(') {
        operators.push(token);
      } else if (token === ')') {
        while (operators.length > 0 && operators[operators.length - 1] !== '(') {
          this.processOperator(stack, operators.pop()!);
        }
        operators.pop(); // Remove '('

        if (operators.length > 0 && this.isFunction(operators[operators.length - 1])) {
          const func = operators.pop()!;
          const paramCount = functionParams.pop()! + 1;
          this.processFunction(stack, func, paramCount);
        }
      } else if (token === ',') {
        while (operators.length > 0 && operators[operators.length - 1] !== '(') {
          this.processOperator(stack, operators.pop()!);
        }
        if (functionParams.length > 0) {
          functionParams[functionParams.length - 1]++;
        }
      } else if (this.isOperator(token)) {
        while (
          operators.length > 0 &&
          operators[operators.length - 1] !== '(' &&
          this.getPrecedence(operators[operators.length - 1]) >= this.getPrecedence(token)
        ) {
          this.processOperator(stack, operators.pop()!);
        }
        operators.push(token);
      } else {
        stack.push({ value: token });
      }
    }

    while (operators.length > 0) {
      this.processOperator(stack, operators.pop()!);
    }

    return stack[0];
  }

  private static processOperator(stack: Node[], op: string): void {
    const right = stack.pop()!;
    const left = stack.pop()!;
    stack.push({
      value: op,
      left,
      right,
    });
  }

  private static processFunction(stack: Node[], func: string, paramCount: number): void {
    const parameters: Node[] = new Array(paramCount);
    for (let i = paramCount - 1; i >= 0; i--) {
      parameters[i] = stack.pop()!;
    }
    stack.push({ value: func, parameters });
  }

  private static isOperator(token: string): boolean {
    return ['+', '-', '*', '/', '^', '>', '<', '>=', '<=', '==', '!='].includes(token);
  }

  private static isFunction(token: string): boolean {
    return ['min', 'max', 'and', 'or'].includes(token);
  }

  private static getPrecedence(op: string): number {
    switch (op) {
      case '^':
        return 4;
      case '*':
      case '/':
        return 3;
      case '+':
      case '-':
        return 2;
      case '>':
      case '<':
      case '>=':
      case '<=':
      case '==':
      case '!=':
        return 1;
      default:
        return 0;
    }
  }

  private static evaluateAST(node: Node, valueRegistry: ValueRegistry): Decimal {
    if (!node) return new Decimal(0);

    // Handle functions
    if (node.parameters) {
      const params = node.parameters.map(p => this.evaluateAST(p, valueRegistry));
      switch (node.value) {
        case 'min':
          return Decimal.min(...params);
        case 'max':
          return Decimal.max(...params);
        case 'and':
          return params.every(p => p.greaterThanOrEqualTo(1)) ? new Decimal(1) : new Decimal(0);
        case 'or':
          return params.some(p => p.greaterThanOrEqualTo(1)) ? new Decimal(1) : new Decimal(0);
        default:
          throw new Error(`Unknown function: ${node.value}`);
      }
    }

    // Handle operators
    if (node.left && node.right) {
      const left = this.evaluateAST(node.left, valueRegistry);
      const right = this.evaluateAST(node.right, valueRegistry);

      switch (node.value) {
        case '+':
          return left.plus(right);
        case '-':
          return left.minus(right);
        case '*':
          return left.times(right);
        case '/':
          return left.dividedBy(right);
        case '^':
          return left.pow(right);
        case '>':
          return left.greaterThan(right) ? new Decimal(1) : new Decimal(0);
        case '<':
          return left.lessThan(right) ? new Decimal(1) : new Decimal(0);
        case '>=':
          return left.greaterThanOrEqualTo(right) ? new Decimal(1) : new Decimal(0);
        case '<=':
          return left.lessThanOrEqualTo(right) ? new Decimal(1) : new Decimal(0);
        case '==':
          return left.equals(right) ? new Decimal(1) : new Decimal(0);
        case '!=':
          return !left.equals(right) ? new Decimal(1) : new Decimal(0);
        default:
          throw new Error(`Unknown operator: ${node.value}`);
      }
    }

    // Handle literals and variables
    if (!isNaN(Number(node.value))) {
      return new Decimal(node.value);
    }

    return valueRegistry.getWrappedValue(node.value);
  }

  private static collectDependencies(node: Node, dependencies: Set<string>): void {
    if (!node) return;

    // Handle functions
    if (node.parameters) {
      node.parameters.forEach(p => this.collectDependencies(p, dependencies));
      return;
    }

    // Handle operators
    if (node.left && node.right) {
      this.collectDependencies(node.left, dependencies);
      this.collectDependencies(node.right, dependencies);
      return;
    }

    // Handle variables (non-numeric values)
    if (isNaN(Number(node.value))) {
      dependencies.add(node.value);
    }
  }
} 