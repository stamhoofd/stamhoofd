import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { SessionClientType, SessionDeviceType, SessionLoginMethod, SessionOS } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

export class UserSession extends QueryableModel {
    static table = 'user_sessions';

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
}
