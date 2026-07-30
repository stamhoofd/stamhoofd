import { Factory } from '@simonbackx/simple-database';
import { PlatformConfig, PlatformPrivateConfig } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { Platform, ROOT_TENANT_ID } from '../models/Platform.js';
import type { RegistrationPeriod } from '../models/RegistrationPeriod.js';
import { RegistrationPeriodFactory } from './RegistrationPeriodFactory.js';

class Options {
    /**
     * Defaults to a fresh uuid, so a factory tenant is never the root tenant by accident.
     */
    id?: string;
    uri?: string;
    domain?: string;
    parentTenant?: Platform;

    /**
     * Defaults to the tenant itself: a tenant charges its own fees until it is made a child.
     */
    feesTenant?: Platform;
    period?: RegistrationPeriod;
    config?: PlatformConfig;
    privateConfig?: PlatformPrivateConfig;
    membershipOrganizationId?: string;
}

export class TenantFactory extends Factory<Options, Platform> {
    async create(): Promise<Platform> {
        const tenant = new Platform();

        tenant.id = this.options.id ?? uuidv4();

        const name = 'tenant-' + Formatter.slug(tenant.id);
        tenant.uri = this.options.uri ?? name;
        tenant.domain = this.options.domain ?? name + '.example.com';

        tenant.parentTenantId = this.options.parentTenant?.id ?? null;
        tenant.feesTenantId = this.options.feesTenant?.id ?? tenant.id;

        const period = this.options.period ?? await new RegistrationPeriodFactory({}).create();
        tenant.periodId = period.id;

        tenant.config = this.options.config ?? PlatformConfig.create({});
        tenant.privateConfig = this.options.privateConfig ?? PlatformPrivateConfig.create({});

        if (this.options.membershipOrganizationId) {
            tenant.membershipOrganizationId = this.options.membershipOrganizationId;
        }

        await tenant.save();
        return tenant;
    }

    /**
     * The tenant every deployment already has. Created by the migrations, so this only fetches it.
     */
    static async getRoot(): Promise<Platform> {
        return await Platform.getForEditing(ROOT_TENANT_ID);
    }
}
