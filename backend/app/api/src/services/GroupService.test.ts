import { Group, GroupFactory, MemberFactory, OrganizationFactory, RegistrationFactory } from '@stamhoofd/models';
import { GroupService } from './GroupService.js';

describe('Group occupancy', () => {
    const now = new Date('2026-10-19T12:00:00.000Z');

    beforeEach(() => {
        vitest.useFakeTimers({ toFake: ['Date'] });
        vitest.setSystemTime(now);
    });

    afterEach(() => {
        vitest.useRealTimers();
    });

    test.each([
        { name: 'active confirmed registration', registeredAt: now, deactivatedAt: null, canRegister: false, reservedUntil: null, registered: 1, reserved: 0 },
        { name: 'deactivated confirmed registration', registeredAt: now, deactivatedAt: now, canRegister: false, reservedUntil: null, registered: 0, reserved: 0 },
        { name: 'registration allowed without an expiry', registeredAt: null, deactivatedAt: null, canRegister: true, reservedUntil: null, registered: 0, reserved: 1 },
        { name: 'future reservation', registeredAt: null, deactivatedAt: null, canRegister: false, reservedUntil: new Date(now.getTime() + 1000), registered: 0, reserved: 1 },
        { name: 'reservation expiring now', registeredAt: null, deactivatedAt: null, canRegister: false, reservedUntil: now, registered: 0, reserved: 1 },
        { name: 'expired reservation', registeredAt: null, deactivatedAt: null, canRegister: false, reservedUntil: new Date(now.getTime() - 1000), registered: 0, reserved: 0 },
        { name: 'expired reservation still allowed to register', registeredAt: null, deactivatedAt: null, canRegister: true, reservedUntil: new Date(now.getTime() - 1000), registered: 0, reserved: 1 },
        { name: 'deactivated unconfirmed reservation', registeredAt: null, deactivatedAt: now, canRegister: true, reservedUntil: null, registered: 0, reserved: 1 },
        { name: 'confirmed registration with a reservation', registeredAt: now, deactivatedAt: null, canRegister: true, reservedUntil: now, registered: 1, reserved: 0 },
        { name: 'unconfirmed registration without a reservation', registeredAt: null, deactivatedAt: null, canRegister: false, reservedUntil: null, registered: 0, reserved: 0 },
    ])('counts $name', async ({ registeredAt, deactivatedAt, canRegister, reservedUntil, registered, reserved }) => {
        const organization = await new OrganizationFactory({}).create();
        const group = await new GroupFactory({ organization }).create();
        const member = await new MemberFactory({ organization }).create();
        const registration = await new RegistrationFactory({ group, member }).create();
        registration.registeredAt = registeredAt;
        registration.deactivatedAt = deactivatedAt;
        registration.canRegister = canRegister;
        registration.reservedUntil = reservedUntil;
        await registration.save();

        await GroupService.refreshOccupancy(group);

        expect(group.settings.registeredMembers).toBe(registered);
        expect(group.settings.reservedMembers).toBe(reserved);
    });

    test('only counts registrations in the requested group and resets stale counts', async () => {
        const organization = await new OrganizationFactory({}).create();
        const group = await new GroupFactory({ organization }).create();
        const otherGroup = await new GroupFactory({ organization }).create();
        const member = await new MemberFactory({ organization }).create();
        await new RegistrationFactory({ group: otherGroup, member }).create();
        const reservation = await new RegistrationFactory({ group: otherGroup, member }).create();
        reservation.registeredAt = null;
        reservation.canRegister = true;
        await reservation.save();
        group.settings.registeredMembers = 10;
        group.settings.reservedMembers = 10;

        await GroupService.refreshOccupancy(group);

        expect(group.settings.registeredMembers).toBe(0);
        expect(group.settings.reservedMembers).toBe(0);
    });

    test('refreshes the supplied instance without saving or losing unsaved settings', async () => {
        const group = await new GroupFactory({}).create();
        const originalMaxMembers = group.settings.maxMembers;
        const originalRegisteredMembers = group.settings.registeredMembers;
        group.settings.maxMembers = 123;
        group.settings.registeredMembers = 10;

        await GroupService.refreshOccupancy(group);

        expect(group.settings.maxMembers).toBe(123);
        expect(group.settings.registeredMembers).toBe(0);
        const stored = await Group.getByID(group.id);
        expect(stored?.settings.maxMembers).toBe(originalMaxMembers);
        expect(stored?.settings.registeredMembers).toBe(originalRegisteredMembers);
    });

    test('updates and persists occupancy by group id', async () => {
        const group = await new GroupFactory({}).create();
        const member = await new MemberFactory({}).create();
        await new RegistrationFactory({ group, member }).create();

        const updated = await GroupService.updateOccupancy(group.id);

        expect(updated?.settings.registeredMembers).toBe(1);
        expect(updated?.settings.reservedMembers).toBe(0);
        const stored = await Group.getByID(group.id);
        expect(stored?.settings.registeredMembers).toBe(1);
        expect(stored?.settings.reservedMembers).toBe(0);
    });

    test('does not fail for a missing group', async () => {
        expect(await GroupService.updateOccupancy('missing-group')).toBeUndefined();
    });
});
