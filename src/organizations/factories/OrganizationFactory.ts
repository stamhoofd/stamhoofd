import { Organization } from '../models/Organization';
import { Factory } from '@/database/classes/Factory';
import { Formatter } from '@/tools/classes/Formatter';
import { OrganizationMetaStruct, OrganizationType } from '../structs/OrganizationMetaStruct';

class Options {

}

export class OrganizationFactory extends Factory<Options, Organization> {
    async create(): Promise<Organization> {
        const organization = new Organization()
        organization.name = "Organization " + (new Date().getTime() + Math.floor(Math.random() * 999));
        organization.website = "https://domain.com"
        organization.registerDomain = null;
        organization.uri = Formatter.slug(organization.name);
        organization.meta = new OrganizationMetaStruct()
        organization.meta.type = this.randomEnum(OrganizationType)
        organization.meta.umbrellaOrganization = undefined

        await organization.save()
        return organization
    }
}