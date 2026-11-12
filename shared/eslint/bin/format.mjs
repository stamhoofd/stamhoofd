import { ESLint } from 'eslint';
import { createFormattingESLint } from '../src/format.js';

const fix = process.argv.includes('--fix');
const eslint = createFormattingESLint({ cwd: process.cwd(), fix });
const results = await eslint.lintFiles(['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue}']);
if (fix) await ESLint.outputFixes(results);
const formatter = await eslint.loadFormatter('stylish');
const output = formatter.format(results);
if (output) console.log(output);
if (results.some(result => result.errorCount || result.warningCount)) process.exitCode = 1;
