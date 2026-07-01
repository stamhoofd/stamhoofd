import { Token, User } from '@stamhoofd/models';

/**
 * Signs out administrators in bulk.
 *
 * Making two-factor authentication required only affects new logins: it is evaluated when a
 * session is created, so admins that are already signed in keep their session and never get
 * asked to enroll. An administrator can therefore ask us to end those sessions, which forces
 * every other admin through the login flow again — and with that through the forced
 * enrollment.
 *
 * API users are never signed out: their tokens are machine credentials with a long lifetime
 * that cannot complete an interactive login. User.getAdmins()/getPlatformAdmins() already
 * leave them out.
 */
export class AdminSessionService {
    /**
     * Sign out every administrator of an organization.
     *
     * `keepAccessToken` is the session of the administrator making the request: signing
     * themselves out would interrupt what they are doing, and they are forced to enroll on
     * their next login anyway.
     *
     * Returns the number of ended sessions.
     */
    static async signOutOrganizationAdmins(organizationId: string, keepAccessToken: string | null): Promise<number> {
        const admins = await User.getAdmins(organizationId);
        return await Token.deleteForUsers(admins.map(a => a.id), keepAccessToken);
    }

    /**
     * Sign out every administrator of the platform. Administrators that only have
     * permissions within an organization are not affected.
     *
     * Returns the number of ended sessions.
     */
    static async signOutPlatformAdmins(keepAccessToken: string | null): Promise<number> {
        const admins = await User.getPlatformAdmins();
        return await Token.deleteForUsers(admins.map(a => a.id), keepAccessToken);
    }
}
