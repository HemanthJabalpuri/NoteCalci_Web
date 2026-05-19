/**
 * @fileoverview Automated regression tests for NoteCalci Web MathEngine in a mock environment.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock browser global namespace
const window = {};
globalThis.window = window;

// Load and evaluate source scripts sequentially
const loadScript = (relativePath) => {
  const fullPath = path.join(__dirname, relativePath);
  const code = fs.readFileSync(fullPath, 'utf8');
  // Execute in current context to populate global window registry
  (new Function(code))();
};

loadScript('./core/Lexer.js');
loadScript('./core/Parser.js');
loadScript('./core/OperatorDispatcher.js');
loadScript('./core/MathEngine.js');
loadScript('./ui/NotesManager.js');

const MathEngine = window.NoteCalci.MathEngine;

// Helper assertion runner
function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`✅ [PASS] ${label}: "${actual}"`);
  } else {
    console.error(`❌ [FAIL] ${label}: Expected "${expected}", but got "${actual}"`);
    process.exit(1);
  }
}

console.log('Starting NoteCalci Web Math Engine verification scans...');

// 1. Arithmetic Precedence Verification
const parseResults1 = MathEngine.calculate([
  '12 + 34 * 2',
  '(10 + 2) / 3',
  '2 ^ 10'
]);
assertEqual(parseResults1[0], '80', 'BODMAS precedence (12 + 34 * 2)');
assertEqual(parseResults1[1], '4', 'Parentheses precedence ((10 + 2) / 3)');
assertEqual(parseResults1[2], '1024', 'Exponentiation (2 ^ 10)');

// 2. Variable assignment and reference resolving
const parseResults2 = MathEngine.calculate([
  'rate = 2.5',
  'factor = 10',
  'result = rate * factor',
  'result'
]);
assertEqual(parseResults2[0], '2.5', 'Assign rate (rate = 2.5)');
assertEqual(parseResults2[1], '10', 'Assign factor (factor = 10)');
assertEqual(parseResults2[2], '25', 'Perform calculation on variables (rate * factor)');
assertEqual(parseResults2[3], '25', 'Resolve Variable in next row');

// 3. Compound Operator assignments
const parseResults3 = MathEngine.calculate([
  'count = 50',
  'count++',
  'count--',
  'count += 10',
  'count'
]);
assertEqual(parseResults3[0], '50', 'Assign count');
assertEqual(parseResults3[1], '51', 'Increment postfix identifier (count++)');
assertEqual(parseResults3[2], '50', 'Decrement postfix identifier (count--)');
assertEqual(parseResults3[3], '60', 'Compound plus assign operator (count += 10)');
assertEqual(parseResults3[4], '60', 'Resolve mutated variable');

// 4. Percentages support
const parseResults4 = MathEngine.calculate([
  '20% of 50000',
  '15% off 1000',
  '1000 + 10%',
  '1000 - 20%',
  '20% of what is 100'
]);
assertEqual(parseResults4[0], '10000', 'Percentage of calculation (20% of 50000)');
assertEqual(parseResults4[1], '850', 'Percentage off discounts calculation (15% off 1000)');
assertEqual(parseResults4[2], '1100', 'Adding dynamic percentage (1000 + 10%)');
assertEqual(parseResults4[3], '800', 'Subtracting dynamic percentage (1000 - 20%)');
assertEqual(parseResults4[4], '500', 'Reverse percentage of (20% of what is 100)');

// 5. Dynamic Summary Variables (sum, total, avg, grand_total, prev)
const parseResults5 = MathEngine.calculate([
  '100',
  '200',
  '300',
  'total', // Sum of current block
  'avg',   // Average of current block (100, 200, 300, 600) -> 1200 / 4 = 300
  'prev',   // Preceding result is 300
  '',      // Resets block variables
  '50',
  'grand_total' // Sum of all prior lines (100+200+300+600+300+300+50) = 1850
]);
assertEqual(parseResults5[0], '100', 'First block score');
assertEqual(parseResults5[3], '600', 'Sum of prior block values (100+200+300)');
assertEqual(parseResults5[4], '300', 'Average of prior block values ((100+200+300+600)/4)');
assertEqual(parseResults5[5], '300', 'Previous line reference word (prev)');
assertEqual(parseResults5[8], '1850', 'Grand total sum across empty boundary block separations');

// 6. Constants and Function Calls
const parseResults6 = MathEngine.calculate([
  'pi',
  'sqrt(81)',
  'pow(2, 8)'
]);
assertEqual(parseResults6[0], parseFloat(Math.PI.toFixed(10)).toString(), 'PI Constant');
assertEqual(parseResults6[1], '9', 'Function call sqrt');
assertEqual(parseResults6[2], '256', 'Function call pow');

// 7. User-Defined Multi-Parameter Functions
const parseResults7 = MathEngine.calculate([
  'sq(x) = x ^ 2',
  'sq(5)',
  'add(a, b) = a + b',
  'add(3, 4)',
  'add(5)', // too few args (arity mismatch)
  'add(5, 6, 7)', // too many args (arity mismatch)
  'scale = 2',
  'f(x) = x * scale',
  'f(5)', // 10
  'val = 100',
  'g(x) = val = x * 2; val', // local isolated base variable
  'g(5)', // 10
  'val', // remains 100 globally, write-isolated
  'nested(x) = nested(x)',
  'nested(5)', // yields recursion Err
  'pi(x) = x' // attempts reassign constants -> Err
]);

assertEqual(parseResults7[0], '', 'Function definition sq');
assertEqual(parseResults7[1], '25', 'Call sq(5)');
assertEqual(parseResults7[3], '7', 'Call add(3,4)');
assertEqual(parseResults7[4], 'Err', 'Add call failing arity check too few args');
assertEqual(parseResults7[5], 'Err', 'Add call failing arity check too many args');
assertEqual(parseResults7[8], '10', 'Call f(5) using outer scale lookup');
assertEqual(parseResults7[11], '10', 'Call g(5) semicolon multi-statement return');
assertEqual(parseResults7[12], '100', 'Assert global val was isolated and write-protected');
assertEqual(parseResults7[14], 'Err', 'Call nested(5) recursion guard trigger');
assertEqual(parseResults7[15], 'Err', 'Reassigning constant PI throws error');

// 8. Dynamic Hashing Registries (Custom Functions & Constants)
const NoteCalci = window.NoteCalci;

NoteCalci.registerConstant('golden', 1.618);
NoteCalci.registerFunction('double', (x) => x * 2);
NoteCalci.registerFunction('bit_and', (a, b) => a & b);

const parseResults8 = MathEngine.calculate([
  'golden',
  'double(15)',
  'bit_and(12, 25)'
]);

assertEqual(parseResults8[0], '1.618', 'Dynamically registered constant golden');
assertEqual(parseResults8[1], '30', 'Dynamically registered function double called');
assertEqual(parseResults8[2], '8', 'Dynamically registered bitwise function bit_and called');

// Collision locks checks
try {
  NoteCalci.registerConstant('pi', 3);
  console.error('❌ [FAIL]: Redefining baseline constant pi should have thrown error');
  process.exit(1);
} catch (e) {
  console.log('✅ [PASS] Blocked custom constant redefining pi');
}

try {
  NoteCalci.registerFunction('sqrt', (x) => x);
  console.error('❌ [FAIL]: Redefining baseline function sqrt should have thrown error');
  process.exit(1);
} catch (e) {
  console.log('✅ [PASS] Blocked custom function redefining sqrt');
}


// 9. Inline Markdown line filtering simulations (CalculatorScreen logic checks)
const simulateMarkdownFilters = (lines) => {
  return lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('-') || trimmed.startsWith('+') || trimmed.startsWith('>')) {
      return '';
    }
    if (trimmed.includes('://') || (trimmed.includes('/') && !/\d/.test(trimmed) && !trimmed.includes('='))) {
      return '';
    }
    if (!/[=\+\-\*\/%\^\(\)\d_]/.test(trimmed)) {
      return '';
    }
    return line;
  });
};

const markdownLinesList = [
  '# Project Budget Calculation 🚀',
  'Plain text explaining subscription parameters.',
  '* Subscription base count:',
  '  users = 2500',
  '* Target cost per user:',
  '  price = 15',
  'Calculating final estimate:',
  'gross_income = users * price',
  'Calculations performed by https://mathjs.org',
  'Created by https://steveridout.com',
  'and/or prose slash test'
];

const cleanedLines = simulateMarkdownFilters(markdownLinesList);
assertEqual(cleanedLines[0], '', 'Heading line maps to empty row');
assertEqual(cleanedLines[1], '', 'Prose description maps to empty row');
assertEqual(cleanedLines[2], '', 'Bulleted annotation list maps to empty row');
assertEqual(cleanedLines[3], '  users = 2500', 'Math row base assignment users preserved intact');
assertEqual(cleanedLines[4], '', 'Dynamic bullet list maps to empty row');
assertEqual(cleanedLines[5], '  price = 15', 'Math row price preserved intact');
assertEqual(cleanedLines[6], '', 'Paragraph spacer maps to empty row');
assertEqual(cleanedLines[7], 'gross_income = users * price', 'Math evaluation equation preserved intact');
assertEqual(cleanedLines[8], '', 'MathJS URL line filtered and mapped to empty row');
assertEqual(cleanedLines[9], '', 'steveridout URL line filtered and mapped to empty row');
assertEqual(cleanedLines[10], '', 'Prose slash line filtered and mapped to empty row');

// Ensure standard MathEngine execution on these cleaned lines works flawlessly
const markdownCalculatedResults = MathEngine.calculate(cleanedLines);
assertEqual(markdownCalculatedResults[3], '2500', 'Users resolved to 2500');
assertEqual(markdownCalculatedResults[5], '15', 'Price resolved to 15');
assertEqual(markdownCalculatedResults[7], '37500', 'Gross income correctly calculated to 37500');


// 10. Array Calculations & Block Lists (above_block & list functions)
const parseResults10 = MathEngine.calculate([
  '10',
  '20',
  'expenses = above_block',
  'sum(expenses)',
  'avg(expenses)',
  '',
  '100',
  '200',
  '300',
  'grand_expenses = above_block',
  'sum(grand_expenses)'
]);

assertEqual(parseResults10[0], '10', 'Value 10');
assertEqual(parseResults10[2], '[10, 20]', 'Array below 2 elements serialized fully');
assertEqual(parseResults10[3], '30', 'Sum of list [10, 20] evaluates to 30');
assertEqual(parseResults10[4], '15', 'Average of list [10, 20] evaluates to 15');
assertEqual(parseResults10[9], '[100, 200, ...]', 'Array of 3 elements truncated with ellipsis');
assertEqual(parseResults10[10], '600', 'Sum of truncated list [100, 200, 300] evaluates to 600');


// 11. Markdown prose block-seeking verification (above_block skips prose/headers)
const parseResults11 = MathEngine.calculate([
  '# Section 1: Income Sources',
  '4000',
  '600',
  '',
  'You can refer to the previous list of numbers:',
  'income = above_block',
  'sum(income)'
]);

assertEqual(parseResults11[1], '4000', 'Salary value 4000');
assertEqual(parseResults11[2], '600', 'Investment value 600');
assertEqual(parseResults11[5], '[4000, 600]', 'above_block successfully skipped preceding prose block boundary resets');
assertEqual(parseResults11[6], '4600', 'Sum of above_block variables resolves perfectly to 4600');


// 12. Multi-line Operator Carry-On & ans variable alias
const parseResults12 = MathEngine.calculate([
  '100',
  '+ 50',
  '* 2',
  '/ 5',
  'ans * 10',
  'price = 150',
  '1000',
  '- price',
  '-5',
  '- Rent expense'
]);

assertEqual(parseResults12[0], '100', 'Baseline 100');
assertEqual(parseResults12[1], '150', 'Carry-on add (+ 50) -> 150');
assertEqual(parseResults12[2], '300', 'Carry-on multiply (* 2) -> 300');
assertEqual(parseResults12[3], '60', 'Carry-on division (/ 5) -> 60');
assertEqual(parseResults12[4], '600', 'ans keyword resolving previous value (60 * 10) -> 600');
assertEqual(parseResults12[7], '850', 'Carry-on subtraction other variables (- price) -> 850');
assertEqual(parseResults12[8], '-5', 'Leading negative sign without space evaluates as negative number literal -5');
assertEqual(parseResults12[9], '', 'Prose list item starting with dash (- Rent...) ignored as comment spacer');


// 13. Prose-Skipping preceding-value Carry-On (above / ans skips prose/headers)
const parseResults13 = MathEngine.calculate([
  '# Example 1: Time',
  '',
  'How many weeks in a month?',
  '  52 / 12',
  '',
  'How many weekdays in a month?',
  '  * 5'
]);

assertEqual(parseResults13[3], '4.3333333333', 'Weeks calculation evaluates successfully');
assertEqual(parseResults13[6], '21.6666666667', 'Multiplication carry-on correctly leaped over headers and prose text gaps');


// 14. Markdown dividers & Single-letter prose lists
const parseResults14 = MathEngine.calculate([
  'Notepad meet Calculator',
  '-----------------------',
  '',
  ' - mix text with sums',
  ' - a sane way to do multi-step calculations',
  ' - sign up for free to sync across devices',
  '',
  '',
  'Examples',
  '--------'
]);

assertEqual(parseResults14[0], '', 'Title line maps to spacer');
assertEqual(parseResults14[1], '', 'Dashes divider Rule 1 horizontal line mapped to spacer');
assertEqual(parseResults14[3], '', 'Prose bullet mapped to spacer');
assertEqual(parseResults14[4], '', 'Single-letter bullet (a sane...) correctly skipped as spacer instead of Err');
assertEqual(parseResults14[5], '', 'Prose bullet containing hyphen (multi-step) correctly skipped as spacer instead of Err');
assertEqual(parseResults14[9], '', 'Setext header bottom dashes divider mapped to spacer');


// 15. Default Seeded Worksheets Verification Scans
const notesManager = new window.NoteCalci.NotesManager();

// A. Test Note 1: Mathematics Tutorial
const note1 = notesManager.getNote('tutorial_math');
const processedLines1 = note1.content.split('\n').map(line => window.NoteCalci.MathEngine.isProseLine(line) ? '' : line);
const results1 = MathEngine.calculate(processedLines1);
assertEqual(results1[4], '1500', 'Tutorial 1: Base price preserved');
assertEqual(results1[5], '0.12', 'Tutorial 1: Tax percentage resolved');
assertEqual(results1[6], '180', 'Tutorial 1: Tax amount calculated successfully');
assertEqual(results1[9], '1680', 'Tutorial 1: Total bill calculated successfully');
assertEqual(results1[13], '1', 'Tutorial 1: count++ incremental step successful');

// B. Test Note 2: Lists & Array Math
const note2 = notesManager.getNote('tutorial_lists');
const processedLines2 = note2.content.split('\n').map(line => window.NoteCalci.MathEngine.isProseLine(line) ? '' : line);
const results2 = MathEngine.calculate(processedLines2);
assertEqual(results2[12], '[1500, 350, ...]', 'Tutorial 2: above_block evaluated and visually truncated in gutter');
assertEqual(results2[15], '3360', 'Tutorial 2: sum(expenses) aggregate list function call successful');
assertEqual(results2[16], '560', 'Tutorial 2: avg(expenses) aggregate list function call successful');
assertEqual(results2[17], '6', 'Tutorial 2: length(expenses) size list function call successful');
assertEqual(results2[18], '1500', 'Tutorial 2: max(expenses) list function call successful');

// C. Test Note 3: Operator Carry-On
const note3 = notesManager.getNote('tutorial_carryon');
const processedLines3 = note3.content.split('\n').map(line => window.NoteCalci.MathEngine.isProseLine(line) ? '' : line);
const results3 = MathEngine.calculate(processedLines3);
assertEqual(results3[4], '52', 'Tutorial 3: Weeks number baseline 52');
assertEqual(results3[7], '4.3333333333', 'Tutorial 3: Division carry-on correctly leaped prose text');
assertEqual(results3[10], '21.6666666667', 'Tutorial 3: Multiplication carry-on correctly leaped prose text');
assertEqual(results3[13], '216.6666666667', 'Tutorial 3: ans keyword product successful');

// D. Test Unique Note Names on creation
const firstNewNote = notesManager.createNote('Stock Prices', 'apple = 175\n');
assertEqual(firstNewNote.name, 'Stock Prices', 'Unique Note Name check: Standard name respected');

const duplicateNewNote = notesManager.createNote('Stock Prices', 'google = 140\n');
assertEqual(duplicateNewNote.name, 'Stock Prices 1', 'Unique Note Name check: Duplicate name incremented');

console.log('✨ All verification tests PASSED successfully!');
