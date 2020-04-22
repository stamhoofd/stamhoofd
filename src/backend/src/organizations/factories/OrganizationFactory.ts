import { Organization } from "../models/Organization";
import { Factory } from "@stamhoofd/backend/src/database/classes/Factory";
import { Formatter } from "@stamhoofd-common/formatting"; 
import { OrganizationMetaStruct, OrganizationType } from "../structs/OrganizationMetaStruct";
import { Sodium } from "@stamhoofd-common/crypto";

class Options {}

export class OrganizationFactory extends Factory<Options, Organization> {
    async create(): Promise<Organization> {
        const organizationKeyPair = await Sodium.signKeyPair();

        const organization = new Organization();
        organization.name = "Organization " + (new Date().getTime() + Math.floor(Math.random() * 999));
        organization.website = "https://domain.com";
        organization.registerDomain = null;
        organization.uri = Formatter.slug(organization.name);
        organization.meta = new OrganizationMetaStruct();
        organization.meta.type = this.randomEnum(OrganizationType);
        organization.meta.umbrellaOrganization = undefined;
        organization.publicKey = organizationKeyPair.publicKey;

        await organization.save();
        return organization;
    }
}
