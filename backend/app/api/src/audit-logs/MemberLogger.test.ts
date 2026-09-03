import { AuditLog, MemberFactory } from '@stamhoofd/models';
import { AuditLogService } from '../services/AuditLogService.js';
import './init.js';

describe('MemberLogger', () => {
    beforeAll(() => {
        AuditLogService.listen();
    });

    test('does not write an audit log when only lastExternalSync changes', async () => {
        const member = await AuditLogService.disable(async () => await new MemberFactory({}).create());

        member.details.lastExternalSync = new Date();
        await member.save();

        const logs = await AuditLog.select()
            .where('objectId', member.id)
            .fetch();

        expect(logs).toHaveLength(0);
    });
});
