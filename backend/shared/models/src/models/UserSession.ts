import { column, Database } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { SessionClientType, SessionDeviceType, type SessionMetaData, SessionLoginMethod, SessionOS } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import type { Token } from './Token.js';
import type { User } from './User.js';

export class UserSession extends QueryableModel {
    static table = 'user_sessions';
    static MAX_SESSIONS = 15;

    @column({ primary: true, type: 'string', beforeSave: value => value ?? uuidv4() })
    id: string;

    @column({ type: 'string' })
    userId: string;

    @column({ type: 'string' })
    clientType = SessionClientType.Browser;

    @column({ type: 'datetime' })
    startedAt: Date;

    @column({ type: 'string' })
    loginMethod = SessionLoginMethod.Password;

    @column({ type: 'string' })
    deviceType = SessionDeviceType.Desktop;

    @column({ type: 'string', nullable: true })
    deviceName: string | null = null;

    @column({ type: 'string', nullable: true })
    osName: SessionOS | null = null;

    @column({ type: 'string', nullable: true })
    osVersion: string | null = null;

    @column({ type: 'string', nullable: true })
    appVersion: string | null = null;

    @column({ type: 'string', nullable: true })
    nativeAppVersion: string | null = null;

    @column({ type: 'string', nullable: true })
    browserName: string | null = null;

    @column({ type: 'string' })
    lastUsedTokenId: string;

    @column({ type: 'string' })
    lastActiveTokenId: string;

    static async createForToken(user: User, tokenId: string, clientType: SessionClientType, loginMethod: SessionLoginMethod, metaData: SessionMetaData): Promise<UserSession> {
        const session = new UserSession();
        session.id = uuidv4();
        session.userId = user.id;
        session.clientType = clientType;
        session.loginMethod = loginMethod;
        session.startedAt = new Date();
        session.startedAt.setMilliseconds(0);
        session.lastUsedTokenId = tokenId;
        session.lastActiveTokenId = tokenId;
        session.updateMetaData(metaData);

        await Database.delete(
            'DELETE FROM `user_sessions` WHERE `id` IN (SELECT `id` FROM (SELECT `id` FROM `user_sessions` WHERE `userId` = ? ORDER BY `startedAt` DESC LIMIT ? OFFSET ?) old_sessions)',
            [user.id, this.MAX_SESSIONS - 1, this.MAX_SESSIONS - 1],
        );
        await session.save();
        return session;
    }

    updateMetaData(metaData: SessionMetaData) {
        this.deviceType = metaData.deviceType;
        this.deviceName = metaData.deviceName;
        this.osName = metaData.osName;
        this.osVersion = metaData.osVersion;
        this.appVersion = metaData.appVersion;
        this.nativeAppVersion = metaData.nativeAppVersion;
        this.browserName = metaData.browserName;
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

    static async setLastUsedToken(sessionId: string, previousTokenId: string, tokenId: string): Promise<boolean> {
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
}
