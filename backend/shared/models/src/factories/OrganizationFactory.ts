import { Factory } from "@simonbackx/simple-database";
import { Address,Country,OrganizationMetaData, OrganizationType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility"; 

import { Organization } from "../models/Organization";

class Options {
    publicKey?: string;
    uri?: string;
    domain?: string;
    meta?: OrganizationMetaData;
    name?: string;
    city?: string
}

export class OrganizationFactory extends Factory<Options, Organization> {
    async create(): Promise<Organization> {
        const organization = new Organization();
        organization.name = this.options.name ?? "Organization " + (new Date().getTime() + Math.floor(Math.random() * 999999));
        organization.website = "https://domain.com";
        organization.registerDomain = this.options.domain ?? null;
        organization.uri = this.options.uri ?? Formatter.slug(organization.name);
        organization.meta = this.options.meta ?? OrganizationMetaData.create({
            type: this.randomEnum(OrganizationType),
            umbrellaOrganization: null,
            defaultEndDate: new Date(),
            defaultStartDate: new Date(),
            defaultPrices: []
        });
        organization.address = Address.create({
            street: "Demostraat",
            number: "12",
            city: this.options.city ?? "Gent",
            postalCode: "9000",
            country: Country.Belgium
        })

        await organization.save();
        return organization;
    }
}
