/**
 * @fileoverview Port of the UI coordination and bindings from upstream NerdCalci.
 * Upstream reference: app/src/main/java/com/vishaltelangre/nerdcalci/ui/calculator/CalculatorScreen.kt
 */

(function() {
  // Attach/Retrieve window namespace registry
  const NoteCalci = (window.NoteCalci = window.NoteCalci || {});
  const MathEngine = NoteCalci.MathEngine;

  class CalculatorScreen {
    constructor() {
      // DOM Bindings
      this.editor = document.getElementById('editor');
      this.lineNumbersContainer = document.getElementById('line-numbers');
      this.resultsContainer = document.getElementById('results');

      if (!this.editor || !this.lineNumbersContainer || !this.resultsContainer) {
        throw new Error('CalculatorScreen initialization error: Required viewports not found in DOM.');
      }

      // Standard configurations
      this.linesCount = 1;

      // Initialize event binding
      this.registerEventListeners();
      this.onEditorInput(); // Run baseline calculation
    }

    /**
     * Binds layout listeners.
     */
    registerEventListeners() {
      // keystroke listener for actual parsing re-computation
      this.editor.addEventListener('input', () => this.onEditorInput());

      // synchronize scrolling heights dynamically across gutters
      const syncScroll = () => {
        const scrollTopValue = this.editor.scrollTop;
        this.lineNumbersContainer.scrollTop = scrollTopValue;
        this.resultsContainer.scrollTop = scrollTopValue;
      };
      this.editor.addEventListener('scroll', syncScroll);

      // sync when dimensions rescales
      window.addEventListener('resize', () => {
        this.onEditorInput();
      });
    }

    /**
     * Real-time recalculation and view updating orchestration.
     */
    onEditorInput() {
      const textSource = this.editor.value;
      const lines = textSource.split('\n');
      this.linesCount = Math.max(1, lines.length);

      // Run MathEngine calculation line-by-line, carrying sequence variables
      const lineCalculatedResults = MathEngine.calculate(lines);

      // Update layouts
      this.updateLineNumbers();
      this.updateResultsGutter(lineCalculatedResults);
    }

    /**
     * Synchronously displays line numbers side-by-side.
     */
    updateLineNumbers() {
      this.lineNumbersContainer.innerHTML = '';
      for (let i = 1; i <= this.linesCount; i++) {
        const lineNumSpan = document.createElement('div');
        lineNumSpan.className = 'line-number-item';
        lineNumSpan.textContent = i;
        this.lineNumbersContainer.appendChild(lineNumSpan);
      }
    }

    /**
     * Renders calculated results side-by-side with editor text inputs.
     * Highlight calculation parse failures with red indicators.
     * @param {string[]} resultsList
     */
    updateResultsGutter(resultsList) {
      this.resultsContainer.innerHTML = '';
      resultsList.forEach((result) => {
        const resultSpan = document.createElement('div');
        
        if (result === 'Err') {
          resultSpan.className = 'result-item-error';
          resultSpan.textContent = 'Err';
        } else if (result === '') {
          resultSpan.className = 'result-item-empty';
          // Output spacer item matching exact font-height spacing metrics
          resultSpan.innerHTML = '&nbsp;';
        } else {
          resultSpan.className = 'result-item-success';
          resultSpan.textContent = result;
        }
        this.resultsContainer.appendChild(resultSpan);
      });
    }
  }

  // Make namespaces items strictly visible globally
  Object.assign(NoteCalci, {
    CalculatorScreen
  });
})();
