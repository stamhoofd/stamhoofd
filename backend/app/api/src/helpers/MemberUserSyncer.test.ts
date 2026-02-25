import { Database } from '@simonbackx/simple-database';
import { Member, MemberFactory, MemberResponsibilityRecordFactory, User, UserFactory } from '@stamhoofd/models';
import { BooleanStatus, MemberDetails, Parent, UserPermissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { MemberUserSyncer } from './MemberUserSyncer.js';

describe('Helpers.MemberUserSyncer', () => {
    beforeEach(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
    });

    afterEach(async () => {
        await Database.delete('DELETE FROM users');
        await Database.delete('DELETE FROM members');
    });

    test('Each email, parent and unverified email receives an account', async () => {
        const member = await new MemberFactory({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                parents: [
                    Parent.create({
                        firstName: 'Linda',
                        lastName: 'Potter',
                        email: 'linda@example.com',
                    }),
                    Parent.create({
                        firstName: 'Peter',
                        lastName: 'Doe',
                        email: 'peter@example.com',
                        alternativeEmails: [
                            'peter@work.com',
                        ],
                    }),
                ],
                email: 'john@example.com',
                alternativeEmails: ['john@work.com'],
                unverifiedEmails: ['untitled@example.com', 'peter@example.com'], // Last one should be ignored
            }),
        }).create();

        await MemberUserSyncer.onChangeMember(member);

        const users = await Member.users.load(member);
        expect(users).toIncludeSameMembers([
            // Member
            expect.objectContaining({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                memberId: member.id,
            }),
            expect.objectContaining({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@work.com',
                memberId: member.id,
            }),

            // Parents
            expect.objectContaining({
                firstName: 'Linda',
                lastName: 'Potter',
                email: 'linda@example.com',
                memberId: null,
                permissions: null,
            }),
            expect.objectContaining({
                firstName: 'Peter',
                lastName: 'Doe',
                email: 'peter@example.com',
                memberId: null,
                permissions: null,
            }),
            expect.objectContaining({
                firstName: 'Peter',
                lastName: 'Doe',
                email: 'peter@work.com',
                memberId: null,
                permissions: null,
            }),

            // Unverified
            expect.objectContaining({
                firstName: null,
                lastName: null,
                email: 'untitled@example.com',
                memberId: null,
                permissions: null,
            }),
        ]);
    });

    test('Parents do not get access by default for adult members', async () => {
        const member = await new MemberFactory({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 366 * 18), // 18 years old + compensation for leap years
                parents: [
                    Parent.create({
                        firstName: 'Linda',
                        lastName: 'Potter',
                        email: 'linda@example.com',
                    }),
                    Parent.create({
                        firstName: 'Peter',
                        lastName: 'Doe',
                        email: 'peter@example.com',
                        alternativeEmails: [
                            'peter@work.com',
                        ],
                    }),
                ],
                email: 'john@example.com',
                alternativeEmails: ['john@work.com'],
                unverifiedEmails: ['untitled@example.com', 'peter@example.com'], // Last one should be ignored
            }),
        }).create();

        await MemberUserSyncer.onChangeMember(member);

        const users = await Member.users.load(member);
        expect(users).toIncludeSameMembers([
            // Member
            expect.objectContaining({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                memberId: member.id,
            }),
            expect.objectContaining({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@work.com',
                memberId: member.id,
            }),

            // Unverified
            expect.objectContaining({
                firstName: null,
                lastName: null,
                email: 'untitled@example.com',
                memberId: null,
                permissions: null,
            }),
        ]);
    });

    test('Parents can get access for adult members if explicitly set', async () => {
        const member = await new MemberFactory({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 366 * 18), // 18 years old + compensation for leap years
                parentsHaveAccess: BooleanStatus.create({ value: true }),
                parents: [
                    Parent.create({
                        firstName: 'Linda',
                        lastName: 'Potter',
                        email: 'linda@example.com',
                    }),
                    Parent.create({
                        firstName: 'Peter',
                        lastName: 'Doe',
                        email: 'peter@example.com',
                        alternativeEmails: [
                            'peter@work.com',
                        ],
                    }),
                ],
                email: 'john@example.com',
                alternativeEmails: ['john@work.com'],
                unverifiedEmails: ['untitled@example.com', 'peter@example.com'], // Last one should be ignored
            }),
        }).create();

        await MemberUserSyncer.onChangeMember(member);

        const users = await Member.users.load(member);
        expect(users).toIncludeSameMembers([
            // Member
            expect.objectContaining({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                memberId: member.id,
            }),
            expect.objectContaining({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@work.com',
                memberId: member.id,
            }),

            // Parents
            expect.objectContaining({
                firstName: 'Linda',
                lastName: 'Potter',
                email: 'linda@example.com',
                memberId: null,
                permissions: null,
            }),
            expect.objectContaining({
                firstName: 'Peter',
                lastName: 'Doe',
                email: 'peter@example.com',
                memberId: null,
                permissions: null,
            }),
            expect.objectContaining({
                firstName: 'Peter',
                lastName: 'Doe',
                email: 'peter@work.com',
                memberId: null,
                permissions: null,
            }),

            // Unverified
            expect.objectContaining({
                firstName: null,
                lastName: null,
                email: 'untitled@example.com',
                memberId: null,
                permissions: null,
            }),
        ]);
    });

    test('Existing users are updated with a member id and name', async () => {
        const user_m1 = await new UserFactory({ email: 'john@example.com' }).create();
        const user_m2 = await new UserFactory({ email: 'john@work.com' }).create();
        const user_p1 = await new UserFactory({ email: 'linda@example.com' }).create();
        const user_p2a = await new UserFactory({ email: 'peter@example.com' }).create();
        const user_p2b = await new UserFactory({ email: 'peter@work.com' }).create();
        const user_unverified = await new UserFactory({ email: 'untitled@example.com' }).create();

        const member = await new MemberFactory({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                parents: [
                    Parent.create({
                        firstName: 'Linda',
                        lastName: 'Potter',
                        email: 'linda@example.com',
                    }),
                    Parent.create({
                        firstName: 'Peter',
                        lastName: 'Doe',
                        email: 'peter@example.com',
                        alternativeEmails: [
                            'peter@work.com',
                        ],
                    }),
                ],
                email: 'john@example.com',
                alternativeEmails: ['john@work.com'],
                unverifiedEmails: ['untitled@example.com', 'peter@example.com'], // Last one should be ignored
            }),
        }).create();

        await MemberUserSyncer.onChangeMember(member);

        const users = await Member.users.load(member);
        expect(users).toIncludeSameMembers([
            // Member
            expect.objectContaining({
                id: user_m1.id,
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                memberId: member.id,
                permissions: null,
            }),
            expect.objectContaining({
                id: user_m2.id,
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@work.com',
                memberId: member.id,
                permissions: null,
            }),

            // Parents
            expect.objectContaining({
                id: user_p1.id,
                firstName: 'Linda',
                lastName: 'Potter',
                email: 'linda@example.com',
                memberId: null,
                permissions: null,
            }),
            expect.objectContaining({
                id: user_p2a.id,
                firstName: 'Peter',
                lastName: 'Doe',
                email: 'peter@example.com',
                memberId: null,
                permissions: null,
            }),
            expect.objectContaining({
                id: user_p2b.id,
                firstName: 'Peter',
                lastName: 'Doe',
                email: 'peter@work.com',
                memberId: null,
                permissions: null,
            }),

            // Unverified
            expect.objectContaining({
                id: user_unverified.id,
                firstName: null,
                lastName: null,
                email: 'untitled@example.com',
                memberId: null,
                permissions: null,
            }),
        ]);
    });

    test('Custom user names are maintained for parents', async () => {
        const user_p1 = await new UserFactory({ email: 'linda@example.com', firstName: 'Custom', lastName: 'Name' }).create();

        const member = await new MemberFactory({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                parents: [
                    Parent.create({
                        firstName: 'Linda',
                        lastName: 'Potter',
                        email: 'linda@example.com',
                    }),
                ],
            }),
        }).create();

        await MemberUserSyncer.onChangeMember(member);

        const users = await Member.users.load(member);
        expect(users).toIncludeSameMembers([
            // Member
            expect.objectContaining({
                id: user_p1.id,
                firstName: 'Custom',
                lastName: 'Name',
                email: 'linda@example.com',
                memberId: null,
                permissions: null,
            }),
        ]);
    });

    test('Parent name is cleared if it equals the member name', async () => {
        const user_p1 = await new UserFactory({ email: 'linda@example.com', firstName: 'John', lastName: 'Doe' }).create();

        const member = await new MemberFactory({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                parents: [
                    Parent.create({
                        firstName: 'Linda',
                        lastName: 'Potter',
                        email: 'linda@example.com',
                    }),
                ],
            }),
        }).create();

        await MemberUserSyncer.onChangeMember(member);

        const users = await Member.users.load(member);
        expect(users).toIncludeSameMembers([
            // Member
            expect.objectContaining({
                id: user_p1.id,
                firstName: 'Linda',
                lastName: 'Potter',
                email: 'linda@example.com',
                memberId: null,
                permissions: null,
            }),
        ]);
    });

    test('Parent name is cleared if it equals the member name with caps difference', async () => {
        const user_p1 = await new UserFactory({ email: 'linda@example.com', firstName: 'john', lastName: 'doe' }).create();

        const member = await new MemberFactory({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                parents: [
                    Parent.create({
                        firstName: 'Linda',
                        lastName: 'Potter',
                        email: 'linda@example.com',
                    }),
                ],
            }),
        }).create();

        await MemberUserSyncer.onChangeMember(member);

        const users = await Member.users.load(member);
        expect(users).toIncludeSameMembers([
            // Member
            expect.objectContaining({
                id: user_p1.id,
                firstName: 'Linda',
                lastName: 'Potter',
                email: 'linda@example.com',
                memberId: null,
                permissions: null,
            }),
        ]);
    });

    test('Existing parent user can have the same name as the member', async () => {
        const user_p1 = await new UserFactory({ email: 'linda@example.com', firstName: 'John', lastName: 'Doe' }).create();

        const member = await new MemberFactory({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                parents: [
                    Parent.create({
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'linda@example.com',
                    }),
                ],
            }),
        }).create();

        await MemberUserSyncer.onChangeMember(member);

        const users = await Member.users.load(member);
        expect(users).toIncludeSameMembers([
            // Member
            expect.objectContaining({
                id: user_p1.id,
                firstName: 'John',
                lastName: 'Doe',
                email: 'linda@example.com',
                memberId: null,
                permissions: null,
            }),
        ]);
    });

    test('New parent user can have the same name as the member', async () => {
        const member = await new MemberFactory({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                parents: [
                    Parent.create({
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'linda@example.com',
                    }),
                ],
            }),
        }).create();

        await MemberUserSyncer.onChangeMember(member);

        const users = await Member.users.load(member);
        expect(users).toIncludeSameMembers([
            // Member
            expect.objectContaining({
                firstName: 'John',
                lastName: 'Doe',
                email: 'linda@example.com',
                memberId: null,
                permissions: null,
            }),
        ]);
    });

    describe('Unlinking', () => {
        test('Old emails without account are removed', async () => {
            const member = await new MemberFactory({
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                    parents: [
                        Parent.create({
                            firstName: 'Linda',
                            lastName: 'Potter',
                            email: 'linda@example.com',
                        }),
                        Parent.create({
                            firstName: 'Peter',
                            lastName: 'Doe',
                            email: 'peter@example.com',
                            alternativeEmails: [
                                'peter@work.com',
                            ],
                        }),
                    ],
                    email: 'john@example.com',
                    alternativeEmails: ['john@work.com'],
                    unverifiedEmails: ['untitled@example.com', 'peter@example.com'], // Last one should be ignored
                }),
            }).create();
            await new MemberResponsibilityRecordFactory({
                member,
            }).create();

            await MemberUserSyncer.onChangeMember(member);

            const users = await Member.users.load(member);
            expect(users).toIncludeSameMembers([
                // Member
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@work.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),

                // Parents
                expect.objectContaining({
                    firstName: 'Linda',
                    lastName: 'Potter',
                    email: 'linda@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@work.com',
                    memberId: null,
                    permissions: null,
                }),

                // Unverified
                expect.objectContaining({
                    firstName: null,
                    lastName: null,
                    email: 'untitled@example.com',
                    memberId: null,
                    permissions: null,
                }),
            ]);

            // Now remove the work address of peter
            member.details.parents[1].alternativeEmails = [];
            member.details.parents[1].email = null;
            member.details.parents[0].email = null;
            member.details.alternativeEmails = [];
            member.details.unverifiedEmails = [];

            // Save member
            if (!await member.save()) {
                throw new Error('Failed to save member');
            }

            // Sync again
            await MemberUserSyncer.onChangeMember(member);

            const users2 = await Member.users.load(member);
            expect(users2).toIncludeSameMembers([
                // Member
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),
            ]);

            const userWork = await User.select().where('email', 'john@work.com').first(true);
            expect(userWork).toMatchObject({
                firstName: null,
                lastName: null,
                memberId: null,
                permissions: null,
            });
        });

        test('Parents are removed if access is revoked', async () => {
            const member = await new MemberFactory({
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                    parents: [
                        Parent.create({
                            firstName: 'Linda',
                            lastName: 'Potter',
                            email: 'linda@example.com',
                        }),
                        Parent.create({
                            firstName: 'Peter',
                            lastName: 'Doe',
                            email: 'peter@example.com',
                            alternativeEmails: [
                                'peter@work.com',
                            ],
                        }),
                    ],
                    email: 'john@example.com',
                }),
            }).create();
            await new MemberResponsibilityRecordFactory({
                member,
            }).create();

            await MemberUserSyncer.onChangeMember(member);

            let users = await Member.users.load(member);
            expect(users).toIncludeSameMembers([
                // Member
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),

                // Parents
                expect.objectContaining({
                    firstName: 'Linda',
                    lastName: 'Potter',
                    email: 'linda@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@work.com',
                    memberId: null,
                    permissions: null,
                }),
            ]);

            // Revoke parents access
            member.details.parentsHaveAccess = BooleanStatus.create({ value: false });
            await MemberUserSyncer.onChangeMember(member);

            users = await Member.users.load(member);
            expect(users).toIncludeSameMembers([
                // Member
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),
            ]);
        });

        test('Parents are removed if member turns 18', async () => {
            const member = await new MemberFactory({
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                    parents: [
                        Parent.create({
                            firstName: 'Linda',
                            lastName: 'Potter',
                            email: 'linda@example.com',
                        }),
                        Parent.create({
                            firstName: 'Peter',
                            lastName: 'Doe',
                            email: 'peter@example.com',
                            alternativeEmails: [
                                'peter@work.com',
                            ],
                        }),
                    ],
                    email: 'john@example.com',
                }),
            }).create();
            await new MemberResponsibilityRecordFactory({
                member,
            }).create();

            await MemberUserSyncer.onChangeMember(member);

            let users = await Member.users.load(member);
            expect(users).toIncludeSameMembers([
                // Member
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),

                // Parents
                expect.objectContaining({
                    firstName: 'Linda',
                    lastName: 'Potter',
                    email: 'linda@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@work.com',
                    memberId: null,
                    permissions: null,
                }),
            ]);

            // Revoke parents access
            member.details.birthDay = new Date(Date.now() - 1000 * 60 * 60 * 24 * 366 * 18); // 18 years old + compensation for leap years
            await MemberUserSyncer.onChangeMember(member);

            users = await Member.users.load(member);
            expect(users).toIncludeSameMembers([
                // Member
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),
            ]);
        });

        test('Old emails with account are not removed', async () => {
            const user_m1 = await new UserFactory({ email: 'john@example.com' }).create();
            const user_m2 = await new UserFactory({ email: 'john@work.com' }).create();
            const user_p1 = await new UserFactory({ email: 'linda@example.com' }).create();
            const user_p2a = await new UserFactory({ email: 'peter@example.com' }).create();
            const user_p2b = await new UserFactory({ email: 'peter@work.com' }).create();
            const user_unverified = await new UserFactory({ email: 'untitled@example.com' }).create();

            const member = await new MemberFactory({
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                    parents: [
                        Parent.create({
                            firstName: 'Linda',
                            lastName: 'Potter',
                            email: 'linda@example.com',
                        }),
                        Parent.create({
                            firstName: 'Peter',
                            lastName: 'Doe',
                            email: 'peter@example.com',
                            alternativeEmails: [
                                'peter@work.com',
                            ],
                        }),
                    ],
                    email: 'john@example.com',
                    alternativeEmails: ['john@work.com'],
                    unverifiedEmails: ['untitled@example.com', 'peter@example.com'], // Last one should be ignored
                }),
            }).create();

            await new MemberResponsibilityRecordFactory({
                member,
            }).create();

            await MemberUserSyncer.onChangeMember(member);

            const users = await Member.users.load(member);
            expect(users).toIncludeSameMembers([
                // Member
                expect.objectContaining({
                    id: user_m1.id,
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),
                expect.objectContaining({
                    id: user_m2.id,
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@work.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),

                // Parents
                expect.objectContaining({
                    id: user_p1.id,
                    firstName: 'Linda',
                    lastName: 'Potter',
                    email: 'linda@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    id: user_p2a.id,
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    id: user_p2b.id,
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@work.com',
                    memberId: null,
                    permissions: null,
                }),

                // Unverified
                expect.objectContaining({
                    id: user_unverified.id,
                    firstName: null,
                    lastName: null,
                    email: 'untitled@example.com',
                    memberId: null,
                    permissions: null,
                }),
            ]);

            // Now remove the work address of peter
            member.details.parents[1].alternativeEmails = [];
            member.details.parents[1].email = null;
            member.details.parents[0].email = null;
            member.details.alternativeEmails = [];
            member.details.unverifiedEmails = [];

            // Save member
            await member.save();

            // Sync again
            await MemberUserSyncer.onChangeMember(member);

            const users2 = await Member.users.load(member);
            expect(users2).toIncludeSameMembers([
                // Member
                expect.objectContaining({
                    id: user_m1.id,
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),
                expect.objectContaining({
                    id: user_m2.id,
                    firstName: null, // this has been reset
                    lastName: null, // this has been reset
                    email: 'john@work.com',
                    memberId: null, // this has been reset
                    permissions: null, // this has been reset
                }),

                // Parents
                expect.objectContaining({
                    id: user_p1.id,
                    firstName: 'Linda',
                    lastName: 'Potter',
                    email: 'linda@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    id: user_p2a.id,
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    id: user_p2b.id,
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@work.com',
                    memberId: null,
                    permissions: null,
                }),

                // Unverified
                expect.objectContaining({
                    id: user_unverified.id,
                    firstName: null,
                    lastName: null,
                    email: 'untitled@example.com',
                    memberId: null,
                    permissions: null,
                }),
            ]);
        });
    });

    describe('Linking', () => {
        test('Parents are added if access is added', async () => {
            const member = await new MemberFactory({
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 366 * 18), // 18 years old + leap year margin
                    parents: [
                        Parent.create({
                            firstName: 'Linda',
                            lastName: 'Potter',
                            email: 'linda@example.com',
                        }),
                        Parent.create({
                            firstName: 'Peter',
                            lastName: 'Doe',
                            email: 'peter@example.com',
                            alternativeEmails: [
                                'peter@work.com',
                            ],
                        }),
                    ],
                    email: 'john@example.com',
                }),
            }).create();
            await new MemberResponsibilityRecordFactory({
                member,
            }).create();

            await MemberUserSyncer.onChangeMember(member);

            let users = await Member.users.load(member);
            expect(users).toIncludeSameMembers([
                // Member
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),
            ]);

            // Revoke parents access
            member.details.parentsHaveAccess = BooleanStatus.create({ value: true });
            await MemberUserSyncer.onChangeMember(member);

            users = await Member.users.load(member);
            expect(users).toIncludeSameMembers([
                // Member
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member.id,
                    permissions: expect.any(UserPermissions),
                }),

                // Parents
                expect.objectContaining({
                    firstName: 'Linda',
                    lastName: 'Potter',
                    email: 'linda@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@example.com',
                    memberId: null,
                    permissions: null,
                }),
                expect.objectContaining({
                    firstName: 'Peter',
                    lastName: 'Doe',
                    email: 'peter@work.com',
                    memberId: null,
                    permissions: null,
                }),
            ]);
        });
    });

    describe('Members with the same email addresses', () => {
        test('The most recent member is linked to a user if both do not have responsibilities', async () => {
            const member1 = await new MemberFactory({
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                    email: 'john@example.com',
                }),
            }).create();
            await MemberUserSyncer.onChangeMember(member1);
            const users1 = await Member.users.load(member1);
            expect(users1).toIncludeSameMembers([
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member1.id,
                    permissions: null,
                }),
            ]);

            // Wait 1 second to make sure we save a new timestamp
            await new Promise(resolve => setTimeout(resolve, 2000));

            // member2 should not seize the memberId
            const member2 = await new MemberFactory({
                details: MemberDetails.create({
                    firstName: 'Other',
                    lastName: 'Doe',
                    birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                    email: 'john@example.com',
                }),
            }).create();

            await MemberUserSyncer.onChangeMember(member2);
            const users2 = await Member.users.load(member2);
            expect(users2).toIncludeSameMembers([
                expect.objectContaining({
                    firstName: 'Other',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member2.id,
                    permissions: null,
                }),
            ]);

            // Even if called sync again on other member
            await MemberUserSyncer.onChangeMember(member1);
            const users3 = await Member.users.load(member1);
            expect(users3).toIncludeSameMembers([
                expect.objectContaining({
                    firstName: 'Other',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member2.id,
                    permissions: null,
                }),
            ]);
        });

        test('The most old member is linked to a user if both have responsibilities', async () => {
            const member1 = await new MemberFactory({
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                    email: 'john@example.com',
                }),
            }).create();
            await new MemberResponsibilityRecordFactory({
                member: member1,
            }).create();

            await MemberUserSyncer.onChangeMember(member1);

            const users1 = await Member.users.load(member1);
            expect(users1).toIncludeSameMembers([
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member1.id,
                    permissions: expect.any(UserPermissions),
                }),
            ]);
            await new Promise(resolve => setTimeout(resolve, 2000));

            // member2 should not seize the memberId
            const member2 = await new MemberFactory({
                details: MemberDetails.create({
                    firstName: 'Other',
                    lastName: 'Doe',
                    birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                    email: 'john@example.com',
                }),
            }).create();
            await new MemberResponsibilityRecordFactory({
                member: member2,
            }).create();

            await MemberUserSyncer.onChangeMember(member2);
            const users2 = await Member.users.load(member2);

            // Stayed the same
            expect(users2).toIncludeSameMembers([
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member1.id,
                    permissions: expect.any(UserPermissions),
                }),
            ]);

            // Even if called sync again on other member
            await MemberUserSyncer.onChangeMember(member1);
            const users3 = await Member.users.load(member1);
            expect(users3).toIncludeSameMembers([
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member1.id,
                    permissions: expect.any(UserPermissions),
                }),
            ]);
        });

        test('The member with responsibilities is linked to a user', async () => {
            const member1 = await new MemberFactory({
                details: MemberDetails.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                    email: 'john@example.com',
                }),
            }).create();
            await MemberUserSyncer.onChangeMember(member1);
            const users1 = await Member.users.load(member1);
            expect(users1).toIncludeSameMembers([
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member1.id,
                    permissions: null,
                }),
            ]);

            // member2 should not seize the memberId
            const member2 = await new MemberFactory({
                details: MemberDetails.create({
                    firstName: 'Other',
                    lastName: 'Doe',
                    birthDay: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8), // 8 years old
                    email: 'john@example.com',
                }),
            }).create();

            // Attach a responsibility to member2
            await new MemberResponsibilityRecordFactory({
                member: member2,
            }).create();

            await MemberUserSyncer.onChangeMember(member2);
            const users2 = await Member.users.load(member2);
            expect(users2).toIncludeSameMembers([
                expect.objectContaining({
                    firstName: 'Other',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member2.id,
                    permissions: expect.any(UserPermissions),
                }),
            ]);

            // Even if called sync again on other member
            await MemberUserSyncer.onChangeMember(member1);
            const users3 = await Member.users.load(member1);
            expect(users3).toIncludeSameMembers([
                expect.objectContaining({
                    firstName: 'Other',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    memberId: member2.id,
                    permissions: expect.any(UserPermissions),
                }),
            ]);
        });
    });
});
