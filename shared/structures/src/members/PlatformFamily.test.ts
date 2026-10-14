import { vi } from 'vitest';
import { Group } from '../Group.js';
import { Organization } from '../Organization.js';
import { Platform } from '../Platform.js';
import { PlatformFamilyHelper } from '../helpers/PlatformFamilyHelper.js';
import { PlatformFamily } from './PlatformMember.js';
import { RegisterCheckout } from './checkout/RegisterCheckout.js';
import { RegisterItem } from './checkout/RegisterItem.js';

describe('PlatformFamily checkout context', () => {
    test('constructs its checkout through the supplied factory', () => {
        const checkout = new RegisterCheckout();
        const createCheckout = vi.fn(() => checkout);

        const family = new PlatformFamily({ platform: Platform.create({}), createCheckout });

        expect(createCheckout).toHaveBeenCalledOnce();
        expect(family.checkout).toBe(checkout);
    });

    test('cloning rebinds siblings while retaining checkout and pending item identities', () => {
        const organization = Organization.create({});
        const family = PlatformFamilyHelper.create({ platform: Platform.create({}), contextOrganization: organization });
        const first = family.newMember();
        family.newMember();
        const group = Group.create({ organizationId: organization.id, periodId: organization.period.period.id });
        const item = RegisterItem.defaultFor(first, group, organization);
        family.pendingRegisterItems = [item];

        const clone = family.clone();

        expect(clone).not.toBe(family);
        expect(clone.checkout).toBe(family.checkout);
        expect(PlatformFamilyHelper.getCheckout(clone)).toBe(PlatformFamilyHelper.getCheckout(family));
        expect(clone.pendingRegisterItems).toBe(family.pendingRegisterItems);
        expect(clone.pendingRegisterItems[0]).toBe(item);
        expect(clone.members).toHaveLength(2);
        for (const [index, member] of clone.members.entries()) {
            expect(member).not.toBe(family.members[index]);
            expect(member.id).toBe(family.members[index].id);
            expect(member.family).toBe(clone);
        }
    });
});
