import path from 'node:path';
import { expect } from 'vitest';

// Only opt in files whose exercised paths do not use the database or application services.
const lightweightTests = [
    'src/crons/clearExcelCache.test.ts',
    'src/endpoints/global/members/throwIfDrasticMemberDetailsChange.test.ts',
    'src/helpers/GroupedThrottledQueue.test.ts',
    'src/helpers/PaymentCustomerResolver.test.ts',
    'src/helpers/RecordAnswerHelper.test.ts',
    'src/helpers/TagHelper.test.ts',
    'src/helpers/ThrottledQueue.test.ts',
    'src/helpers/XlsxTransformerColumnHelper.test.ts',
    'src/helpers/migrationOutput.test.ts',
    'src/helpers/streamForBreakdown.test.ts',
    'src/helpers/waitUntilDeadline.test.ts',
    'src/services/AuditLogService.test.ts',
    'src/services/mailchimp/buildContacts.test.ts',
    'src/services/mailchimp/planSync.test.ts',
    'tests/e2e/tests-disable-net-connect.test.ts',
];

const testPath = expect.getState().testPath;
const relativePath = testPath ? path.relative(path.resolve(import.meta.dirname, '..'), testPath).split(path.sep).join('/') : '';
if (lightweightTests.includes(relativePath)) {
    await import('./vitest.lightweight.setup.js');
} else {
    await import('./vitest.integration.setup.js');
}
