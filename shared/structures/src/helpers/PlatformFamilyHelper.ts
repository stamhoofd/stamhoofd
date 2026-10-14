import { PlatformFamily, PlatformRegistration, type PlatformFamilyContext } from '../members/PlatformMember.js';
import { RegisterCheckout } from '../members/checkout/RegisterCheckout.js';

type FamilyContext = Omit<PlatformFamilyContext, 'createCheckout'>;

export class PlatformFamilyHelper {
    static create(context: FamilyContext): PlatformFamily {
        return new PlatformFamily({ ...context, createCheckout: () => new RegisterCheckout() });
    }

    static fromBlob(blob: Parameters<typeof PlatformFamily.create>[0], context: FamilyContext): PlatformFamily {
        return PlatformFamily.create(blob, { ...context, createCheckout: () => new RegisterCheckout() });
    }

    static createSingles(blob: Parameters<typeof PlatformFamily.createSingles>[0], context: FamilyContext) {
        return PlatformFamily.createSingles(blob, { ...context, createCheckout: () => new RegisterCheckout() });
    }

    static createRegistrationSingles(blob: Parameters<typeof PlatformRegistration.createSingles>[0], context: FamilyContext) {
        return PlatformRegistration.createSingles(blob, { ...context, createCheckout: () => new RegisterCheckout() });
    }

    static getCheckout(family: PlatformFamily): RegisterCheckout {
        if (!(family.checkout instanceof RegisterCheckout)) {
            throw new Error('This family does not have a registration checkout');
        }
        return family.checkout;
    }
}
