import { Factory } from '@simonbackx/simple-database';

import { STPackage } from '../models/index.js';
import { Organization } from '../models/Organization.js';
import { STPackageBundle, STPackageBundleHelper } from '@stamhoofd/structures';

class Options {
    organization: Organization;
    bundle?: STPackageBundle;
    removeAt?: Date | null;
    validAt?: Date | null;
}

export class STPackageFactory extends Factory<Options, STPackage> {
    async create(): Promise<STPackage> {
        const pack = new STPackage();
        pack.organizationId = this.options.organization.id;

        const m = STPackageBundleHelper.getCurrentPackage(this.options.bundle ?? STPackageBundle.Webshops, new Date());

        pack.meta = m.meta;
        pack.validUntil = m.validUntil;
        pack.removeAt = m.removeAt;

        if (this.options.removeAt) {
            pack.validAt = new Date(this.options.removeAt.getTime() - 365 * 1000 * 60 * 60 * 24);
        }
        else {
            pack.validAt = this.options.validAt !== undefined ? this.options.validAt : new Date();
        }

        if (this.options.removeAt !== undefined) {
            pack.removeAt = this.options.removeAt;
        }

        if (this.options.validAt !== undefined) {
            pack.validAt = this.options.validAt;
        }

        await pack.save();
        return pack;
    }
}
