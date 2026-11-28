import { Database } from '@stamhoofd/node-database';
import { afterAll } from 'vitest';
import { setTestDatabaseEnvironment } from './environment.js';

setTestDatabaseEnvironment();
afterAll(() => Database.end());
