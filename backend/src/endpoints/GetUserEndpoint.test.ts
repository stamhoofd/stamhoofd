import { Request } from "@simonbackx/simple-endpoints";
import { KeyConstantsHelper,Sodium } from "@stamhoofd/crypto";
import { ChallengeResponseStruct, NewUser,Token as TokenStruct } from '@stamhoofd/structures';

import { OrganizationFactory } from '../factories/OrganizationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Challenge } from '../models/Challenge';
import { Token } from '../models/Token';
import { User } from '../models/User';
import { GetUserEndpoint } from './GetUserEndpoint';


describe("Endpoint.GetUser", () => {
    // Test endpoint
    const endpoint = new GetUserEndpoint();

    test("Request user details when signed in", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v1/user", organization.getApiHost());
        r.headers.authorization = "Bearer "+token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof NewUser)) {
            throw new Error("Expected NewUser")
        }   

        expect(response.body.id).toEqual(user.id)
    });

    test("Request user details when not signed in is not working", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v1/user", organization.getApiHost());

        await expect(endpoint.test(r)).rejects.toThrow(/missing/i)
    });

    test("Request user details with invalid token is not working", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v1/user", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken+"d"

        await expect(endpoint.test(r)).rejects.toThrow(/invalid/i)
    });

    test("Request user details with expired token is not working", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const token = await Token.createExpiredToken(user)

        const r = Request.buildJson("GET", "/v1/user", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(endpoint.test(r)).rejects.toThrow(/expired/i)
    });

    
});
