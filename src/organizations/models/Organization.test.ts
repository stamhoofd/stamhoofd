import { Organization } from "./Organization";
import { Database } from "../../database/classes/Database";

describe("Model.Organization", () => {
    let existingOrganizationId: number;

    beforeAll(async () => {
        const [data] = await Database.insert("INSERT INTO " + Organization.table + " SET ?", [
            {
                name: "Model Organization test",
                website: "https://www.domain.com",
                addressId: null,
                meta: "{}",
                createdOn: "2020-03-29 14:30:15"
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

});
