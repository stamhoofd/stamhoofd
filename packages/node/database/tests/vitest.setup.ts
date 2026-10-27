import { TestUtils } from '@stamhoofd/test-utils';
import { afterAll } from 'vitest';
import { Database } from '../src/classes/Database.js';

TestUtils.setup();
afterAll(() => Database.end());
