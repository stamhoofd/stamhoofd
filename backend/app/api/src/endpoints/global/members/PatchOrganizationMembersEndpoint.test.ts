import { Database } from '@simonbackx/simple-database';
import { PatchableArray, PatchMap } from '@simonbackx/simple-encoding';
import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { GroupFactory, MemberFactory, OrganizationFactory, OrganizationTagFactory, Platform, RegistrationFactory, Token, UserFactory } from '@stamhoofd/models';
import { MemberDetails, MemberWithRegistrationsBlob, OrganizationMetaData, OrganizationRecordsConfiguration, Parent, PatchAnswers, PermissionLevel, Permissions, PermissionsResourceType, RecordCategory, RecordSettings, RecordTextAnswer, ResourcePermissions, UserPermissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer';
import { PatchOrganizationMembersEndpoint } from './PatchOrganizationMembersEndpoint';

const baseUrl = `/organization/members`;
const endpoint = new PatchOrganizationMembersEndpoint();
type EndpointType = typeof endpoint;
type Body = EndpointType extends Endpoint<any, any, infer B, any> ? B : never;

const firstName = 'John';
const lastName = 'Doe';
const birthDay = { year: 1993, month: 4, day: 5 };

const errorWithCode = (code: string) => expect.objectContaining({ code }) as jest.Constructable;

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
                .toThrow(errorWithCode('known_member_missing_rights'));
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
            const put = MemberWithRegistrationsBlob.create({
                details: MemberDetails.create({
                    firstName,
                    lastName,
                    birthDay: new Date(existingMember.details.birthDay!.getTime() + 1),
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
            expect(member.details.birthDay).toEqual(existingMember.details.birthDay);
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
            const put = MemberWithRegistrationsBlob.create({
                details: MemberDetails.create({
                    firstName,
                    lastName,
                    birthDay: new Date(existingMember.details.birthDay!.getTime() + 1),
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
            expect(member.details.birthDay).toEqual(existingMember.details.birthDay);
            expect(member.details.email).toBe('original@example.com'); // this has been merged
            expect(member.details.alternativeEmails).toEqual(['anewemail@example.com']); // this has been merged

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
            await expect(testServer.test(endpoint, request)).rejects.toThrow(errorWithCode('not_found'));
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
                name: 'Opmerkingen',
                externalPermissionLevel: PermissionLevel.Read, // this should be ignored since we are an admin
            });

            const recordCategory = RecordCategory.create({
                name: 'Medische fiche',
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
                name: 'Opmerkingen',
            });

            const recordCategory = RecordCategory.create({
                name: 'Medische fiche',
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
            await expect(testServer.test(endpoint, request)).rejects.toThrow(errorWithCode('permission_denied'));
        });

        test('An admin without record category permission cannot set the records in that category', async () => {
            const commentsRecord = RecordSettings.create({
                name: 'Opmerkingen',
            });

            const recordCategory = RecordCategory.create({
                name: 'Medische fiche',
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
            await expect(testServer.test(endpoint, request)).rejects.toThrow(errorWithCode('permission_denied'));
        });

        test('An admin can set records of the platform', async () => {
            const commentsRecord = RecordSettings.create({
                name: 'Opmerkingen',
            });

            const recordCategory = RecordCategory.create({
                name: 'Medische fiche',
                records: [
                    commentsRecord,
                ],
            });

            const platform = await Platform.getShared();
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
                name: 'Opmerkingen',
            });

            const recordCategory = RecordCategory.create({
                name: 'Medische fiche',
                records: [
                    commentsRecord,
                ],
            });

            const platform = await Platform.getShared();
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
});
