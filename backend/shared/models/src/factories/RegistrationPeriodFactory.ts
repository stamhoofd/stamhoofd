import { Factory } from '@simonbackx/simple-database';
import { RegistrationPeriodSettings } from '@stamhoofd/structures';

import { RegistrationPeriod } from '../models';

class Options {
    startDate?: Date;
    endDate?: Date;
    previousPeriodId?: string;
    locked?: boolean;
}

export class RegistrationPeriodFactory extends Factory<Options, RegistrationPeriod> {
    async create(): Promise<RegistrationPeriod> {
        const period = new RegistrationPeriod();

        period.organizationId = null;
        period.startDate = this.options.startDate ?? new Date(2024, 0, 1, 0, 0, 0, 0);
        period.endDate = this.options.endDate ?? new Date(2024, 11, 31, 59, 59, 59, 999);
        if (this.options.previousPeriodId) {
            period.previousPeriodId = this.options.previousPeriodId;
        }
        period.settings = RegistrationPeriodSettings.create({});
        period.locked = this.options.locked ?? false;

        await period.save();
        return period;
    }
}
