/**
 * @fileoverview Component managing synchronized editor and results gutters scrolling coordinate locks,
 * rendering line numbering counts and managing visual row underscores backdrop overlays.
 *
 * Visual line highlighting overlay backdrop architecture is adapted from and inspired by 
 * Steve Ridout's notepad-calculator (https://github.com/SteveRidout/notepad-calculator).
 */

(function() {
  const NoteCalci = (window.NoteCalci = window.NoteCalci || {});

  /**
   * EditorWorkspace class isolates DOM view synchronizations for editor gutters.
   */
  class EditorWorkspace {
    /**
     * @param {HTMLTextAreaElement} editor The central script textarea editor element
     * @param {HTMLElement} lineNumbers Gutter element holding line numbers
     * @param {HTMLElement} results Gutter element holding calculated row outputs
     * @param {HTMLElement} backgrounds Absolute backdrop layer drawing selective underlines
     */
    constructor(editor, lineNumbers, results, backgrounds) {
      this.editor = editor;
      this.lineNumbersContainer = lineNumbers;
      this.resultsContainer = results;
      this.rowBackgroundsContainer = backgrounds;

      this.registerGutterScrollListeners();
    }

    /**
     * Binds scrolling locks synchronizing viewport scroll coordinates across columns.
     */
    registerGutterScrollListeners() {
      // Synchronize scrolling coordinates when editor text scroll triggers
      const syncScroll = () => {
        const scrollTopValue = this.editor.scrollTop;
        this.lineNumbersContainer.scrollTop = scrollTopValue;
        this.resultsContainer.scrollTop = scrollTopValue;
        this.rowBackgroundsContainer.scrollTop = scrollTopValue;
      };
      this.editor.addEventListener('scroll', syncScroll);

      // Forward mouse wheel scrolling inside textarea when wheel action triggers over locked gutters
      const handleGutterWheel = (e) => {
        this.editor.scrollTop += e.deltaY;
        e.preventDefault();
      };
      this.lineNumbersContainer.addEventListener('wheel', handleGutterWheel, { passive: false });
      this.resultsContainer.addEventListener('wheel', handleGutterWheel, { passive: false });
    }

    /**
     * Synchronously paints line counts side-by-side.
     * @param {number} linesCount Total rows inside the editor
     */
    updateLineNumbers(linesCount) {
      this.lineNumbersContainer.innerHTML = '';
      for (let i = 1; i <= linesCount; i++) {
        const lineNumSpan = document.createElement('div');
        lineNumSpan.className = 'line-number-item';
        lineNumSpan.textContent = i;
        this.lineNumbersContainer.appendChild(lineNumSpan);
      }
    }

    /**
     * Renders computed mathematics outputs and updates underlines overlay backdrops.
     * @param {string[]} resultsList List of string results calculated per line
     */
    updateResultsGutter(resultsList) {
      this.resultsContainer.innerHTML = '';
      this.rowBackgroundsContainer.innerHTML = '';

      resultsList.forEach((result) => {
        const resultSpan = document.createElement('div');
        const bgSpan = document.createElement('div');
        bgSpan.className = 'row-bg-item';

        if (result === 'Err') {
          resultSpan.className = 'result-item-error';
          resultSpan.textContent = 'Err';
          bgSpan.classList.add('row-bg-math'); // draw divider under failed math equations
        } else if (result === '') {
          resultSpan.className = 'result-item-empty';
          resultSpan.innerHTML = '&nbsp;';
          bgSpan.classList.add('row-bg-prose'); // plain spacer row
        } else {
          resultSpan.className = 'result-item-success';
          resultSpan.textContent = result;
          bgSpan.classList.add('row-bg-math'); // draw divider under successful active math equations
        }
        
        this.resultsContainer.appendChild(resultSpan);
        this.rowBackgroundsContainer.appendChild(bgSpan);
      });
    }

    /**
     * Resets caret coordinates and scroll parameters on sheet load.
     */
    focusEditor() {
      this.editor.focus();
      // Trigger scrolling sync to lock alignments
      this.editor.scrollTop = 0;
      this.lineNumbersContainer.scrollTop = 0;
      this.resultsContainer.scrollTop = 0;
      this.rowBackgroundsContainer.scrollTop = 0;
    }
  }

  // Register inside namespace
  Object.assign(NoteCalci, {
    EditorWorkspace
  });
})();
