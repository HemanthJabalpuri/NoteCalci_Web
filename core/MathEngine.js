/**
 * @fileoverview Port of MathEngine, MathContext and Evaluator logic from upstream NerdCalci.
 * Upstream reference: app/src/main/java/com/vishaltelangre/nerdcalci/core/MathEngine.kt
 *                     app/src/main/java/com/vishaltelangre/nerdcalci/core/Evaluator.kt
 *                     app/src/main/java/com/vishaltelangre/nerdcalci/core/Builtins.kt
 */

(function() {
  // Attach/Retrieve window namespace registry
  const NoteCalci = (window.NoteCalci = window.NoteCalci || {});
  const Lexer = NoteCalci.Lexer;
  const Parser = NoteCalci.Parser;
  const Statement = NoteCalci.Statement;
  const Expr = NoteCalci.Expr;
  const TokenKind = NoteCalci.TokenKind;

  /**
   * Container for evaluated mathematical state (variables registry and calculated history).
   */
  class MathContext {
    constructor() {
      this.variables = new Map(); // variableName -> number value
      this.lineResults = [];      // array of line number values or null
      this.userAssignedDynamicVariables = new Set(); // tracking dynamic keywords assigned by user
    }
  }

  // Built-in constants
  const CONSTANTS = {
    'pi': Math.PI,
    'e': Math.E
  };

  // Built-in functions
  const BUILTIN_FUNCTIONS = {
    'sqrt': (arg) => Math.sqrt(arg),
    'sin': (arg) => Math.sin(arg),
    'cos': (arg) => Math.cos(arg),
    'tan': (arg) => Math.tan(arg),
    'abs': (arg) => Math.abs(arg),
    'log': (arg) => Math.log(arg),
    'log10': (arg) => Math.log10(arg),
    'ceil': (arg) => Math.ceil(arg),
    'floor': (arg) => Math.floor(arg),
    'round': (arg) => Math.round(arg),
    'pow': (base, exp) => Math.pow(base, exp),
    'min': (...args) => Math.min(...args),
    'max': (...args) => Math.max(...args)
  };

  /**
   * Tree-walking evaluator to compute numerical results from AST representations.
   */
  class Evaluator {
    /**
     * @param {Map<string, number>} variables
     */
    constructor(variables) {
      this.variables = variables;
    }

    /**
     * Evaluates expressions.
     * @param {Expr} expr
     * @returns {number}
     */
    evaluate(expr) {
      if (expr instanceof Expr.NumberLiteral) {
        return expr.value;
      }

      if (expr instanceof Expr.StringLiteral) {
        return expr.value;
      }

      if (expr instanceof Expr.Variable) {
        const name = expr.name.toLowerCase();
        if (this.variables.has(name)) {
          return this.variables.get(name);
        }
        if (name in CONSTANTS) {
          return CONSTANTS[name];
        }
        throw new Error(`Variable "${expr.name}" is not defined`);
      }

      if (expr instanceof Expr.UnaryMinus) {
        const operandVal = this.evaluate(expr.operand);
        if (typeof operandVal !== 'number') {
          throw new Error('Cannot negate non-numeric expression');
        }
        return -operandVal;
      }

      if (expr instanceof Expr.PercentLiteral) {
        const val = this.evaluate(expr.value);
        return val / 100;
      }

      if (expr instanceof Expr.PercentOf) {
        const pct = this.evaluate(expr.percent);
        const base = this.evaluate(expr.base);
        return base * (pct / 100);
      }

      if (expr instanceof Expr.PercentOff) {
        const pct = this.evaluate(expr.percent);
        const base = this.evaluate(expr.base);
        return base * (1 - pct / 100);
      }

      if (expr instanceof Expr.ReversePercentOf) {
        const pct = this.evaluate(expr.percent);
        const base = this.evaluate(expr.value);
        if (pct === 0) {
          throw new Error('Percentage cannot be zero in reverse calculation');
        }
        return base / (pct / 100);
      }

      if (expr instanceof Expr.BinaryOp) {
        const leftVal = this.evaluate(expr.left);

        // Intercept percentage additions/subtractions: "1000 - 20%"
        if (expr.right instanceof Expr.PercentLiteral) {
          const pct = this.evaluate(expr.right.value);
          switch (expr.op) {
            case 'PLUS':
              return leftVal * (1 + pct / 100);
            case 'MINUS':
              return leftVal * (1 - pct / 100);
            default:
              // Fall back to standard binary evaluation below
              break;
          }
        }

        const rightVal = this.evaluate(expr.right);

        switch (expr.op) {
          case 'PLUS':
            return leftVal + rightVal;
          case 'MINUS':
            return leftVal - rightVal;
          case 'STAR':
            return leftVal * rightVal;
          case 'SLASH':
            if (rightVal === 0) {
              throw new Error('Division by zero');
            }
            return leftVal / rightVal;
          case 'PERCENT': // modulo operator
            if (rightVal === 0) {
              throw new Error('Modulo division by zero');
            }
            return leftVal % rightVal;
          case 'CARET':
            return Math.pow(leftVal, rightVal);
          default:
            throw new Error(`Unknown operator kind: "${expr.op}"`);
        }
      }

      if (expr instanceof Expr.FunctionCall) {
        const name = expr.name.toLowerCase();
        const funcLookup = BUILTIN_FUNCTIONS[name];
        if (!funcLookup) {
          throw new Error(`Unknown function signature "${expr.name}()"`);
        }
        const evaluatedArgs = expr.args.map(arg => this.evaluate(arg));
        const res = funcLookup(...evaluatedArgs);
        if (isNaN(res)) {
          throw new Error(`Function call "${name}" returned NaN`);
        }
        return res;
      }

      throw new Error('Invalid syntax tree node evaluated');
    }

    /**
     * Evaluates a statement, updating variables context map if mutation is requested.
     * @param {Statement} statement
     * @returns {number|null}
     */
    validateVariableOrFunctionName(name) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error(`Invalid variable name "${name}"`);
      }
      if (name in CONSTANTS || name in BUILTIN_FUNCTIONS) {
        throw new Error(`"${name}" is a built-in keyword and cannot be reassigned`);
      }
    }

    evaluateStatement(statement) {
      if (statement instanceof Statement.Empty) {
        return null;
      }

      if (statement instanceof Statement.ExprStatement) {
        return this.evaluate(statement.expr);
      }

      if (statement instanceof Statement.Assignment) {
        const name = statement.target.name.toLowerCase();
        this.validateVariableOrFunctionName(name);
        const valueResult = this.evaluate(statement.expr);
        this.variables.set(name, valueResult);
        return valueResult;
      }

      if (statement instanceof Statement.CompoundAssignment) {
        const name = statement.target.name.toLowerCase();
        this.validateVariableOrFunctionName(name);
        const currentVal = this.variables.get(name);
        if (currentVal === undefined) {
          throw new Error(`Variable "${statement.target.name}" is not defined`);
        }

        const evaluatedExpr = this.evaluate(statement.expr);
        let resultVal;
        switch (statement.op) {
          case 'PLUS_EQUALS':
            resultVal = currentVal + evaluatedExpr;
            break;
          case 'MINUS_EQUALS':
            resultVal = currentVal - evaluatedExpr;
            break;
          case 'STAR_EQUALS':
            resultVal = currentVal * evaluatedExpr;
            break;
          case 'SLASH_EQUALS':
            if (evaluatedExpr === 0) {
              throw new Error('Division by zero');
            }
            resultVal = currentVal / evaluatedExpr;
            break;
          case 'PERCENT_EQUALS':
            if (evaluatedExpr === 0) {
              throw new Error('Modulo by zero');
            }
            resultVal = currentVal % evaluatedExpr;
            break;
          default:
            throw new Error(`Unknown compound assignment: "${statement.op}"`);
        }

        this.variables.set(name, resultVal);
        return resultVal;
      }

      if (statement instanceof Statement.Increment) {
        const name = statement.target.name.toLowerCase();
        this.validateVariableOrFunctionName(name);
        const currentVal = this.variables.get(name);
        if (currentVal === undefined) {
          throw new Error(`Variable "${statement.target.name}" is not defined`);
        }
        const resultVal = currentVal + 1;
        this.variables.set(name, resultVal);
        return resultVal;
      }

      if (statement instanceof Statement.Decrement) {
        const name = statement.target.name.toLowerCase();
        this.validateVariableOrFunctionName(name);
        const currentVal = this.variables.get(name);
        if (currentVal === undefined) {
          throw new Error(`Variable "${statement.target.name}" is not defined`);
        }
        const resultVal = currentVal - 1;
        this.variables.set(name, resultVal);
        return resultVal;
      }

      return null;
    }
  }

  /**
   * MathEngine orchestrator module mirroring upstream structure.
   */
  class MathEngine {
    // Dynamic variable names that will be injected dynamically during evaluations
    static DYNAMIC_VARIABLES = [
      'sum', 'total', 'avg', 'average', 'last', 'prev', 'previous', 'above', '_',
      'lineno', 'linenumber', 'currentlinenumber'
    ];

    /**
     * Calculates results for all raw text lines, maintaining sequential execution scope.
     * @param {string[]} lineStrings List of lines expressions to parse
     * @returns {string[]} List of line results formatted as plain output strings
     */
    static calculate(lineStrings) {
      const context = new MathContext();
      
      return lineStrings.map((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine === '') {
          context.lineResults.push(null);
          return '';
        }

        try {
          // 1. Intercept and register user manual overriding assignments to dynamic keywords (e.g. standard "total = 10")
          this.trackDynamicVariableAssignment(trimmedLine, context.userAssignedDynamicVariables);

          // 2. Inject calculated dynamic variables before line evaluation
          this.injectDynamicVariables(context);

          // 3. Run lexical tokenizing
          const tokens = new Lexer(trimmedLine).tokenize();

          // If is blank or pure trailing comments which scanned as EOF
          if (tokens.length === 1 && tokens[0].kind === 'EOF') {
            context.lineResults.push(null);
            return '';
          }

          // 4. Run AST Parser
          const statement = new Parser(tokens).parse();

          // 5. Execute AST tree-walk Evaluator
          const evaluator = new Evaluator(context.variables);
          const numericResult = evaluator.evaluateStatement(statement);

          if (numericResult === null) {
            context.lineResults.push(null);
            return '';
          }

          // Add numeric calculated value to results map for upcoming dynamic loops
          context.lineResults.push(numericResult);
          
          // 6. Format output result
          return this.formatBigDecimal(numericResult);

        } catch (err) {
          context.lineResults.push(null);
          return 'Err'; // Returns Err output on syntax or execution failure
        }
      });
    }

    /**
     * Trace if line comprises assignments overriding dynamic keyword mappings.
     * @param {string} expression
     * @param {Set<string>} userAssigned
     */
    static trackDynamicVariableAssignment(expression, userAssigned) {
      const hashIdx = expression.indexOf('#');
      const expr = hashIdx >= 0 ? expression.substring(0, hashIdx).trim() : expression.trim();

      for (const name of this.DYNAMIC_VARIABLES) {
        if (expr.startsWith(name) && expr.length > name.length) {
          const rest = expr.substring(name.length).trimStart();
          if (
            rest.startsWith('=') || rest.startsWith('+=') || rest.startsWith('-=') ||
            rest.startsWith('*=') || rest.startsWith('/=') || rest.startsWith('%=') ||
            rest.startsWith('++') || rest.startsWith('--') || rest.startsWith('(')
          ) {
            userAssigned.add(name);
          }
        }
      }
    }

    /**
     * Calculates and injects dynamic variables sequentially based on prior calculated history blocks.
     * @param {MathContext} context
     */
    static injectDynamicVariables(context) {
      const variables = context.variables;
      const lineHistory = context.lineResults;
      const overrides = context.userAssignedDynamicVariables;

      // Helper block checker: collects continuous numeric rows running backwards until null/empty
      const getBlockResults = () => {
        const results = [];
        for (let i = lineHistory.length - 1; i >= 0; i--) {
          const res = lineHistory[i];
          if (res === null) {
            break;
          }
          results.unshift(res);
        }
        return results;
      };

      // 1. sum & total
      if (!overrides.has('sum') && !overrides.has('total')) {
        const blockVal = getBlockResults();
        const sum = blockVal.reduce((acc, val) => acc + val, 0);
        variables.set('sum', sum);
        variables.set('total', sum);
      }

      // 2. average & avg
      if (!overrides.has('avg') && !overrides.has('average')) {
        const blockVal = getBlockResults();
        const avg = blockVal.length > 0 ? blockVal.reduce((acc, val) => acc + val, 0) / blockVal.length : 0;
        variables.set('avg', avg);
        variables.set('average', avg);
      }

      // 3. grand_total / grand_sum
      if (!overrides.has('grand_total') && !overrides.has('grand_sum')) {
        const grandSum = lineHistory.reduce((acc, val) => acc + (val !== null ? val : 0), 0);
        variables.set('grand_total', grandSum);
        variables.set('grand_sum', grandSum);
      }

      // 4. prev / last / _ / above
      const precedingVal = lineHistory.length > 0 && lineHistory[lineHistory.length - 1] !== null 
        ? lineHistory[lineHistory.length - 1] 
        : 0;
      if (!overrides.has('last')) variables.set('last', precedingVal);
      if (!overrides.has('prev')) variables.set('prev', precedingVal);
      if (!overrides.has('previous')) variables.set('previous', precedingVal);
      if (!overrides.has('above')) variables.set('above', precedingVal);
      if (!overrides.has('_')) variables.set('_', precedingVal);

      // 5. lineno & linenumber indexes (1-based)
      const currentLineIndex = lineHistory.length + 1;
      if (!overrides.has('lineno')) variables.set('lineno', currentLineIndex);
      if (!overrides.has('linenumber')) variables.set('linenumber', currentLineIndex);
      if (!overrides.has('currentlinenumber')) variables.set('currentlinenumber', currentLineIndex);
    }

    /**
     * High precision decimal formatting.
     * @param {number} number
     * @returns {string}
     */
    static formatBigDecimal(number) {
      if (Math.abs(number) >= 1e15 || (Math.abs(number) < 1e-5 && number !== 0)) {
        return number.toExponential(10).replace(/e\+?/, 'E');
      }
      // Return standard float representation cleanly (integers show custom flat, decimals up to 10 digits limit)
      return parseFloat(number.toFixed(10)).toString();
    }
  }

  // Make namespaces items strictly visible globally
  Object.assign(NoteCalci, {
    MathContext,
    MathEngine
  });
})();
