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
loadScript('./core/MathEngine.js');

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
  'grand_total' // Sum of all prior lines (100+200+300+600+300+0+50) = 1550
]);
assertEqual(parseResults5[0], '100', 'First block score');
assertEqual(parseResults5[3], '600', 'Sum of prior block values (100+200+300)');
assertEqual(parseResults5[4], '300', 'Average of prior block values ((100+200+300+600)/4)');
assertEqual(parseResults5[5], '300', 'Previous line reference word (prev)');
assertEqual(parseResults5[8], '1550', 'Grand total sum across empty boundary block separations');

// 6. Constants and Function Calls
const parseResults6 = MathEngine.calculate([
  'pi',
  'sqrt(81)',
  'pow(2, 8)'
]);
assertEqual(parseResults6[0], parseFloat(Math.PI.toFixed(10)).toString(), 'PI Constant');
assertEqual(parseResults6[1], '9', 'Function call sqrt');
assertEqual(parseResults6[2], '256', 'Function call pow');

console.log('✨ All verification tests PASSED successfully!');
