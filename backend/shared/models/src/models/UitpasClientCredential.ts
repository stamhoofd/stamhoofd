import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

export class UitpasClientCredential extends QueryableModel {
    static table = 'uitpas_client_credentials';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    clientId: string;

    @column({ type: 'string' })
    clientSecret: string;

    /**
     * The organizationId is the ID of the organization that this token belongs to.
     * If it is null, it means that this token is for the platform.
     */
    @column({ type: 'string', nullable: true })
    organizationId: string | null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
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
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    async save() {
        if (this.organizationId === null) {
            throw new Error('Not allowed to save uitpas client credentials for platform (organizationId = null)');
        }
        return await super.save();
    }
}
