import { Request } from "@simonbackx/simple-endpoints";
import { KeyConstantsHelper, SensitivityLevel, Sodium } from "@stamhoofd/crypto";
import { KeychainItem, OrganizationGenderType, SignupResponse } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { EmailVerificationCode } from "@stamhoofd/models";
import { Organization } from "@stamhoofd/models";
import { CreateOrganizationEndpoint } from "./CreateOrganizationEndpoint";

describe("Endpoint.CreateOrganization", () => {
    // Test endpoint
    const endpoint = new CreateOrganizationEndpoint();

    test("Create an organization", async () => {
        const userKeyPair = await Sodium.generateEncryptionKeyPair();
        const organizationKeyPair = await Sodium.generateEncryptionKeyPair();

        const authSignKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Tests)
        const authEncryptionKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Tests)
        const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, "My user password")
        const authEncryptionSecretKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, "My user password")

        const userId = uuidv4()
        const organizationId = uuidv4()

        const r = Request.buildJson("POST", "/v1/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            organization: {
                id: organizationId,
                name: "My endpoint test organization",
                publicKey: organizationKeyPair.publicKey,
                meta: {
                    type: "Other",
                    umbrellaOrganization: null,
                    genderType: OrganizationGenderType.Mixed,
                    expectedMemberCount: 120,
                    defaultPrices: [],
                    defaultEndDate: new Date().getTime(),
                    defaultStartDate: new Date().getTime()
                },
                address: {
                    street: "Demostraat",
                    number: "12",
                    city: "Gent",
                    postalCode: "9000",
                    country: "BE"
                }
            },
            privateMeta: null,
            user: {
                id: userId,
                email: "admin@domain.com",
                publicKey: userKeyPair.publicKey,
                publicAuthSignKey: authSignKeyPair.publicKey,
                // Indirectly the server can have access to the private key during moments where he can read the password (= login and register)
                // encryptedPrivateKey is optional, and is only needed for browser based users. Users that use the apps will have a better
                // (= forward secrecy) protection against a compromised server
                encryptedPrivateKey: await Sodium.encryptMessage(userKeyPair.privateKey, authEncryptionSecretKey),
                authSignKeyConstants: authSignKeyConstants,
                authEncryptionKeyConstants: authSignKeyConstants,
            },
            keychainItems: [
                // Give access to the private key of the organization by encrypting the private key of the organization with the private key of the user
                KeychainItem.create({
                    publicKey: organizationKeyPair.publicKey,
                    // encrypted private key is always authenticated with the private key of the user
                    encryptedPrivateKey: await Sodium.sealMessageAuthenticated(organizationKeyPair.privateKey, userKeyPair.publicKey, userKeyPair.privateKey),
                }).encode({ version: 1 }),
            ]
        });

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        // Access token should be expired (todo for email validation)
        // expect(response.body.accessTokenValidUntil).toBeBefore(new Date());
        expect(response.body).toBeInstanceOf(SignupResponse);

        expect(response.status).toEqual(200);

        const organization = await Organization.getByURI(Formatter.slug("My endpoint test organization"));
        expect(organization).toBeDefined();
        if (!organization) throw new Error("impossible");

        const token = await EmailVerificationCode.poll(organizationId, response.body.token);
        expect(token).toEqual(true)
        if (!token) throw new Error("impossible");
        //expect(token.accessTokenValidUntil).toBeBefore(new Date());

        //const user = await User.login(organization, "admin@domain.com", "My user password");
        //expect(user).toBeDefined();
    });

    /*test("Organization already exists throws", async () => {
        const userKeyPair = await Sodium.boxKeyPair();
        const organizationKeyPair = await Sodium.signKeyPair();

        const r = Request.buildJson("POST", "/v1/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            name: "My endpoint test organization",
            publicKey: organizationKeyPair.publicKey,
            user: {
                email: "admin@domain.com",
                password: "My user password",
                publicKey: userKeyPair.publicKey,
                adminSignature: await Sodium.signMessage(
                    userKeyPair.publicKey,
                    organizationKeyPair.privateKey
                ),
            },
        });

        await expect(endpoint.test(r)).rejects.toThrow(/name/);
    });

    test("Mising admin signature", async () => {
        const userKeyPair = await Sodium.boxKeyPair();
        const organizationKeyPair = await Sodium.signKeyPair();

        const r = Request.buildJson("POST", "/v1/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            name: "My endpoint test 2 organization",
            publicKey: organizationKeyPair.publicKey,
            user: {
                email: "admin@domain.com",
                password: "My user password",
                publicKey: userKeyPair.publicKey,
            },
        });

        await expect(endpoint.test(r)).rejects.toThrow(/sign/);
    });

    test("Invalid admin signature", async () => {
        const userKeyPair = await Sodium.boxKeyPair();
        const organizationKeyPair = await Sodium.signKeyPair();
        const invalidKeyPair = await Sodium.signKeyPair();

        const r = Request.buildJson("POST", "/v1/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            name: "My endpoint test 3 organization",
            publicKey: organizationKeyPair.publicKey,
            user: {
                email: "admin@domain.com",
                password: "My user password",
                publicKey: userKeyPair.publicKey,
                adminSignature: await Sodium.signMessage(
                    userKeyPair.publicKey,
                    invalidKeyPair.privateKey,
                ),
            },
        });

        await expect(endpoint.test(r)).rejects.toThrow(/adminSignature/);
    });*/
});
