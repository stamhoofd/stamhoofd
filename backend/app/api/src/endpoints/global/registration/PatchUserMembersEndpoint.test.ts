import { Database } from '@simonbackx/simple-database';
import { PatchableArray, PatchMap } from '@simonbackx/simple-encoding';
import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { GroupFactory, Member, MemberFactory, OrganizationFactory, Platform, RegistrationFactory, Token, UserFactory } from '@stamhoofd/models';
import { MemberDetails, MemberWithRegistrationsBlob, OrganizationMetaData, OrganizationRecordsConfiguration, Parent, PatchAnswers, PermissionLevel, RecordCategory, RecordSettings, RecordTextAnswer, TranslatedString, UitpasNumberDetails, UitpasSocialTariff, UitpasSocialTariffStatus } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initUitpasApi } from '../../../../tests/init/index.js';
import { PatchUserMembersEndpoint } from './PatchUserMembersEndpoint.js';

const baseUrl = `/members`;
const endpoint = new PatchUserMembersEndpoint();
type EndpointType = typeof endpoint;
type Body = EndpointType extends Endpoint<any, any, infer B, any> ? B : never;

const firstName = 'John';
const lastName = 'Doe';
const birthDay = { year: 1993, month: 4, day: 5 };

describe('Endpoint.PatchUserMembersEndpoint', () => {
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
            const user = await new UserFactory({ }).create();
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
            const user = await new UserFactory({ }).create();
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
            const user = await new UserFactory({ organization }).create();
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

    describe('Record answers', () => {
        test('A user can save answers of records of an organization it has not yet registered for', async () => {
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

            const user = await new UserFactory({ }).create();
            const existingMember = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
                // Give user access to this member
                user,
            }).create();

            const token = await Token.createToken(user);

            const recordAnswers = new PatchMap() as PatchAnswers;

            recordAnswers.set(commentsRecord.id, RecordTextAnswer.create({
                settings: commentsRecord,
                value: 'Some comments',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: existingMember.id,
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
            const member = response.body.members[0];
            expect(member.details.recordAnswers.get(commentsRecord.id)).toMatchObject({
                value: 'Some comments',
            });
        });

        test('A user cannot save answers to organization read-only records', async () => {
            const commentsRecord = RecordSettings.create({
                name: TranslatedString.create('Opmerkingen'),
                externalPermissionLevel: PermissionLevel.Read,
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

            const user = await new UserFactory({ }).create();
            const existingMember = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
                // Give user access to this member
                user,
            }).create();

            const token = await Token.createToken(user);

            const recordAnswers = new PatchMap() as PatchAnswers;

            recordAnswers.set(commentsRecord.id, RecordTextAnswer.create({
                settings: commentsRecord,
                value: 'Some comments',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: existingMember.id,
                details: MemberDetails.patch({
                    recordAnswers,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        });

        test('A user can save answers of records of the platform', async () => {
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

            const user = await new UserFactory({ }).create();
            const existingMember = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
                // Give user access to this member
                user,
            }).create();

            const token = await Token.createToken(user);

            const recordAnswers = new PatchMap() as PatchAnswers;

            recordAnswers.set(commentsRecord.id, RecordTextAnswer.create({
                settings: commentsRecord,
                value: 'Some comments',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: existingMember.id,
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
            const member = response.body.members[0];
            expect(member.details.recordAnswers.get(commentsRecord.id)).toMatchObject({
                value: 'Some comments',
            });
        });

        test('A user cannot save answers to platform read-only records', async () => {
            const commentsRecord = RecordSettings.create({
                name: TranslatedString.create('Opmerkingen'),
                externalPermissionLevel: PermissionLevel.Read,
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

            const user = await new UserFactory({ }).create();
            const existingMember = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
                // Give user access to this member
                user,
            }).create();

            const token = await Token.createToken(user);

            const recordAnswers = new PatchMap() as PatchAnswers;

            recordAnswers.set(commentsRecord.id, RecordTextAnswer.create({
                settings: commentsRecord,
                value: 'Some comments',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: existingMember.id,
                details: MemberDetails.patch({
                    recordAnswers,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        });

        test('A user can not save anwers to inexisting records', async () => {
            const commentsRecord = RecordSettings.create({
                name: TranslatedString.create('Opmerkingen'),
            });

            const organization = await new OrganizationFactory({
                meta: OrganizationMetaData.create({
                    recordsConfiguration: OrganizationRecordsConfiguration.create({
                        recordCategories: [],
                    }),
                }),
            }).create();

            const user = await new UserFactory({ }).create();
            const existingMember = await new MemberFactory({
                firstName,
                lastName,
                birthDay,
                generateData: false,
                // Give user access to this member
                user,
            }).create();

            const token = await Token.createToken(user);

            const recordAnswers = new PatchMap() as PatchAnswers;

            recordAnswers.set(commentsRecord.id, RecordTextAnswer.create({
                settings: commentsRecord,
                value: 'Some comments',
            }));

            const arr: Body = new PatchableArray();
            const patch = MemberWithRegistrationsBlob.patch({
                id: existingMember.id,
                details: MemberDetails.patch({
                    recordAnswers,
                }),
            });
            arr.addPatch(patch);

            const request = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
            request.headers.authorization = 'Bearer ' + token.accessToken;
            await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        });
    });

    describe('Uitpas number', () => {
        describe('PUT', () => {
            test('Should not set socialTariff from request', async () => {
                initUitpasApi();

                const user = await new UserFactory({ }).create();

                const token = await Token.createToken(user);

                const organization = await new OrganizationFactory({}).create();

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
                                status: UitpasSocialTariffStatus.None,
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

                const user = await new UserFactory({ }).create();

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

                const user = await new UserFactory({ }).create();

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

                    const user = await new UserFactory({ }).create();

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
                        .toThrow(STExpect.errorWithCode('unknown_uitpas_number'));
                });

                test('Should throw and set status to unknown if number did not change', async () => {
                    initUitpasApi();

                    const organization = await new OrganizationFactory({ }).create();

                    const user = await new UserFactory({ }).create();

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
                        .toThrow(STExpect.errorWithCode('unknown_uitpas_number'));

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

                    const user = await new UserFactory({ }).create();

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

                    const user = await new UserFactory({ }).create();

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

                    const user = await new UserFactory({ }).create();

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

                const user = await new UserFactory({ }).create();

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

                const user = await new UserFactory({ }).create();

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

                const user = await new UserFactory({ }).create();

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

                const user = await new UserFactory({ }).create();

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
