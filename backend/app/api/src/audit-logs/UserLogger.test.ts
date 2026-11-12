import { AuditLog, UserFactory } from '@stamhoofd/models';
import { AuditLogService } from '../services/AuditLogService.js';
import './init.js';

describe('UserLogger renamed keys', () => {
    beforeAll(() => {
        AuditLogService.listen();
    });

    test('renames configured fields and retains unconfigured field names', async () => {
        const user = await AuditLogService.disable(
            async () => await new UserFactory({ verified: true }).create(),
        );
        user.verified = false;
        user.firstName = 'Jane';
        await user.save();

        const logs = await AuditLog.select().where('objectId', user.id).fetch();
        expect(logs).toHaveLength(1);
        const keys = logs[0].patchList.map((item) => item.key.toKey());
        expect(keys).toContain('emailVerified');
        expect(keys).toContain('firstName');
        expect(keys).not.toContain('verified');
    });
});
