import { column } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { QueryableModel, SQL, SQLWhereSign } from '@stamhoofd/sql';
import { RegistrationPeriodBase, RegistrationPeriodSettings, RegistrationPeriod as RegistrationPeriodStruct } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

export class RegistrationPeriod extends QueryableModel {
    static table = 'registration_periods';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string', nullable: true })
    customName: string | null = null;

    @column({ type: 'string', nullable: true })
    previousPeriodId: string | null = null;

    @column({ type: 'string', nullable: true })
    nextPeriodId: string | null = null;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    @column({ type: 'datetime' })
    startDate: Date;

    @column({ type: 'datetime' })
    endDate: Date;

    @column({ type: 'json', decoder: RegistrationPeriodSettings })
    settings = RegistrationPeriodSettings.create({});

    @column({ type: 'boolean' })
    locked = false;

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

    getBaseStructure() {
        return RegistrationPeriodBase.create(this);
    }

    getStructure() {
        return RegistrationPeriodStruct.create(this);
    }

    configureForNewOrganization() {
        this.settings = RegistrationPeriodSettings.create({});
        this.startDate = new Date();
        this.endDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 31); // 1 month
    }

    static async getByDate(date: Date, organizationId: string | null): Promise<RegistrationPeriod | null> {
        if (STAMHOOFD.userMode === 'organization' && organizationId === null) {
            throw new SimpleError({
                code: 'invalid_argument',
                message: 'Organization id is required when user mode is organization',
                statusCode: 400,
            });
        }

        const query = SQL.select().from(SQL.table(this.table))
            .where(SQL.column('startDate'), SQLWhereSign.LessEqual, date)
            .where(SQL.column('endDate'), SQLWhereSign.GreaterEqual, date);

        if (organizationId && STAMHOOFD.userMode === 'organization') {
            query.where(SQL.column('organizationId'), organizationId);
        }

        const result = await query.first(false);

        if (result === null || !result[this.table]) {
            return null;
        }

        return RegistrationPeriod.fromRow(result[this.table]) ?? null;
    }

    async updatePreviousNextPeriods() {
        return await RegistrationPeriod.updatePreviousNextPeriods(this.organizationId, this);
    }

    static async updatePreviousNextPeriods(organizationId: string | null, existingReference?: RegistrationPeriod) {
        const allPeriods = await RegistrationPeriod.select().where('organizationId', organizationId).fetch();

        // Include self if not yet in database
        if (existingReference) {
            if (!existingReference.existsInDatabase) {
                allPeriods.push(existingReference);
            }
            else {
            // Replace self with this
                const index = allPeriods.findIndex(p => p.id === existingReference.id);
                if (index !== -1) {
                    allPeriods[index] = existingReference;
                }
            }
        }

        // Sort by start date
        allPeriods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        // Take the one before this.periodId
        let previousPeriod: RegistrationPeriod | null = null;

        for (const period of allPeriods) {
            period.previousPeriodId = previousPeriod?.id ?? null;
            period.nextPeriodId = null;

            if (previousPeriod) {
                previousPeriod.nextPeriodId = period.id;
            }
            previousPeriod = period;
        }

        // Save all
        for (const period of allPeriods) {
            await period.save();
        }
    }
}
