import { Factory } from '@simonbackx/simple-database';
import { MemberResponsibility } from '@stamhoofd/structures';

import { Platform } from '../models/Platform.js';

class Options {
    name?: string;
    organizationBased?: boolean;
}

export class PlatformResponsibilityFactory extends Factory<Options, MemberResponsibility> {
    async create(): Promise<MemberResponsibility> {
        const responsibility = MemberResponsibility.create({
            name: this.options.name ?? ('Responsibility ' + (new Date().getTime() + Math.floor(Math.random() * 999999))),
            organizationBased: this.options.organizationBased ?? true,
        });

        // Add to platform
        const platform = await Platform.getForEditing();
        platform.config.responsibilities.push(responsibility);
        await platform.save();

        return responsibility;
    }
}
