import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { Organization, OrganizationPrivateMetaData, PermissionLevel, Permissions, Platform, PlatformConfig, UserPermissions, UserWithMembers } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { isTwoFactorEnabled } from './useTwoFactorEnabled';

function buildPlatform(featureFlags: string[] = []): Platform {
    return Platform.create({
        config: PlatformConfig.create({ featureFlags }),
    });
}

function buildOrganization(featureFlags: string[] = []): Organization {
    return Organization.create({
        name: 'Scouts Gent',
        privateMeta: OrganizationPrivateMetaData.create({ featureFlags }),
    });
}

function buildContext(platform: Platform, { platformAdmin = false }: { platformAdmin?: boolean } = {}): SessionContext {
    const context = new SessionContext(null, platform);
    context.user = UserWithMembers.create({
        email: 'admin@example.com',
        permissions: platformAdmin
            ? UserPermissions.create({
                    globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
                })
            : null,
    });
    return context;
}

describe('isTwoFactorEnabled', () => {
    test('two-factor authentication is hidden when no flag is enabled', () => {
        const platform = buildPlatform();
        expect(isTwoFactorEnabled(buildContext(platform), platform)).toBe(false);
        expect(isTwoFactorEnabled(buildContext(platform, { platformAdmin: true }), platform)).toBe(false);
    });

    test("the 'mfa' flag enables it for everyone", () => {
        const platform = buildPlatform(['mfa']);
        expect(isTwoFactorEnabled(buildContext(platform), platform)).toBe(true);
        expect(isTwoFactorEnabled(buildContext(platform, { platformAdmin: true }), platform)).toBe(true);
    });

    test("the 'mfa-admins' flag only enables it for users with platform permissions", () => {
        const platform = buildPlatform(['mfa-admins']);
        expect(isTwoFactorEnabled(buildContext(platform), platform)).toBe(false);
        expect(isTwoFactorEnabled(buildContext(platform, { platformAdmin: true }), platform)).toBe(true);
    });

    test('an organization can enable it for its own users', () => {
        const platform = buildPlatform();
        expect(isTwoFactorEnabled(buildContext(platform), platform, buildOrganization(['mfa']))).toBe(true);
        expect(isTwoFactorEnabled(buildContext(platform), platform, buildOrganization())).toBe(false);
    });
});
