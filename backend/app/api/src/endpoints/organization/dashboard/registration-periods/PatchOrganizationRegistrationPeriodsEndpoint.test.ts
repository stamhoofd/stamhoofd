import { Request } from '@simonbackx/simple-endpoints';
import { GroupFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodFactory, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { GroupSettings, Group as GroupStruct, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, PermissionLevel, Permissions, Version } from '@stamhoofd/structures';

import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchOrganizationRegistrationPeriodsEndpoint } from './PatchOrganizationRegistrationPeriodsEndpoint.js';

describe('Endpoint.PatchOrganizationRegistrationPeriods', () => {
    // Test endpoint
    const endpoint = new PatchOrganizationRegistrationPeriodsEndpoint();

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    const patchOrganizationRegistrationPeriods = async ({ patch, organization, token }: { patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>; organization: Organization; token: Token }) => {
        const request = Request.buildJson('PATCH', `/v${Version}/organization/registration-periods`, organization.getApiHost(), patch);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    describe('userMode organization', () => {
        beforeEach(async () => {
            TestUtils.setEnvironment('userMode', 'organization');
        });

        test('should not be able to patch registration periods with global period', async () => {
            const organization = await new OrganizationFactory({ }).create();

            // create global period
            const newPeriod = await new RegistrationPeriodFactory({}).create();

            // create organization registration period linked to global period
            const newOrganizationPeriod = new OrganizationRegistrationPeriod();
            newOrganizationPeriod.organizationId = organization.id;
            newOrganizationPeriod.periodId = newPeriod.id;
            await newOrganizationPeriod.save();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(user);

            const patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct> = new PatchableArray();

            patch.addPatch(OrganizationRegistrationPeriodStruct.patch({
                id: newOrganizationPeriod.id,
                groups: new PatchableArray(),
            }));

            // patch organization registration period should fail
            await expect(patchOrganizationRegistrationPeriods({ patch, organization, token })).rejects.toThrow(
                STExpect.simpleError({ code: 'not_found' }),
            );
        });

        test('should be able to patch registration periods', async () => {
            const organization = await new OrganizationFactory({ }).create();

            // create period
            const newPeriod = await new RegistrationPeriodFactory({ organization }).create();

            // create organization registration period
            const newOrganizationPeriod = new OrganizationRegistrationPeriod();
            newOrganizationPeriod.organizationId = organization.id;
            newOrganizationPeriod.periodId = newPeriod.id;
            await newOrganizationPeriod.save();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(user);

            const patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct> = new PatchableArray();

            patch.addPatch(OrganizationRegistrationPeriodStruct.patch({
                id: newOrganizationPeriod.id,
                groups: new PatchableArray(),
            }));

            // patch organization registration period should not fail
            const response = await patchOrganizationRegistrationPeriods({ patch, organization, token });
            expect(response.body).toBeDefined();
        });

        test('should not be able to create registration periods with global period', async () => {
            const organization = await new OrganizationFactory({ }).create();

            // create global period
            const newPeriod = await new RegistrationPeriodFactory({}).create();

            // create organization registration period linked to global period
            const newOrganizationPeriod = OrganizationRegistrationPeriodStruct.create({
                period: newPeriod.getStructure(),
            });

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(user);

            const patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct> = new PatchableArray();

            patch.addPut(newOrganizationPeriod);

            // patch organization registration period should fail
            await expect(patchOrganizationRegistrationPeriods({ patch, organization, token })).rejects.toThrow(
                STExpect.simpleError({ code: 'invalid_period' }),
            );
        });

        test('should be able to create registration periods', async () => {
            const organization = await new OrganizationFactory({ }).create();

            // create period
            const startDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
            const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            const newPeriod = await new RegistrationPeriodFactory({
                organization,
                startDate,
                endDate,
            }).create();

            // create organization registration period
            const newOrganizationPeriod = OrganizationRegistrationPeriodStruct.create({
                period: newPeriod.getStructure(),
            });

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(user);

            const patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct> = new PatchableArray();

            patch.addPut(newOrganizationPeriod);

            // patch organization registration period should not fail
            const response = await patchOrganizationRegistrationPeriods({ patch, organization, token });
            expect(response.body).toBeDefined();
        });

        test('should not be able to patch groups of other organization', async () => {
            const organization = await new OrganizationFactory({ }).create();
            const otherOrganization = await new OrganizationFactory({ }).create();

            // create period
            const startDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
            const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            const newPeriod = await new RegistrationPeriodFactory({
                organization,
                startDate,
                endDate,
            }).create();

            // create organization registration period
            const newOrganizationPeriod = await new OrganizationRegistrationPeriodFactory({
                organization,
                period: newPeriod,
            }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(user);

            // create group
            const group = await new GroupFactory({ organization: otherOrganization }).create();

            const patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct> = new PatchableArray();
            const groupsPatch: PatchableArrayAutoEncoder<GroupStruct> = new PatchableArray();

            // patch group
            groupsPatch.addPatch(GroupStruct.patch({
                id: group.id,
                settings: GroupSettings.patch({
                    name: 'new name',
                }),
            }));

            patch.addPatch(OrganizationRegistrationPeriodStruct.patch({
                id: newOrganizationPeriod.id,
                groups: groupsPatch,
            }));

            // patch organization registration period should fail because of group of other organization
            await expect(patchOrganizationRegistrationPeriods({ patch, organization, token })).rejects.toThrow(
                STExpect.simpleError({ code: 'permission_denied' }),
            );
        });
    });
});
