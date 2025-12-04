import { Factory } from '@simonbackx/simple-database';
import { RegistrationPeriodSettings } from '@stamhoofd/structures';

import { Organization, RegistrationPeriod } from '../models/index.js';

class Options {
    startDate?: Date;
    endDate?: Date;
    previousPeriodId?: string;
    nextPeriodId?: string;
    locked?: boolean;
    organization?: Organization;
}

export class RegistrationPeriodFactory extends Factory<Options, RegistrationPeriod> {
    async create(): Promise<RegistrationPeriod> {
        const period = new RegistrationPeriod();

        period.organizationId = this.options.organization ? this.options.organization.id : null;
        period.startDate = this.options.startDate ?? new Date(2024, 0, 1, 0, 0, 0, 0);
        period.endDate = this.options.endDate ?? new Date(2024, 11, 31, 59, 59, 59, 999);
        if (this.options.previousPeriodId) {
            period.previousPeriodId = this.options.previousPeriodId;
        }
        if (this.options.nextPeriodId) {
            period.nextPeriodId = this.options.nextPeriodId;
        }
        period.settings = RegistrationPeriodSettings.create({});
        period.locked = this.options.locked ?? false;

        await period.save();
        return period;
    }
}
