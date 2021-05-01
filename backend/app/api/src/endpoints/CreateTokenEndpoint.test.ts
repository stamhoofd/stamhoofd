import { Request } from "@simonbackx/simple-endpoints";
import { KeyConstantsHelper,Sodium } from "@stamhoofd/crypto";
import { ChallengeResponseStruct, Token as TokenStruct } from '@stamhoofd/structures';
import MockDate from "mockdate";

import { OrganizationFactory } from '@stamhoofd/models';
import { UserFactory } from '@stamhoofd/models';
import { Challenge } from '@stamhoofd/models';
import { User } from '@stamhoofd/models';
import { CreateTokenEndpoint } from './CreateTokenEndpoint';

describe("Endpoint.CreateToken", () => {
    // Test endpoint
    const endpoint = new CreateTokenEndpoint();

    test("Request a challenge for a non existing user", async () => {
        const organization = await new OrganizationFactory({}).create()

        const r = Request.buildJson("POST", "/v1/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "request_challenge",
            email: "nonexistinguser123@domaintest.be"
        });

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof ChallengeResponseStruct)) {
            throw new Error("Expected ChallengeResponseStruct")
        }   

        const response2 = await endpoint.test(r);
        expect(response2.body).toBeDefined();

        if (!(response2.body instanceof ChallengeResponseStruct)) {
            throw new Error("Expected ChallengeResponseStruct")
        }   

        expect(response.body.keyConstants).toEqual(response2.body.keyConstants)
        expect(response.body.challenge).not.toEqual(response2.body.challenge)
    });

    test("Request a challenge for an existing user", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()

        const r = Request.buildJson("POST", "/v1/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "request_challenge",
            email: user.email
        });

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof ChallengeResponseStruct)) {
            throw new Error("Expected ChallengeResponseStruct")
        }

        const response2 = await endpoint.test(r);
        expect(response2.body).toBeDefined();

        if (!(response2.body instanceof ChallengeResponseStruct)) {
            throw new Error("Expected ChallengeResponseStruct")
        }

        const u = await User.getForAuthentication(organization.id, user.email)
        if (!u) {
            throw new Error("Unexpected check")
        }

        expect(response.body.keyConstants).toEqual(response2.body.keyConstants)
        expect(response.body.keyConstants).toEqual(u.getAuthSignKeyConstants())
        expect(response.body.challenge).not.toEqual(response2.body.challenge)
    });

    test("Challenge flow for an existing user", async () => {
        const organization = await new OrganizationFactory({}).create()
        // Also check UTF8 passwords
        const password = "54😂test👌🏾86s&é"
        const user = await new UserFactory({ organization, password }).create()

        const r = Request.buildJson("POST", "/v1/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "request_challenge",
            email: user.email
        });

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof ChallengeResponseStruct)) {
            throw new Error("Expected ChallengeResponseStruct")
        }

        const u = await User.getForAuthentication(organization.id, user.email)
        if (!u) {
            throw new Error("Unexpected check")
        }

        expect(response.body.keyConstants).toEqual(u.getAuthSignKeyConstants())

        // Sign the challenge
        const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(u.authSignKeyConstants, password)
        const signature = await Sodium.signMessage(response.body.challenge, authSignKeyPair.privateKey)

        const challengeRequest = Request.buildJson("POST", "/v1/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "challenge",
            email: user.email,
            challenge: response.body.challenge,
            signature: signature
        });

        const challengeResponse = await endpoint.test(challengeRequest);
        expect(challengeResponse.body).toBeDefined();

        expect(challengeResponse.body).toBeInstanceOf(TokenStruct)

        // Check if a challenge is cleared or deleted after one failed or succeeded try
        const challenges = await Challenge.where({ challenge: response.body.challenge})
        expect(challenges).toBeEmpty()

        // Also no other challenges left
        const userChallenges = await Challenge.where({ email: user.email, organizationId: organization.id })
        expect(userChallenges).toBeEmpty()
    });

    test("Invalid password login and lockout", async () => {
        const organization = await new OrganizationFactory({}).create()
        // Also check UTF8 passwords
        const password = "54😂test👌🏾86s&é"
        const user = await new UserFactory({ organization, password }).create()

        const r = Request.buildJson("POST", "/v1/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "request_challenge",
            email: user.email
        });

        let response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof ChallengeResponseStruct)) {
            throw new Error("Expected ChallengeResponseStruct")
        }

        const u = await User.getForAuthentication(organization.id, user.email)
        if (!u) {
            throw new Error("Unexpected check")
        }

        expect(response.body.keyConstants).toEqual(u.getAuthSignKeyConstants())

        // Generate random sign keys (to check if signature check fails for random signatures)
        const authSignKeyPair = await Sodium.generateSignKeyPair()
        const signature = await Sodium.signMessage(response.body.challenge, authSignKeyPair.privateKey)

        const challengeRequest = Request.buildJson("POST", "/v1/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "challenge",
            email: user.email,
            challenge: response.body.challenge,
            signature: signature
        });

        await expect(endpoint.test(challengeRequest)).rejects.toThrow(/invalid/i);

        // Check if a challenge is cleared or deleted after one failed or succeeded try
        const challenges = await Challenge.where({ challenge: response.body.challenge })
        expect(challenges).toBeEmpty()

        // Check counter
        let userChallenges = await Challenge.where({ email: user.email, organizationId: organization.id })
        expect(userChallenges).toHaveLength(1)
        expect(userChallenges[0].tries).toEqual(1)
        expect(userChallenges[0].challenge).toEqual(null)

        // Try again
        response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof ChallengeResponseStruct)) {
            throw new Error("Expected ChallengeResponseStruct")
        }

        // Check counter increased
        userChallenges = await Challenge.where({ email: user.email, organizationId: organization.id })
        expect(userChallenges).toHaveLength(1)
        expect(userChallenges[0].tries).toEqual(2)
        expect(userChallenges[0].challenge).toEqual(response.body.challenge)

        // Check 5 seconds lockout
        await expect(endpoint.test(r)).rejects.toThrow(/too many/i);

        // Wait 5 seconds
        MockDate.set(new Date().getTime() + 5 * 1000)

        response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof ChallengeResponseStruct)) {
            throw new Error("Expected ChallengeResponseStruct")
        }

        // Check counter increased
        userChallenges = await Challenge.where({ email: user.email, organizationId: organization.id })
        expect(userChallenges).toHaveLength(1)
        expect(userChallenges[0].tries).toEqual(3)
        expect(userChallenges[0].challenge).toEqual(response.body.challenge)

        // Check 5 seconds lockout again
        await expect(endpoint.test(r)).rejects.toThrow(/too many/i);

        // Set tries to 10
        userChallenges[0].tries = 10
        await userChallenges[0].save()

        // Check 5 seconds lockout again
        await expect(endpoint.test(r)).rejects.toThrow(/too many/i);

        // Wait 5 seconds
        MockDate.set(new Date().getTime() + 5 * 1000)
        await expect(endpoint.test(r)).rejects.toThrow(/too many/i);

        // Wait one hour
        MockDate.set(new Date().getTime() + 60 * 1000 * 60)

        response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof ChallengeResponseStruct)) {
            throw new Error("Expected ChallengeResponseStruct")
        }

        // Check counter increased
        userChallenges = await Challenge.where({ email: user.email, organizationId: organization.id })
        expect(userChallenges).toHaveLength(1)
        expect(userChallenges[0].tries).toEqual(11)
        expect(userChallenges[0].challenge).toEqual(response.body.challenge)
    });

    test("Expired challenges never succeed", async () => {
        const organization = await new OrganizationFactory({}).create()
        // Also check UTF8 passwords
        const password = "54😂test👌🏾86s&é"
        const user = await new UserFactory({ organization, password }).create()

        const r = Request.buildJson("POST", "/v1/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "request_challenge",
            email: user.email
        });

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof ChallengeResponseStruct)) {
            throw new Error("Expected ChallengeResponseStruct")
        }

        const u = await User.getForAuthentication(organization.id, user.email)
        if (!u) {
            throw new Error("Unexpected check")
        }

        expect(response.body.keyConstants).toEqual(u.getAuthSignKeyConstants())

        // Mock the time to be one minute later
        MockDate.set(new Date().getTime() + 61*1000)

        // Sign the challenge
        const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(u.authSignKeyConstants, password)
        const signature = await Sodium.signMessage(response.body.challenge, authSignKeyPair.privateKey)

        const challengeRequest = Request.buildJson("POST", "/v1/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "challenge",
            email: user.email,
            challenge: response.body.challenge,
            signature: signature
        });

        await expect(endpoint.test(challengeRequest)).rejects.toThrow(/invalid/i);
    });

    afterAll(() => {
        MockDate.reset();
    })
});
