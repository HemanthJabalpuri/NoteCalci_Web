/**
 * @fileoverview Port of the lexical tokenizer from upstream NerdCalci.
 * Upstream reference: app/src/main/java/com/vishaltelangre/nerdcalci/core/Lexer.kt
 *                     app/src/main/java/com/vishaltelangre/nerdcalci/core/Token.kt
 */

(function() {
  // Attach/Retrieve window namespace registry
  const NoteCalci = (window.NoteCalci = window.NoteCalci || {});

  /** Every distinct lexeme kind produced by Lexer. */
  const TokenKind = {
    // Literals
    NUMBER: 'NUMBER',
    STRING_LITERAL: 'STRING_LITERAL',

    // Identifiers (variables, function names, keywords)
    IDENTIFIER: 'IDENTIFIER',

    // Arithmetic operators
    PLUS: 'PLUS',
    MINUS: 'MINUS',
    STAR: 'STAR',
    SLASH: 'SLASH',
    PERCENT: 'PERCENT',
    CARET: 'CARET',

    // Compound assignment operators
    PLUS_EQUALS: 'PLUS_EQUALS',
    MINUS_EQUALS: 'MINUS_EQUALS',
    STAR_EQUALS: 'STAR_EQUALS',
    SLASH_EQUALS: 'SLASH_EQUALS',
    PERCENT_EQUALS: 'PERCENT_EQUALS',

    // Increment / decrement
    PLUS_PLUS: 'PLUS_PLUS',
    MINUS_MINUS: 'MINUS_MINUS',

    // Grouping & punctuation
    LPAREN: 'LPAREN',
    RPAREN: 'RPAREN',
    COMMA: 'COMMA',
    EQUALS: 'EQUALS',
    SEMICOLON: 'SEMICOLON',
    DOT: 'DOT',

    // Keywords — resolved from IDENTIFIER by the Lexer
    KW_OF: 'KW_OF',
    KW_OFF: 'KW_OFF',
    KW_WHAT: 'KW_WHAT',
    KW_IS: 'KW_IS',
    KW_FILE: 'KW_FILE',
    KW_LAST: 'KW_LAST',
    KW_PREV: 'KW_PREV',
    KW_PREVIOUS: 'KW_PREVIOUS',
    KW_ABOVE: 'KW_ABOVE',
    KW_UNDERSCORE: 'KW_UNDERSCORE',
    KW_LINENO: 'KW_LINENO',
    KW_LINENUMBER: 'KW_LINENUMBER',
    KW_CURRENTLINENUMBER: 'KW_CURRENTLINENUMBER',
    KW_TO: 'KW_TO',
    KW_IN: 'KW_IN',
    KW_AS: 'KW_AS',

    // Date relative keywords
    KW_TODAY: 'KW_TODAY',
    KW_YESTERDAY: 'KW_YESTERDAY',
    KW_TOMORROW: 'KW_TOMORROW',
    KW_NOW: 'KW_NOW',

    // Date arithmetic prepositions
    KW_BEFORE: 'KW_BEFORE',
    KW_AFTER: 'KW_AFTER',
    KW_AGO: 'KW_AGO',
    KW_FROM: 'KW_FROM',
    KW_SINCE: 'KW_SINCE',
    KW_TILL: 'KW_TILL',
    KW_UNTIL: 'KW_UNTIL',
    KW_THROUGH: 'KW_THROUGH',
    KW_BETWEEN: 'KW_BETWEEN',
    KW_AND: 'KW_AND',

    // End-of-input
    EOF: 'EOF'
  };

  const KEYWORDS = {
    'of': TokenKind.KW_OF,
    'off': TokenKind.KW_OFF,
    'what': TokenKind.KW_WHAT,
    'is': TokenKind.KW_IS,
    'last': TokenKind.KW_LAST,
    'prev': TokenKind.KW_PREV,
    'previous': TokenKind.KW_PREVIOUS,
    'above': TokenKind.KW_ABOVE,
    '_': TokenKind.KW_UNDERSCORE,
    'lineno': TokenKind.KW_LINENO,
    'linenumber': TokenKind.KW_LINENUMBER,
    'currentlinenumber': TokenKind.KW_CURRENTLINENUMBER,
    'file': TokenKind.KW_FILE,
    'to': TokenKind.KW_TO,
    'in': TokenKind.KW_IN,
    'as': TokenKind.KW_AS,

    // Date relative keywords
    'today': TokenKind.KW_TODAY,
    'yesterday': TokenKind.KW_YESTERDAY,
    'tomorrow': TokenKind.KW_TOMORROW,
    'now': TokenKind.KW_NOW,

    // Date prepositions
    'before': TokenKind.KW_BEFORE,
    'after': TokenKind.KW_AFTER,
    'ago': TokenKind.KW_AGO,
    'from': TokenKind.KW_FROM,
    'since': TokenKind.KW_SINCE,
    'till': TokenKind.KW_TILL,
    'until': TokenKind.KW_UNTIL,
    'through': TokenKind.KW_THROUGH,
    'between': TokenKind.KW_BETWEEN,
    'and': TokenKind.KW_AND
  };

  const PREVIOUS_LINE_ALIAS_KINDS = new Set([
    TokenKind.KW_LAST,
    TokenKind.KW_PREV,
    TokenKind.KW_PREVIOUS,
    TokenKind.KW_ABOVE,
    TokenKind.KW_UNDERSCORE
  ]);

  const LINE_NUMBER_ALIAS_KINDS = new Set([
    TokenKind.KW_LINENO,
    TokenKind.KW_LINENUMBER,
    TokenKind.KW_CURRENTLINENUMBER
  ]);

  /**
   * A single token representation.
   */
  class Token {
    /**
     * @param {string} kind
     * @param {string} lexeme
     * @param {number} value
     * @param {number} position
     */
    constructor(kind, lexeme, value = 0, position = 0) {
      this.kind = kind;
      this.lexeme = lexeme;
      this.value = value;
      this.position = position;
    }
  }

  /**
   * Single-pass character scanner.
   */
  class Lexer {
    /**
     * @param {string} source
     */
    constructor(source) {
      this.source = source;
      this.pos = 0;
    }

    /**
     * Tokenizes the raw source string into a list of Tokens.
     * @returns {Token[]}
     */
    tokenize() {
      const tokens = [];
      while (this.pos < this.source.length) {
        const start = this.pos;
        const ch = this.source[this.pos];

        if (ch === '#') {
          // Comment — stop scanning entirely
          this.pos = this.source.length;
        } else if (/\s/.test(ch)) {
          this.pos++;
        } else if (/\d/.test(ch) || (ch === '.' && /\d/.test(this.peekNext()))) {
          tokens.push(this.scanNumber(start));
        } else if (ch === '"') {
          tokens.push(this.scanString(start));
        } else if (/[a-zA-Z_°]/.test(ch)) {
          tokens.push(this.scanIdentifier(start));
        } else {
          tokens.push(this.scanOperator(start));
        }
      }
      tokens.push(new Token(TokenKind.EOF, '', 0, this.pos));
      return tokens;
    }

    /**
     * Reads and tokenizes numeric literals.
     * @param {number} start
     * @returns {Token}
     */
    scanNumber(start) {
      // Integer part
      while (this.pos < this.source.length && /\d/.test(this.source[this.pos])) {
        this.pos++;
      }

      // Decimal part
      if (this.pos < this.source.length && this.source[this.pos] === '.' &&
          (this.pos + 1 < this.source.length && /\d/.test(this.source[this.pos + 1]))) {
        this.pos++; // consume '.'
        while (this.pos < this.source.length && /\d/.test(this.source[this.pos])) {
          this.pos++;
        }
      }

      // Exponent part
      if (this.pos < this.source.length && this.source[this.pos] === 'E') {
        const savedPos = this.pos;
        this.pos++; // consume 'E'

        // Optional sign
        if (this.pos < this.source.length && (this.source[this.pos] === '+' || this.source[this.pos] === '-')) {
          this.pos++;
        }

        // Must have at least one digit after E
        if (this.pos < this.source.length && /\d/.test(this.source[this.pos])) {
          while (this.pos < this.source.length && /\d/.test(this.source[this.pos])) {
            this.pos++;
          }
        } else {
          // Backtrack exponent parsing
          this.pos = savedPos;
        }
      }

      const lexeme = this.source.substring(start, this.pos);
      const value = parseFloat(lexeme);

      // Safety validation for too large exponent value (mirroring upstream Constants.MAX_POWER_EXPONENT)
      const eIdx = lexeme.indexOf('E');
      if (eIdx >= 0) {
        const expPart = lexeme.substring(eIdx + 1);
        const expVal = parseInt(expPart, 10);
        if (!isNaN(expVal) && Math.abs(expVal) > 1000) {
          throw new Error('Exponent is too large (maximum exponent is 1000)');
        }
      }

      return new Token(TokenKind.NUMBER, lexeme, value, start);
    }

    /**
     * Reads and tokenizes string literals.
     * @param {number} start
     * @returns {Token}
     */
    scanString(start) {
      this.pos++; // consume open quote
      const stringStart = this.pos;
      while (this.pos < this.source.length && this.source[this.pos] !== '"') {
        this.pos++;
      }
      if (this.pos >= this.source.length) {
        throw new Error(`Syntax error: Unterminated string literal at position ${start}`);
      }
      const lexeme = this.source.substring(stringStart, this.pos);
      this.pos++; // consume closing quote
      return new Token(TokenKind.STRING_LITERAL, lexeme, 0, start);
    }

    /**
     * Reads and tokenizes identifiers and maps them to keyword lookups.
     * @param {number} start
     * @returns {Token}
     */
    scanIdentifier(start) {
      while (this.pos < this.source.length && /[a-zA-Z0-9_²³°]/.test(this.source[this.pos])) {
        this.pos++;
      }
      const lexeme = this.source.substring(start, this.pos);
      const lowercaseLexeme = lexeme.toLowerCase();
      const kind = KEYWORDS[lowercaseLexeme] || TokenKind.IDENTIFIER;
      return new Token(kind, lexeme, 0, start);
    }

    /**
     * Reads and tokenizes mathematical operator characters.
     * @param {number} start
     * @returns {Token}
     */
    scanOperator(start) {
      const ch = this.source[this.pos];
      this.pos++;
      switch (ch) {
        case '+':
          if (this.match('=')) return new Token(TokenKind.PLUS_EQUALS, '+=', 0, start);
          if (this.match('+')) return new Token(TokenKind.PLUS_PLUS, '++', 0, start);
          return new Token(TokenKind.PLUS, '+', 0, start);
        case '.':
          return new Token(TokenKind.DOT, '.', 0, start);
        case '-':
          if (this.match('=')) return new Token(TokenKind.MINUS_EQUALS, '-=', 0, start);
          if (this.match('-')) return new Token(TokenKind.MINUS_MINUS, '--', 0, start);
          return new Token(TokenKind.MINUS, '-', 0, start);
        case '*':
        case '×': // Unicode multiplication char support
          if (this.match('=')) return new Token(TokenKind.STAR_EQUALS, '*=', 0, start);
          return new Token(TokenKind.STAR, '*', 0, start);
        case '/':
        case '÷': // Unicode division char support
          if (this.match('=')) return new Token(TokenKind.SLASH_EQUALS, '/=', 0, start);
          return new Token(TokenKind.SLASH, '/', 0, start);
        case '%':
          if (this.match('=')) return new Token(TokenKind.PERCENT_EQUALS, '%=', 0, start);
          return new Token(TokenKind.PERCENT, '%', 0, start);
        case '^':
          return new Token(TokenKind.CARET, '^', 0, start);
        case '(':
          return new Token(TokenKind.LPAREN, '(', 0, start);
        case ')':
          return new Token(TokenKind.RPAREN, ')', 0, start);
        case ',':
          return new Token(TokenKind.COMMA, ',', 0, start);
        case '=':
          return new Token(TokenKind.EQUALS, '=', 0, start);
        case ';':
          return new Token(TokenKind.SEMICOLON, ';', 0, start);
        default:
          throw new Error(`Syntax error: Unexpected character "${ch}" at position ${start}`);
      }
    }

    /**
     * Consume next char only if it matches the expected criteria.
     * @param {string} expected
     * @returns {boolean}
     */
    match(expected) {
      if (this.pos < this.source.length && this.source[this.pos] === expected) {
        this.pos++;
        return true;
      }
      return false;
    }

    /**
     * peekNext returns the upcoming character from the parsing stream.
     * @returns {string}
     */
    peekNext() {
      return this.pos + 1 < this.source.length ? this.source[this.pos + 1] : '';
    }
  }

  // Make namespaces items strictly visible
  Object.assign(NoteCalci, {
    TokenKind,
    Token,
    Lexer,
    PREVIOUS_LINE_ALIAS_KINDS,
    LINE_NUMBER_ALIAS_KINDS
  });
})();
