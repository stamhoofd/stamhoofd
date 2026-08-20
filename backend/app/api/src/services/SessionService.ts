import { Database } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { Token, User, UserSession } from '@stamhoofd/models';
import type { SessionDurations, SessionType } from '@stamhoofd/models/constants/sessions.js';
import { ACCESS_TOKEN_DURATION, SESSION_DURATIONS, SSO_HANDOFF_TOKEN_DURATION } from '@stamhoofd/models/constants/sessions.js';
import { SQLWhereSign } from '@stamhoofd/sql';
import { SessionClientType, SessionDeviceType, SessionLoginMethod, SessionOS } from '@stamhoofd/structures';
import type { SessionMetaData } from '@stamhoofd/structures';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { contextStorage } from '../helpers/ContextStorage.js';

const DAY = 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 15;
const API_TOKEN_DURATION = 5 * 365 * DAY;

async function randomBytes(size: number): Promise<Buffer> {
    return await new Promise((resolve, reject) => {
        crypto.randomBytes(size, (error, buffer) => error ? reject(error) : resolve(buffer));
    });
}

export class SessionService {
    /**
     * @param authenticatedAt Pass the current date when a primary credential was verified
     * as part of this request, so the session counts as "fresh" for sensitive actions.
     */
    static async createSession<U extends User>(user: U, { loginMethod = SessionLoginMethod.Password, authenticatedAt = null }: { loginMethod?: SessionLoginMethod; authenticatedAt?: Date | null } = {}): Promise<Token & { user: U }> {
        const tokenId = uuidv4();
        const session = await this.createUserSession(user, {
            tokenId,
            clientType: this.getClientType(),
            loginMethod,
            metaData: this.getMetaData(),
        });
        const token = await this.createToken(user, { session, tokenId });
        token.authenticatedAt = authenticatedAt;
        this.applyLimits({ token, session, user });
        await token.save();
        return token;
    }

    /**
     * Used by the SSO callback: that is a browser redirect, so the only way to hand the
     * session to the client is in the URL. Only the refresh token travels along, and the
     * client exchanges it for a usable access token.
     */
    static async createSSOHandoff<U extends User>(user: U, { clientType = this.getClientType(), metaData = this.getMetaData() }: { clientType?: SessionClientType; metaData?: SessionMetaData } = {}): Promise<Token & { user: U }> {
        const tokenId = uuidv4();
        const session = await this.createUserSession(user, { tokenId, clientType, loginMethod: SessionLoginMethod.SSO, metaData });
        const token = await this.createToken(user, { session, tokenId });

        token.accessTokenValidUntil = new Date(Date.now() - 31 * DAY);
        token.accessTokenValidUntil.setMilliseconds(0);
        this.applyLimits({ token, session, user });
        token.refreshTokenValidUntil = new Date(Math.min(token.refreshTokenValidUntil.getTime(), Date.now() + SSO_HANDOFF_TOKEN_DURATION));
        token.refreshTokenValidUntil.setMilliseconds(0);
        await token.save();
        return token;
    }

    static async createApiSession<U extends User>(user: U): Promise<Token & { user: U }> {
        const tokenId = uuidv4();
        const session = await this.createUserSession(user, {
            tokenId,
            clientType: SessionClientType.Browser,
            loginMethod: SessionLoginMethod.Password,
            metaData: this.getFallbackMetaData(),
        });
        const token = await this.createToken(user, { session, tokenId });
        token.accessTokenValidUntil = new Date(Date.now() + API_TOKEN_DURATION);
        token.accessTokenValidUntil.setMilliseconds(0);
        token.refreshTokenValidUntil = new Date(token.accessTokenValidUntil);
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
            throw this.invalidRefreshTokenError();
        }

        const durations = this.getDurations(session, oldToken.user);
        if (durations.session !== null && session.startedAt.getTime() + durations.session <= Date.now()) {
            await oldToken.delete();
            throw this.invalidRefreshTokenError();
        }

        const isSSOHandoff = this.isSSOHandoff(oldToken, session);
        const token = await this.createToken(oldToken.user, { session });

        this.applyLimits({ token, session, user: oldToken.user });
        await token.save();

        const didRotate = isSSOHandoff
            ? await this.consumeSSOHandoff({ sessionId: session.id, handoffTokenId: oldToken.id, tokenId: token.id })
            : await this.replaceLastUsedToken({ sessionId: session.id, previousTokenId: oldToken.id, tokenId: token.id });
        if (!didRotate) {
            await token.delete();
            throw this.invalidRefreshTokenError();
        }

        const metaData = this.getMetaData();
        session.appVersion = metaData.appVersion ?? session.appVersion;
        session.nativeAppVersion = metaData.nativeAppVersion ?? session.nativeAppVersion;
        session.osVersion = metaData.osVersion ?? session.osVersion;
        await session.save();
        return token;
    }

    private static isSSOHandoff(token: Token, session: UserSession): boolean {
        // Handoff access tokens expire before they are created; normal access tokens do not.
        return session.loginMethod === SessionLoginMethod.SSO && token.accessTokenValidUntil < token.createdAt;
    }

    static async getByRefreshToken(refreshToken: string) {
        const token = await Token.getByRefreshToken(refreshToken);
        if (!token || token.user.isApiUser) {
            return undefined;
        }
        if (token.refreshTokenValidUntil < new Date()) {
            console.error('Detected an expired refresh token, deleting all sessions and tokens for user', token.userId);
            await UserSession.delete().where('userId', token.userId).delete();
            await Token.delete().where('userId', token.userId).delete();
            return undefined;
        }
        return token;
    }

    static async activateToken(token: Token): Promise<boolean> {
        const [result] = await Database.update(
            'UPDATE `user_sessions` SET `lastActiveTokenId` = ? WHERE `id` = ? AND `lastUsedTokenId` = ?',
            [token.id, token.sessionId, token.id],
        );
        if (result.affectedRows > 0) {
            await Database.delete('DELETE FROM `tokens` WHERE `sessionId` = ? AND `id` != ?', [token.sessionId, token.id]);
            return true;
        }

        const [sessions] = await Database.select('SELECT `id` FROM `user_sessions` WHERE `id` = ? AND `lastActiveTokenId` = ? LIMIT 1', [token.sessionId, token.id]);
        return sessions.length > 0;
    }

    static async endSession(token: Token): Promise<void> {
        await UserSession.delete().where('id', token.sessionId).delete();
    }

    static async deleteOtherSessions({ userId, keepAccessToken }: { userId: string; keepAccessToken: string | null }): Promise<number> {
        const user = await User.getByID(userId);
        if (user?.isApiUser) {
            return 0;
        }
        return await this.deleteForUsers({ userIds: [userId], keepAccessToken });
    }

    static async deleteForUsers({ userIds, keepAccessToken }: { userIds: string[]; keepAccessToken: string | null }): Promise<number> {
        if (userIds.length === 0) {
            return 0;
        }
        const query = Token.delete().where('userId', userIds);
        if (keepAccessToken) {
            query.where(Token.primary.name, SQLWhereSign.NotEqual, keepAccessToken);
        }
        const { affectedRows } = await query.delete();
        return affectedRows;
    }

    static async clearFor({ userId, keepAccessToken }: { userId: string; keepAccessToken: string }): Promise<void> {
        await Database.delete('DELETE FROM `tokens` WHERE `userId` = ? AND `accessToken` != ?', [userId, keepAccessToken]);
    }

    private static invalidRefreshTokenError() {
        return new SimpleError({
            code: 'invalid_refresh_token',
            message: 'Invalid refresh token',
            statusCode: 400,
        });
    }

    private static async createToken<U extends User>(user: U, { session, tokenId = uuidv4() }: { session: UserSession; tokenId?: string }): Promise<Token & { user: U }> {
        if (user.isSystemUser) {
            throw new SimpleError({
                code: 'internal_error',
                message: 'Cannot create token for system user',
                statusCode: 500,
            });
        }

        const token = new Token().setRelation(Token.user, user);
        token.id = tokenId;
        token.sessionId = session.id;
        token.accessTokenValidUntil = new Date(Date.now() + ACCESS_TOKEN_DURATION);
        token.accessTokenValidUntil.setMilliseconds(0);
        token.refreshTokenValidUntil = new Date(token.accessTokenValidUntil);
        token.accessToken = (await randomBytes(192)).toString('base64').toUpperCase();
        token.refreshToken = (await randomBytes(192)).toString('base64').toUpperCase();
        return token;
    }

    private static async createUserSession(user: User, { tokenId, clientType, loginMethod, metaData }: { tokenId: string; clientType: SessionClientType; loginMethod: SessionLoginMethod; metaData: SessionMetaData }): Promise<UserSession> {
        const session = new UserSession();
        session.id = uuidv4();
        session.userId = user.id;
        session.clientType = clientType;
        session.loginMethod = loginMethod;
        session.startedAt = new Date();
        session.startedAt.setMilliseconds(0);
        session.lastUsedTokenId = session.lastActiveTokenId = tokenId;
        this.applyMetaData(session, metaData);

        await Database.delete(
            'DELETE FROM `user_sessions` WHERE `id` IN (SELECT `id` FROM (SELECT `id` FROM `user_sessions` WHERE `userId` = ? ORDER BY `startedAt` DESC LIMIT ? OFFSET ?) old_sessions)',
            [user.id, MAX_SESSIONS - 1, MAX_SESSIONS - 1],
        );
        await session.save();
        return session;
    }

    private static applyMetaData(session: UserSession, metaData: SessionMetaData): void {
        session.deviceType = metaData.deviceType;
        session.deviceName = metaData.deviceName;
        session.osName = metaData.osName;
        session.osVersion = metaData.osVersion;
        session.appVersion = metaData.appVersion;
        session.nativeAppVersion = metaData.nativeAppVersion;
        session.browserName = metaData.browserName;
    }

    private static async replaceLastUsedToken({ sessionId, previousTokenId, tokenId }: { sessionId: string; previousTokenId: string; tokenId: string }): Promise<boolean> {
        const [result] = await Database.update(
            'UPDATE `user_sessions` SET `lastUsedTokenId` = ? WHERE `id` = ? AND (`lastUsedTokenId` = ? OR `lastActiveTokenId` = ?)',
            [tokenId, sessionId, previousTokenId, previousTokenId],
        );
        if (result.affectedRows === 0) {
            return false;
        }
        await Database.delete('DELETE FROM `tokens` WHERE `sessionId` = ? AND `id` != ? AND `id` != (SELECT `lastActiveTokenId` FROM `user_sessions` WHERE `id` = ?)', [sessionId, tokenId, sessionId]);
        return true;
    }

    private static async consumeSSOHandoff({ sessionId, handoffTokenId, tokenId }: { sessionId: string; handoffTokenId: string; tokenId: string }): Promise<boolean> {
        const [result] = await Database.update(
            'UPDATE `user_sessions` SET `lastUsedTokenId` = ? WHERE `id` = ? AND `lastUsedTokenId` = ?',
            [tokenId, sessionId, handoffTokenId],
        );
        if (result.affectedRows === 0) {
            return false;
        }
        await Database.delete('DELETE FROM `tokens` WHERE `sessionId` = ? AND `id` != ?', [sessionId, tokenId]);
        return true;
    }

    /**
     * Only read when a session is created: it is a client provided header, and a rotation
     * has to keep the value of the login instead of trusting the header again.
     */
    private static getClientType(): SessionClientType {
        const platform = contextStorage.getStore()?.request.headers['x-platform'];
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

    private static applyLimits({ token, session, user }: { token: Token; session: UserSession; user: User }) {
        const durations = this.getDurations(session, user);
        const sessionEndsAt = durations.session !== null ? (session.startedAt.getTime() + durations.session) : (Date.now() + durations.refreshToken);

        token.refreshTokenValidUntil = new Date(Math.min(Date.now() + durations.refreshToken, sessionEndsAt));
        token.refreshTokenValidUntil.setMilliseconds(0);

        token.accessTokenValidUntil = new Date(Math.min(token.accessTokenValidUntil.getTime(), sessionEndsAt));
        token.accessTokenValidUntil.setMilliseconds(0);
    }

    static getMetaData(): SessionMetaData {
        const value = contextStorage.getStore()?.request.headers['x-session-metadata'];
        return this.parseMetaData(typeof value === 'string' ? value : null);
    }

    static parseMetaData(value: string | null): SessionMetaData {
        const fallback = this.getFallbackMetaData();
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

    private static getFallbackMetaData(): SessionMetaData {
        return {
            deviceType: SessionDeviceType.Desktop,
            deviceName: null,
            osName: null,
            osVersion: null,
            appVersion: null,
            nativeAppVersion: null,
            browserName: null,
        };
    }
}
