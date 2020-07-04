import { Factory } from "@simonbackx/simple-database";
import { Sodium } from "@stamhoofd/crypto";
import { OrganizationMetaData, OrganizationType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility"; 

import { Organization } from "../models/Organization";

class Options {}

export class OrganizationFactory extends Factory<Options, Organization> {
    async create(): Promise<Organization> {
        const organizationKeyPair = await Sodium.signKeyPair();

        const organization = new Organization();
        organization.name = "Organization " + (new Date().getTime() + Math.floor(Math.random() * 999));
        organization.website = "https://domain.com";
        organization.registerDomain = null;
        organization.uri = Formatter.slug(organization.name);
        organization.meta = OrganizationMetaData.create({
            type: this.randomEnum(OrganizationType),
            umbrellaOrganization: null
        });
        organization.publicKey = organizationKeyPair.publicKey;

        await organization.save();
        return organization;
    }
}
