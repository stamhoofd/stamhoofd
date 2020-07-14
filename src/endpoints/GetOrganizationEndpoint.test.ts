import { Request } from "@simonbackx/simple-endpoints";
import { KeychainedResponse,Organization } from '@stamhoofd/structures';

import { GroupFactory } from '../factories/GroupFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Token } from '../models/Token';
import { GetOrganizationEndpoint } from './GetOrganizationEndpoint';

describe("Endpoint.GetOrganization", () => {
    // Test endpoint
    const endpoint = new GetOrganizationEndpoint();

    test("Get organization as signed in user", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const groups = await new GroupFactory({ organization }).createMultiple(2)
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v3/organization", organization.getApiHost());
        r.headers.authorization = "Bearer "+token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof KeychainedResponse)) {
            throw new Error("Expected KeychainedResponse")
        }

        if (!(response.body.data instanceof Organization)) {
            throw new Error("Expected Organization")
        }

        expect(response.body.data.id).toEqual(organization.id)
        expect(response.body.data.groups.map(g => g.id).sort()).toEqual(groups.map(g => g.id).sort())
    });

});
