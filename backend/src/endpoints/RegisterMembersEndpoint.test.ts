import { Request } from "@simonbackx/simple-endpoints";
import { EncryptedMember, KeychainedResponse, Payment, RegisterResponse } from '@stamhoofd/structures';
import { group } from "console";

import { GroupFactory } from '../factories/GroupFactory';
import { MemberFactory } from '../factories/MemberFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Token } from '../models/Token';
import { RegisterMembersEndpoint } from './RegisterMembersEndpoint';


describe("Endpoint.RegisterMembers", () => {
    // Test endpoint
    const endpoint = new RegisterMembersEndpoint();

    test("Register two new members", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const group = await new GroupFactory({ 
            organization,
            price: 123,
            reducedPrice: 12,
            delayDate: new Date(new Date().getTime() + 10000),
            delayPrice: 10,
            delayReducedPrice: 5
         }).create()

        const user = await userFactory.create()
        const members = await new MemberFactory({ organization, user }).createMultiple(2)

        const token = await Token.createToken(user)

        const r = Request.buildJson("POST", "/v19/members/register", organization.getApiHost(), {
            members: members.map(m => {
                return { 
                    memberId: m.id,
                    groupId: group.id,
                    reduced: false,
                    waitingList: false
                }
            }),
            paymentMethod: "Transfer"
        });
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(RegisterResponse)

        expect(response.body.payment!.status).toEqual("Created")
        expect(response.body.payment!.method).toEqual("Transfer")
        expect(response.body.payment!.price).toEqual(123 * 2)
        expect(response.body.registrations).toHaveLength(2)
        expect(response.body.registrations.map(r => r.waitingList)).toEqual([false, false])
    });

    test("Add members to waiting list", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const group = await new GroupFactory({ 
            organization,
            price: 123,
            reducedPrice: 12,
            delayDate: new Date(new Date().getTime() + 10000),
            delayPrice: 10,
            delayReducedPrice: 5
         }).create()

        const user = await userFactory.create()
        const members = await new MemberFactory({ organization, user }).createMultiple(2)

        const token = await Token.createToken(user)

        const r = Request.buildJson("POST", "/v19/members/register", organization.getApiHost(), {
            members: members.map(m => {
                return { 
                    memberId: m.id,
                    groupId: group.id,
                    reduced: false,
                    waitingList: true,
                }
            }),
            paymentMethod: "Transfer"
        });
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(RegisterResponse)

        expect(response.body.payment).toEqual(null)
        expect(response.body.members).toHaveLength(2)
        expect(response.body.registrations).toHaveLength(2)
        expect(response.body.registrations.map(r => r.waitingList)).toEqual([true, true])
    });

    test("Register two new members with reduced price", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const group = await new GroupFactory({
            organization,
            price: 123,
            reducedPrice: 12,
            delayDate: new Date(new Date().getTime() + 10000),
            delayPrice: 10,
            delayReducedPrice: 5
        }).create()

        const user = await userFactory.create()
        const members = await new MemberFactory({ organization, user }).createMultiple(2)

        const token = await Token.createToken(user)

        const r = Request.buildJson("POST", "/v19/members/register", organization.getApiHost(), {
            members: members.map(m => {
                return {
                    memberId: m.id,
                    groupId: group.id,
                    reduced: true,
                    waitingList: false
                }
            }),
            paymentMethod: "Transfer"
        });
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(RegisterResponse)

        expect(response.body.payment!.status).toEqual("Created")
        expect(response.body.payment!.method).toEqual("Transfer")
        expect(response.body.payment!.price).toEqual(12 * 2)
        expect(response.body.registrations).toHaveLength(2)
        expect(response.body.registrations.map(r => r.waitingList)).toEqual([false, false])
    });

    test("Register two new members with reduced price after date", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const group = await new GroupFactory({
            organization,
            price: 123,
            reducedPrice: 12,
            delayDate: new Date(new Date().getTime() - 1000),
            delayPrice: 10,
            delayReducedPrice: 5
        }).create()

        const user = await userFactory.create()
        const members = await new MemberFactory({ organization, user }).createMultiple(2)

        const token = await Token.createToken(user)

        const r = Request.buildJson("POST", "/v19/members/register", organization.getApiHost(), {
            members: members.map(m => {
                return {
                    memberId: m.id,
                    groupId: group.id,
                    reduced: true,
                    waitingList: false
                }
            }),
            paymentMethod: "Transfer"
        });
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(RegisterResponse)

        expect(response.body.payment!.status).toEqual("Created")
        expect(response.body.payment!.method).toEqual("Transfer")
        expect(response.body.payment!.price).toEqual(5 * 2)
        expect(response.body.registrations).toHaveLength(2)
    });

    test("Register two new members with normal price after date", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const group = await new GroupFactory({
            organization,
            price: 123,
            reducedPrice: 12,
            delayDate: new Date(new Date().getTime() - 1000),
            delayPrice: 10,
            delayReducedPrice: 5
        }).create()

        const user = await userFactory.create()
        const members = await new MemberFactory({ organization, user }).createMultiple(2)

        const token = await Token.createToken(user)

        const r = Request.buildJson("POST", "/v19/members/register", organization.getApiHost(), {
            members: members.map(m => {
                return {
                    memberId: m.id,
                    groupId: group.id,
                    reduced: false,
                    waitingList: false
                }
            }),
            paymentMethod: "Transfer"
        });
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(RegisterResponse)

        expect(response.body.payment!.status).toEqual("Created")
        expect(response.body.payment!.method).toEqual("Transfer")
        expect(response.body.payment!.price).toEqual(10 * 2)
        expect(response.body.registrations).toHaveLength(2)
    });

});
