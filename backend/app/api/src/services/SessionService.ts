import type { SessionLoginMethod, User } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import type { SessionDurations, SessionType } from '@stamhoofd/models/constants/sessions.js';
import { SESSION_DURATIONS } from '@stamhoofd/models/constants/sessions.js';

import { ContextInstance } from '../helpers/Context.js';

const DAY = 24 * 60 * 60 * 1000;

export class SessionService {
    /**
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
     * Used by the SSO callback: that is a browser redirect, so the only way to hand the
     * session to the client is in the URL. Only the refresh token travels along, and the
     * client exchanges it for a usable access token.
     */
    static async createExpiredSession<U extends User>(user: U, { loginMethod }: { loginMethod: SessionLoginMethod }): Promise<Token & { user: U }> {
        const token = await Token.createUnsavedToken(user);
        token.loginMethod = loginMethod;
        token.isNativeApp = this.isNativeApp();

        token.accessTokenValidUntil = new Date(Date.now() - 31 * DAY);
        token.accessTokenValidUntil.setMilliseconds(0);

        this.applyLimits(token, user);
        await token.save();
        return token;
    }

    /**
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
     * Only read when a session is created: it is a client provided header, and a rotation
     * has to keep the value of the login instead of trusting the header again.
     */
    private static isNativeApp(): boolean {
        const platform = ContextInstance.optional?.request.headers['x-platform'];
        return platform === 'ios' || platform === 'android';
    }

    /**
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

    private static applyLimits(token: Token, user: User) {
        const durations = this.getDurations(token, user);
        const sessionEndsAt = durations.session !== null ? (token.sessionStartedAt.getTime() + durations.session) : (Date.now() + durations.refreshToken);

        token.refreshTokenValidUntil = new Date(Math.min(Date.now() + durations.refreshToken, sessionEndsAt));
        token.refreshTokenValidUntil.setMilliseconds(0);

        token.accessTokenValidUntil = new Date(Math.min(token.accessTokenValidUntil.getTime(), sessionEndsAt));
        token.accessTokenValidUntil.setMilliseconds(0);
    }
}
