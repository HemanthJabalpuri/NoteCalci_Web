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
      this.localFunctions = new Map(); // functionName -> FunctionDefinition Node
      this.lineResults = [];      // array of line number values or null
      this.userAssignedDynamicVariables = new Set(); // tracking dynamic keywords assigned by user
    }
  }

  // Expose built-in constants registry on global namespace
  NoteCalci.CONSTANTS = {
    'pi': Math.PI,
    'e': Math.E
  };

  // Expose built-in functions registry on global namespace
  NoteCalci.BUILTIN_FUNCTIONS = {
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
    'min': (...args) => {
      if (args.length === 1 && Array.isArray(args[0])) return Math.min(...args[0]);
      return Math.min(...args);
    },
    'max': (...args) => {
      if (args.length === 1 && Array.isArray(args[0])) return Math.max(...args[0]);
      return Math.max(...args);
    },
    'sum': (arg) => Array.isArray(arg) ? arg.reduce((acc, val) => acc + val, 0) : arg,
    'avg': (arg) => Array.isArray(arg) ? (arg.length > 0 ? arg.reduce((acc, val) => acc + val, 0) / arg.length : 0) : arg,
    'average': (arg) => Array.isArray(arg) ? (arg.length > 0 ? arg.reduce((acc, val) => acc + val, 0) / arg.length : 0) : arg,
    'length': (arg) => Array.isArray(arg) ? arg.length : 1,
    'size': (arg) => Array.isArray(arg) ? arg.length : 1
  };

  const RESERVED_NAMES = new Set([
    'pi', 'e', 'sqrt', 'sin', 'cos', 'tan', 'abs', 'log', 'log10', 'ceil', 'floor', 'round', 'pow', 'min', 'max',
    'sum', 'total', 'avg', 'average', 'grand_total', 'grand_sum', 'last', 'prev', 'previous', 'above', '_',
    'lineno', 'linenumber', 'currentlinenumber'
  ]);

  /**
   * Registers a custom constant with validation checks.
   * @param {string} name Constant name
   * @param {number} value Constant numeric value
   */
  NoteCalci.registerConstant = function(name, value) {
    const normalized = name.toLowerCase();
    if (RESERVED_NAMES.has(normalized)) {
      throw new Error(`Assignment error: "${name}" is a reserved naming keyword and cannot be redefined`);
    }
    NoteCalci.CONSTANTS[normalized] = value;
  };

  /**
   * Registers a custom function with validation checks.
   * @param {string} name Function signature name
   * @param {Function} fn Function execution handler
   */
  NoteCalci.registerFunction = function(name, fn) {
    const normalized = name.toLowerCase();
    if (RESERVED_NAMES.has(normalized)) {
      throw new Error(`Assignment error: "${name}" is a reserved naming keyword and cannot be redefined`);
    }
    NoteCalci.BUILTIN_FUNCTIONS[normalized] = fn;
  };

  /**
   * Tree-walking evaluator to compute numerical results from AST representations.
   */
  class Evaluator {
    /**
     * @param {Map<string, number>} variables
     * @param {Map<string, object>} localFunctions
     * @param {Set<string>} callStack
     */
    constructor(variables, localFunctions = new Map(), callStack = new Set()) {
      this.variables = variables;
      this.localFunctions = localFunctions;
      this.callStack = callStack;

      // Decoupled JSDoc-instrumented expression visitor dispatch actions map
      this.visitorMap = {
        'NumberLiteral': (expr) => expr.value,
        'StringLiteral': (expr) => expr.value,
        
        'Variable': (expr) => {
          const name = expr.name.toLowerCase();
          if (this.variables.has(name)) {
            return this.variables.get(name);
          }
          if (name in NoteCalci.CONSTANTS) {
            return NoteCalci.CONSTANTS[name];
          }
          throw new Error(`Variable "${expr.name}" is not defined`);
        },

        'UnaryMinus': (expr) => {
          const operandVal = this.evaluate(expr.operand);
          return NoteCalci.OperatorDispatcher.evaluateUnary('-', operandVal);
        },

        'PercentLiteral': (expr) => {
          const val = this.evaluate(expr.value);
          return val / 100;
        },

        'PercentOf': (expr) => {
          const pct = this.evaluate(expr.percent);
          const base = this.evaluate(expr.base);
          return NoteCalci.OperatorDispatcher.evaluatePercentOf(pct, base);
        },

        'PercentOff': (expr) => {
          const pct = this.evaluate(expr.percent);
          const base = this.evaluate(expr.base);
          return NoteCalci.OperatorDispatcher.evaluatePercentOff(pct, base);
        },

        'ReversePercentOf': (expr) => {
          const pct = this.evaluate(expr.percent);
          const base = this.evaluate(expr.value);
          return NoteCalci.OperatorDispatcher.evaluateReversePercentOf(pct, base);
        },

        'BinaryOp': (expr) => {
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
                break;
            }
          }
          const rightVal = this.evaluate(expr.right);
          // Translate internal operator names to standard algebraic symbols
          const opMap = { 'PLUS': '+', 'MINUS': '-', 'STAR': '*', 'SLASH': '/', 'PERCENT': '%', 'CARET': '^' };
          const opSymbol = opMap[expr.op] || expr.op;
          return NoteCalci.OperatorDispatcher.evaluateBinary(leftVal, opSymbol, rightVal);
        },

        'FunctionCall': (expr) => {
          const name = expr.name.toLowerCase();
          const localFunc = this.localFunctions.get(name);
          if (localFunc) {
            const providedArgLength = expr.args.length;
            const requiredArgLength = localFunc.params.length;

            if (providedArgLength !== requiredArgLength) {
              throw new Error(`Arity mismatch error: Function "${expr.name}" expects exactly ${requiredArgLength} arguments, but got ${providedArgLength}`);
            }

            if (this.callStack.has(name)) {
              throw new Error(`Recursion error: Function "${expr.name}()" calls itself too many times which is not allowed`);
            }

            const evaluatedArgs = expr.args.map(arg => this.evaluate(arg));

            // Map parameters inside the isolated scope Map
            const localVars = new Map();
            for (let i = 0; i < localFunc.params.length; i++) {
              const paramName = localFunc.params[i].toLowerCase();
              localVars.set(paramName, evaluatedArgs[i]);
            }

            // Spawn child Evaluator context
            const childVars = new Map([...this.variables, ...localVars]);
            const childCallStack = new Set(this.callStack);
            childCallStack.add(name);

            const childEvaluator = new Evaluator(childVars, this.localFunctions, childCallStack);

            let lastResult = null;
            for (const stmt of localFunc.body) {
              lastResult = childEvaluator.evaluateStatement(stmt);
            }
            return lastResult;
          }

          const funcLookup = NoteCalci.BUILTIN_FUNCTIONS[name];
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
      };
    }

    /**
     * Evaluates expressions by dispatching to type-visitor handler.
     * @param {Expr} expr AST expression node
     * @returns {number}
     */
    evaluate(expr) {
      const className = expr.constructor.name;
      const visitor = this.visitorMap[className];
      if (visitor) {
        return visitor(expr);
      }
      throw new Error(`Invalid syntax tree node evaluated: "${className}"`);
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
      if (name in NoteCalci.CONSTANTS || name in NoteCalci.BUILTIN_FUNCTIONS) {
        throw new Error(`"${name}" is a built-in keyword and cannot be reassigned`);
      }
    }

    evaluateStatement(statement) {
      if (statement instanceof Statement.Empty) {
        return null;
      }

      if (statement instanceof Statement.FunctionDefinition) {
        const name = statement.name.toLowerCase();
        this.validateVariableOrFunctionName(name);
        this.localFunctions.set(name, statement);
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
      'lineno', 'linenumber', 'currentlinenumber', 'above_block', 'ans'
    ];

    /**
     * Dynamic, context-aware Prose Classifier. 
     * Confidently isolates Markdown prose, remarks, headers, lists, and textual annotations from active calculations.
     *
     * ALGORITHM AND CLASSIFICATION RULES:
     *
     * RULE 1: Syntactical Structural Markdown
     * Any trimmed line starting with '#' (Markdown headers), '>' (blockquotes), or consisting strictly of dashes 
     * (e.g. "---" Setext dividers or dividers) is instantly classified as prose and skipped.
     *
     * RULE 2: Plain URLs & Textual Slashes
     * Lines containing URLs ("http://", "://") or text rows with slashes ("/") but containing absolutely zero 
     * digits or equals signs (e.g., "Calculated by steveridout.com") are classified as prose.
     *
     * RULE 3: Markdown Prose Bullet Lists
     * Lines starting with prose bullets ("- ", "* ", "+ ") are matched. If the starting word directly following 
     * the bullet is not a registered variable or constant, the trailing line is analyzed: if it contains a space 
     * and plain alphabetic words, it is treated as an annotation list rather than subtraction math.
     *
     * RULE 4: The Unregistered Word Sandbox (Deep Compiler Scan)
     * If a line seems to have math elements (like a digit "12" or variable name "above_block"), we split it into words.
     * If the line is not an assignment statement, and contains EVEN A SINGLE alphabetical word (>= 2 chars) that is 
     * NEITHER a declared variable in context, a constant, a system built-in function, nor an algebraic operator keyword 
     * (like "of", "off", "ans"), the entire line is safely categorised as text prose and skipped.
     *
     * @param {string} line The raw text string row to inspect
     * @param {Map<string,number>|null} variablesMap Active variables cache for registered keywords checking
     * @param {Map<string,object>|null} localFunctionsMap Active user functions cache (prevents skipping recursives)
     * @returns {boolean} True if the row is standard prose text/spacers; False if it is mathematical arithmetic
     */
    static isProseLine(line, variablesMap = null, localFunctionsMap = null) {
      const trimmed = line.trim();
      if (trimmed === '') return true;

      // 1. Headers (#), blockquotes (>), or horizontal rules (---)
      if (trimmed.startsWith('#') || trimmed.startsWith('>') || /^-+$/.test(trimmed)) {
        return true;
      }

      // 2. Plain URLs or prose containing text slashes but no digits or '='
      if (trimmed.includes('://') || (trimmed.includes('/') && !/\d/.test(trimmed) && !trimmed.includes('='))) {
        return true;
      }

      // 3. Markdown bullet lists (- / * / +) that aren't math operations
      if (/^[\-\*\+]\s+/.test(trimmed)) {
        const rest = trimmed.substring(1).trim();
        const singleWord = rest.split(/[^\w_]/)[0].toLowerCase();
        
        // Check if the starting word after bullet is a registered active variable/constant
        const isKnownVar = variablesMap && (
          variablesMap.has(singleWord) || 
          (localFunctionsMap && localFunctionsMap.has(singleWord)) ||
          (singleWord in NoteCalci.CONSTANTS) || 
          (singleWord in NoteCalci.BUILTIN_FUNCTIONS)
        );
        
        if (!isKnownVar) {
          // Classified as prose list if trailing has multiple words or lacks math operators
          return /^[a-zA-Z_]+\s+[a-zA-Z_]/.test(rest) || (!/[=\+\-\*\/%\^\(\)\d_]/.test(rest));
        }
      }

      // 4. General text paragraph check: if a line contains any unregistered prose words, it is prose
      // We only execute this deep compiler check if a variablesMap is provided (running inside MathEngine.calculate)
      if (variablesMap) {
        // Function definitions (e.g., "f(x) = ...") are always mathematical declarations
        if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*\([^\)]*\)\s*=/.test(trimmed)) {
          return false;
        }

        const ALGEBRAIC_KEYWORDS = new Set([
          'of', 'off', 'in', 'to', 'as', 'what', 'is', 'above_block', 'ans',
          'sum', 'total', 'avg', 'average', 'grand_total', 'grand_sum', 'last',
          'prev', 'previous', 'above', '_', 'lineno', 'linenumber', 'currentlinenumber'
        ]);

        const hashIdx = trimmed.indexOf('#');
        const expr = hashIdx >= 0 ? trimmed.substring(0, hashIdx).trim() : trimmed;
        
        let rightHandPart = expr;
        const eqIdx = expr.indexOf('=');
        if (eqIdx >= 0) {
          rightHandPart = expr.substring(eqIdx + 1).trim();
        }

        const words = rightHandPart.split(/[^\w_]+/);
        const hasUnregisteredWord = words.some(w => {
          const wl = w.toLowerCase();
          if (wl.length < 2 || /^\d+$/.test(wl)) return false; // ignore single letters or numbers
          
          const isRegistered = variablesMap.has(wl) ||
                               (localFunctionsMap && localFunctionsMap.has(wl)) ||
                               (wl in NoteCalci.CONSTANTS) ||
                               (wl in NoteCalci.BUILTIN_FUNCTIONS) ||
                               ALGEBRAIC_KEYWORDS.has(wl);
          return !isRegistered;
        });

        if (hasUnregisteredWord) {
          return true;
        }
      }

      return false;
    }

    /**
     * Calculates results for all raw text lines, maintaining sequential execution scope.
     * @param {string[]} lineStrings List of lines expressions to parse
     * @returns {string[]} List of line results formatted as plain output strings
     */
    static calculate(lineStrings) {
      const context = new MathContext();
      
      return lineStrings.map((line, index) => {
        let targetLine = line.trim();
        if (this.isProseLine(targetLine, context.variables, context.localFunctions)) {
          context.lineResults.push(null);
          return '';
        }

        // 1. Intercept and register user manual overriding assignments to dynamic keywords
        this.trackDynamicVariableAssignment(targetLine, context.userAssignedDynamicVariables);

        // 2. Inject calculated dynamic variables before line evaluation
        this.injectDynamicVariables(context);

        // 2.5. Context-aware Operator Carry-on Prefixing
        const standardOperators = ['+', '*', '/', '%', '^', '×', '÷'];
        let isCarryOn = false;
        if (standardOperators.some(op => targetLine.startsWith(op))) {
          isCarryOn = true;
        } else if (/^-\s/.test(targetLine)) {
          const rest = targetLine.substring(1).trim();
          // Decouple prose: e.g. "- Rent expense" (multiple words starting with word chars)
          // from math subtraction: e.g. "- 50" or "- price"
          const isProseList = /^[a-zA-Z_]{2,}\s+[a-zA-Z_]/.test(rest);
          if (!isProseList && rest.length > 0) {
            const singleWord = rest.split(/[^\w_]/)[0];
            if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(singleWord)) {
              // Check if it is a registered variable, constant, or function call
              const isVar = context.variables.has(singleWord.toLowerCase());
              const isConst = singleWord.toLowerCase() in NoteCalci.CONSTANTS;
              const isFunc = singleWord.toLowerCase() in NoteCalci.BUILTIN_FUNCTIONS || rest.includes('(');
              if (isVar || isConst || isFunc) {
                isCarryOn = true;
              }
            } else {
              // If not raw letters (e.g. starting with digit or parentheses), it is subtraction math
              isCarryOn = true;
            }
          }
        }

        if (isCarryOn) {
          targetLine = 'above ' + targetLine;
        }

        try {
          // 3. Run lexical tokenizing
          const tokens = new Lexer(targetLine).tokenize();

          // If is blank or pure trailing comments which scanned as EOF
          if (tokens.length === 1 && tokens[0].kind === 'EOF') {
            context.lineResults.push(null);
            return '';
          }

          // 4. Run AST Parser
          const statement = new Parser(tokens).parse();

          // 5. Execute AST tree-walk Evaluator
          const evaluator = new Evaluator(context.variables, context.localFunctions);
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

      // Smart preceding block-seeking: skips trailing nulls (prose/spacing gaps) to capture the active numeric block
      const getAboveBlockResults = () => {
        const results = [];
        let i = lineHistory.length - 1;
        while (i >= 0 && lineHistory[i] === null) {
          i--;
        }
        while (i >= 0 && lineHistory[i] !== null) {
          results.unshift(lineHistory[i]);
          i--;
        }
        return results;
      };

      const blockVal = getBlockResults();
      const sumVal = blockVal.reduce((acc, val) => acc + val, 0);
      const avgVal = blockVal.length > 0 ? sumVal / blockVal.length : 0;
      const grandSumVal = lineHistory.reduce((acc, val) => acc + (val !== null ? val : 0), 0);
      
      const getPrecedingValue = () => {
        for (let i = lineHistory.length - 1; i >= 0; i--) {
          if (lineHistory[i] !== null) {
            return lineHistory[i];
          }
        }
        return 0;
      };

      const precedingVal = getPrecedingValue();
        
      const currentLineIndex = lineHistory.length + 1;

      // 1. sum & total (Inject independently to prevent partial namespace blocking)
      if (!overrides.has('sum')) variables.set('sum', sumVal);
      if (!overrides.has('total')) variables.set('total', sumVal);

      // 2. average & avg
      if (!overrides.has('avg')) variables.set('avg', avgVal);
      if (!overrides.has('average')) variables.set('average', avgVal);

      // 3. grand_total / grand_sum
      if (!overrides.has('grand_total')) variables.set('grand_total', grandSumVal);
      if (!overrides.has('grand_sum')) variables.set('grand_sum', grandSumVal);

      // 4. prev / last / _ / above
      if (!overrides.has('last')) variables.set('last', precedingVal);
      if (!overrides.has('prev')) variables.set('prev', precedingVal);
      if (!overrides.has('previous')) variables.set('previous', precedingVal);
      if (!overrides.has('above')) variables.set('above', precedingVal);
      if (!overrides.has('_')) variables.set('_', precedingVal);
      if (!overrides.has('ans')) variables.set('ans', precedingVal);

      // 5. lineno & linenumber indexes (1-based)
      if (!overrides.has('lineno')) variables.set('lineno', currentLineIndex);
      if (!overrides.has('linenumber')) variables.set('linenumber', currentLineIndex);
      if (!overrides.has('currentlinenumber')) variables.set('currentlinenumber', currentLineIndex);

      // 6. above_block (Exposes first preceding non-empty block elements as composite JS Array list)
      const aboveBlockVal = getAboveBlockResults();
      if (!overrides.has('above_block')) variables.set('above_block', aboveBlockVal);
    }

    /**
     * High precision decimal formatting.
     * @param {number} number
     * @returns {string}
     */
    static formatBigDecimal(number) {
      if (Array.isArray(number)) {
        if (number.length <= 2) {
          return '[' + number.map(n => parseFloat(n.toFixed(10))).join(', ') + ']';
        } else {
          return '[' + number.slice(0, 2).map(n => parseFloat(n.toFixed(10))).join(', ') + ', ...]';
        }
      }
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

