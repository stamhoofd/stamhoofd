import { Factory } from "@simonbackx/simple-database";
import { KeyConstantsHelper, SensitivityLevel,Sodium } from '@stamhoofd/crypto';
import { GroupPrices,GroupSettings } from "@stamhoofd/structures";

import { Group } from "../models/Group";
import { Organization } from "../models/Organization";
import { OrganizationFactory } from './OrganizationFactory';

class Options {
    organization?: Organization;
}

export class GroupFactory extends Factory<Options, Group> {
    async create(): Promise<Group> {
        const organization = this.options.organization ?? await new OrganizationFactory({}).create()
        
        const group = new Group()
        group.organizationId = organization.id
        group.settings = GroupSettings.create({
            name: "Group name",
            startDate: new Date(),
            endDate: new Date(),
            prices: [
                GroupPrices.create({
                    price: 400
                })
            ],
        })

        await group.save()
        return group;
    }
}
