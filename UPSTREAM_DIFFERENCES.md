# Upstream NerdCalci Logic Discrepancies

This document registers mathematical engine and parsing logic behaviors implemented differently in **NoteCalci Web** compared to the upstream Kotlin-based **NerdCalci** (v4.6.0) engine.

---

## 1. Cascading Read-Only Global/Outer Variables inside Functions

### Upstream NerdCalci Behavior
In NerdCalci, mathematical evaluations inside user-defined functions are strictly sealed within their local variable space. Functions cannot resolve or read variables defined globally in the outer document calculator context.

### NoteCalci Web Behavior
NoteCalci Web introduces a **Cascading Scope Lookup Chain** allowing user functions to fall back and read global calculator variables from preceding rows:
1.  **Reads Cascade:** If a referenced variable is not defined locally (neither passed as an argument nor assigned locally in the body), the execution engine looks it up dynamically from the outer global variables context.
2.  **Strict Write Isolation (Read-Only):** Any value assignments (`=`), compound assignments (`+=`, `*=`), or increment/decrement operations (`++`, `--`) occurring inside a function write **exclusively** to the local scope frame cache. The global variable in the parent document calculator is never modified, ensuring that global data is strictly read-only and side-effect free during execution.

---

## 2. Pluggable Built-In Functions & Constants Registry

### Upstream NerdCalci Behavior
In NerdCalci, built-in functions (like `sqrt`, `pow`) and constants (like `pi`, `e`) are resolved statically from compile-time declarations inside closed, compiled classes (`Builtins.kt` and `Constants.kt`). The available vocabulary is closed and cannot be extended dynamically at runtime without refactoring and compiling the system.

### NoteCalci Web Behavior
NoteCalci Web exposes built-in vocabularies as open, dynamic JavaScript objects (`NoteCalci.BUILTIN_FUNCTIONS` and `NoteCalci.CONSTANTS`), updating the evaluator to query these collections dynamically. We provide clean extension helpers (`NoteCalci.registerFunction()` and `NoteCalci.registerConstant()`) so developers can extend mathematical features (e.g., bitwise operations or custom domain constants) dynamically without altering core parsing files, while enforcing strict verification checks to prevent overriding baseline systems.

---

## 3. Inline Markdown Calculations & Context-Aware Sandbox pre-filtering

### Upstream NerdCalci Behavior
In NerdCalci, the input editor is designed strictly for mathematical equations, assignments, and trailing comments prefixed with `#`. Embedding plain paragraphs, explanations, URLs, or Markdown list items throws syntax errors, as the compiler does not have standard pre-processing text shielding layers.

### NoteCalci Web Behavior
NoteCalci Web incorporates a unified, highly robust **Markdown Prose-Classifier Sandbox (`MathEngine.isProseLine()`)** evaluated during calculations walks. This capability to mix rich Markdown formatting paragraphs, titles, list bullets, and horizontal rules directly inside the calculation canvas is inspired by Steve Ridout's notepad-calculator execution model.
*   **RULE 1 (Markdown):** Ignores headers (`#`), blockquotes (`>`), and divider rules (matching `^-+$` e.g. `----------------`).
*   **RULE 2 (URLs & Text Slashes):** Confidently ignores domain links or slash remarks containing no digits or `=` (e.g., `Created by steveridout.com`).
*   **RULE 3 (Prose Lists):** Intelligently distinguishes prose bullets (starting with `-`, `*`, `+`) from active math subtractions by checks if the trailing row consists of plain textual sentences (e.g., `- Rent...`).
*   **RULE 4 (Unregistered Word Sandbox):** If a prose sentence contains numbers (like `"We want to divide it by 12 months"`) or variables (like `"called above_block:"`), we scan all words in the line. If it contains ANY word that is neither a registered variable/constant, a custom function, nor an algebraic keyword, the entire line is safely bypassed and treated as spacer comments, completely avoiding `Err` syntax glitches.
*   **Functional Value:** This enables developers to write rich commentaries and explanations in plain English between equation blocks without needing prefix comments `#` tags on every row!

---

## 4. Composite Block Array Variable (`above_block`) & Pluggable List Functions

### Upstream NerdCalci Behavior
In NerdCalci, dynamic block summaries (like `total` or `avg`) compute and return single, scalar numbers. The vocabulary lacks any list/array type values. The dynamic variables `above` and `prev` only represent preceding scalar row values.

### NoteCalci Web Behavior
NoteCalci Web introduces composite **Array Value Types** natively in the calculations data stream:
*   **`above_block` Dynamic Variable (Notepad Calculator Concept):** Evaluates back to a JavaScript Array containing every numeric calculation result in the preceding contiguous block (e.g., `[1500, 350, 210, 400, 300, 600]`). This above-block aggregate is inspired by Steve Ridout's notepad-calculator list design.
*   **Pluggable List Functions:** Extends the built-in functions registry to support standard array operations (like `sum(above_block)`, `avg(above_block)`, `average(above_block)`, `length(above_block)`, `size(above_block)`, `min()`, `max()`).
*   **Smart Gutter Truncation Formatting:** When outputting to the result pane, arrays with more than 2 elements are formatted to display only the first two elements followed by an ellipsis (e.g. `[1500, 350, ...]`), avoiding horizontal text overflow and keeping readability next to narrow gutter boundaries.

---

## 5. Dynamic Preceding Result Seeking & Calibration (`above` / `ans`)

### Upstream NerdCalci Behavior
In NerdCalci, accessors referencing the preceding math result (`above`, `prev`, `last`, `_`) resolve strictly to `0` if the immediately preceding line is empty, a comment, or evaluates to an error.

### NoteCalci Web Behavior
NoteCalci Web implements **Dynamic Preceding Result Seeking** designed to work seamlessly with standard Markdown layout streams:
*   **Skip Prose Spacer Gaps:** If a line executes binary operator carry-ons or references `ans`/`above` inside equations, the engine scans backward through calculation history.
*   **Pristine Carry-on Integrity (Notepad Calculator Concept):** It skips trailing `null` spacer values (representing Markdown headers, lists, or prose sentences), retrieving the first actual **non-null** numeric result above. It defaults to `0` only if no calculations occurred yet. This dynamic carry-on (or curry) arithmetic and the preceding answer `ans` keyword are inspired by and adapted from Steve Ridout's notepad-calculator execution flows.

---

## 6. Modular Visitor Dispatch Evaluator & Polymorphic Operator Dispatcher

### Upstream NerdCalci Behavior
In NerdCalci, all algebraic operations and AST walks are resolved sequentially in a core compiled evaluator walker. Extending math keywords, custom currency operations, or timezone evaluations requires re-allocating the compiler code parameters.

### NoteCalci Web Behavior
NoteCalci Web implements a highly decoupled, modular **AST Visitor Dispatcher** and standard **Polymorphic Operator Dispatcher** (`core/OperatorDispatcher.js`):
*   **Dynamic Visitor Maps:** Shuffled the evaluator's giant `if-else instanceof` chain into a clean, extensible visitor dispatch map. Extending new AST nodes is as simple as adding a handler callback to the visitor object.
*   **Arithmetic Decoupling:** Isolates algebraic operator execution (sums, subtractions, exponentiations, and percentages) cleanly out of the parser. This establishes an open, pluggable playground ready to intercept and resolve unit mathematics or date algebras in future compatibility milestones without touching core files!
