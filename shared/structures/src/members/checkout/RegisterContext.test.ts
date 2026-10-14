import { Group } from '../../Group.js';
import { Organization } from '../../Organization.js';
import { Platform } from '../../Platform.js';
import { PlatformFamilyHelper } from '../../helpers/PlatformFamilyHelper.js';
import { Registration } from '../Registration.js';
import { RegisterCheckout } from './RegisterCheckout.js';
import type { RegisterContext as CheckoutRegisterContext } from './RegisterCheckout.js';
import type { RegisterContext } from './RegisterContext.js';
import { RegisterItem } from './RegisterItem.js';

describe('RegisterContext', () => {
    test('hydrates checkout items and removed registrations from the same context', () => {
        const organization = Organization.create({});
        const group = Group.create({ organizationId: organization.id, periodId: organization.period.period.id });
        const family = PlatformFamilyHelper.create({ platform: Platform.create({}), contextOrganization: organization });
        const member = family.newMember();
        const registration = Registration.create({ group, groupPrice: group.settings.prices[0], organizationId: organization.id });
        member.member.registrations.push(registration);
        const context: RegisterContext = { members: [member], groups: [group], organizations: [organization] };
        const checkoutContext: CheckoutRegisterContext = context;
        const original = new RegisterCheckout();
        original.cart.items = [RegisterItem.defaultFor(member, group, organization)];
        const encoded = original.convert();
        encoded.cart.deleteRegistrationIds = [registration.id];

        const hydrated = encoded.hydrate(checkoutContext);

        expect(hydrated.cart.items[0].member).toBe(member);
        expect(hydrated.cart.items[0].group).toBe(group);
        expect(hydrated.cart.items[0].organization).toBe(organization);
        expect(hydrated.cart.deleteRegistrations[0].member).toBe(member);
        expect(hydrated.cart.deleteRegistrations[0].registration.id).toBe(registration.id);
        expect(hydrated.defaultOrganization).toBe(organization);
    });
});
