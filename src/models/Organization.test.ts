import { Database } from "@simonbackx/simple-database";
import { Sodium } from "@stamhoofd/crypto";
import { OrganizationMetaData,OrganizationType, UmbrellaOrganization } from "@stamhoofd/structures";

import { OrganizationFactory } from '../factories/OrganizationFactory';
import { Organization } from "./Organization";

describe("Model.Organization", () => {
    let existingOrganizationId: string;

    beforeAll(async () => {
        const organizationKeyPair = await Sodium.generateEncryptionKeyPair();

        const organization = await new OrganizationFactory({
            publicKey: organizationKeyPair.publicKey,
            uri: "model-organization-test",
            meta: OrganizationMetaData.create({
                type: OrganizationType.Other,
                umbrellaOrganization: null
            })
        }).create();

        existingOrganizationId = organization.id;
    });

    test("Get organization by id", async () => {
        const organization = await Organization.getByID(existingOrganizationId);
        expect(organization).toBeDefined();
        if (!organization) return;
        expect(organization).toBeInstanceOf(Organization);
        expect(organization.id).toEqual(existingOrganizationId);
        expect(organization.meta.type).toEqual("Other");
    });

    test("Save organization meta data", async () => {
        const organization = await Organization.getByID(existingOrganizationId);
        expect(organization).toBeDefined();
        if (!organization) return;
        organization.meta.type = OrganizationType.Youth;
        organization.meta.umbrellaOrganization = UmbrellaOrganization.ChiroNationaal;
        await organization.save();

        const clean = await Organization.getByID(existingOrganizationId);
        expect(clean).toBeDefined();
        if (!clean) return;
        expect(clean).toBeInstanceOf(Organization);
        expect(clean.id).toEqual(organization.id);
        expect(clean.meta.type).toEqual(OrganizationType.Youth);
        expect(clean.meta.umbrellaOrganization).toEqual(UmbrellaOrganization.ChiroNationaal);
    });
});
