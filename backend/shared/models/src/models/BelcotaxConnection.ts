import { column } from '@node/database';
import { QueryableModel } from '@stamhoofd/sql';
import { BelcotaxConnection as BelcotaxConnectionStruct } from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Consent of a company (KBO number) to let us call the Belcotax API on its behalf.
 * Tokens are stored unencrypted, like the credentials of the other integrations.
 */
export class BelcotaxConnection extends QueryableModel {
    static table = 'belcotax_connections';

    @column({
        primary: true,
        type: 'string',
        beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    organizationId: string;

    /**
     * 10 digits, without separators
     */
    @column({ type: 'string' })
    companyNumber: string;

    /**
     * Single use: every refresh returns a new one. Null once FOD refused it, so a legal
     * representative has to log in again.
     */
    @column({ type: 'string', nullable: true })
    refreshToken: string | null = null;

    @column({ type: 'datetime' })
    validUntil: Date;

    @column({ type: 'string' })
    representativeName = '';

    /**
     * The user who started the connection in Stamhoofd
     */
    @column({ type: 'string', nullable: true })
    userId: string | null = null;

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

    @column({
        type: 'datetime',
        beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    get isValid() {
        return this.refreshToken !== null && this.validUntil > new Date();
    }

    static async getFor(organizationId: string, companyNumber: string) {
        return await BelcotaxConnection.select()
            .where('organizationId', organizationId)
            .andWhere('companyNumber', companyNumber)
            .first(false);
    }

    getStructure() {
        return BelcotaxConnectionStruct.create({
            id: this.id,
            companyNumber: this.companyNumber,
            representativeName: this.representativeName,
            // A refused refresh token ends the connection right away
            validUntil: this.refreshToken ? this.validUntil : this.updatedAt,
            createdAt: this.createdAt,
        });
    }
}
