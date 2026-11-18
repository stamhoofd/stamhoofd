import { column } from '@node/database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

export enum BelcotaxApiLogAction {
    /**
     * We sent a legal representative to the login of FOD Financiën
     */
    Authorize = 'Authorize',
    /**
     * The representative came back, with an authorization code or an error
     */
    Callback = 'Callback',
    TokenExchange = 'TokenExchange',
    TokenRefresh = 'TokenRefresh',
    ApiCall = 'ApiCall',
}

/**
 * Every authentication and call to FOD Financiën, kept for 12 months as the user agreement
 * with FOD requires. Deliberately without foreign keys: the log has to outlive a deleted
 * connection or organization. Never contains tokens.
 */
export class BelcotaxApiLog extends QueryableModel {
    static table = 'belcotax_api_logs';

    @column({
        primary: true,
        type: 'string',
        beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    @column({ type: 'string', nullable: true })
    connectionId: string | null = null;

    @column({ type: 'string', nullable: true })
    companyNumber: string | null = null;

    @column({ type: 'string', nullable: true })
    userId: string | null = null;

    @column({ type: 'string' })
    action: BelcotaxApiLogAction;

    @column({ type: 'string' })
    method = 'GET';

    /**
     * Without query string
     */
    @column({ type: 'string' })
    url = '';

    @column({ type: 'integer', nullable: true })
    statusCode: number | null = null;

    @column({ type: 'boolean' })
    success = false;

    /**
     * Error code and description returned by FOD, or our own reason to refuse the response
     */
    @column({ type: 'string', nullable: true })
    error: string | null = null;

    /**
     * Legal representative named in the ID token
     */
    @column({ type: 'string', nullable: true })
    representativeName: string | null = null;

    @column({ type: 'integer', nullable: true })
    durationMs: number | null = null;

    @column({
        type: 'datetime',
        beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;
}
