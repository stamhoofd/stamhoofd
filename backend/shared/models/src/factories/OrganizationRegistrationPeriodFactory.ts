import { Factory } from '@simonbackx/simple-database';

import { OrganizationRegistrationPeriod } from '../models';
import { Organization } from '../models/Organization';
import { RegistrationPeriod } from '../models/RegistrationPeriod';

class Options {
    organization: Organization;
    period: RegistrationPeriod;
}

export class OrganizationRegistrationPeriodFactory extends Factory<Options, OrganizationRegistrationPeriod> {
    async create(): Promise<OrganizationRegistrationPeriod> {
        const organizationRegistrationPeriod = new OrganizationRegistrationPeriod();

        organizationRegistrationPeriod.organizationId = this.options.organization.id;
        // todo: migrate-platform-period-id
        organizationRegistrationPeriod.periodId = this.options.period.id;

        await organizationRegistrationPeriod.save();
        return organizationRegistrationPeriod;
    }
}
