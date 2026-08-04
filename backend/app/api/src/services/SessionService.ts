import type { SessionDurations, SessionLoginMethod, SessionType, User } from '@stamhoofd/models';
import { SESSION_DURATIONS, Token } from '@stamhoofd/models';

import { ContextInstance } from '../helpers/Context.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Creates and rotates the sessions of a login.
 *
 * A session lives as long as its refresh token, which is rotated on every access token
 * renewal — so without a limit, a client that keeps renewing keeps its session forever.
 * Every session therefore ends after a maximum length (counted from the login itself) and
 * after a period without use. How long that is depends on what the session gives access to
 * and where it is kept: see SESSION_DURATIONS for the numbers and the reasoning.
 */
export class SessionService {
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
     * How long this session may live, and how long it may go unused.
     *
     * Recalculated on every rotation, so a user that becomes an administrator during a
     * session is limited from that moment on (counted from their login, as if they had the
     * permissions all along).
     */
    private static getDurations(token: Token, user: User): SessionDurations {
        return SESSION_DURATIONS[this.getSessionType(token, user)][token.isNativeApp ? 'nativeApp' : 'browser'];
    }

    private static getSessionType(token: Token, user: User): SessionType {
        // Before the permissions: whoever signs in through the identity provider stays
        // dependent on it, member or administrator.
        if (token.loginMethod === 'sso') {
            return 'sso';
        }

        const permissions = user.permissions;
        if (!permissions || permissions.isEmpty) {
            return 'user';
        }

        if (permissions.globalPermissions !== null) {
            return 'platformAdmin';
        }

        return 'admin';
    }

    /**
     * Shorten the validity of a token to what the session it belongs to still has left.
     */
    private static applyLimits(token: Token, user: User) {
        const durations = this.getDurations(token, user);
        const sessionEndsAt = token.sessionStartedAt.getTime() + durations.session;

        token.refreshTokenValidUntil = new Date(Math.min(Date.now() + durations.refreshToken, sessionEndsAt));
        token.refreshTokenValidUntil.setMilliseconds(0);

        token.accessTokenValidUntil = new Date(Math.min(token.accessTokenValidUntil.getTime(), sessionEndsAt));
        token.accessTokenValidUntil.setMilliseconds(0);
    }
}
