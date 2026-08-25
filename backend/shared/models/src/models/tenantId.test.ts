import { MemberFactory, OrganizationFactory, RegistrationPeriodFactory, UserFactory } from '../factories/index.js';
import { Member } from './Member.js';
import { Organization } from './Organization.js';
import { RegistrationPeriod } from './RegistrationPeriod.js';
import { User } from './User.js';

describe('tenantId', () => {
    test('it is null on rows created before the backfill', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const member = await new MemberFactory({ organization }).create();
        const period = await new RegistrationPeriodFactory({}).create();

        expect(organization.tenantId).toBeNull();
        expect(user.tenantId).toBeNull();
        expect(member.tenantId).toBeNull();
        expect(period.tenantId).toBeNull();
    });

    test('it round-trips through the database', async () => {
        const organization = await new OrganizationFactory({}).create();
        organization.tenantId = 'some-tenant';
        await organization.save();

        expect((await Organization.getByID(organization.id))!.tenantId).toBe('some-tenant');

        const user = await new UserFactory({ organization }).create();
        user.tenantId = 'some-tenant';
        await user.save();
        expect((await User.getByID(user.id))!.tenantId).toBe('some-tenant');

        const member = await new MemberFactory({ organization }).create();
        member.tenantId = 'some-tenant';
        await member.save();
        expect((await Member.getByID(member.id))!.tenantId).toBe('some-tenant');

        const period = await new RegistrationPeriodFactory({}).create();
        period.tenantId = 'some-tenant';
        await period.save();
        expect((await RegistrationPeriod.getByID(period.id))!.tenantId).toBe('some-tenant');
    });
});
