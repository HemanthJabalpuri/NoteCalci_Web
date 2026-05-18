/**
 * @fileoverview Port of the syntax analyzer and recursive-descent parser from upstream NerdCalci.
 * Upstream reference: app/src/main/java/com/vishaltelangre/nerdcalci/core/Parser.kt
 *                     app/src/main/java/com/vishaltelangre/nerdcalci/core/Ast.kt
 */

(function() {
  // Attach/Retrieve window namespace registry
  const NoteCalci = (window.NoteCalci = window.NoteCalci || {});
  const TokenKind = NoteCalci.TokenKind;
  const PREVIOUS_LINE_ALIAS_KINDS = NoteCalci.PREVIOUS_LINE_ALIAS_KINDS;
  const LINE_NUMBER_ALIAS_KINDS = NoteCalci.LINE_NUMBER_ALIAS_KINDS;

  // ==========================================
  // Abstract Syntax Tree (AST) Definitions
  // ==========================================

  class Statement {
    static Empty = class extends Statement {
      toString() { return 'Empty'; }
    };

    static ExprStatement = class extends Statement {
      /**
       * @param {Expr} expr
       */
      constructor(expr) {
        super();
        this.expr = expr;
      }
    };

    static Assignment = class extends Statement {
      /**
       * @param {Expr} target
       * @param {Expr} expr
       */
      constructor(target, expr) {
        super();
        this.target = target;
        this.expr = expr;
      }
    };

    static CompoundAssignment = class extends Statement {
      /**
       * @param {Expr} target
       * @param {string} op
       * @param {Expr} expr
       */
      constructor(target, op, expr) {
        super();
        this.target = target;
        this.op = op;
        this.expr = expr;
      }
    };

    static Increment = class extends Statement {
      /**
       * @param {Expr} target
       */
      constructor(target) {
        super();
        this.target = target;
      }
    };

    static Decrement = class extends Statement {
      /**
       * @param {Expr} target
       */
      constructor(target) {
        super();
        this.target = target;
      }
    };
  }

  class Expr {
    static NumberLiteral = class extends Expr {
      /**
       * @param {number} value
       */
      constructor(value) {
        super();
        this.value = value;
      }
    };

    static StringLiteral = class extends Expr {
      /**
       * @param {string} value
       */
      constructor(value) {
        super();
        this.value = value;
      }
    };

    static PercentLiteral = class extends Expr {
      /**
       * @param {Expr} value
       */
      constructor(value) {
        super();
        this.value = value;
      }
    };

    static PercentOf = class extends Expr {
      /**
       * @param {Expr} percent
       * @param {Expr} base
       */
      constructor(percent, base) {
        super();
        this.percent = percent;
        this.base = base;
      }
    };

    static PercentOff = class extends Expr {
      /**
       * @param {Expr} percent
       * @param {Expr} base
       */
      constructor(percent, base) {
        super();
        this.percent = percent;
        this.base = base;
      }
    };

    static ReversePercentOf = class extends Expr {
      /**
       * @param {Expr} percent
       * @param {Expr} value
       */
      constructor(percent, value) {
        super();
        this.percent = percent;
        this.value = value;
      }
    };

    static UnaryMinus = class extends Expr {
      /**
       * @param {Expr} operand
       */
      constructor(operand) {
        super();
        this.operand = operand;
      }
    };

    static BinaryOp = class extends Expr {
      /**
       * @param {Expr} left
       * @param {string} op
       * @param {Expr} right
       */
      constructor(left, op, right) {
        super();
        this.left = left;
        this.op = op;
        this.right = right;
      }
    };

    static Variable = class extends Expr {
      /**
       * @param {string} name
       */
      constructor(name) {
        super();
        this.name = name;
      }
    };

    static FunctionCall = class extends Expr {
      /**
       * @param {string} name
       * @param {Expr[]} args
       */
      constructor(name, args) {
        super();
        this.name = name;
        this.args = args;
      }
    };
  }

  // ==========================================
  // Parsing Engine
  // ==========================================

  /**
   * Converts Token lists scanned by the Lexer into Statements & Expressions AST representations.
   */
  class Parser {
    /**
     * @param {Token[]} tokens
     */
    constructor(tokens) {
      this.tokens = tokens;
      this.pos = 0;
    }

    /** @returns {Token} */
    peek() {
      return this.tokens[this.pos];
    }

    /** @returns {string} */
    peekKind() {
      return this.tokens[this.pos].kind;
    }

    /** @returns {boolean} */
    isAtEnd() {
      return this.peekKind() === TokenKind.EOF;
    }

    /** @returns {Token} */
    advance() {
      const token = this.tokens[this.pos];
      if (!this.isAtEnd()) {
        this.pos++;
      }
      return token;
    }

    /**
     * Consumes next token only if the expected token type is satisfied.
     * @param {string} kind
     * @returns {Token}
     */
    expect(kind) {
      const token = this.peek();
      if (token.kind !== kind) {
        throw new Error(`Syntax error: Expected "${kind}" at position ${token.position}, but found "${token.kind}"`);
      }
      return this.advance();
    }

    /**
     * Main entry point to parse the scanned tokens into a Statement.
     * @returns {Statement}
     */
    parse() {
      if (this.isAtEnd()) {
        return new Statement.Empty();
      }
      const stmt = this.parseStatement();
      if (!this.isAtEnd()) {
        const leftover = this.peek();
        throw new Error(`Syntax error: Unexpected token "${leftover.lexeme}" at position ${leftover.position}`);
      }
      return stmt;
    }

    /**
     * Detects and isolates statements: Assignments, Compounds, Increments, or simple Expressions.
     * @returns {Statement}
     */
    parseStatement() {
      const checkpoint = this.pos;
      let target;
      try {
        target = this.parsePostfix();
      } catch (e) {
        this.pos = checkpoint;
        return new Statement.ExprStatement(this.parseExpression());
      }

      const nextKind = this.peekKind();
      const isAssignmentOp =
        nextKind === TokenKind.EQUALS ||
        nextKind === TokenKind.PLUS_EQUALS ||
        nextKind === TokenKind.MINUS_EQUALS ||
        nextKind === TokenKind.STAR_EQUALS ||
        nextKind === TokenKind.SLASH_EQUALS ||
        nextKind === TokenKind.PERCENT_EQUALS ||
        nextKind === TokenKind.PLUS_PLUS ||
        nextKind === TokenKind.MINUS_MINUS;

      if (isAssignmentOp) {
        this.requireAssignableExpr(target);
        switch (nextKind) {
          case TokenKind.EQUALS:
            this.advance(); // skip EQUALS "="
            return new Statement.Assignment(target, this.parseExpression());
          case TokenKind.PLUS_EQUALS:
          case TokenKind.MINUS_EQUALS:
          case TokenKind.STAR_EQUALS:
          case TokenKind.SLASH_EQUALS:
          case TokenKind.PERCENT_EQUALS: {
            const opToken = this.advance();
            return new Statement.CompoundAssignment(target, opToken.kind, this.parseExpression());
          }
          case TokenKind.PLUS_PLUS:
            this.advance(); // skip PLUS_PLUS "++"
            return new Statement.Increment(target);
          case TokenKind.MINUS_MINUS:
            this.advance(); // skip MINUS_MINUS "--"
            return new Statement.Decrement(target);
          default:
            throw new Error(`Syntax error: Unexpected notation "${this.peek().lexeme}" at position ${this.peek().position}`);
        }
      } else {
        // Reset and treat as normal expression statement
        this.pos = checkpoint;
        return new Statement.ExprStatement(this.parseExpression());
      }
    }

    /**
     * Asserts if target node is valid variable assignable.
     * @param {Expr} target
     */
    requireAssignableExpr(target) {
      if (target instanceof Expr.Variable) {
        return;
      }
      const pos = this.peek().position;
      throw new Error(`Syntax error: Values can only be assigned to variables, found invalid assignment target at position ${pos}`);
    }

    /**
     * Entry point for parsing expressions recursively.
     * @returns {Expr}
     */
    parseExpression() {
      return this.parseAddSub();
    }

    /**
     * Parses low-precedence Operations: Addition and Subtraction (+, -).
     * @returns {Expr}
     */
    parseAddSub() {
      let left = this.parseMulDivMod();
      while (this.peekKind() === TokenKind.PLUS || this.peekKind() === TokenKind.MINUS) {
        const op = this.advance();
        const right = this.parseMulDivMod();
        left = new Expr.BinaryOp(left, op.kind, right);
      }
      return left;
    }

    /**
     * Parses higher-precedence Operations: Multiplication, Division, and Modulo (*, /, %).
     * @returns {Expr}
     */
    parseMulDivMod() {
      let left = this.parsePower();
      while (
        this.peekKind() === TokenKind.STAR ||
        this.peekKind() === TokenKind.SLASH ||
        this.peekKind() === TokenKind.PERCENT
      ) {
        if (this.peekKind() === TokenKind.PERCENT) {
          // '%' behaves as absolute Modulo only if a valid start-expression token follows it.
          if (!this.canStartExpression(this.peekAt(1))) {
            break;
          }
        }
        const op = this.advance();
        const right = this.parsePower();
        left = new Expr.BinaryOp(left, op.kind, right);
      }
      return left;
    }

    /**
     * Parses Exponent power operations (^) in a right-associative recursive manner.
     * @returns {Expr}
     */
    parsePower() {
      const base = this.parseUnary();
      if (this.peekKind() === TokenKind.CARET) {
        this.advance(); // skip "^"
        const exponent = this.parsePower(); // recursive call for right-association
        return new Expr.BinaryOp(base, TokenKind.CARET, exponent);
      }
      return base;
    }

    /**
     * Parses Unary negative operations, e.g., "-y".
     * @returns {Expr}
     */
    parseUnary() {
      if (this.peekKind() === TokenKind.MINUS) {
        this.advance(); // consume "-"
        const operand = this.parseUnary();
        return new Expr.UnaryMinus(operand);
      }
      return this.parsePostfix();
    }

    /**
     * Parses postfix operations (primarily percentages: "a%", "a% of b", "a% off b").
     * @returns {Expr}
     */
    parsePostfix() {
      let expr = this.parsePrimary();
      while (true) {
        const kind = this.peekKind();
        if (kind === TokenKind.PERCENT) {
          const nextKind = this.peekAt(1);
          if (nextKind === TokenKind.KW_OF) {
            this.advance(); // skip "%"
            this.advance(); // skip "of"
            if (this.peekKind() === TokenKind.KW_WHAT) {
              this.advance(); // skip "what"
              this.expect(TokenKind.KW_IS);
              const val = this.parseExpression();
              expr = new Expr.ReversePercentOf(expr, val);
            } else {
              const base = this.parseExpression();
              expr = new Expr.PercentOf(expr, base);
            }
          } else if (nextKind === TokenKind.KW_OFF) {
            this.advance(); // skip "%"
            this.advance(); // skip "off"
            const base = this.parseExpression();
            expr = new Expr.PercentOff(expr, base);
          } else if (this.canStartExpression(nextKind)) {
            // Preceded by expression, % represents raw modulo. Do not consume here.
            break;
          } else {
            this.advance(); // consume bare percentage "%"
            expr = new Expr.PercentLiteral(expr);
          }
        } else {
          break;
        }
      }
      return expr;
    }

    /**
     * Parses primary nodes: numbers, string literals, variables, parentheses groups, and function calls.
     * @returns {Expr}
     */
    parsePrimary() {
      const kind = this.peekKind();
      switch (kind) {
        case TokenKind.STRING_LITERAL: {
          const token = this.advance();
          return new Expr.StringLiteral(token.lexeme);
        }
        case TokenKind.NUMBER: {
          const token = this.advance();
          return new Expr.NumberLiteral(token.value);
        }
        case TokenKind.IDENTIFIER: {
          const token = this.advance();
          const name = token.lexeme;
          if (this.peekKind() === TokenKind.LPAREN) {
            this.advance(); // consume LPAREN "("
            const args = this.parseArgList();
            this.expect(TokenKind.RPAREN); // expect RPAREN ")"
            return new Expr.FunctionCall(name, args);
          }
          return new Expr.Variable(name);
        }
        case TokenKind.LPAREN: {
          this.advance(); // consume LPAREN "("
          const expr = this.parseExpression();
          this.expect(TokenKind.RPAREN); // expect RPAREN ")"
          return expr;
        }
        default: {
          // Dynamic line variables alias fallbacks
          if (PREVIOUS_LINE_ALIAS_KINDS.has(kind) || LINE_NUMBER_ALIAS_KINDS.has(kind)) {
            const token = this.advance();
            return new Expr.Variable(token.lexeme);
          }
          const token = this.peek();
          throw new Error(`Syntax error: Expected number, indent or "(" but found "${token.lexeme}" at position ${token.position}`);
        }
      }
    }

    /**
     * Parses dynamic list of function inputs: "a, b, c".
     * @returns {Expr[]}
     */
    parseArgList() {
      if (this.peekKind() === TokenKind.RPAREN) {
        return [];
      }
      const args = [this.parseExpression()];
      while (this.peekKind() === TokenKind.COMMA) {
        this.advance(); // consume COMMA ","
        args.push(this.parseExpression());
      }
      return args;
    }

    /**
     * Peeks ahead in token list.
     * @param {number} offset
     * @returns {string}
     */
    peekAt(offset) {
      const idx = this.pos + offset;
      return idx < this.tokens.length ? this.tokens[idx].kind : TokenKind.EOF;
    }

    /**
     * Checks if standard token signifies the start of an expression.
     * @param {string} kind
     * @returns {boolean}
     */
    canStartExpression(kind) {
      return (
        kind === TokenKind.NUMBER ||
        kind === TokenKind.LPAREN ||
        kind === TokenKind.IDENTIFIER ||
        PREVIOUS_LINE_ALIAS_KINDS.has(kind) ||
        LINE_NUMBER_ALIAS_KINDS.has(kind) ||
        kind === TokenKind.STRING_LITERAL
      );
    }
  }

  // Make namespaces items strictly visible globally
  Object.assign(NoteCalci, {
    Statement,
    Expr,
    Parser
  });
})();
