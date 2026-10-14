import { Group } from '../../Group.js';
import { GroupPrice } from '../../GroupSettings.js';
import { Platform } from '../../Platform.js';
import { PlatformFamilyHelper } from '../../helpers/PlatformFamilyHelper.js';
import { Registration } from '../Registration.js';
import { RegistrationWithPlatformMember } from './RegistrationWithPlatformMember.js';

describe('RegistrationWithPlatformMember', () => {
    test('clones the registration while retaining its member reference', () => {
        const family = PlatformFamilyHelper.create({ platform: Platform.create({}) });
        const member = family.newMember();
        const registration = Registration.create({ group: Group.create({}), groupPrice: GroupPrice.create({}), organizationId: '' });
        const original = new RegistrationWithPlatformMember({ registration, member });

        const clone = original.clone();

        expect(clone).not.toBe(original);
        expect(clone.member).toBe(member);
        expect(clone.registration).not.toBe(registration);
        expect(clone.registration.id).toBe(registration.id);
        expect(original.group).toBe(registration.group);
        expect(clone.group).toBe(clone.registration.group);
    });
});
