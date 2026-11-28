import { afterAll } from 'vitest';
import { Database } from '../src/classes/Database.js';
import { setTestDatabaseEnvironment } from './environment.js';

setTestDatabaseEnvironment();
afterAll(() => Database.end());
