import type { SessionLoginMethod, User } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';

import { ContextInstance } from '../helpers/Context.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Creates and rotates the sessions of a login.
 *
 * A session normally lives as long as its refresh token, which is rotated on every access
 * token renewal — so a browser that keeps renewing keeps its session forever. That is fine
 * for a member, but not for an administrator: their session gives access to the personal
 * data of everyone they manage, and it lives in a browser we cannot trust to keep it safe
 * for a year. Their sessions therefore end after a while no matter what (the maximum
 * session length, counted from the login itself) and after a period without use.
 *
 * The native app is left alone: it keeps its tokens in the secure storage of the device
 * instead of in a browser, and rotates them automatically in the background.
 */
export class SessionService {
    /**
     * Maximum length of an administrator session in a browser, counted from the login.
     * Platform administrators have access to every organization, so their sessions are the
     * shortest of the two.
     */
    static MAX_PLATFORM_ADMIN_SESSION_DURATION = 30 * DAY;
    static MAX_ORGANIZATION_ADMIN_SESSION_DURATION = 90 * DAY;

    /**
     * Maximum length of an administrator session that was authenticated by an external
     * identity provider. Access is granted (and taken away) there, so we go back to it more
     * often than we ask for a password.
     */
    static MAX_SSO_ADMIN_SESSION_DURATION = 7 * DAY;

    /**
     * An administrator session that is not used for this long ends, even when the maximum
     * session length has not been reached yet.
     */
    static ADMIN_INACTIVITY_DURATION = 7 * DAY;

    /**
     * Create a session for a user that just authenticated.
     *
     * @param authenticatedAt Pass the current date when a primary credential was verified
     * as part of this request, so the session counts as "fresh" for sensitive actions.
     */
    static async createSession<U extends User>(user: U, { loginMethod, authenticatedAt = null }: { loginMethod: SessionLoginMethod; authenticatedAt?: Date | null }): Promise<Token & { user: U }> {
        const token = await Token.createUnsavedToken(user);
        token.authenticatedAt = authenticatedAt;
        token.loginMethod = loginMethod;
        token.isNativeApp = this.isNativeApp();

        this.applyLimits(token, user);
        await token.save();
        return token;
    }

    /**
     * Create a session that still has to be renewed before it can be used.
     *
     * Used by the SSO callback: that is a browser redirect, so the only way to hand the
     * session to the client is in the URL. Only the refresh token travels along, and the
     * client exchanges it for a usable access token.
     */
    static async createExpiredSession<U extends User>(user: U, { loginMethod }: { loginMethod: SessionLoginMethod }): Promise<Token & { user: U }> {
        const token = await Token.createUnsavedToken(user);
        token.loginMethod = loginMethod;
        token.isNativeApp = this.isNativeApp();

        // Expired a month ago (to prevent any timezone bugs)
        token.accessTokenValidUntil = new Date(Date.now() - 31 * DAY);
        token.accessTokenValidUntil.setMilliseconds(0);

        this.applyLimits(token, user);
        await token.save();
        return token;
    }

    /**
     * Continue an existing session with a new token pair (the refresh token grant).
     *
     * The new token continues the session of the old one, so it keeps its start date and
     * cannot outlive it. Using the session is what postpones the inactivity limit.
     */
    static async rotateSession<U extends User>(oldToken: Token & { user: U }): Promise<Token & { user: U }> {
        const token = await Token.createUnsavedToken(oldToken.user);
        token.sessionStartedAt = oldToken.sessionStartedAt;
        token.loginMethod = oldToken.loginMethod;
        token.isNativeApp = oldToken.isNativeApp;

        this.applyLimits(token, oldToken.user);
        await token.save();
        return token;
    }

    /**
     * Whether the request that creates this session comes from the native app.
     *
     * Only read when a session is created: it is a client provided header, and a rotation
     * has to keep the value of the login instead of trusting the header again.
     */
    private static isNativeApp(): boolean {
        const platform = ContextInstance.optional?.request.headers['x-platform'];
        return platform === 'ios' || platform === 'android';
    }

    /**
     * How long this session may live in total, or null when it is not limited.
     *
     * Recalculated on every rotation, so a user that becomes an administrator during a
     * session is limited from that moment on (counted from their login, as if they had the
     * permissions all along).
     */
    private static getMaxSessionDuration(token: Token, user: User): number | null {
        if (token.isNativeApp) {
            return null;
        }

        const permissions = user.permissions;
        if (!permissions || permissions.isEmpty) {
            return null;
        }

        if (token.loginMethod === 'sso') {
            return this.MAX_SSO_ADMIN_SESSION_DURATION;
        }

        if (permissions.globalPermissions !== null) {
            return this.MAX_PLATFORM_ADMIN_SESSION_DURATION;
        }

        return this.MAX_ORGANIZATION_ADMIN_SESSION_DURATION;
    }

    /**
     * Shorten the validity of a token to what the session it belongs to still has left.
     */
    private static applyLimits(token: Token, user: User) {
        const maxDuration = this.getMaxSessionDuration(token, user);
        if (maxDuration === null) {
            return;
        }

        const sessionEndsAt = token.sessionStartedAt.getTime() + maxDuration;

        token.refreshTokenValidUntil = new Date(Math.min(Date.now() + this.ADMIN_INACTIVITY_DURATION, sessionEndsAt));
        token.refreshTokenValidUntil.setMilliseconds(0);

        token.accessTokenValidUntil = new Date(Math.min(token.accessTokenValidUntil.getTime(), sessionEndsAt));
        token.accessTokenValidUntil.setMilliseconds(0);
    }
}
