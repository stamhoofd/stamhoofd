import { Database } from "@/database/classes/Database";
import { Organization } from "./Organization";
import { OrganizationType, UmbrellaOrganization } from '../structs/OrganizationMetaStruct';

describe("Model.Organization", () => {
    let existingOrganizationId: number;

    beforeAll(async () => {
        const [data] = await Database.insert("INSERT INTO " + Organization.table + " SET ?", [
            {
                name: "Model Organization test",
                website: "https://www.domain.com",
                addressId: null,
                meta: "{}",
                createdOn: "2020-03-29 14:30:15",
                uri: "model-organization-test",
            }
        ]);
        existingOrganizationId = data.insertId;
    });

    test("Get organization by id", async () => {
        const organization = await Organization.getByID(existingOrganizationId);
        expect(organization).toBeDefined();
        if (!organization) return
        expect(organization).toBeInstanceOf(Organization);
        expect(organization.id).toBeGreaterThanOrEqual(1);
        expect(organization.meta.type).toEqual("other")
    });

    test("Save organization meta data", async () => {
        const organization = await Organization.getByID(existingOrganizationId);
        expect(organization).toBeDefined();
        if (!organization) return
        organization.meta.type = OrganizationType.Youth;
        organization.meta.umbrellaOrganization = UmbrellaOrganization.ChiroNationaal;
        await organization.save();

        const clean = await Organization.getByID(existingOrganizationId);
        expect(clean).toBeDefined();
        if (!clean) return
        expect(clean).toBeInstanceOf(Organization);
        expect(clean.id).toEqual(organization.id);
        expect(clean.meta.type).toEqual(OrganizationType.Youth)
        expect(clean.meta.umbrellaOrganization).toEqual(UmbrellaOrganization.ChiroNationaal)

    });

});
