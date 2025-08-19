import { Factory } from '@simonbackx/simple-database';

import { SimpleError } from '@simonbackx/simple-errors';
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

        if (STAMHOOFD.userMode === 'organization' && this.options.period.organizationId !== this.options.organization.id) {
            throw new SimpleError({
                code: 'invalid_period',
                message: 'Period has different organization id then the organization',
                statusCode: 400,
            });
        }

        organizationRegistrationPeriod.periodId = this.options.period.id;

        await organizationRegistrationPeriod.save();
        return organizationRegistrationPeriod;
    }
}
