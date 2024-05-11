import { Request } from "@simonbackx/simple-endpoints";
import { Group, GroupFactory, Member, MemberFactory, Organization, OrganizationFactory, RegistrationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsByRole } from "@stamhoofd/structures";

import { testServer } from "../../../../../tests/helpers/TestServer";
import { GetGroupMembersEndpoint } from './GetGroupMembersEndpoint';

describe("Endpoint.GetGroupMembersEndpoint", () => {
    // Test endpoint
    const endpoint = new GetGroupMembersEndpoint();
    let organization: Organization;
    let group: Group;
    let members: Member[];
    let role: PermissionRoleDetailed;
    let role2: PermissionRoleDetailed;

    beforeAll(async () => {
        role = PermissionRoleDetailed.create({
            name: 'Group 1 read access'
        })
        role2 = PermissionRoleDetailed.create({
            name: 'Group 2 full access'
        })

        organization = await new OrganizationFactory({roles: [role, role2]}).create()
        group = await new GroupFactory({ 
            organization, 
            permissions: PermissionsByRole.create({read: [role]}) 
        }).create()
        await new GroupFactory({ 
            organization, 
            permissions: PermissionsByRole.create({full: [role2]}) 
         }).create()
        members = await new MemberFactory({ organization }).createMultiple(5)

        // Create role
        for (const member of members) {
            await new RegistrationFactory({ group, member }).create()
        }
    });

    test("Cannot request group members as a normal user without permissions", async () => {
        const user = await new UserFactory({ organization }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", `/organization/group/${group.id}/members`, organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(testServer.test(endpoint, r)).rejects.toThrow("You do not have permissions for this action");
    });

    test("Cannot request group members if only access to a different group", async () => {
        const user = await new UserFactory({ 
            organization,
            permissions: Permissions.create({
                roles: [role2]
            })
        }).create()
        const token = await Token.createToken(user)
        

        const r = Request.buildJson("GET", `/organization/group/${group.id}/members`, organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(testServer.test(endpoint, r)).rejects.toThrow("Resource not found or no access");
    });

    test("Can request group members if has specific read access", async () => {
        const user = await new UserFactory({ 
            organization,
            permissions: Permissions.create({
                roles: [role]
            })
        }).create()
        const token = await Token.createToken(user)
        
        const r = Request.buildJson("GET", `/organization/group/${group.id}/members`, organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await testServer.test(endpoint, r);
        expect(response.body).toHaveLength(members.length);
    });

    test("Organizations are properly scoped even if a user from a different organization has the required role", async () => {
        const differentOrganization = await new OrganizationFactory({roles: [role, role2]}).create()
        const user = await new UserFactory({ 
            organization: differentOrganization,
            permissions: Permissions.create({
                roles: [role]
            })
        }).create()
        const token = await Token.createToken(user)
        
        const r = Request.buildJson("GET", `/organization/group/${group.id}/members`, differentOrganization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(testServer.test(endpoint, r)).rejects.toThrow("Resource not found or no access");
    });

    test("Organizations are properly scoped even if a user from a different organization has full access", async () => {
        const differentOrganization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ 
            organization: differentOrganization,
            permissions: Permissions.create({
                level: PermissionLevel.Full
            })
        }).create()
        const token = await Token.createToken(user)
        
        const r = Request.buildJson("GET", `/organization/group/${group.id}/members`, differentOrganization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(testServer.test(endpoint, r)).rejects.toThrow("Resource not found or no access");
    });

});
