import { PatchMap } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Group, Organization, RegistrationPeriod, User } from '@stamhoofd/models';
import { EventFactory, GroupFactory, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { Notification } from '@stamhoofd/models/models/Notification.js';
import { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import { GroupType, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, PaymentMethod, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, TranslatedString, Version } from '@stamhoofd/structures';
import { NotificationSubjectType } from '@stamhoofd/structures/notifications/NotificationSubjectType.js';
import { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { RegistrationCreatedNotificationPayload } from '@stamhoofd/structures/notifications/RegistrationCreatedNotificationPayload.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { testServer } from '../../tests/helpers/TestServer.js';
import { RegisterMembersEndpoint } from '../endpoints/global/registration/RegisterMembersEndpoint.js';
import { RegistrationService } from './RegistrationService.js';
import { SessionService } from './SessionService.js';

describe('RegistrationNotificationService', () => {
    const endpoint = new RegisterMembersEndpoint();
    let period: RegistrationPeriod;

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2030, 11, 31),
        }).create();
    });

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(async () => {
        await Notification.delete();
    });

    function resourcePermissions(type: PermissionsResourceType, id: string) {
        const patch = Permissions.patch({});
        patch.resources.set(type, new PatchMap([[id, ResourcePermissions.patch({ level: PermissionLevel.Read })]]));
        return Permissions.create({}).patch(patch);
    }

    async function init({ featureFlag = true }: { featureFlag?: boolean } = {}) {
        const organization = await new OrganizationFactory({ period }).create();
        await new OrganizationRegistrationPeriodFactory({ organization, period }).create();
        organization.privateMeta.featureFlags = featureFlag ? ['notifications'] : [];
        await organization.save();

        const group = await new GroupFactory({ organization, period, price: 25_0000, name: new TranslatedString('Kapoenen') }).create();
        const otherGroup = await new GroupFactory({ organization, period, price: 0 }).create();

        const fullAdmin = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
        const groupReader = await new UserFactory({ organization, permissions: resourcePermissions(PermissionsResourceType.Groups, group.id) }).create();
        const otherGroupReader = await new UserFactory({ organization, permissions: resourcePermissions(PermissionsResourceType.Groups, otherGroup.id) }).create();

        return { organization, group, otherGroup, fullAdmin, groupReader, otherGroupReader };
    }

    async function register({ organization, group, member, user, asOrganization = false }: { organization: Organization; group: Group; member: { id: string }; user: User; asOrganization?: boolean }) {
        const body = IDRegisterCheckout.create({
            cart: IDRegisterCart.create({
                items: [
                    IDRegisterItem.create({
                        id: uuidv4(),
                        replaceRegistrationIds: [],
                        options: [],
                        groupPrice: group.settings.prices[0],
                        organizationId: organization.id,
                        groupId: group.id,
                        memberId: member.id,
                    }),
                ],
                balanceItems: [],
                deleteRegistrationIds: [],
            }),
            administrationFee: 0,
            freeContribution: 0,
            paymentMethod: PaymentMethod.PointOfSale,
            totalPrice: group.settings.prices[0].price.price,
            asOrganizationId: asOrganization ? organization.id : null,
            customer: null,
        });

        const request = Request.buildJson('POST', `/v${Version}/members/register`, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + (await SessionService.createSession(user)).accessToken;
        const response = await testServer.test(endpoint, request);
        expect(response.body.registrations.length).toBe(1);
        expect(response.body.registrations[0].registeredAt).not.toBeNull();
    }

    async function getNotifications() {
        const notifications = await Notification.select().where('type', NotificationType.RegistrationCreated).fetch();
        const recipients = await NotificationRecipient.select().where('notificationId', notifications.map(n => n.id)).fetch();
        return notifications.map(notification => ({
            notification,
            userIds: recipients.filter(r => r.notificationId === notification.id).map(r => r.userId).sort(),
        }));
    }

    test('a registration by a member notifies the administrators that can read the group, grouped per group', async () => {
        const { organization, group, fullAdmin, groupReader } = await init();

        // An administrator that registers their own child through the member portal is not notified about it
        const parentAdmin = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
        const member = await new MemberFactory({ organization, user: parentAdmin }).create();
        const otherUser = await new UserFactory({ organization }).create();
        const otherMember = await new MemberFactory({ organization, user: otherUser }).create();

        await register({ organization, group, member, user: parentAdmin });
        expect((await getNotifications()).map(n => n.userIds)).toEqual([[fullAdmin.id, groupReader.id].sort()]);

        // The second registration is merged into the same notification, and does reach the parent
        await register({ organization, group, member: otherMember, user: otherUser });

        const notifications = await getNotifications();
        expect(notifications).toHaveLength(1);

        const { notification, userIds } = notifications[0];
        expect(userIds).toEqual([fullAdmin.id, groupReader.id, parentAdmin.id].sort());
        expect(notification).toMatchObject({
            organizationId: organization.id,
            subjectType: NotificationSubjectType.Member,
            subjectId: member.id,
            groupKey: group.id,
            groupResourceCount: 2,
        });
        expect(notification.groupResources.map(r => r.id)).toEqual([member.id, otherMember.id]);
        expect(RegistrationCreatedNotificationPayload.decodeBoxed(notification.payload)?.group).toMatchObject({ id: group.id, name: 'Kapoenen' });
    });

    test('no notification for a manual registration by an administrator, or without the feature flag', async () => {
        const { organization, group, otherGroup, fullAdmin } = await init();
        const member = await new MemberFactory({ organization }).create();
        // Gives the administrators of the organization access to the member
        await new RegistrationFactory({ member, group: otherGroup }).create();

        await register({ organization, group, member, user: fullAdmin, asOrganization: true });

        const withoutFlag = await init({ featureFlag: false });
        const user = await new UserFactory({ organization: withoutFlag.organization }).create();
        const otherMember = await new MemberFactory({ organization: withoutFlag.organization, user }).create();
        await register({ organization: withoutFlag.organization, group: withoutFlag.group, member: otherMember, user });

        expect(await getNotifications()).toEqual([]);
    });

    test('an event registration notifies administrators with access to the event', async () => {
        const { organization, fullAdmin, otherGroupReader } = await init();
        const eventGroup = await new GroupFactory({ organization, period, type: GroupType.EventRegistration, price: 0 }).create();
        const event = await new EventFactory({ organization, group: eventGroup }).create();
        await eventGroup.refresh();

        const eventReader = await new UserFactory({ organization, permissions: resourcePermissions(PermissionsResourceType.Events, event.id) }).create();

        const user = await new UserFactory({ organization }).create();
        const member = await new MemberFactory({ organization, user }).create();
        await register({ organization, group: eventGroup, member, user });

        const notifications = await getNotifications();
        expect(notifications).toHaveLength(1);
        expect(notifications[0].userIds).toEqual([fullAdmin.id, eventReader.id].sort());
        expect(notifications[0].userIds).not.toContain(otherGroupReader.id);
    });

    test('a registration that is waiting for an online payment only notifies once it becomes valid', async () => {
        const { organization, group, fullAdmin, groupReader } = await init();
        const user = await new UserFactory({ organization }).create();
        const member = await new MemberFactory({ organization, user }).create();

        const registration = await new RegistrationFactory({ member, group, groupPrice: group.settings.prices[0] }).create();
        registration.registeredAt = null;
        registration.registeredByMember = true;
        await registration.save();

        expect(await getNotifications()).toEqual([]);

        expect(await RegistrationService.markValid(registration.id, { paid: true })).toBe(true);

        const notifications = await getNotifications();
        expect(notifications).toHaveLength(1);
        expect(notifications[0].userIds).toEqual([fullAdmin.id, groupReader.id].sort());
    });
});
