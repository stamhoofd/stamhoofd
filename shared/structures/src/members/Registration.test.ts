import { Group } from '../Group.js';
import { GroupPrice } from '../GroupSettings.js';
import { Registration } from './Registration.js';

describe('Registration.isTrialAt', () => {
    const trialUntil = new Date(2026, 5, 15, 23, 59, 59);

    function createRegistration({ deactivatedAt = null }: { deactivatedAt?: Date | null } = {}) {
        return Registration.create({
            group: Group.create({}),
            groupPrice: GroupPrice.create({}),
            trialUntil,
            deactivatedAt,
        });
    }

    test('is a trial until the end of the trial period', () => {
        const registration = createRegistration();

        expect(registration.isTrialAt(new Date(trialUntil.getTime() - 1))).toBe(true);
        expect(registration.isTrialAt(trialUntil)).toBe(false);
        expect(registration.isTrialAt(new Date(trialUntil.getTime() + 1))).toBe(false);
    });

    test('is never a trial without a trial period', () => {
        const registration = createRegistration();
        registration.trialUntil = null;

        expect(registration.isTrialAt(new Date(trialUntil.getTime() - 1))).toBe(false);
    });

    test('stays a trial when the registration was stopped during the trial period', () => {
        const registration = createRegistration({
            deactivatedAt: new Date(trialUntil.getTime() - 1000),
        });

        expect(registration.isTrialAt(new Date(trialUntil.getTime() + 1000 * 60 * 60 * 24))).toBe(
            true,
        );
    });

    test('is no trial when the registration was stopped after the trial period', () => {
        const registration = createRegistration({
            deactivatedAt: new Date(trialUntil.getTime() + 1000),
        });

        expect(registration.isTrialAt(new Date(trialUntil.getTime() - 1))).toBe(false);
    });
});
