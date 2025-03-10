import { Factory } from '@simonbackx/simple-database';
import { Address, Country, OrganizationMetaData, OrganizationType, PermissionRoleDetailed } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { Organization } from '../models/Organization';
import { RegistrationPeriod } from '../models/RegistrationPeriod';
import { RegistrationPeriodFactory } from './RegistrationPeriodFactory';

class Options {
    uri?: string;
    domain?: string;
    meta?: OrganizationMetaData;
    name?: string;
    city?: string;
    roles?: PermissionRoleDetailed[];
    period?: RegistrationPeriod;
    tags?: string[];
}

export class OrganizationFactory extends Factory<Options, Organization> {
    async create(): Promise<Organization> {
        const organization = new Organization();
        organization.name = this.options.name ?? 'Organization ' + (new Date().getTime() + Math.floor(Math.random() * 999999));
        organization.website = 'https://domain.com';
        organization.registerDomain = this.options.domain ?? null;
        organization.uri = this.options.uri ?? Formatter.slug(organization.name);
        organization.meta = this.options.meta ?? OrganizationMetaData.create({
            type: this.randomEnum(OrganizationType),
            umbrellaOrganization: null,
            defaultEndDate: new Date(),
            defaultStartDate: new Date(),
            defaultPrices: [],
        });
        organization.address = Address.create({
            street: 'Demostraat',
            number: '12',
            city: this.options.city ?? 'Gent',
            postalCode: '9000',
            country: Country.Belgium,
        });

        const period = this.options.period ?? await new RegistrationPeriodFactory({}).create();
        organization.periodId = period.id;

        if (this.options.roles) {
            organization.privateMeta.roles = this.options.roles;
        }

        if (this.options.tags) {
            organization.meta.tags = this.options.tags;
        }

        await organization.save();
        return organization;
    }
}
