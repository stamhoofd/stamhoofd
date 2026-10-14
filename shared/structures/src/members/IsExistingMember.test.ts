import { Group } from '../Group.js';
import { GroupPrice, GroupSettings } from '../GroupSettings.js';
import { GroupType } from '../GroupType.js';
import { Organization } from '../Organization.js';
import { Platform } from '../Platform.js';
import { OrganizationRegistrationPeriod, RegistrationPeriod } from '../RegistrationPeriod.js';
import { PlatformFamilyHelper } from '../helpers/PlatformFamilyHelper.js';
import { MemberDetails } from './MemberDetails.js';
import { MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob.js';
import { PlatformMember } from './PlatformMember.js';
import { Registration } from './Registration.js';

describe('PlatformMember.isExistingMember', () => {
    const organization = Organization.create({
        period: OrganizationRegistrationPeriod.create({
            period: RegistrationPeriod.create({
                id: 'current',
                previousPeriodId: 'previous',
                nextPeriodId: 'next',
            }),
        }),
    });

    function build({ periodId, type = GroupType.Membership, organizationId = organization.id }: { periodId: string; type?: GroupType; organizationId?: string }) {
        const member = MemberWithRegistrationsBlob.create({
            registrations: [Registration.create({
                registeredAt: new Date(),
                organizationId,
                groupPrice: GroupPrice.create({}),
                group: Group.create({
                    organizationId,
                    type,
                    settings: GroupSettings.create({}),
                    periodId,
                }),
            })],
            details: MemberDetails.create({}),
        });
        const family = PlatformFamilyHelper.create({ platform: Platform.create({}), contextOrganization: organization });
        return new PlatformMember({ member, family });
    }

    test.each(['previous', 'current', 'next'])('a membership in the %s period counts', (periodId) => {
        expect(build({ periodId }).isExistingMember(organization)).toBe(true);
    });

    test('a membership in an older period does not count', () => {
        expect(build({ periodId: 'older' }).isExistingMember(organization)).toBe(false);
    });

    test.each([GroupType.EventRegistration, GroupType.WaitingList])('a %s registration does not count', (type) => {
        expect(build({ periodId: 'current', type }).isExistingMember(organization)).toBe(false);
    });

    test('a membership of another organization does not count', () => {
        expect(build({ periodId: 'current', organizationId: 'other' }).isExistingMember(organization)).toBe(false);
    });
});
