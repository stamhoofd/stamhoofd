import { File, MemberDetails, MemberWithRegistrationsBlob, RecordCategory, RecordFileAnswer, RecordSettings, RecordType, TranslatedString, Version } from '@stamhoofd/structures';

import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import { Member, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { PatchUserMembersEndpoint } from '../../src/endpoints/global/registration/PatchUserMembersEndpoint.js';
import { testServer } from '../helpers/TestServer.js';
import { GetUserMembersEndpoint } from '../../src/endpoints/global/registration/GetUserMembersEndpoint.js';
import { FileSignService } from '../../src/services/FileSignService.js';

const baseUrl = `/v${Version}/members`;
const endpoint = new PatchUserMembersEndpoint();
const getMembersEndpoint = new GetUserMembersEndpoint();

describe('E2E.PrivateFiles', () => {
    const recordSettings = RecordSettings.create({
        id: 'test',
        name: TranslatedString.create('Bestand test'),
        type: RecordType.File,
    });

    async function createOrganization() {
        const organization = await new OrganizationFactory({}).create();

        // Add record settings type
        const category = RecordCategory.create({
            name: TranslatedString.create('Voorbeeld'),
            defaultEnabled: true,
            records: [
                recordSettings,
            ],
        });

        organization.meta.recordsConfiguration.recordCategories = [category];
        await organization.save();

        return organization;
    }

    test('Cannot set unsigned private files', async () => {
        const organization = await createOrganization();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await Token.createToken(user);

        // Create a user member
        const member = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
            }),
        });

        // A malicious user could try to set a private file to a member in order to get
        // access to the signed URL. This should not be possible without a valid signature
        const privateFile = new File({
            id: 'test',
            server: 'test.com',
            path: 'test.txt',
            size: 100,
            isPrivate: true,
        });

        member.details.recordAnswers.set(recordSettings.id, RecordFileAnswer.create({
            file: privateFile,
            settings: recordSettings,
        }));

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        arr.addPut(member);

        const r = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/Missing signature for private file/);
    });

    test('Cannot set private files with invalid signatures', async () => {
        const organization = await createOrganization();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await Token.createToken(user);

        // Create a user member
        const member = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
            }),
        });

        // A malicious user could try to set a private file to a member in order to get
        // access to the signed URL. This should not be possible without a valid signature
        const privateFile = new File({
            id: 'test',
            server: 'test.com',
            path: 'test.txt',
            size: 100,
            isPrivate: true,
            signature: 'invalid',
        });

        member.details.recordAnswers.set(recordSettings.id, RecordFileAnswer.create({
            file: privateFile,
            settings: recordSettings,
        }));

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        arr.addPut(member);

        const r = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/Invalid signature for file/);
    });

    test('Can set signed private files', async () => {
        const organization = await createOrganization();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await Token.createToken(user);

        // Create a user member
        const member = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
            }),
        });

        // A malicious user could try to set a private file to a member in order to get
        // access to the signed URL. This should not be possible without a valid signature
        const privateFile = new File({
            id: 'test',
            server: 'test.com',
            path: 'test.txt',
            size: 100,
            isPrivate: true,
        });
        await privateFile.sign();

        member.details.recordAnswers.set(recordSettings.id, RecordFileAnswer.create({
            file: privateFile,
            settings: recordSettings,
        }));

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        arr.addPut(member);

        const r = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        // Check file has a signed URL in the response
        const memberStruct = response.body.members[0];
        const answer = memberStruct.details.recordAnswers.get(recordSettings.id);
        if (!answer) {
            // eslint-disable-next-line jest/no-conditional-expect
            expect(memberStruct.details.recordAnswers).toHaveProperty(recordSettings.id);
            throw new Error('Unexpected: Answer is not defined');
        }

        if (!(answer instanceof RecordFileAnswer)) {
            throw new Error('Unexpected: Answer is not a RecordFileAnswer');
        }

        expect(answer.file).toBeDefined();
        expect(answer.file!.isPrivate).toBe(true);
        expect(answer.file!.signature).toBeTruthy();
        expect(answer.file!.signedUrl).toBeTruthy();
    });

    test('Can set public files', async () => {
        const organization = await createOrganization();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await Token.createToken(user);

        // Create a user member
        const member = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
            }),
        });

        // A malicious user could try to set a private file to a member in order to get
        // access to the signed URL. This should not be possible without a valid signature
        const publicFile = new File({
            id: 'test',
            server: 'test.com',
            path: 'test.txt',
            size: 100,
            isPrivate: false,
        });

        member.details.recordAnswers.set(recordSettings.id, RecordFileAnswer.create({
            file: publicFile,
            settings: recordSettings,
        }));

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        arr.addPut(member);

        const r = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        // Check file has not signed URL
        const memberStruct = response.body.members[0];
        const answer = memberStruct.details.recordAnswers.get(recordSettings.id);
        if (!answer) {
            // eslint-disable-next-line jest/no-conditional-expect
            expect(memberStruct.details.recordAnswers).toHaveProperty(recordSettings.id);
            throw new Error('Unexpected: Answer is not defined');
        }

        if (!(answer instanceof RecordFileAnswer)) {
            throw new Error('Unexpected: Answer is not a RecordFileAnswer');
        }

        expect(answer.file).toBeDefined();
        expect(answer.file!.isPrivate).toBe(false);
        expect(answer.file!.signature).toBeFalsy();
        expect(answer.file!.signedUrl).toBeFalsy();
    });

    /**
     * Tests that when an unverified file is stored on the server (in case someone managed to bypass upload security),
     * the server will never generate a signed URL for it.
     */
    test('Does not generate signed urls for unverifiable files', async () => {
        const organization = await createOrganization();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await Token.createToken(user);

        // Create a user member
        const member = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
            }),
        });

        // A malicious user could try to set a private file to a member in order to get
        // access to the signed URL. This should not be possible without a valid signature
        const maliciousFile = new File({
            id: 'test',
            server: 'test.com',
            path: 'test.txt',
            size: 100,
            isPrivate: true,
            signature: 'invalid',
        });

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        arr.addPut(member);

        const r = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        const memberId = response.body.members[0].id;

        // Do a direct change in the database to simulate a file that was uploaded without a signature
        const model = await Member.getByID(memberId);
        if (!model) {
            throw new Error('Member not found');
        }

        model.details.recordAnswers.set(recordSettings.id, RecordFileAnswer.create({
            file: maliciousFile,
            settings: recordSettings,
        }));

        await model.save();

        // Now try to fetch the member again using the API
        const r2 = Request.buildJson('GET', '/user/members', organization.getApiHost());
        r2.headers.authorization = 'Bearer ' + token.accessToken;

        const response2 = await testServer.test(getMembersEndpoint, r2);
        expect(response2.body).toBeDefined();

        // Check file has not signed URL
        const memberStruct = response2.body.members[0];
        const answer = memberStruct.details.recordAnswers.get(recordSettings.id);
        if (!answer) {
            throw new Error('Unexpected: Answer is not defined but expected');
        }

        if (!(answer instanceof RecordFileAnswer)) {
            throw new Error('Unexpected: Answer is not a RecordFileAnswer');
        }

        expect(answer.file).toBeDefined();
        expect(answer.file!.isPrivate).toBe(true);
        expect(answer.file!.signedUrl).toBeFalsy();
    });

    /**
     * Tests that when an verified file is stored on the server with a signed url, the server will never return that signed url.
     */
    test('Does not return stored signed urls from database', async () => {
        const organization = await createOrganization();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await Token.createToken(user);

        // Create a user member
        const member = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
            }),
        });

        // A malicious user could try to set a private file to a member in order to get
        // access to the signed URL. This should not be possible without a valid signature
        const maliciousFile = new File({
            id: 'test',
            server: 'test.com',
            path: 'test.txt',
            size: 100,
            isPrivate: true,
        });

        await maliciousFile.sign();
        maliciousFile.signedUrl = 'https://test.com/test.exe';

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        arr.addPut(member);

        const r = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        const memberId = response.body.members[0].id;

        // Do a direct change in the database to simulate a file that was uploaded without a signature
        const model = await Member.getByID(memberId);
        if (!model) {
            throw new Error('Member not found');
        }

        model.details.recordAnswers.set(recordSettings.id, RecordFileAnswer.create({
            file: maliciousFile,
            settings: recordSettings,
        }));

        await model.save();

        // Now try to fetch the member again using the API
        const r2 = Request.buildJson('GET', '/user/members', organization.getApiHost());
        r2.headers.authorization = 'Bearer ' + token.accessToken;

        const response2 = await testServer.test(getMembersEndpoint, r2);
        expect(response2.body).toBeDefined();

        // Check file has not signed URL
        const memberStruct = response2.body.members[0];
        const answer = memberStruct.details.recordAnswers.get(recordSettings.id);
        if (!answer) {
            throw new Error('Unexpected: Answer is not defined but expected');
        }

        if (!(answer instanceof RecordFileAnswer)) {
            throw new Error('Unexpected: Answer is not a RecordFileAnswer');
        }

        expect(answer.file).toBeDefined();
        expect(answer.file!.isPrivate).toBe(true);
        expect(answer.file!.signedUrl).toBeString();
        expect(answer.file!.signedUrl).not.toEqual('https://test.com/test.exe'); // It got replaced with a proper signed url
    });

    describe('fillSignedUrlsForStruct', () => {
        test('Can handle circular references', async () => {
            // A malicious user could try to set a private file to a member in order to get
            // access to the signed URL. This should not be possible without a valid signature
            const privateFile = new File({
                id: 'test',
                server: 'test.com',
                path: 'test.txt',
                size: 100,
                isPrivate: true,
            });
            await privateFile.sign();

            const data = {
                hello: 'true',
                world: 'false',
                circular: {
                    data: {
                        here: null as any,
                    },
                    file: privateFile,
                },
            };

            data.circular.data.here = data;

            await FileSignService.fillSignedUrlsForStruct(data);
            expect(data.circular.file.signedUrl).toBeString();
        });

        test('Can handle duplicate files', async () => {
            // A malicious user could try to set a private file to a member in order to get
            // access to the signed URL. This should not be possible without a valid signature
            const privateFile = new File({
                id: 'test',
                server: 'test.com',
                path: 'test.txt',
                size: 100,
                isPrivate: true,
            });
            await privateFile.sign();

            const data = {
                hello: 'true',
                world: 'false',
                circular: {
                    file1: privateFile,
                    file2: privateFile,
                },
                arr: [
                    privateFile,
                    privateFile,
                ],
            };

            await FileSignService.fillSignedUrlsForStruct(data);
            expect(data.circular.file1.signedUrl).toBeString();
            expect(data.circular.file2.signedUrl).toBeString();
            expect(data.arr[0].signedUrl).toBeString();
            expect(data.arr[1].signedUrl).toBeString();
        });
    });

    describe('verifyFilesInStruct', () => {
        test('Can handle circular references that are properly signed', async () => {
            // A malicious user could try to set a private file to a member in order to get
            // access to the signed URL. This should not be possible without a valid signature
            const privateFile = new File({
                id: 'test',
                server: 'test.com',
                path: 'test.txt',
                size: 100,
                isPrivate: true,
            });
            await privateFile.sign();

            const data = {
                hello: 'true',
                world: 'false',
                circular: {
                    data: {
                        here: null as any,
                    },
                    file: privateFile,
                },
            };

            data.circular.data.here = data;

            await expect(FileSignService.verifyFilesInStruct(data)).toResolve();
        });

        test('Can handle duplicate files that are properly signed', async () => {
            // A malicious user could try to set a private file to a member in order to get
            // access to the signed URL. This should not be possible without a valid signature
            const privateFile = new File({
                id: 'test',
                server: 'test.com',
                path: 'test.txt',
                size: 100,
                isPrivate: true,
            });
            await privateFile.sign();

            const data = {
                hello: 'true',
                world: 'false',
                circular: {
                    file1: privateFile,
                    file2: privateFile,
                },
                arr: [
                    privateFile,
                    privateFile,
                ],
            };

            await expect(FileSignService.verifyFilesInStruct(data)).toResolve();
        });

        test('Can handle circular references with files that are not signed', async () => {
            // A malicious user could try to set a private file to a member in order to get
            // access to the signed URL. This should not be possible without a valid signature
            const privateFile = new File({
                id: 'test',
                server: 'test.com',
                path: 'test.txt',
                size: 100,
                isPrivate: true,
            });

            const data = {
                hello: 'true',
                world: 'false',
                circular: {
                    data: {
                        here: null as any,
                    },
                    file: privateFile,
                },
            };

            data.circular.data.here = data;

            await expect(FileSignService.verifyFilesInStruct(data)).rejects.toThrow(/Invalid signature for file/);
        });

        test('Can handle duplicate files that are not signed', async () => {
            // A malicious user could try to set a private file to a member in order to get
            // access to the signed URL. This should not be possible without a valid signature
            const privateFile = new File({
                id: 'test',
                server: 'test.com',
                path: 'test.txt',
                size: 100,
                isPrivate: true,
            });

            const data = {
                hello: 'true',
                world: 'false',
                circular: {
                    file1: privateFile,
                    file2: privateFile,
                },
                arr: [
                    privateFile,
                    privateFile,
                ],
            };

            await expect(FileSignService.verifyFilesInStruct(data)).rejects.toThrow(/Invalid signature for file/);
        });
    });

    /**
     * Tests that when an unverified file is stored on the server with a signed url, the server will never return that signed url.
     */
    test('Does not return stored signed urls from database for unverified files', async () => {
        const organization = await createOrganization();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await Token.createToken(user);

        // Create a user member
        const member = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
            }),
        });

        // A malicious user could try to set a private file to a member in order to get
        // access to the signed URL. This should not be possible without a valid signature
        const maliciousFile = new File({
            id: 'test',
            server: 'test.com',
            path: 'test.txt',
            size: 100,
            isPrivate: true,
            signature: 'invalid',
        });

        maliciousFile.signedUrl = 'https://test.com/test.exe';

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        arr.addPut(member);

        const r = Request.buildJson('PATCH', baseUrl, organization.getApiHost(), arr);
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        const memberId = response.body.members[0].id;

        // Do a direct change in the database to simulate a file that was uploaded without a signature
        const model = await Member.getByID(memberId);
        if (!model) {
            throw new Error('Member not found');
        }

        model.details.recordAnswers.set(recordSettings.id, RecordFileAnswer.create({
            file: maliciousFile,
            settings: recordSettings,
        }));

        await model.save();

        // Now try to fetch the member again using the API
        const r2 = Request.buildJson('GET', '/user/members', organization.getApiHost());
        r2.headers.authorization = 'Bearer ' + token.accessToken;

        const response2 = await testServer.test(getMembersEndpoint, r2);
        expect(response2.body).toBeDefined();

        // Check file has not signed URL
        const memberStruct = response2.body.members[0];
        const answer = memberStruct.details.recordAnswers.get(recordSettings.id);
        if (!answer) {
            throw new Error('Unexpected: Answer is not defined but expected');
        }

        if (!(answer instanceof RecordFileAnswer)) {
            throw new Error('Unexpected: Answer is not a RecordFileAnswer');
        }

        expect(answer.file).toBeDefined();
        expect(answer.file!.isPrivate).toBe(true);
        expect(answer.file!.signedUrl).toBeNull();
    });
});
