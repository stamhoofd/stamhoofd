import { Factory } from "@simonbackx/simple-database";
import { Sodium } from "@stamhoofd/crypto";
import { OrganizationMetaData, OrganizationType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility"; 

import { Organization } from "../models/Organization";

class Options {
    publicKey?: string;
    uri?: string;
    meta?: OrganizationMetaData
}

export class OrganizationFactory extends Factory<Options, Organization> {
    async create(): Promise<Organization> {

        const organization = new Organization();
        organization.name = "Organization " + (new Date().getTime() + Math.floor(Math.random() * 999));
        organization.website = "https://domain.com";
        organization.registerDomain = null;
        organization.uri = this.options.uri ?? Formatter.slug(organization.name);
        organization.meta = this.options.meta ?? OrganizationMetaData.create({
            type: this.randomEnum(OrganizationType),
            umbrellaOrganization: null
        });

        if (this.options.publicKey) {
            organization.publicKey = this.options.publicKey;
        } else {
            const organizationKeyPair = await Sodium.generateEncryptionKeyPair();
            organization.publicKey = organizationKeyPair.publicKey;
        }

        await organization.save();
        return organization;
    }
}
