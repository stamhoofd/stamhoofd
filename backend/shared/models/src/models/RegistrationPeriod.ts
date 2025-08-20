import { column } from '@simonbackx/simple-database';
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
    previousPeriodId: string | null = null;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    @column({ type: 'datetime' })
    startDate: Date;

    @column({ type: 'datetime' })
    endDate: Date;

    @column({ type: 'json', decoder: RegistrationPeriodSettings })
    settings: RegistrationPeriodSettings;

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

    // todo: migrate-platform-period-id
    static async getByDate(date: Date): Promise<RegistrationPeriod | null> {
        const result = await SQL.select().from(SQL.table(this.table))
            .where(SQL.column('startDate'), SQLWhereSign.LessEqual, date)
            .where(SQL.column('endDate'), SQLWhereSign.GreaterEqual, date)
            .first(false);

        if (result === null || !result[this.table]) {
            return null;
        }

        return RegistrationPeriod.fromRow(result[this.table]) ?? null;
    }

    async setPreviousPeriodId() {
        const allPeriods = await RegistrationPeriod.where({ organizationId: this.organizationId });

        // Include self if not yet in database
        if (!this.existsInDatabase) {
            allPeriods.push(this);
        }

        // Sort by start date
        allPeriods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        // Take the one before this.periodId
        let previousPeriod: RegistrationPeriod | null = null;

        for (const period of allPeriods) {
            if (period.id === this.id) {
                break;
            }
            previousPeriod = period;
        }

        this.previousPeriodId = previousPeriod?.id ?? null;
    }
}
