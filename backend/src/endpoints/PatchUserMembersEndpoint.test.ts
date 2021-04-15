import { Request } from "@simonbackx/simple-endpoints";
import { EncryptedMember, KeychainedMembers, KeychainedResponse, User as UserStruct } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

import { EncryptedMemberFactory } from '../factories/EncryptedMemberFactory';
import { MemberFactory } from '../factories/MemberFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Token } from '../models/Token';
import { PatchUserMembersEndpoint } from './PatchUserMembersEndpoint';


describe("Endpoint.PatchUserMembersEndpoint", () => {
    // Test endpoint
    const endpoint = new PatchUserMembersEndpoint();

    test("Create a new member", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const user = await userFactory.create()

        const memberData = await new EncryptedMemberFactory({ user, userPrivateKey: userFactory.lastPrivateKey }).createMultiple(2)
        const members = memberData.map(m => m[0])
        const keychainItems = memberData.flatMap(m => m[1] ? [m[1]] : [])

        const token = await Token.createToken(user)

        const r = Request.buildJson("PATCH", "/v82/members", organization.getApiHost(), {
            members: members.map(m => { return {
                    put: m.encode({ version: 82 })
                }
            }),
            keychainItems: keychainItems.map(m => { return {
                    put: m.encode({ version: 82 })
                }
            })
        });
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(KeychainedResponse)

        expect(response.body.data).toHaveLength(2)
        expect(response.body.keychainItems).toHaveLength(2)

        expect(response.body.data.map(m => Object.assign({}, m, { updatedAt: undefined, createdAt: undefined })).sort(Sorter.byID)).toEqual(members.map(m => Object.assign({ registrations: [], users: [UserStruct.create(user)] }, m, { updatedAt: undefined, createdAt: undefined })).sort(Sorter.byID)) // created user won't have any registrations
        expect(response.body.keychainItems.map(i => i.publicKey)).toIncludeAllMembers(members.flatMap(m => m.encryptedDetails.filter(e => !e.forOrganization).map(e => e.publicKey)))
    });

    test("Create a new member and update a member", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const user = await userFactory.create()

        const existingMember = await new MemberFactory({ user, userPrivateKey: userFactory.lastPrivateKey }).create()
        const memberData = await new EncryptedMemberFactory({ user, userPrivateKey: userFactory.lastPrivateKey }).createMultiple(1)

        const members = memberData.map(m => m[0])
        const keychainItems = memberData.flatMap(m => m[1] ? [m[1]] : [])

        const token = await Token.createToken(user)

        const existingMemberEncrypted = EncryptedMember.patch({
            id: existingMember.id,
            //encryptedForMember: members[0].encryptedForMember,
            //encryptedForOrganization: members[0].encryptedForOrganization,
            //publicKey: existingMember.publicKey,
            //organizationPublicKey: organization.publicKey,
            firstName: existingMember.firstName+"2"
        })

        const patch = KeychainedMembers.patch({})
        for (const member of members) {
            patch.members.addPut(member)
        }

        patch.members.addPatch(existingMemberEncrypted)

        for (const keychainItem of keychainItems) {
            patch.keychainItems.addPut(keychainItem)
        }
        const r = Request.buildJson("PATCH", "/v82/members", organization.getApiHost(), patch);
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(KeychainedResponse)

        expect(response.body.data).toHaveLength(2)
        expect(response.body.keychainItems).toHaveLength(2)

        existingMember.firstName = existingMemberEncrypted.firstName!
        expect(
            response.body.data.map(
                m => 
                    Object.assign({}, m, { 
                        updatedAt: undefined, 
                        createdAt: undefined 
                    })
                )
            .sort(Sorter.byID)
        ).toEqual(
            [...members, EncryptedMember.create(existingMember)].map(
                m => 
                Object.assign({ 
                    registrations: [], 
                    users: [UserStruct.create(user)] 
                }, m, { 
                    updatedAt: undefined, 
                    createdAt: undefined 
                })
            ).sort(Sorter.byID)
        )

        expect(response.body.keychainItems.map(i => i.publicKey)).toIncludeAllMembers(members.flatMap(m => m.encryptedDetails.filter(e => !e.forOrganization).map(e => e.publicKey)))
    });
});
