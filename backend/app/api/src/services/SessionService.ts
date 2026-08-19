import { SimpleError } from '@simonbackx/simple-errors';
import type { User } from '@stamhoofd/models';
import { Token, UserSession } from '@stamhoofd/models';
import type { SessionDurations, SessionType } from '@stamhoofd/models/constants/sessions.js';
import { SESSION_DURATIONS } from '@stamhoofd/models/constants/sessions.js';
import { SessionClientType, SessionDeviceType, type SessionMetaData, SessionLoginMethod, SessionOS } from '@stamhoofd/structures';

import { ContextInstance } from '../helpers/Context.js';

const DAY = 24 * 60 * 60 * 1000;

export class SessionService {
    /**
     * @param authenticatedAt Pass the current date when a primary credential was verified
     * as part of this request, so the session counts as "fresh" for sensitive actions.
     */
    static async createSession<U extends User>(user: U, { loginMethod, authenticatedAt = null }: { loginMethod: SessionLoginMethod; authenticatedAt?: Date | null }): Promise<Token & { user: U }> {
        const token = await Token.createUnsavedToken(user, {
            clientType: this.getClientType(),
            loginMethod,
            metaData: this.getMetaData(),
        });
        token.authenticatedAt = authenticatedAt;

        const session = await UserSession.getByID(token.sessionId);
        if (!session) {
            throw new Error('Failed to create user session');
        }
        this.applyLimits(token, session, user);
        await token.save();
        return token;
    }

    /**
     * Used by the SSO callback: that is a browser redirect, so the only way to hand the
     * session to the client is in the URL. Only the refresh token travels along, and the
     * client exchanges it for a usable access token.
     */
    static async createExpiredSession<U extends User>(user: U, { loginMethod, clientType = this.getClientType(), metaData = this.getMetaData() }: { loginMethod: SessionLoginMethod; clientType?: SessionClientType; metaData?: SessionMetaData }): Promise<Token & { user: U }> {
        const token = await Token.createUnsavedToken(user, { clientType, loginMethod, metaData });

        token.accessTokenValidUntil = new Date(Date.now() - 31 * DAY);
        token.accessTokenValidUntil.setMilliseconds(0);

        const session = await UserSession.getByID(token.sessionId);
        if (!session) {
            throw new Error('Failed to create user session');
        }
        this.applyLimits(token, session, user);
        await token.save();
        return token;
    }

    /**
     * The new token continues the session of the old one, so it keeps its start date and
     * cannot outlive it. Using the session is what postpones the inactivity limit.
     */
    static async rotateSession<U extends User>(oldToken: Token & { user: U }): Promise<Token & { user: U }> {
        const session = await UserSession.getByID(oldToken.sessionId);
        if (!session || session.userId !== oldToken.userId) {
            throw this.invalidRefreshToken();
        }

        const durations = this.getDurations(session, oldToken.user);
        if (durations.session !== null && session.startedAt.getTime() + durations.session <= Date.now()) {
            await oldToken.delete();
            throw this.invalidRefreshToken();
        }

        const token = await Token.createUnsavedToken(oldToken.user, { session });

        this.applyLimits(token, session, oldToken.user);
        await token.save();

        if (!await UserSession.setLastUsedToken(session.id, oldToken.id, token.id)) {
            await token.delete();
            throw this.invalidRefreshToken();
        }

        const metaData = this.getMetaData();
        session.appVersion = metaData.appVersion ?? session.appVersion;
        session.nativeAppVersion = metaData.nativeAppVersion ?? session.nativeAppVersion;
        session.osVersion = metaData.osVersion ?? session.osVersion;
        await session.save();
        return token;
    }

    private static invalidRefreshToken() {
        return new SimpleError({
            code: 'invalid_refresh_token',
            message: 'Invalid refresh token',
            statusCode: 400,
        });
    }

    /**
     * Only read when a session is created: it is a client provided header, and a rotation
     * has to keep the value of the login instead of trusting the header again.
     */
    private static getClientType(): SessionClientType {
        const platform = ContextInstance.optional?.request.headers['x-platform'];
        if (platform === 'ios') {
            return SessionClientType.iOS;
        }
        if (platform === 'android') {
            return SessionClientType.Android;
        }
        return SessionClientType.Browser;
    }

    /**
     * Recalculated on every rotation, so a user that becomes an administrator during a
     * session is limited from that moment on (counted from their login, as if they had the
     * permissions all along).
     */
    private static getDurations(session: UserSession, user: User): SessionDurations {
        return SESSION_DURATIONS[this.getSessionType(session, user)][session.clientType];
    }

    private static getSessionType(session: UserSession, user: User): SessionType {
        // Before the permissions: whoever signs in through the identity provider stays
        // dependent on it, member or administrator.
        if (session.loginMethod === SessionLoginMethod.SSO) {
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

    private static applyLimits(token: Token, session: UserSession, user: User) {
        const durations = this.getDurations(session, user);
        const sessionEndsAt = durations.session !== null ? (session.startedAt.getTime() + durations.session) : (Date.now() + durations.refreshToken);

        token.refreshTokenValidUntil = new Date(Math.min(Date.now() + durations.refreshToken, sessionEndsAt));
        token.refreshTokenValidUntil.setMilliseconds(0);

        token.accessTokenValidUntil = new Date(Math.min(token.accessTokenValidUntil.getTime(), sessionEndsAt));
        token.accessTokenValidUntil.setMilliseconds(0);
    }

    static getMetaData(): SessionMetaData {
        const value = ContextInstance.optional?.request.headers['x-session-metadata'];
        return this.parseMetaData(typeof value === 'string' ? value : null);
    }

    static parseMetaData(value: string | null): SessionMetaData {
        const fallback: SessionMetaData = {
            deviceType: SessionDeviceType.Desktop,
            deviceName: null,
            osName: null,
            osVersion: null,
            appVersion: null,
            nativeAppVersion: null,
            browserName: null,
        };
        if (typeof value !== 'string' || value.length > 4096) {
            return fallback;
        }

        try {
            let parsed: Partial<SessionMetaData>;
            try {
                parsed = JSON.parse(value) as Partial<SessionMetaData>;
            } catch {
                parsed = JSON.parse(decodeURIComponent(value)) as Partial<SessionMetaData>;
            }
            const string = (candidate: unknown, max: number): string | null => typeof candidate === 'string' && candidate.length > 0 ? candidate.slice(0, max) : null;
            return {
                deviceType: Object.values(SessionDeviceType).includes(parsed.deviceType as SessionDeviceType) ? parsed.deviceType as SessionDeviceType : fallback.deviceType,
                deviceName: string(parsed.deviceName, 255),
                osName: Object.values(SessionOS).includes(parsed.osName as SessionOS) ? parsed.osName as SessionOS : null,
                osVersion: string(parsed.osVersion, 64),
                appVersion: string(parsed.appVersion, 64),
                nativeAppVersion: string(parsed.nativeAppVersion, 64),
                browserName: string(parsed.browserName, 64),
            };
        } catch {
            return fallback;
        }
    }
}
