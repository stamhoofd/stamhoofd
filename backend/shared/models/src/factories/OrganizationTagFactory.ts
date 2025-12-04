import { Factory } from '@simonbackx/simple-database';
import { OrganizationTag } from '@stamhoofd/structures';

import { Platform } from '../models/Platform.js';

class Options {
    name?: string;
}

export class OrganizationTagFactory extends Factory<Options, OrganizationTag> {
    async create(): Promise<OrganizationTag> {
        const tag = OrganizationTag.create({
            name: 'tag ' + (new Date().getTime() + Math.floor(Math.random() * 999999)),
        });

        // Add to platform
        const platform = await Platform.getForEditing();
        platform.config.tags.push(tag);
        await platform.save();

        return tag;
    }
}
