import { loadEnvironment } from './loadEnvironment.js';

/**
 * Import this as the first import of a vitest setup file. It defines the global `STAMHOOFD` before any other
 * module is evaluated, so modules that read the environment while loading (such as `Version` in
 * `@stamhoofd/structures`) see the test environment.
 */
loadEnvironment();
