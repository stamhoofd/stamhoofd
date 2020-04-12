import { CreateToken } from "./CreateToken";
import { Request } from '../../routing/classes/Request';
import { User } from '../models/User';
import { TokenStruct } from '../structs/TokenStruct';

describe("Endpoint.CreateToken", () => {
    // Test endpoint
    const endpoint = new CreateToken()

    beforeAll(async () => {
        // Create user
        const t = await User.register("create-token@domain.com", "my test password")
        if (!t) {
            throw new Error("Could not register user for testing")
        }
    })


    test('Log a user in', async () => {
        const r = Request.buildJson("POST", "/oauth/token", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "password",
            username: "create-token@domain.com",
            password: "my test password",
        });

        const response = await endpoint.getResponse(r, {});
        expect(response.body).toBeInstanceOf(TokenStruct)
        expect(response.body.accessToken.length).toBeGreaterThan(40);
        expect(response.body.refreshToken.length).toBeGreaterThan(40);
        expect(response.body.accessTokenValidUntil).toBeValidDate()
    });

    test('Login with a wrong password', async () => {
        const r = Request.buildJson("POST", "/oauth/token", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "password",
            username: "create-token@domain.com",
            password: "my test passwor",
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/Invalid username or password/);;
    });

    test('Login with non existing email', async () => {
        const r = Request.buildJson("POST", "/oauth/token", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "password",
            username: "create-token95959451218181@domain.com",
            password: "my test password",
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/Invalid username or password/);
    });
});