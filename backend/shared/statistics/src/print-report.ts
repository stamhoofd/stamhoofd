import { loadReport } from './report.js';

/**
 * Prints the report definition as json, which is how `stam metabase report` reads it.
 *
 * The CLI cannot import this package: it is built before the backend packages are, so a compile-time
 * dependency would invert that order. Running this script keeps one parser and one copy of the
 * queries instead of a second set in the CLI.
 */
console.log(JSON.stringify(await loadReport()));
