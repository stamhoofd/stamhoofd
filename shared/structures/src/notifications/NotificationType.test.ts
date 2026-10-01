import { PermissionLevel } from '../PermissionLevel.js';
import { Permissions } from '../Permissions.js';
import { Platform } from '../Platform.js';
import { UserPermissions } from '../UserPermissions.js';
import { NotificationAudience, NotificationType, NotificationTypeHelper } from './NotificationType.js';

describe('Unit.NotificationTypeHelper', () => {
    const platform = Platform.create({});

    const member = { permissions: null };
    const organizationAdmin = {
        permissions: UserPermissions.create({
            organizationPermissions: new Map([['organization-1', Permissions.create({ level: PermissionLevel.Read })]]),
        }),
    };
    const platformAdmin = {
        permissions: UserPermissions.create({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }),
    };
    const limitedPlatformAdmin = {
        permissions: UserPermissions.create({
            globalPermissions: Permissions.create({ level: PermissionLevel.Read }),
        }),
    };

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('registration notifications are only relevant for administrators of an organization', () => {
        expect(NotificationTypeHelper.getRelevantTypes(member, platform)).toEqual([]);
        expect(NotificationTypeHelper.getRelevantTypes(organizationAdmin, platform)).toEqual([NotificationType.RegistrationCreated]);
        expect(NotificationTypeHelper.getRelevantTypes(platformAdmin, platform)).toEqual([]);
    });

    test.each([
        [NotificationAudience.Users, [true, true, true, true]],
        [NotificationAudience.OrganizationAdmins, [false, true, false, false]],
        [NotificationAudience.PlatformAdmins, [false, false, true, false]],
    ])('audience %s is relevant for member, organization admin, full platform admin and limited platform admin: %j', (audience, expected) => {
        vi.spyOn(NotificationTypeHelper, 'getAudience').mockReturnValue(audience);

        const users = [member, organizationAdmin, platformAdmin, limitedPlatformAdmin];
        expect(users.map(user => NotificationTypeHelper.isRelevantFor(NotificationType.RegistrationCreated, user, platform))).toEqual(expected);
    });

    test('isKnown accepts only existing types', () => {
        expect(NotificationTypeHelper.isKnown('registration.created')).toBe(true);
        expect(NotificationTypeHelper.isKnown('registration.deleted')).toBe(false);
    });
});
