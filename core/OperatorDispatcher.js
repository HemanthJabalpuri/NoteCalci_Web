/**
 * @fileoverview Polymorphic type operator dispatcher abstracting binary and unary algebraic operations.
 * Centralizes standard math operations to support seamless future expansions (like Units and Date math).
 */

(function() {
  const NoteCalci = (window.NoteCalci = window.NoteCalci || {});

  /**
   * OperatorDispatcher handles polymorphic validation and evaluation for dynamic algebraic operations.
   */
  class OperatorDispatcher {
    /**
     * Core binary dispatcher. Resolves calculations based on operand types.
     * @param {any} left Left hand operand
     * @param {string} op Operator symbol (+, -, *, /, %, ^, etc.)
     * @param {any} right Right hand operand
     * @returns {number}
     * @throws {Error} If parsing/evaluation fails or arity/type conflicts arise
     */
    static evaluateBinary(left, op, right) {
      // Dynamic type routing hooks will be registered here in future milestones
      // E.g. if (left instanceof Unit && right instanceof Unit) => return unitBinaryop(left, op, right);
      // E.g. if (left instanceof Date && right instanceof Interval) => return dateBinaryop(left, op, right);

      const numLeft = Number(left);
      const numRight = Number(right);

      if (isNaN(numLeft) || isNaN(numRight)) {
        throw new Error(`Type Error: Operator "${op}" requires numerical operands, but got "${left}" and "${right}"`);
      }

      switch (op) {
        case '+': return numLeft + numRight;
        case '-': return numLeft - numRight;
        case '*':
        case '×': return numLeft * numRight;
        case '/':
        case '÷':
          if (numRight === 0) {
            throw new Error('Evaluation Error: Division by zero');
          }
          return numLeft / numRight;
        case '%':
          if (numRight === 0) {
            throw new Error('Evaluation Error: Modulo division by zero');
          }
          return numLeft % numRight;
        case '^': return Math.pow(numLeft, numRight);
        default:
          throw new Error(`Unknown binary operator signature "${op}"`);
      }
    }

    /**
     * Core unary dispatcher (e.g., negative numbers, positive signs).
     * @param {string} op Unary operator symbol (+, -)
     * @param {any} operand Target expression value
     * @returns {number}
     */
    static evaluateUnary(op, operand) {
      const numVal = Number(operand);
      if (isNaN(numVal)) {
        throw new Error(`Type Error: Unary operator "${op}" requires numerical operand, but got "${operand}"`);
      }

      switch (op) {
        case '+': return numVal;
        case '-': return -numVal;
        default:
          throw new Error(`Unknown unary operator signature "${op}"`);
      }
    }

    /**
     * Evaluates standard percentage part divisions ("of" calculations).
     * @param {any} percent Percent rate fraction (e.g. 0.12 for 12%)
     * @param {any} base The baseline sum to extract portion from
     * @returns {number}
     */
    static evaluatePercentOf(percent, base) {
      const numP = Number(percent);
      const numB = Number(base);
      if (isNaN(numP) || isNaN(numB)) {
        throw new Error(`Type Error: percentage calculation requires numeric values, but got "${percent}" and "${base}"`);
      }
      return numB * (numP / 100);
    }

    /**
     * Evaluates standard percentage discounts off calculations ("off" calculations).
     * @param {any} percent Percent rate discount fraction (e.g. 0.15 for 15%)
     * @param {any} base The baseline sum to discount
     * @returns {number}
     */
    static evaluatePercentOff(percent, base) {
      const numP = Number(percent);
      const numB = Number(base);
      if (isNaN(numP) || isNaN(numB)) {
        throw new Error(`Type Error: percentage discount calculation requires numeric values`);
      }
      return numB * (1 - numP / 100);
    }

    /**
     * Evaluates inverse reverse percentage calculations ("percent of what is base" calculations).
     * @param {any} percent Percent rate fraction (e.g. 0.20 for 20%)
     * @param {any} val The resulting portion value
     * @returns {number}
     */
    static evaluateReversePercentOf(percent, val) {
      const numP = Number(percent);
      const numV = Number(val);
      if (isNaN(numP) || isNaN(numV)) {
        throw new Error(`Type Error: reverse percentage calculation requires numeric values`);
      }
      if (numP === 0) {
        throw new Error('Evaluation Error: Reverse percentage division by zero');
      }
      return numV / (numP / 100);
    }
  }

  // Register inside global namespace
  Object.assign(NoteCalci, {
    OperatorDispatcher
  });
})();
