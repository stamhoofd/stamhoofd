import { Factory } from '@simonbackx/simple-database';

import { OrganizationRegistrationPeriod } from '../models/index.js';
import { Organization } from '../models/Organization.js';
import { RegistrationPeriod } from '../models/RegistrationPeriod.js';

class Options {
    organization: Organization;
    period: RegistrationPeriod;
}

export class OrganizationRegistrationPeriodFactory extends Factory<Options, OrganizationRegistrationPeriod> {
    async create(): Promise<OrganizationRegistrationPeriod> {
        const organizationRegistrationPeriod = new OrganizationRegistrationPeriod();

        organizationRegistrationPeriod.organizationId = this.options.organization.id;
        organizationRegistrationPeriod.periodId = this.options.period.id;

        await organizationRegistrationPeriod.save();
        return organizationRegistrationPeriod;
    }
}
