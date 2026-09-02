import { MemberFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { Notification } from '@stamhoofd/models/models/Notification.js';
import { NotificationPreference } from '@stamhoofd/models/models/NotificationPreference.js';
import { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import { NamedObject } from '@stamhoofd/structures';
import { NotificationChannel } from '@stamhoofd/structures/notifications/NotificationChannel.js';
import { NotificationSubjectType } from '@stamhoofd/structures/notifications/NotificationSubjectType.js';
import { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { NotificationService } from './NotificationService.js';

describe('NotificationService', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(async () => {
        vitest.useRealTimers();
        await Notification.delete();
        await NotificationPreference.delete();
    });

    const resource = (id: string) => NamedObject.create({ id, name: 'Registration ' + id });

    async function recipientsOf(notification: Notification) {
        return await NotificationRecipient.select().where('notificationId', notification.id).fetch();
    }

    test('targets users and the users linked to members, without duplicates', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({}).create();
        const parent = await new UserFactory({}).create();
        const member = await new MemberFactory({ organization, user: parent }).create();
        const memberWithoutUser = await new MemberFactory({ organization }).create();

        const notification = await NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: { hello: 'world' },
            organizationId: organization.id,
            subjectType: NotificationSubjectType.Registration,
            subjectId: 'registration-1',
            to: { users: [user, parent.id], members: [member, memberWithoutUser.id] },
        });

        expect(notification).not.toBeNull();
        expect(notification!.payload).toEqual({ hello: 'world' });
        expect(notification!.subjectType).toBe(NotificationSubjectType.Registration);
        expect(notification!.groupResourceCount).toBe(0);

        const recipients = await recipientsOf(notification!);
        expect(recipients.map(r => r.userId).sort()).toEqual([user.id, parent.id].sort());
        expect(recipients.every(r => r.readAt === null && r.readCount === 0)).toBe(true);
    });

    test('returns null without any targets and skips users that disabled the in-app channel', async () => {
        const user = await new UserFactory({}).create();
        const disabledUser = await new UserFactory({}).create();

        const savePreference = async (userId: string, channel: NotificationChannel, enabled: boolean) => {
            const preference = new NotificationPreference();
            preference.userId = userId;
            preference.notificationType = NotificationType.RegistrationCreated;
            preference.channel = channel;
            preference.enabled = enabled;
            await preference.save();
        };
        await savePreference(disabledUser.id, NotificationChannel.InApp, false);
        // Other channels and enabled preferences don't suppress in-app delivery
        await savePreference(user.id, NotificationChannel.Push, false);
        await savePreference(user.id, NotificationChannel.InApp, true);

        expect(await NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: {},
            to: { users: [disabledUser] },
        })).toBeNull();
        expect(await Notification.select().count()).toBe(0);

        const notification = await NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: {},
            to: { users: [user, disabledUser] },
        });
        expect((await recipientsOf(notification!)).map(r => r.userId)).toEqual([user.id]);
    });

    test('groups notifications with the same key on the same day and reactivates read recipients', async () => {
        vitest.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] }).setSystemTime(new Date('2026-09-03T10:00:00Z'));

        const organization = await new OrganizationFactory({}).create();
        const reader = await new UserFactory({}).create();
        const other = await new UserFactory({}).create();
        const newcomer = await new UserFactory({}).create();

        const send = (id: string, users: typeof reader[]) => NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: {},
            organizationId: organization.id,
            group: { key: 'registrations', resource: resource(id) },
            to: { users },
        });

        const first = (await send('1', [reader, other]))!;
        expect(first.groupResourceCount).toBe(1);

        const readerRecipient = await NotificationService.markAsRead((await recipientsOf(first)).find(r => r.userId === reader.id)!);
        expect(readerRecipient.readCount).toBe(1);
        expect(readerRecipient.readAt).not.toBeNull();

        await send('2', [reader, other]);
        await send('3', [reader, other]);
        const fourth = await send('4', [reader, other, newcomer]);

        expect(fourth!.id).toBe(first.id);
        expect(await Notification.select().count()).toBe(1);

        const merged = (await Notification.getByID(first.id))!;
        expect(merged.groupResourceCount).toBe(4);
        expect(merged.groupResources.map(r => r.id)).toEqual(['2', '3', '4']);

        const recipients = await recipientsOf(merged);
        expect(recipients).toHaveLength(3);

        const reactivated = recipients.find(r => r.userId === reader.id)!;
        expect(reactivated.readAt).toBeNull();
        expect(reactivated.seenAt).toBeNull();
        expect(reactivated.readCount).toBe(1);

        const added = recipients.find(r => r.userId === newcomer.id)!;
        expect(added.readAt).toBeNull();
        expect(added.readCount).toBe(3);
    });

    test('does not group across days, organizations, types or group keys', async () => {
        // Grouping uses the Europe/Brussels day: 21:30Z is 23:30 local
        vitest.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] }).setSystemTime(new Date('2026-09-03T21:30:00Z'));

        const organization = await new OrganizationFactory({}).create();
        const otherOrganization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({}).create();

        const send = (options: { organizationId: string; key: string; type?: NotificationType }) => NotificationService.send({
            type: options.type ?? NotificationType.RegistrationCreated,
            payload: {},
            organizationId: options.organizationId,
            group: { key: options.key, resource: resource('x') },
            to: { users: [user] },
        });

        const base = (await send({ organizationId: organization.id, key: 'a' }))!;
        const otherOrg = (await send({ organizationId: otherOrganization.id, key: 'a' }))!;
        const otherKey = (await send({ organizationId: organization.id, key: 'b' }))!;
        const otherType = (await send({ organizationId: organization.id, key: 'a', type: 'other.created' as NotificationType }))!;

        expect(new Set([base.id, otherOrg.id, otherKey.id, otherType.id]).size).toBe(4);

        vitest.setSystemTime(new Date('2026-09-03T22:30:00Z'));
        const nextDay = (await send({ organizationId: organization.id, key: 'a' }))!;
        expect(nextDay.id).not.toBe(base.id);
        expect(nextDay.groupResourceCount).toBe(1);
        expect((await Notification.getByID(base.id))!.groupResourceCount).toBe(1);
    });
});
