import { Database } from '@simonbackx/simple-database';
import { PatchableArray, PatchableArrayAutoEncoder, PatchMap } from '@simonbackx/simple-encoding';
import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { GroupFactory, Member, MemberFactory, OrganizationFactory, OrganizationTagFactory, Platform, RegistrationFactory, Token, UserFactory } from '@stamhoofd/models';
import { Address, Country, EmergencyContact, MemberDetails, MemberWithRegistrationsBlob, OrganizationMetaData, OrganizationRecordsConfiguration, Parent, PatchAnswers, PermissionLevel, Permissions, PermissionsResourceType, RecordCategory, RecordSettings, RecordTextAnswer, ResourcePermissions, ReviewTime, ReviewTimes, TranslatedString, UitpasNumberDetails, UitpasSocialTariff, UitpasSocialTariffStatus } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initUitpasApi } from '../../../../tests/init/index.js';
import { PatchOrganizationMembersEndpoint } from './PatchOrganizationMembersEndpoint.js';

const baseUrl = `/organization/members`;
const endpoint = new PatchOrganizationMembersEndpoint();
type EndpointType = typeof endpoint;
type Body = EndpointType extends Endpoint<any, any, infer B, any> ? B : never;

const firstName = 'John';
const lastName = 'Doe';
const birthDay = { year: 1993, month: 4, day: 5 };

describe('Endpoint.PatchOrganizationMembersEndpoint', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(async () => {
        // Delete all members (so the duplicate checks work as expected)
        await Database.delete('DELETE FROM `members`');
    });

    describe('Duplicate members', () => {
        test('The security code should be a requirement', async () => {
            const organization = await new OrganizationFactory({ }).create();
            const user = await new UserFactory({
                permissions: Permissions.create({ level: PermissionLevel.Full }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const existingMember = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: true,
            }).create();

            const token = await Token.createToken(user);

            const arr: Body = new PatchableArray();
            const put = MemberWithRegistrationsBlob.create({
                details: MemberDetails.create({
                    firstName,
                    lastName,
                    birthDay: new Date(existingMember.details.birthDay!.getTime() + 1),
                }),
            });
            arr.addPut(put);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            await expect(testServer.test(endpoint, request))
                .rejects
                .toThrow(STExpect.errorWithCode('known_member_missing_rights'));
        });

        test('The security code is not a requirement for members without additional data', async () => {
            const organization = await new OrganizationFactory({ }).create();
            const user = await new UserFactory({
                permissions: Permissions.create({ level: PermissionLevel.Full }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const existingMember = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            const token = await Token.createToken(user);

            const arr: Body = new PatchableArray();
            const newBirthDay = new Date(existingMember.details.birthDay!.getTime() + 1);
            const put = MemberWithRegistrationsBlob.create({
                details: MemberDetails.create({
                    firstName,
                    lastName,
                    birthDay: newBirthDay,
                    email: 'anewemail@example.com',
                }),
            });
            arr.addPut(put);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);

            // Check id of the returned memebr matches the existing member
            expect(response.body.members.length).toBe(1);
            expect(response.body.members[0].id).toBe(existingMember.id);

            // Check data matches the original data + changes from the put
            const member = response.body.members[0];
            expect(member.details.firstName).toBe(firstName);
            expect(member.details.lastName).toBe(lastName);
            expect(member.details.birthDay).toEqual(newBirthDay);
            expect(member.details.email).toBe('anewemail@example.com'); // this has been merged
            expect(member.details.alternativeEmails).toHaveLength(0);
        });

        test('A duplicate member with existing registrations returns those registrations after a merge', async () => {
            const organization = await new OrganizationFactory({ }).create();
            const user = await new UserFactory({
                permissions: Permissions.create({ level: PermissionLevel.Full }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const details = MemberDetails.create({
                firstName,
                lastName,
                securityCode: 'ABC-123',
                email: 'original@example.com',
                parents: [
                    Parent.create({
                        firstName: 'Jane',
                        lastName: 'Doe',
                        email: 'jane.doe@example.com',
                    }),
                ],
            });

            const existingMember = await new MemberFactory({
                birthDay,
                details,
            }).create();

            // Create a registration for this member
            const group = await new GroupFactory({ organization }).create();
            const registration = await new RegistrationFactory({
                member: existingMember,
                group,
            }).create();

            const token = await Token.createToken(user);

            const arr: Body = new PatchableArray();
            const newBirthDay = new Date(existingMember.details.birthDay!.getTime() + 1);
            const put = MemberWithRegistrationsBlob.create({
                details: MemberDetails.create({
                    firstName,
                    lastName,
                    birthDay: newBirthDay,
                    securityCode: existingMember.details.securityCode,
                    email: 'anewemail@example.com',
                }),
            });
            arr.addPut(put);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);

            // Check id of the returned memebr matches the existing member
            expect(response.body.members.length).toBe(1);
            expect(response.body.members[0].id).toBe(existingMember.id);

            // Check data matches the original data + changes from the put
            const member = response.body.members[0];
            expect(member.details.firstName).toBe(firstName);
            expect(member.details.lastName).toBe(lastName);
            expect(member.details.birthDay).toEqual(newBirthDay);
            expect(member.details.email).toBe('anewemail@example.com'); // this has been merged
            expect(member.details.alternativeEmails).toEqual(['original@example.com']); // this has been merged

            // Check the registration is still there
            expect(member.registrations.length).toBe(1);
            expect(member.registrations[0].id).toBe(registration.id);

            // Check parent is still there
            expect(member.details.parents.length).toBe(1);
            expect(member.details.parents[0]).toEqual(existingMember.details.parents[0]);
        });
    });

    describe('Permission checking', () => {
        test('An admin cannot edit members of a different organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const otherOrganization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const member = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            // Register this member
            await new RegistrationFactory({
                member,
                organization: otherOrganization,
            }).create();

            const token = await Token.createToken(user);

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    firstName: 'Changed',
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('not_found'));
        });

        test('An admin can edit members registered in its own organization', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const member = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            // Register this member
            await new RegistrationFactory({
                member,
                organization,
            }).create();

            const token = await Token.createToken(user);

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    firstName: 'Changed',
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);
            const memberStruct = response.body.members[0];
            expect(memberStruct.details).toMatchObject({
                firstName: 'Changed',
            });
        });

        test('A registration grants permission to a member', async () => {
            // Member had a deactivated registration with a group that should give the admin acecss to the member, but since it is deactivated -> no access
            const organization = await new OrganizationFactory({}).create();
            const resources = new Map();

            const group = await new GroupFactory({
                organization,
            }).create();

            // Give read permission to the group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]]),
            );

            const user = await new UserFactory({
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources,
                }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const member = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            // Register this member
            await new RegistrationFactory({
                member,
                group,
            }).create();

            const token = await Token.createToken(user);

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    firstName: 'Changed',
                }),
            });
            arr.addPatch(patch);

            // Try to request all members at organization
            const request = Request.patch({
                path: baseUrl,
                host: organization.getApiHost(),
                body: arr,
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);
            const memberStruct = response.body.members[0];
            expect(memberStruct.details).toMatchObject({
                firstName: 'Changed',
            });
        });

        test('[REGRESSION] A deactivated registration does not grant permission to a member', async () => {
            // Member had a deactivated registration with a group that should give the admin acecss to the member, but since it is deactivated -> no access
            const organization = await new OrganizationFactory({}).create();
            const resources = new Map();

            const group = await new GroupFactory({
                organization,
            }).create();

            // Give read permission to the group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]]),
            );

            const user = await new UserFactory({
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources,
                }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const member = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            // Register this member
            await new RegistrationFactory({
                member,
                group,
                deactivatedAt: new Date(),
            }).create();

            const token = await Token.createToken(user);

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    firstName: 'Changed',
                }),
            });
            arr.addPatch(patch);

            // Try to request all members at organization
            const request = Request.patch({
                path: baseUrl,
                host: organization.getApiHost(),
                body: arr,
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.simpleError({
                code: 'not_found',
            }));

            await member.refresh();

            // Not changed
            expect(member.details.firstName).toEqual(firstName);
        });

        test('A full platform admin can edit members without registrations', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                globalPermissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            }).create();

            const member = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            const token = await Token.createToken(user);

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    firstName: 'Changed',
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);
            const memberStruct = response.body.members[0];
            expect(memberStruct.details).toMatchObject({
                firstName: 'Changed',
            });
        });

        test('[Regression] A platform admin with all tag access can edit members without registrations', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                globalPermissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([
                        // All Tags
                        [PermissionsResourceType.OrganizationTags, new Map(
                            [['', ResourcePermissions.create({ level: PermissionLevel.Full })]],
                        )],
                    ]),
                }),
            }).create();

            const member = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            const token = await Token.createToken(user);

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    firstName: 'Changed',
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);
            const memberStruct = response.body.members[0];
            expect(memberStruct.details).toMatchObject({
                firstName: 'Changed',
            });
        });
    });

    describe('Record answers', () => {
        test('An admin can set records of its own organization', async () => {
            const commentsRecord = RecordSettings.create({
                name: TranslatedString.create('Opmerkingen'),
                externalPermissionLevel: PermissionLevel.Read, // this should be ignored since we are an admin
            });

            const recordCategory = RecordCategory.create({
                name: TranslatedString.create('Medische fiche'),
                records: [
                    commentsRecord,
                ],
            });
            const organization = await new OrganizationFactory({
                meta: OrganizationMetaData.create({
                    recordsConfiguration: OrganizationRecordsConfiguration.create({
                        recordCategories: [recordCategory],
                    }),
                }),
            }).create();

            const user = await new UserFactory({
                permissions: Permissions.create({ level: PermissionLevel.Full }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const member = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            // Register this member
            await new RegistrationFactory({
                member,
                organization,
            }).create();

            const token = await Token.createToken(user);

            const recordAnswers = new PatchMap() as PatchAnswers;

            recordAnswers.set(commentsRecord.id, RecordTextAnswer.create({
                settings: commentsRecord,
                value: 'Some comments',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    recordAnswers,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);
            const struct = response.body.members[0];
            expect(struct.details.recordAnswers.get(commentsRecord.id)).toMatchObject({
                value: 'Some comments',
            });
        });

        test('An admin with read only record category permission cannot set the records in that category', async () => {
            const commentsRecord = RecordSettings.create({
                name: TranslatedString.create('Opmerkingen'),
            });

            const recordCategory = RecordCategory.create({
                name: TranslatedString.create('Medische fiche'),
                records: [
                    commentsRecord,
                ],
            });
            const organization = await new OrganizationFactory({
                meta: OrganizationMetaData.create({
                    recordsConfiguration: OrganizationRecordsConfiguration.create({
                        recordCategories: [recordCategory],
                    }),
                }),
            }).create();

            const group = await new GroupFactory({ organization }).create();

            const user = await new UserFactory({
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([
                        [PermissionsResourceType.RecordCategories, new Map([
                            [recordCategory.id, ResourcePermissions.create({ level: PermissionLevel.Read })],
                        ])],
                        [PermissionsResourceType.Groups, new Map([
                            [group.id, ResourcePermissions.create({ level: PermissionLevel.Full })],
                        ])],
                    ]),
                }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const member = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            // Register this member
            await new RegistrationFactory({
                member,
                group,
            }).create();

            const token = await Token.createToken(user);

            const recordAnswers = new PatchMap() as PatchAnswers;

            recordAnswers.set(commentsRecord.id, RecordTextAnswer.create({
                settings: commentsRecord,
                value: 'Some comments',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    recordAnswers,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        });

        test('An admin without record category permission cannot set the records in that category', async () => {
            const commentsRecord = RecordSettings.create({
                name: TranslatedString.create('Opmerkingen'),
            });

            const recordCategory = RecordCategory.create({
                name: TranslatedString.create('Medische fiche'),
                records: [
                    commentsRecord,
                ],
            });
            const organization = await new OrganizationFactory({
                meta: OrganizationMetaData.create({
                    recordsConfiguration: OrganizationRecordsConfiguration.create({
                        recordCategories: [recordCategory],
                    }),
                }),
            }).create();

            const group = await new GroupFactory({ organization }).create();

            const user = await new UserFactory({
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([
                        [PermissionsResourceType.Groups, new Map([
                            [group.id, ResourcePermissions.create({ level: PermissionLevel.Full })],
                        ])],
                    ]),
                }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const member = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            // Register this member
            await new RegistrationFactory({
                member,
                group,
            }).create();

            const token = await Token.createToken(user);

            const recordAnswers = new PatchMap() as PatchAnswers;

            recordAnswers.set(commentsRecord.id, RecordTextAnswer.create({
                settings: commentsRecord,
                value: 'Some comments',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    recordAnswers,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        });

        test('An admin can set records of the platform', async () => {
            const commentsRecord = RecordSettings.create({
                name: TranslatedString.create('Opmerkingen'),
            });

            const recordCategory = RecordCategory.create({
                name: TranslatedString.create('Medische fiche'),
                records: [
                    commentsRecord,
                ],
            });

            const platform = await Platform.getForEditing();
            platform.config.recordsConfiguration.recordCategories.push(recordCategory);
            await platform.save();

            const organization = await new OrganizationFactory({}).create();
            const group = await new GroupFactory({ organization }).create();

            const user = await new UserFactory({
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([
                        [PermissionsResourceType.RecordCategories, new Map([
                            [recordCategory.id, ResourcePermissions.create({ level: PermissionLevel.Write })],
                        ])],
                        [PermissionsResourceType.Groups, new Map([
                            [group.id, ResourcePermissions.create({ level: PermissionLevel.Full })],
                        ])],
                    ]),
                }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const member = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            // Register this member
            await new RegistrationFactory({
                member,
                group,
            }).create();

            const token = await Token.createToken(user);

            const recordAnswers = new PatchMap() as PatchAnswers;

            recordAnswers.set(commentsRecord.id, RecordTextAnswer.create({
                settings: commentsRecord,
                value: 'Some comments',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    recordAnswers,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);
            const struct = response.body.members[0];
            expect(struct.details.recordAnswers.get(commentsRecord.id)).toMatchObject({
                value: 'Some comments',
            });
        });

        test('[Regression] A platform admin with tag-access to an organization can change platform records', async () => {
            const commentsRecord = RecordSettings.create({
                name: TranslatedString.create('Opmerkingen'),
            });

            const recordCategory = RecordCategory.create({
                name: TranslatedString.create('Medische fiche'),
                records: [
                    commentsRecord,
                ],
            });

            const platform = await Platform.getForEditing();
            platform.config.recordsConfiguration.recordCategories.push(recordCategory);
            await platform.save();

            const tag = await new OrganizationTagFactory({}).create();
            const organization = await new OrganizationFactory({
                tags: [tag.id],
            }).create();
            const group = await new GroupFactory({ organization }).create();

            const user = await new UserFactory({
                globalPermissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([
                        [PermissionsResourceType.OrganizationTags, new Map([
                            [tag.id, ResourcePermissions.create({ level: PermissionLevel.Full })],
                        ])],
                    ]),
                }),
                organization, // since we are in platform mode, this will only set the permissions for this organization
            }).create();

            const member = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
            }).create();

            // Register this member
            await new RegistrationFactory({
                member,
                group,
            }).create();

            const token = await Token.createToken(user);

            const recordAnswers = new PatchMap() as PatchAnswers;

            recordAnswers.set(commentsRecord.id, RecordTextAnswer.create({
                settings: commentsRecord,
                value: 'Some comments',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    recordAnswers,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);
            const struct = response.body.members[0];
            expect(struct.details.recordAnswers.get(commentsRecord.id)).toMatchObject({
                value: 'Some comments',
            });
        });
    });

    describe('Parents', () => {
        test('Setting updatedAt for one parent, changes it for the whole family', async () => {
            const user = await new UserFactory({}).create();

            const parent1 = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work.com'],
                phone: '+32412345678',
                address: Address.create({
                    street: 'Main street 1',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012345',
                updatedAt: new Date(0),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    parents: [parent1],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    parents: [parent1],
                }),
            }).create();

            // Parent3 was reviewed last, so has priority
            const member3 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Bob',
                    lastName: 'Doe',
                    parents: [parent1],
                }),
            }).create();

            // Now simulate a change to member1's parents, and check if all parents are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);

            const arr: Body = new PatchableArray();
            const d = new Date();
            const parentsPatch = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
            parentsPatch.addPatch(
                Parent.patch({
                    id: parent1.id,
                    updatedAt: d,
                }),
            );

            const patch = MemberWithRegistrationsBlob.patch({
                id: member1.id,
                details: MemberDetails.patch({
                    parents: parentsPatch,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load parents again
            await member1.refresh();
            await member2.refresh();
            await member3.refresh();

            // Check all parents equal
            const expectedParent = Parent.create({
                ...parent1,
                updatedAt: d,
            });

            expect(member1.details.parents).toEqual([expectedParent]);
            expect(member2.details.parents).toEqual([expectedParent]);
            expect(member3.details.parents).toEqual([expectedParent]);
        });

        test('Patches without updatedAt are handled correctly and applied to the most recent parent', async () => {
            const user = await new UserFactory({}).create();

            const mostRecentParent = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work.com'],
                phone: '+32412345678',
                address: Address.create({
                    street: 'Main street 1',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012347',
                updatedAt: new Date(10_000),
                createdAt: new Date(0),
            });

            const outOfDateParent = Parent.create({
                id: mostRecentParent.id,
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work.com'],
                phone: '+32412345678',
                address: Address.create({
                    street: 'Main street 1',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012345',
                updatedAt: new Date(0),
                createdAt: new Date(200),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    parents: [outOfDateParent],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    parents: [outOfDateParent],
                }),
            }).create();

            // Parent3 was reviewed last, so has priority
            const member3 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Bob',
                    lastName: 'Doe',
                    parents: [mostRecentParent],
                }),
            }).create();

            // Now simulate a change to member1's parents, and check if all parents are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);

            const arr: Body = new PatchableArray();
            const parentsPatch = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
            parentsPatch.addPatch(
                Parent.patch({
                    id: outOfDateParent.id,
                    email: 'changed@example.com',
                }),
            );

            const patch = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    parents: parentsPatch,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load parents again
            await member1.refresh();
            await member2.refresh();
            await member3.refresh();

            // Check all parents equal
            const expectedParent = Parent.create({
                ...mostRecentParent,
                email: 'changed@example.com',
            });

            expect(member1.details.parents).toEqual([expectedParent]);
            expect(member2.details.parents).toEqual([expectedParent]);
            expect(member3.details.parents).toEqual([expectedParent]);
        });

        test('Patches without updatedAt are handled correctly and applied to the most recent parent when merging', async () => {
            const user = await new UserFactory({}).create();

            const mostRecentParent = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work.com'],
                phone: '+32412345678',
                address: Address.create({
                    street: 'Main street 1',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012347',
                updatedAt: new Date(10_000),
            });

            const outOfDateParent = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda+oldest@work.com'],
                phone: '+32412345678',
                address: Address.create({
                    street: 'Main street 1',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012345',
                updatedAt: new Date(0),
                createdAt: new Date(0),
            });

            const outOfDateParent2 = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work.com'],
                phone: '+32412345678',
                address: Address.create({
                    street: 'Main street 1',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012345',
                updatedAt: new Date(1000),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    parents: [outOfDateParent],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    parents: [outOfDateParent2],
                }),
            }).create();

            // Parent3 was reviewed last, so has priority
            const member3 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Bob',
                    lastName: 'Doe',
                    parents: [mostRecentParent],
                }),
            }).create();

            // Now simulate a change to member1's parents, and check if all parents are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);

            const arr: Body = new PatchableArray();
            const parentsPatch = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
            parentsPatch.addPatch(
                Parent.patch({
                    id: outOfDateParent.id,
                    email: 'changed@example.com',
                }),
            );

            const patch = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    parents: parentsPatch,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load parents again
            await member1.refresh();
            await member2.refresh();
            await member3.refresh();

            // Check all parents equal
            const expectedParent = Parent.create({
                ...mostRecentParent,
                id: outOfDateParent.id, // the oldest parent id is use
                createdAt: outOfDateParent.createdAt,
                email: 'changed@example.com',
                alternativeEmails: [
                    'linda@work.com',
                    'linda+oldest@work.com',
                ],
            });

            expect(member1.details.parents).toEqual([expectedParent]);
            expect(member2.details.parents).toEqual([expectedParent]);
            expect(member3.details.parents).toEqual([expectedParent]);
        });

        test('Puts without updatedAt are handled correctly and applied to the most recent parent when merging', async () => {
            const user = await new UserFactory({}).create();

            const mostRecentParent = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work.com'],
                phone: '+32412345678',
                address: Address.create({
                    street: 'Main street 1',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012347',
                updatedAt: new Date(10_000),
            });

            const outOfDateParent = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda+oldest@work.com'],
                phone: '+32412345678',
                address: Address.create({
                    street: 'Main street 1',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012345',
                updatedAt: new Date(1000),
                createdAt: new Date(0),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    parents: [outOfDateParent],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    parents: [],
                }),
            }).create();

            // Parent3 was reviewed last, so has priority
            const member3 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Bob',
                    lastName: 'Doe',
                    parents: [mostRecentParent],
                }),
            }).create();

            // Now simulate a change to member1's parents, and check if all parents are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);

            const arr: Body = new PatchableArray();
            const parentsPatch = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
            const createdParent = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                updatedAt: new Date(0),
                email: 'changed@example.com',
                phone: '+3241111111',
                alternativeEmails: ['another-alternative-email@example.com'],
            });
            parentsPatch.addPut(createdParent);

            const patch = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    parents: parentsPatch,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load parents again
            await member1.refresh();
            await member2.refresh();
            await member3.refresh();

            // Check all parents equal
            const expectedParent = Parent.create({
                ...mostRecentParent,
                id: outOfDateParent.id, // the oldest parent id is use
                createdAt: outOfDateParent.createdAt,
                email: 'changed@example.com',
                phone: '+3241111111',
                alternativeEmails: [
                    'linda@work.com',
                    'linda+oldest@work.com',
                    'another-alternative-email@example.com',
                ],
            });

            expect(member1.details.parents).toEqual([expectedParent]);
            expect(member2.details.parents).toEqual([expectedParent]);
            expect(member3.details.parents).toEqual([expectedParent]);
        });

        test('Duplicate parents are merged in a family', async () => {
            const user = await new UserFactory({}).create();

            const parent1 = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work.com'],
                phone: '+32412345678',
                address: Address.create({
                    street: 'Main street 1',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012345',
                createdAt: new Date(0),
            });

            // Create two clones of this parent with a different ID
            const parent2 = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                createdAt: new Date(1000),
            });

            const parent3 = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work2.com'],
                phone: '+32412345679',
                address: Address.create({
                    street: 'Main street 2',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012348',
                createdAt: new Date(2000),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    parents: [parent1],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'parents',
                                reviewedAt: new Date(0),
                            }),
                        ],
                    }),
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    parents: [parent2],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'parents',
                                reviewedAt: new Date(1000),
                            }),
                        ],
                    }),
                }),
            }).create();

            // Parent3 was reviewed last, so has priority
            const member3 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Bob',
                    lastName: 'Doe',
                    parents: [parent3],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'parents',
                                reviewedAt: new Date(2000),
                            }),
                        ],
                    }),
                }),
            }).create();

            // Now simulate a change to member1's parents, and check if all parents are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);

            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
            nonEmtpyArray.addPatch(Parent.patch({
                id: parent1.id,
                // no changes
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member1.id,
                details: MemberDetails.patch({
                    parents: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load parents again
            await member1.refresh();
            await member2.refresh();
            await member3.refresh();

            // Check all parents equal
            const expectedParent = Parent.create({
                ...parent3,
                id: parent1.id, // the oldest parent id is use
                createdAt: parent1.createdAt,
                alternativeEmails: [
                    'linda@work2.com',
                    'linda@work.com',
                ],
            });

            expect(member1.details.parents).toEqual([expectedParent]);
            expect(member2.details.parents).toEqual([expectedParent]);
            expect(member3.details.parents).toEqual([expectedParent]);
        });

        test('Deleting a parent alternative email address is possible in a family if all parents have the same ID', async () => {
            const user = await new UserFactory({}).create();

            const parent1 = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work.com'],
                phone: '+32412345678',
                address: Address.create({
                    street: 'Main street 1',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012345',
            });

            // Create two clones of this parent with a different ID
            const parent2 = Parent.create({
                id: parent1.id,
                firstName: 'Linda',
                lastName: 'Doe',
            });

            const parent3 = Parent.create({
                id: parent1.id,
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work2.com'],
                phone: '+32412345679',
                address: Address.create({
                    street: 'Main street 2',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012348',
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    parents: [parent1],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'parents',
                                reviewedAt: new Date(0),
                            }),
                        ],
                    }),
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    parents: [parent2],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'parents',
                                reviewedAt: new Date(1000),
                            }),
                        ],
                    }),
                }),
            }).create();

            // Parent3 was reviewed last, so has priority
            const member3 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Bob',
                    lastName: 'Doe',
                    parents: [parent3],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'parents',
                                reviewedAt: new Date(2000),
                            }),
                        ],
                    }),
                }),
            }).create();

            // Now simulate a change to member1's parents, and check if all parents are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
            nonEmtpyArray.addPatch(Parent.patch({
                id: parent1.id,
                // no changes
            }));
            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member1.id,
                details: MemberDetails.patch({
                    parents: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load parents again
            await member1.refresh();
            await member2.refresh();
            await member3.refresh();

            // Check all parents equal
            const expectedParent = parent3.patch({
                createdAt: parent1.createdAt, // parent1 created at can be 1ms smaller, and oldest will be used
            });

            expect(member1.details.parents).toEqual([expectedParent]);
            expect(member2.details.parents).toEqual([expectedParent]);
            expect(member3.details.parents).toEqual([expectedParent]);
        });

        test('Deleting a parent address, NRN, phone or email is possible in a family if all parents have the same ID', async () => {
            const user = await new UserFactory({}).create();

            const parent1 = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work.com'],
                phone: '+32412345678',
                address: Address.create({
                    street: 'Main street 1',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012345',
                createdAt: new Date(0),
            });

            // Create two clones of this parent with a different ID
            const parent2 = Parent.create({
                id: parent1.id,
                firstName: 'Linda',
                lastName: 'Doe',
                createdAt: new Date(1000),
            });

            const parent3 = Parent.create({
                id: parent1.id,
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work2.com'],
                phone: '+32412345679',
                address: Address.create({
                    street: 'Main street 2',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012348',
                createdAt: new Date(3000),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    parents: [parent1],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'parents',
                                reviewedAt: new Date(0),
                            }),
                        ],
                    }),
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    parents: [parent2],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'parents',
                                reviewedAt: new Date(1000),
                            }),
                        ],
                    }),
                }),
            }).create();

            // Parent3 was reviewed last, so has priority
            const member3 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Bob',
                    lastName: 'Doe',
                    parents: [parent3],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'parents',
                                reviewedAt: new Date(2000),
                            }),
                        ],
                    }),
                }),
            }).create();

            // Now simulate a change to member1's parents, and check if all parents are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
            nonEmtpyArray.addPatch(Parent.patch({
                id: parent1.id,
                // no changes
            }));
            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    parents: nonEmtpyArray,
                    // Mark these parents as reviewed last, so it overrides all the same parents
                    reviewTimes: ReviewTimes.patch({
                        times: [
                            ReviewTime.create({
                                name: 'parents',
                                reviewedAt: new Date(),
                            }),
                        ],
                    }),
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load parents again
            await member1.refresh();
            await member2.refresh();
            await member3.refresh();

            // Check all parents equal
            const expectedParent = Parent.create({
                ...parent2,
                createdAt: parent1.createdAt, // the oldest one is used
            });

            expect(member1.details.parents).toEqual([expectedParent]);
            expect(member2.details.parents).toEqual([expectedParent]);
            expect(member3.details.parents).toEqual([expectedParent]);
        });

        test('When adding a new parent that is and old copy, the most recent copy is added instead', async () => {
            const user = await new UserFactory({}).create();

            /**
             * This one is the oldest and has been reviewed the most recent
             */
            const latestParent = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work2.com'],
                phone: '+32412345679',
                address: Address.create({
                    street: 'Main street 2',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012348',
                createdAt: new Date(3000),
                updatedAt: new Date(),
            });

            const oldestParent = Parent.create({
                id: latestParent.id,
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'ignored@example.com',
                createdAt: new Date(3000),
                updatedAt: new Date(10_000),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    parents: [latestParent],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    parents: [],
                }),
            }).create();

            // Now simulate a change to member1's contacts, and check if all contacts are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
            nonEmtpyArray.addPut(oldestParent);

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    parents: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();
            await member2.refresh();

            // The contact should be equal to contact1, and ignore other changes
            const expectedParent = Parent.create({
                ...latestParent,
            });

            expect(member1.details.parents).toEqual([expectedParent]);
            expect(member2.details.parents).toEqual([expectedParent]);
        });

        test('It is possible to change the name of a parent without setting updatedAt', async () => {
            const user = await new UserFactory({}).create();

            /**
             * This one is the oldest and has been reviewed the most recent
             */
            const latestParent = Parent.create({
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'linda@example.com',
                alternativeEmails: ['linda@work2.com'],
                phone: '+32412345679',
                address: Address.create({
                    street: 'Main street 2',
                    postalCode: '1000',
                    city: 'Brussels',
                    country: Country.Belgium,
                }),
                nationalRegisterNumber: '93042012348',
                createdAt: new Date(3000),
                updatedAt: new Date(),
            });

            const oldestParent = Parent.create({
                id: latestParent.id,
                firstName: 'Linda',
                lastName: 'Doe',
                email: 'ignored@example.com',
                createdAt: new Date(3000),
                updatedAt: new Date(10_000),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    parents: [latestParent],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    parents: [oldestParent],
                }),
            }).create();

            // Now simulate a change to member1's contacts, and check if all contacts are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
            nonEmtpyArray.addPatch(Parent.patch({
                id: latestParent.id,
                firstName: 'Linda2',
                lastName: 'Doe2',
                // Note that 'by accident' the frontend did not pass the updatedAt value correctly - this should still work as expected
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    parents: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();
            await member2.refresh();

            // The contact should be equal to contact1, and ignore other changes
            const expectedParent = Parent.create({
                ...latestParent,
                firstName: 'Linda2',
                lastName: 'Doe2',
            });

            expect(member1.details.parents).toEqual([expectedParent]);
            expect(member2.details.parents).toEqual([expectedParent]);
        });
    });

    describe('Emergency contacts', () => {
        test('Duplicate emergency contacts are merged in a family', async () => {
            const user = await new UserFactory({}).create();

            const contact1 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Grandmother',
                phone: '+32412345678',
                createdAt: new Date(0),
            });

            // Create two clones of this contact with a different ID
            const contact2 = EmergencyContact.create({
                name: 'Linda Doe',
                createdAt: new Date(2000),
            });

            const contact3 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Oma',
                phone: '+32412345679',
                createdAt: new Date(4000),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'emergencyContacts',
                                reviewedAt: new Date(0),
                            }),
                        ],
                    }),
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    emergencyContacts: [contact2],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'emergencyContacts',
                                reviewedAt: new Date(1000),
                            }),
                        ],
                    }),
                }),
            }).create();

            // Parent3 was reviewed last, so has priority
            const member3 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Bob',
                    lastName: 'Doe',
                    emergencyContacts: [contact3],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'emergencyContacts',
                                reviewedAt: new Date(2000),
                            }),
                        ],
                    }),
                }),
            }).create();

            // Now simulate a change to member1's contacts, and check if all contacts are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            nonEmtpyArray.addPatch(EmergencyContact.patch({
                id: contact1.id,
                // no changes
            }));
            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member1.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();
            await member2.refresh();
            await member3.refresh();

            // Check all contacts equal
            const expectedParent = EmergencyContact.create({
                ...contact3,
                id: contact1.id, // the oldest contact id is used
                createdAt: contact1.createdAt,
            });

            expect(member1.details.emergencyContacts).toEqual([expectedParent]);
            expect(member2.details.emergencyContacts).toEqual([expectedParent]);
            expect(member3.details.emergencyContacts).toEqual([expectedParent]);
        });

        test('Deleting a contact title and phone is possible in a family if all contacts have the same ID', async () => {
            const user = await new UserFactory({}).create();

            const contact1 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Grandmother',
                phone: '+32412345678',
            });

            // Create two clones of this contact with a different ID
            const contact2 = EmergencyContact.create({
                id: contact1.id,
                name: 'Linda Doe',
            });

            const contact3 = EmergencyContact.create({
                id: contact1.id,
                name: 'Linda Doe',
                title: 'Oma',
                phone: '+32412345679',
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'emergencyContacts',
                                reviewedAt: new Date(0),
                            }),
                        ],
                    }),
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    emergencyContacts: [contact2],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'emergencyContacts',
                                reviewedAt: new Date(1000),
                            }),
                        ],
                    }),
                }),
            }).create();

            // Parent3 was reviewed last, so has priority
            const member3 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Bob',
                    lastName: 'Doe',
                    emergencyContacts: [contact3],
                    reviewTimes: ReviewTimes.create({
                        times: [
                            ReviewTime.create({
                                name: 'emergencyContacts',
                                reviewedAt: new Date(2000),
                            }),
                        ],
                    }),
                }),
            }).create();

            // Now simulate a change to member1's contacts, and check if all contacts are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            nonEmtpyArray.addPatch(EmergencyContact.patch({
                id: contact1.id,
                // no changes
            }));
            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray,
                    // Mark these contacts as reviewed last, so it overrides all the same contacts
                    reviewTimes: ReviewTimes.patch({
                        times: [
                            ReviewTime.create({
                                name: 'emergencyContacts',
                                reviewedAt: new Date(),
                            }),
                        ],
                    }),
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();
            await member2.refresh();
            await member3.refresh();

            // Check all contacts equal
            const expectedParent = contact2.patch({ createdAt: contact1.createdAt }); // the oldest one is used

            expect(member1.details.emergencyContacts).toEqual([expectedParent]);
            expect(member2.details.emergencyContacts).toEqual([expectedParent]);
            expect(member3.details.emergencyContacts).toEqual([expectedParent]);
        });

        test('When adding a new emergency contact it is automatically merged with existing contacts', async () => {
            const user = await new UserFactory({}).create();

            const contact1 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Grandmother',
                phone: '+32412345678',
                createdAt: new Date(0),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    emergencyContacts: [],
                }),
            }).create();

            // Now simulate a change to member1's contacts, and check if all contacts are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            nonEmtpyArray.addPut(EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Oma',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();
            await member2.refresh();

            // Check all contacts equal
            const expectedParent = EmergencyContact.create({
                ...contact1,
                title: 'Oma',
            });

            expect(member1.details.emergencyContacts).toEqual([expectedParent]);
            expect(member2.details.emergencyContacts).toEqual([expectedParent]);
        });

        test('When adding a new emergency contact that is an old copy, the most recent copy is added instead', async () => {
            const user = await new UserFactory({}).create();

            /**
             * This one is the oldest and has been reviewed the most recent
             */
            const contact1 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Grandmother',
                phone: '+32412345678',
                createdAt: new Date(0),
                updatedAt: new Date(),
            });

            // The frontend for some reason got and old version of this contact
            const oldVersionContact = EmergencyContact.create({
                id: contact1.id,
                name: 'Linda Doe',
                title: 'Oma',
                phone: '+32412345676',
                createdAt: new Date(0),
                updatedAt: new Date(10_000), // This one is older
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    emergencyContacts: [],
                }),
            }).create();

            // Now simulate a change to member1's contacts, and check if all contacts are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            nonEmtpyArray.addPut(oldVersionContact);

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();
            await member2.refresh();

            // The contact should be equal to contact1, and ignore other changes
            const expectedParent = EmergencyContact.create({
                ...contact1,
            });

            expect(member1.details.emergencyContacts).toEqual([expectedParent]);
            expect(member2.details.emergencyContacts).toEqual([expectedParent]);
        });

        test('It is possible to change the name of an emergency contact without setting updatedAt', async () => {
            const user = await new UserFactory({}).create();

            /**
             * This one is the oldest and has been reviewed the most recent
             */
            const contact1 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Grandmother',
                phone: '+32412345678',
                createdAt: new Date(0),
                updatedAt: new Date(),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                }),
            }).create();

            // Now simulate a change to member1's contacts, and check if all contacts are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            nonEmtpyArray.addPatch(EmergencyContact.patch({
                id: contact1.id,
                name: 'Linda2 Doe2',
                // Note that 'by accident' the frontend did not pass the updatedAt value correctly - this should still work as expected
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();
            await member2.refresh();

            // The contact should be equal to contact1, and ignore other changes
            const expectedContact = EmergencyContact.create({
                ...contact1,
                name: 'Linda2 Doe2',
            });

            expect(member1.details.emergencyContacts).toEqual([expectedContact]);
            expect(member2.details.emergencyContacts).toEqual([expectedContact]);
        });

        test('It is possible to change the name of an emergency contact with setting updatedAt', async () => {
            const user = await new UserFactory({}).create();

            /**
             * This one is the oldest and has been reviewed the most recent
             */
            const contact1 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Grandmother',
                phone: '+32412345678',
                createdAt: new Date(0),
                updatedAt: new Date(Date.now() - 5_000),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                }),
            }).create();

            // Now simulate a change to member1's contacts, and check if all contacts are updated to the same id and details
            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            const d = new Date();
            nonEmtpyArray.addPatch(EmergencyContact.patch({
                id: contact1.id,
                name: 'Linda2 Doe2',
                title: 'Changed',
                updatedAt: d,
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();
            await member2.refresh();

            // The contact should be equal to contact1, and ignore other changes
            const expectedContact = EmergencyContact.create({
                ...contact1,
                name: 'Linda2 Doe2',
                title: 'Changed',
                updatedAt: d,
            });

            expect(member1.details.emergencyContacts).toEqual([expectedContact]);
            expect(member2.details.emergencyContacts).toEqual([expectedContact]);
        });

        test('Adding a completely new emergency contact works correctly', async () => {
            const user = await new UserFactory({}).create();

            const existing = EmergencyContact.create({
                name: 'Existing friend',
                title: 'Friend',
                phone: '+32412345111',
            });
            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [
                        existing,
                    ],
                }),
            }).create();

            const newContact = EmergencyContact.create({
                name: 'New Contact',
                title: 'Friend',
                phone: '+32412345670',
            });

            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            nonEmtpyArray.addPut(newContact);

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member1.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();

            // Check the new contact is added
            expect(member1.details.emergencyContacts).toEqual([
                existing,
                newContact,
            ]);
        });

        test('Updating an existing emergency contact\'s details works correctly', async () => {
            const user = await new UserFactory({}).create();

            const contact1 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Grandmother',
                phone: '+32412345678',
                createdAt: new Date(0),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                }),
            }).create();

            const updatedContact = EmergencyContact.patch({
                id: contact1.id,
                phone: '+32412345679',
            });

            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            nonEmtpyArray.addPatch(updatedContact);

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member1.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();

            // Check the contact is updated
            const expectedContact = EmergencyContact.create({
                ...contact1,
                phone: '+32412345679',
            });

            expect(member1.details.emergencyContacts).toEqual([expectedContact]);
        });

        test('Removing an emergency contact works correctly', async () => {
            const user = await new UserFactory({}).create();

            const contact1 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Grandmother',
                phone: '+32412345678',
                createdAt: new Date(0),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                }),
            }).create();

            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            nonEmtpyArray.addDelete(contact1.id);

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member1.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();

            // Check the contact is removed
            expect(member1.details.emergencyContacts).toEqual([]);
        });

        test('Handling multiple members with different emergency contacts works correctly', async () => {
            const user = await new UserFactory({}).create();

            const contact1 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Grandmother',
                phone: '+32412345678',
                createdAt: new Date(0),
            });

            const contact2 = EmergencyContact.create({
                name: 'John Doe',
                title: 'Uncle',
                phone: '+32412345679',
                createdAt: new Date(1000),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    emergencyContacts: [contact2],
                }),
            }).create();

            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray1 = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            nonEmtpyArray1.addPatch(EmergencyContact.patch({
                id: contact1.id,
                phone: '+32412345680',
            }));

            const nonEmtpyArray2 = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            nonEmtpyArray2.addPatch(EmergencyContact.patch({
                id: contact2.id,
                phone: '+32412345681',
            }));

            const arr: Body = new PatchableArray();
            const patch1 = MemberWithRegistrationsBlob.patch({
                id: member1.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray1,
                }),
            });
            const patch2 = MemberWithRegistrationsBlob.patch({
                id: member2.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray2,
                }),
            });
            arr.addPatch(patch1);
            arr.addPatch(patch2);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(2);

            // Load contacts again
            await member1.refresh();
            await member2.refresh();

            // Check the contacts are updated independently
            const expectedContact1 = EmergencyContact.create({
                ...contact1,
                phone: '+32412345680',
            });

            const expectedContact2 = EmergencyContact.create({
                ...contact2,
                phone: '+32412345681',
            });

            expect(member1.details.emergencyContacts).toEqual([expectedContact1]);
            expect(member2.details.emergencyContacts).toEqual([expectedContact2]);
        });

        test('Handling emergency contacts with different IDs but same details works correctly', async () => {
            const user = await new UserFactory({}).create();

            const contact1 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Grandmother',
                phone: '+32412345678',
                createdAt: new Date(0),
            });

            const contact2 = EmergencyContact.create({
                name: 'Linda Doe',
                title: 'Grandmother',
                phone: '+32412345678',
                createdAt: new Date(1000),
            });

            const member1 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    emergencyContacts: [contact1],
                }),
            }).create();

            const member2 = await new MemberFactory({
                user,
                details: MemberDetails.create({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    emergencyContacts: [contact2],
                }),
            }).create();

            const admin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const token = await Token.createToken(admin);
            const nonEmtpyArray = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
            nonEmtpyArray.addPatch(EmergencyContact.patch({
                id: contact1.id,
                phone: '+32412345679',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: member1.id,
                details: MemberDetails.patch({
                    emergencyContacts: nonEmtpyArray,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, undefined, arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(endpoint, request);

            // Check returned
            expect(response.status).toBe(200);
            expect(response.body.members.length).toBe(1);

            // Load contacts again
            await member1.refresh();
            await member2.refresh();

            // Check the contacts are updated correctly
            const expectedContact = EmergencyContact.create({
                ...contact1,
                phone: '+32412345679',
            });

            expect(member1.details.emergencyContacts).toEqual([expectedContact]);
            expect(member2.details.emergencyContacts).toEqual([expectedContact]);
        });
    });

    describe('Member', () => {
        describe('Uitpas number', () => {
            describe('PUT', () => {
                // todo: test to check social tariff is updated correctly

                test('Should not set socialTariff from request', async () => {
                    initUitpasApi();

                    const organization = await new OrganizationFactory({ }).create();

                    const user = await new UserFactory({
                        permissions: Permissions.create({ level: PermissionLevel.Full }),
                        organization, // since we are in platform mode, this will only set the permissions for this organization
                    }).create();

                    const token = await Token.createToken(user);

                    // patch uitpas number
                    const arr: Body = new PatchableArray();

                    const member = MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({
                            firstName,
                            lastName,
                            uitpasNumberDetails: UitpasNumberDetails.create({
                                // active number
                                uitpasNumber: '0900011354819',
                                socialTariff: UitpasSocialTariff.create({
                                    status: UitpasSocialTariffStatus.Active,
                                    endDate: new Date(2050, 0, 1),
                                    updatedAt: new Date(2040, 0, 1),
                                }),
                            }),
                        }),
                    });

                    arr.addPut(member);

                    const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                    request.headers.authorization = 'Bearer ' + token.accessToken;

                    const result = await testServer.test(endpoint, request);

                    expect(result.status).toBe(200);
                    expect(result.body.members.length).toBe(1);
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.status).toBe(UitpasSocialTariffStatus.Active);
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.endDate?.getTime()).not.toBe(new Date(2050, 0, 1).getTime());
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.updatedAt?.getTime()).not.toBe(new Date(2040, 0, 1).getTime());
                });
            });

            describe('PATCH', () => {
                test('Should update socialTariff if uitpasNumber changes', async () => {
                    initUitpasApi();

                    const organization = await new OrganizationFactory({ }).create();

                    const user = await new UserFactory({
                        permissions: Permissions.create({ level: PermissionLevel.Full }),
                        organization, // since we are in platform mode, this will only set the permissions for this organization
                    }).create();

                    const token = await Token.createToken(user);

                    // create member
                    const member = await new MemberFactory({
                        firstName,
                        lastName,
                        birthDay,
                        generateData: false,
                        // Give user access to this member
                        user,
                        details: MemberDetails.create({
                            uitpasNumberDetails: UitpasNumberDetails.create({
                                // expired
                                uitpasNumber: '0900000095902',
                                socialTariff: UitpasSocialTariff.create({
                                    status: UitpasSocialTariffStatus.None,
                                    updatedAt: new Date(2030, 0, 1),
                                }),
                            }),
                        }),
                    }).create();

                    // patch uitpas number
                    const arr: Body = new PatchableArray();

                    arr.addPatch(MemberWithRegistrationsBlob.patch({
                        id: member.id,
                        details: MemberDetails.patch({
                            uitpasNumberDetails: UitpasNumberDetails.patch({
                                // active
                                uitpasNumber: '0900011354819',
                            }),
                        }),
                    }));

                    const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                    request.headers.authorization = 'Bearer ' + token.accessToken;

                    const result = await testServer.test(endpoint, request);

                    expect(result.status).toBe(200);
                    expect(result.body.members.length).toBe(1);
                    expect(result.body.members[0].details.uitpasNumberDetails?.uitpasNumber).toEqual('0900011354819');
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Active);
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.updatedAt.getTime()).not.toEqual(new Date(2030, 0, 1).getTime());
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.endDate).toBeDate();
                });

                test('Should throw if invalid uitpas number', async () => {
                    initUitpasApi();

                    const organization = await new OrganizationFactory({ }).create();

                    const user = await new UserFactory({
                        permissions: Permissions.create({ level: PermissionLevel.Full }),
                        organization, // since we are in platform mode, this will only set the permissions for this organization
                    }).create();

                    const token = await Token.createToken(user);

                    // create member
                    const member = await new MemberFactory({
                        firstName,
                        lastName,
                        birthDay,
                        generateData: false,
                        // Give user access to this member
                        user,
                        details: MemberDetails.create({
                            uitpasNumberDetails: UitpasNumberDetails.create({
                                // expired
                                uitpasNumber: '0900000095902',
                                socialTariff: UitpasSocialTariff.create({
                                    status: UitpasSocialTariffStatus.None,
                                    updatedAt: new Date(2030, 0, 1),
                                }),
                            }),
                        }),
                    }).create();

                    // patch uitpas number
                    const arr: Body = new PatchableArray();

                    arr.addPatch(MemberWithRegistrationsBlob.patch({
                        id: member.id,
                        details: MemberDetails.patch({
                            uitpasNumberDetails: UitpasNumberDetails.patch({
                                // invalid (too short)
                                uitpasNumber: '094',
                            }),
                        }),
                    }));

                    const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                    request.headers.authorization = 'Bearer ' + token.accessToken;

                    await expect(testServer.test(endpoint, request))
                        .rejects
                        .toThrow(STExpect.errorWithCode('invalid_uitpas_number'));
                });

                describe('unknown uitpas number', () => {
                    test('Should throw if number changed', async () => {
                        initUitpasApi();

                        const organization = await new OrganizationFactory({ }).create();

                        const user = await new UserFactory({
                            permissions: Permissions.create({ level: PermissionLevel.Full }),
                            organization, // since we are in platform mode, this will only set the permissions for this organization
                        }).create();

                        const token = await Token.createToken(user);

                        // create member
                        const member = await new MemberFactory({
                            firstName,
                            lastName,
                            birthDay,
                            generateData: false,
                            // Give user access to this member
                            user,
                            details: MemberDetails.create({
                                uitpasNumberDetails: UitpasNumberDetails.create({
                                    // expired
                                    uitpasNumber: '0900000095902',
                                    socialTariff: UitpasSocialTariff.create({
                                        status: UitpasSocialTariffStatus.None,
                                        updatedAt: new Date(2030, 0, 1),
                                    }),
                                }),
                            }),
                        }).create();

                        // patch uitpas number
                        const arr: Body = new PatchableArray();

                        arr.addPatch(MemberWithRegistrationsBlob.patch({
                            id: member.id,
                            details: MemberDetails.patch({
                                uitpasNumberDetails: UitpasNumberDetails.patch({
                                    // unknown number
                                    uitpasNumber: '0900000095999',
                                }),
                            }),
                        }));

                        const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                        request.headers.authorization = 'Bearer ' + token.accessToken;

                        await expect(testServer.test(endpoint, request))
                            .rejects
                            .toThrow(STExpect.errorWithCode('https://api.publiq.be/probs/uitpas/pass-not-found'));
                    });

                    test('Should throw and set status to unknown if number did not change', async () => {
                        initUitpasApi();

                        const organization = await new OrganizationFactory({ }).create();

                        const user = await new UserFactory({
                            permissions: Permissions.create({ level: PermissionLevel.Full }),
                            organization, // since we are in platform mode, this will only set the permissions for this organization
                        }).create();

                        const token = await Token.createToken(user);

                        // create member
                        const member = await new MemberFactory({
                            firstName,
                            lastName,
                            birthDay,
                            generateData: false,
                            // Give user access to this member
                            user,
                            details: MemberDetails.create({
                                uitpasNumberDetails: UitpasNumberDetails.create({
                                    // unknown number
                                    uitpasNumber: '0900000095999',
                                    socialTariff: UitpasSocialTariff.create({
                                        status: UitpasSocialTariffStatus.None,
                                        updatedAt: new Date(2030, 0, 1),
                                    }),
                                }),
                            }),
                        }).create();

                        // patch uitpas number
                        const arr: Body = new PatchableArray();

                        arr.addPatch(MemberWithRegistrationsBlob.patch({
                            id: member.id,
                            details: MemberDetails.patch({
                                uitpasNumberDetails: UitpasNumberDetails.patch({
                                    // same unknown number
                                    uitpasNumber: '0900000095999',
                                }),
                            }),
                        }));

                        const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                        request.headers.authorization = 'Bearer ' + token.accessToken;

                        await expect(testServer.test(endpoint, request))
                            .rejects
                            .toThrow(STExpect.errorWithCode('https://api.publiq.be/probs/uitpas/pass-not-found'));

                        const updatedMember = await Member.getByID(member.id);
                        expect(updatedMember!.details.uitpasNumberDetails?.uitpasNumber).toEqual('0900000095999');
                        expect(updatedMember!.details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Unknown);
                        expect(updatedMember!.details.uitpasNumberDetails?.socialTariff?.updatedAt.getTime()).not.toEqual(new Date(2030, 0, 1).getTime());
                        expect(updatedMember!.details.uitpasNumberDetails?.socialTariff?.endDate).toBeNull();
                    });
                });

                describe('Should not set socialTariff from request', () => {
                    test('Only patch social tariff', async () => {
                        initUitpasApi();

                        const organization = await new OrganizationFactory({ }).create();

                        const user = await new UserFactory({
                            permissions: Permissions.create({ level: PermissionLevel.Full }),
                            organization, // since we are in platform mode, this will only set the permissions for this organization
                        }).create();

                        const token = await Token.createToken(user);

                        // create member
                        const member = await new MemberFactory({
                            firstName,
                            lastName,
                            birthDay,
                            generateData: false,
                            // Give user access to this member
                            user,
                            details: MemberDetails.create({
                                uitpasNumberDetails: UitpasNumberDetails.create({
                                    uitpasNumber: '0900000095902',
                                    socialTariff: UitpasSocialTariff.create({
                                        status: UitpasSocialTariffStatus.None,
                                        updatedAt: new Date(2000, 0, 1),
                                    }),
                                }),
                            }),
                        }).create();

                        // patch uitpas number
                        const arr: Body = new PatchableArray();

                        arr.addPatch(MemberWithRegistrationsBlob.patch({
                            id: member.id,
                            details: MemberDetails.patch({
                                uitpasNumberDetails: UitpasNumberDetails.patch({
                                    socialTariff: UitpasSocialTariff.create({
                                        status: UitpasSocialTariffStatus.Active,
                                        endDate: new Date(2050, 0, 1),
                                        updatedAt: new Date(2040, 0, 1),
                                    }),
                                }),
                            }),
                        }));

                        const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                        request.headers.authorization = 'Bearer ' + token.accessToken;

                        const result = await testServer.test(endpoint, request);

                        expect(result.status).toBe(200);
                        expect(result.body.members.length).toBe(1);
                        expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.None);
                        expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.updatedAt.getTime()).toEqual(new Date(2000, 0, 1).getTime());
                        expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.endDate).toBeNull();
                    });

                    test('New uitpas number', async () => {
                        initUitpasApi();

                        const organization = await new OrganizationFactory({ }).create();

                        const user = await new UserFactory({
                            permissions: Permissions.create({ level: PermissionLevel.Full }),
                            organization, // since we are in platform mode, this will only set the permissions for this organization
                        }).create();

                        const token = await Token.createToken(user);

                        // create member
                        const member = await new MemberFactory({
                            firstName,
                            lastName,
                            birthDay,
                            generateData: false,
                            // Give user access to this member
                            user,
                            details: MemberDetails.create({
                                uitpasNumberDetails: UitpasNumberDetails.create({
                                    socialTariff: UitpasSocialTariff.create({
                                        status: UitpasSocialTariffStatus.None,
                                        updatedAt: new Date(2000, 0, 1),
                                    }),
                                }),
                            }),
                        }).create();

                        // patch uitpas number
                        const arr: Body = new PatchableArray();

                        arr.addPatch(MemberWithRegistrationsBlob.patch({
                            id: member.id,
                            details: MemberDetails.patch({
                                uitpasNumberDetails: UitpasNumberDetails.patch({
                                    // expired
                                    uitpasNumber: '0900000031618',
                                    socialTariff: UitpasSocialTariff.create({
                                        status: UitpasSocialTariffStatus.Active,
                                        endDate: new Date(2050, 0, 1),
                                        updatedAt: new Date(2040, 0, 1),
                                    }),
                                }),
                            }),
                        }));

                        const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                        request.headers.authorization = 'Bearer ' + token.accessToken;

                        const result = await testServer.test(endpoint, request);

                        expect(result.status).toBe(200);
                        expect(result.body.members.length).toBe(1);
                        expect(result.body.members[0].details.uitpasNumberDetails?.uitpasNumber).toEqual('0900000031618');
                        expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Expired);
                        expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.updatedAt.getTime()).not.toEqual(new Date(2040, 0, 1).getTime());
                        expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.endDate?.getTime()).not.toEqual(new Date(2050, 0, 1).getTime());
                    });

                    test('Same uitpas number', async () => {
                        initUitpasApi();

                        const organization = await new OrganizationFactory({ }).create();

                        const user = await new UserFactory({
                            permissions: Permissions.create({ level: PermissionLevel.Full }),
                            organization, // since we are in platform mode, this will only set the permissions for this organization
                        }).create();

                        const token = await Token.createToken(user);

                        // create member
                        const member = await new MemberFactory({
                            firstName,
                            lastName,
                            birthDay,
                            generateData: false,
                            // Give user access to this member
                            user,
                            details: MemberDetails.create({
                                uitpasNumberDetails: UitpasNumberDetails.create({
                                    // expired
                                    uitpasNumber: '0900000031618',
                                    socialTariff: UitpasSocialTariff.create({
                                        status: UitpasSocialTariffStatus.None,
                                        updatedAt: new Date(2000, 0, 1),
                                    }),
                                }),
                            }),
                        }).create();

                        // patch uitpas number
                        const arr: Body = new PatchableArray();

                        arr.addPatch(MemberWithRegistrationsBlob.patch({
                            id: member.id,
                            details: MemberDetails.patch({
                                uitpasNumberDetails: UitpasNumberDetails.patch({
                                    // expired
                                    uitpasNumber: '0900000031618',
                                    socialTariff: UitpasSocialTariff.create({
                                        status: UitpasSocialTariffStatus.Active,
                                        endDate: new Date(2050, 0, 1),
                                        updatedAt: new Date(2040, 0, 1),
                                    }),
                                }),
                            }),
                        }));

                        const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                        request.headers.authorization = 'Bearer ' + token.accessToken;

                        const result = await testServer.test(endpoint, request);

                        expect(result.status).toBe(200);
                        expect(result.body.members.length).toBe(1);
                        expect(result.body.members[0].details.uitpasNumberDetails?.uitpasNumber).toEqual('0900000031618');
                        expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Expired);
                        expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.updatedAt.getTime()).not.toEqual(new Date(2000, 0, 1).getTime());
                        expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.updatedAt.getTime()).not.toEqual(new Date(2040, 0, 1).getTime());
                        expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.endDate?.getTime()).not.toEqual(new Date(2050, 0, 1).getTime());
                    });
                });

                test('Should not fail if uitpas api is down and number did not change', async () => {
                    const mocker = initUitpasApi();
                    mocker.forceFailure();

                    const organization = await new OrganizationFactory({ }).create();

                    const user = await new UserFactory({
                        permissions: Permissions.create({ level: PermissionLevel.Full }),
                        organization, // since we are in platform mode, this will only set the permissions for this organization
                    }).create();

                    const token = await Token.createToken(user);

                    // create member
                    const member = await new MemberFactory({
                        firstName,
                        lastName,
                        birthDay,
                        generateData: false,
                        // Give user access to this member
                        user,
                        details: MemberDetails.create({
                            uitpasNumberDetails: UitpasNumberDetails.create({
                                // active
                                uitpasNumber: '0900011354819',
                                socialTariff: UitpasSocialTariff.create({
                                    status: UitpasSocialTariffStatus.Active,
                                    updatedAt: new Date(2000, 0, 1),
                                    endDate: new Date(2050, 0, 1),
                                }),
                            }),
                        }),
                    }).create();

                    // patch uitpas number
                    const arr: Body = new PatchableArray();

                    arr.addPatch(MemberWithRegistrationsBlob.patch({
                        id: member.id,
                        details: MemberDetails.patch({
                            uitpasNumberDetails: UitpasNumberDetails.patch({
                                // same number
                                uitpasNumber: '0900011354819',
                            }),
                        }),
                    }));

                    const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                    request.headers.authorization = 'Bearer ' + token.accessToken;

                    const result = await testServer.test(endpoint, request);

                    expect(result.status).toBe(200);
                    expect(result.body.members.length).toBe(1);
                    expect(result.body.members[0].details.uitpasNumberDetails?.uitpasNumber).toEqual('0900011354819');
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Active);
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.updatedAt.getTime()).toEqual(new Date(2000, 0, 1).getTime());
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.endDate?.getTime()).toEqual(new Date(2050, 0, 1).getTime());
                });

                test('Should remove memberDetails if member details null', async () => {
                    const organization = await new OrganizationFactory({ }).create();

                    const user = await new UserFactory({
                        permissions: Permissions.create({ level: PermissionLevel.Full }),
                        organization, // since we are in platform mode, this will only set the permissions for this organization
                    }).create();

                    const token = await Token.createToken(user);

                    // create member
                    const member = await new MemberFactory({
                        firstName,
                        lastName,
                        birthDay,
                        generateData: false,
                        // Give user access to this member
                        user,
                        details: MemberDetails.create({
                            uitpasNumberDetails: UitpasNumberDetails.create({
                                // expired
                                uitpasNumber: '0900000095902',
                                socialTariff: UitpasSocialTariff.create({
                                    status: UitpasSocialTariffStatus.None,
                                    updatedAt: new Date(2030, 0, 1),
                                }),
                            }),
                        }),
                    }).create();

                    // patch uitpas number
                    const arr: Body = new PatchableArray();

                    arr.addPatch(MemberWithRegistrationsBlob.patch({
                        id: member.id,
                        details: MemberDetails.patch({
                            uitpasNumberDetails: null,
                        }),
                    }));

                    const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                    request.headers.authorization = 'Bearer ' + token.accessToken;

                    const result = await testServer.test(endpoint, request);

                    expect(result.status).toBe(200);
                    expect(result.body.members.length).toBe(1);
                    expect(result.body.members[0].details.uitpasNumberDetails).toBeNull();
                });

                test('Should update social tariff if uitpas review changed', async () => {
                    initUitpasApi();
                    const organization = await new OrganizationFactory({ }).create();

                    const user = await new UserFactory({
                        permissions: Permissions.create({ level: PermissionLevel.Full }),
                        organization, // since we are in platform mode, this will only set the permissions for this organization
                    }).create();

                    const token = await Token.createToken(user);

                    // create member
                    const member = await new MemberFactory({
                        firstName,
                        lastName,
                        birthDay,
                        generateData: false,
                        // Give user access to this member
                        user,
                        details: MemberDetails.create({
                            uitpasNumberDetails: UitpasNumberDetails.create({
                                // expired (but active on last check)
                                uitpasNumber: '0900000031618',
                                socialTariff: UitpasSocialTariff.create({
                                    status: UitpasSocialTariffStatus.Active,
                                    updatedAt: new Date(2020, 0, 1),
                                    endDate: new Date(2050, 0, 1),
                                }),
                            }),
                        }),
                    }).create();

                    // set uitpas review
                    member.details.reviewTimes.markReviewed('uitpasNumber', new Date(2020, 0, 1));
                    await member.save();

                    // patch uitpas number review
                    const arr: Body = new PatchableArray();

                    const timesClone = member.details.reviewTimes.clone();
                    timesClone.markReviewed('uitpasNumber', new Date(2020, 0, 2));

                    arr.addPatch(MemberWithRegistrationsBlob.patch({
                        id: member.id,
                        details: MemberDetails.patch({
                            reviewTimes: timesClone,
                        }),
                    }));

                    const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                    request.headers.authorization = 'Bearer ' + token.accessToken;

                    const result = await testServer.test(endpoint, request);

                    expect(result.status).toBe(200);
                    expect(result.body.members.length).toBe(1);
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Expired);
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.updatedAt.getTime()).not.toEqual(new Date(2020, 0, 1).getTime());
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.endDate?.getTime()).not.toEqual(new Date(2050, 0, 1).getTime());
                });

                test('Should update social tariff if uitpas review patched with same date', async () => {
                    initUitpasApi();
                    const organization = await new OrganizationFactory({ }).create();

                    const user = await new UserFactory({
                        permissions: Permissions.create({ level: PermissionLevel.Full }),
                        organization, // since we are in platform mode, this will only set the permissions for this organization
                    }).create();

                    const token = await Token.createToken(user);

                    // create member
                    const member = await new MemberFactory({
                        firstName,
                        lastName,
                        birthDay,
                        generateData: false,
                        // Give user access to this member
                        user,
                        details: MemberDetails.create({
                            uitpasNumberDetails: UitpasNumberDetails.create({
                                // expired (but active on last check)
                                uitpasNumber: '0900000031618',
                                socialTariff: UitpasSocialTariff.create({
                                    status: UitpasSocialTariffStatus.Active,
                                    updatedAt: new Date(2020, 0, 1),
                                    endDate: new Date(2050, 0, 1),
                                }),
                            }),
                        }),
                    }).create();

                    // set uitpas review
                    member.details.reviewTimes.markReviewed('uitpasNumber', new Date(2020, 0, 1));
                    await member.save();

                    // patch uitpas number review
                    const arr: Body = new PatchableArray();

                    const timesClone = member.details.reviewTimes.clone();
                    timesClone.markReviewed('uitpasNumber', new Date(2020, 0, 1));

                    arr.addPatch(MemberWithRegistrationsBlob.patch({
                        id: member.id,
                        details: MemberDetails.patch({
                            reviewTimes: timesClone,
                        }),
                    }));

                    const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
                    request.headers.authorization = 'Bearer ' + token.accessToken;

                    const result = await testServer.test(endpoint, request);

                    expect(result.status).toBe(200);
                    expect(result.body.members.length).toBe(1);
                    expect(result.body.members[0].details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Active);
                });
            });
        });
    });
});
