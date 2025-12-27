import {
    Address,
    BooleanStatus,
    Country,
    EmergencyContact,
    Gender,
    MemberDetails,
    Parent,
    RecordAnswer,
    RecordSettings,
    ReviewTime,
    ReviewTimes,
    TranslatedString,
    UitpasNumberDetails,
} from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { Member } from '../models/index.js';
import { mergeMemberDetails, selectBaseMember } from './MemberMerger.js';

describe('member merge', () => {
    describe('mergeMemberDetails', () => {
        describe('empty base details', () => {
            // #region arrange
            const m1 = new Member();
            const m2 = new Member();
            const d1Old = MemberDetails.create({
                firstName: ' ',
                lastName: '',
                birthDay: undefined,
                memberNumber: undefined,
                uitpasNumberDetails: undefined,
                email: ' ',
                phone: undefined,
                gender: Gender.Other,
                requiresFinancialSupport: undefined,
                dataPermissions: undefined,
                address: undefined,
                parents: [],
                emergencyContacts: [],
                reviewTimes: undefined,
                recordAnswers: undefined,
                unverifiedEmails: [],
                unverifiedPhones: [],
                unverifiedAddresses: [],
                notes: undefined,
            });

            const recordAnswer = RecordAnswer.create({
                settings: RecordSettings.create({
                    name: TranslatedString.create('answer1'),
                    required: true,
                    choices: [],
                }),
            });

            const d2Old = MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(1990, 1, 1),
                memberNumber: '123',
                uitpasNumberDetails: UitpasNumberDetails.create({
                    uitpasNumber: '56',
                }),
                email: 'b7v2x@example.com',
                phone: '04863544',
                gender: Gender.Male,
                requiresFinancialSupport: BooleanStatus.create({ value: true }),
                dataPermissions: BooleanStatus.create({ value: true }),
                address: Address.create({
                    city: 'Amsterdam',
                    street: 'Mozartstraat',
                    number: '1',
                    postalCode: '1011AB',
                    country: Country.Netherlands,
                }),
                parents: [Parent.create({ firstName: 'John', lastName: 'Doe' })],
                emergencyContacts: [
                    EmergencyContact.create({
                        name: 'blabla',
                        title: 'title',
                        phone: '04863544654',
                    }),
                ],
                reviewTimes: ReviewTimes.create({
                    times: [
                        ReviewTime.create({
                            name: 'parents',
                            reviewedAt: new Date(2020, 1, 1),
                        }),
                        ReviewTime.create({
                            name: 'details',
                            reviewedAt: new Date(2021, 1, 1),
                        }),
                    ],
                }),
                recordAnswers: new Map([[recordAnswer.id, recordAnswer]]),
                unverifiedEmails: ['email1@test.be', 'email2@test.be'],
                unverifiedPhones: ['04863545', '04863546'],
                unverifiedAddresses: [
                    Address.create({
                        city: 'Amsterdam',
                        street: 'Mozartstraat',
                        number: '2',
                        postalCode: '1011AB',
                        country: Country.Netherlands,
                    }),
                ],
                notes: 'note1',
            });

            m1.details = d1Old.clone();
            m2.details = d2Old.clone();
            // #endregion

            // act
            let d1: MemberDetails;

            beforeAll(() => {
                mergeMemberDetails(m1, m2);
                d1 = m1.details;
            });

            // assert
            test('firstName', () => {
                expect(d1.firstName).toBe(d2Old.firstName);
            });

            test('lastName', () => {
                expect(d1.lastName).toBe(d2Old.lastName);
            });

            test('memberNumber', () => {
                expect(d1.memberNumber).toBe(d2Old.memberNumber);
            });

            test('uitpasNumber', () => {
                expect(d1.uitpasNumberDetails?.uitpasNumber).toBe(d2Old.uitpasNumberDetails?.uitpasNumber);
            });

            test('email', () => {
                expect(d1.email).toBe(d2Old.email);
                expect(d1.unverifiedEmails).not.toContain(d2Old.email);
            });

            test('phone', () => {
                expect(d1.phone).toBe(d2Old.phone);
                expect(d1.unverifiedPhones).not.toContain(d2Old.phone);
            });

            test('gender', () => {
                expect(d1.gender).toBe(d2Old.gender);
            });

            test('birthDay', () => {
                expect(d1.birthDay?.getTime() ?? -1).toBe(
                    d2Old.birthDay?.getTime() ?? -1,
                );
            });

            test('requires financial support', () => {
                expect(d1.requiresFinancialSupport?.date.getTime() ?? -1).toBe(
                    d2Old.requiresFinancialSupport?.date.getTime() ?? -1,
                );
            });

            test('data permissions', () => {
                expect(d1.dataPermissions?.date.getTime() ?? -1).toBe(
                    d2Old.dataPermissions?.date.getTime() ?? -1,
                );
            });

            test('address', () => {
                expect(d1.address?.id).toBe(d2Old.address?.id);
            });

            test('parents', () => {
                expect(d1.parents.length).toBe(d2Old.parents.length);
            });

            test('emergency contacts', () => {
                expect(d1.emergencyContacts.length).toBe(
                    d2Old.emergencyContacts.length,
                );
            });

            test('review times', () => {
                expect(d1.reviewTimes.times.length).toBe(
                    d2Old.reviewTimes.times.length,
                );
            });

            test('answers', () => {
                expect(d1.recordAnswers.size).toBe(d2Old.recordAnswers.size);
            });

            test('unverifiedEmails', () => {
                expect(d1.unverifiedEmails.length).toBe(d2Old.unverifiedEmails.length);
            });

            test('unverifiedPhones', () => {
                expect(d1.unverifiedPhones.length).toBe(d2Old.unverifiedPhones.length);
            });

            test('unverifiedAddresses', () => {
                expect(d1.unverifiedAddresses.length).toBe(
                    d2Old.unverifiedAddresses.length,
                );
            });

            test('notes', () => {
                expect(d1.notes).toEqual('note1');
            });
        });

        describe('empty other details', () => {
            // #region arrange
            const m1 = new Member();
            const m2 = new Member();

            const recordAnswer = RecordAnswer.create({
                settings: RecordSettings.create({
                    name: TranslatedString.create('answer1'),
                    required: true,
                    choices: [],
                }),
            });

            const d1Old = MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(1990, 1, 1),
                memberNumber: '123',
                uitpasNumberDetails: UitpasNumberDetails.create({
                    uitpasNumber: '56',
                }),
                email: 'b7v2x@example.com',
                phone: '04863544',
                gender: Gender.Male,
                requiresFinancialSupport: BooleanStatus.create({ value: true }),
                dataPermissions: BooleanStatus.create({ value: true }),
                address: Address.create({
                    city: 'Amsterdam',
                    street: 'Mozartstraat',
                    number: '1',
                    postalCode: '1011AB',
                    country: Country.Netherlands,
                }),
                parents: [Parent.create({ firstName: 'John', lastName: 'Doe' })],
                emergencyContacts: [
                    EmergencyContact.create({
                        name: 'blabla',
                        title: 'title',
                        phone: '04863544654',
                    }),
                ],
                reviewTimes: ReviewTimes.create({
                    times: [
                        ReviewTime.create({
                            name: 'parents',
                            reviewedAt: new Date(2020, 1, 1),
                        }),
                        ReviewTime.create({
                            name: 'details',
                            reviewedAt: new Date(2021, 1, 1),
                        }),
                    ],
                }),
                recordAnswers: new Map([[recordAnswer.id, recordAnswer]]),
                unverifiedEmails: ['email1@test.be', 'email2@test.be'],
                unverifiedPhones: ['04863545', '04863546'],
                unverifiedAddresses: [
                    Address.create({
                        city: 'Amsterdam',
                        street: 'Mozartstraat',
                        number: '2',
                        postalCode: '1011AB',
                        country: Country.Netherlands,
                    }),
                ],
                notes: 'note1',
            });

            const d2Old = MemberDetails.create({
                firstName: ' ',
                lastName: '',
                birthDay: undefined,
                memberNumber: undefined,
                uitpasNumberDetails: undefined,
                email: ' ',
                phone: undefined,
                gender: Gender.Other,
                requiresFinancialSupport: undefined,
                dataPermissions: undefined,
                address: undefined,
                parents: [],
                emergencyContacts: [],
                reviewTimes: undefined,
                recordAnswers: undefined,
                unverifiedEmails: [],
                unverifiedPhones: [],
                unverifiedAddresses: [],
                notes: undefined,
            });

            m1.details = d1Old.clone();
            m2.details = d2Old.clone();
            // #endregion

            // act
            let d1: MemberDetails;

            beforeAll(() => {
                mergeMemberDetails(m1, m2);
                d1 = m1.details;
            });

            // assert
            test('firstName', () => {
                expect(d1.firstName).toBe(d1Old.firstName);
            });

            test('lastName', () => {
                expect(d1.lastName).toBe(d1Old.lastName);
            });

            test('memberNumber', () => {
                expect(d1.memberNumber).toBe(d1Old.memberNumber);
            });

            test('uitpasNumber', () => {
                expect(d1.uitpasNumberDetails?.uitpasNumber).toBe(d1Old.uitpasNumberDetails?.uitpasNumber);
            });

            test('email', () => {
                expect(d1.email).toBe(d1Old.email);
                expect(d1.unverifiedEmails).not.toContain(d2Old.email);
            });

            test('phone', () => {
                expect(d1.phone).toBe(d1Old.phone);
                expect(d1.unverifiedPhones).not.toContain(d2Old.phone);
            });

            test('gender', () => {
                expect(d1.gender).toBe(d1Old.gender);
            });

            test('birthDay', () => {
                expect(d1.birthDay?.getTime() ?? -1).toBe(
                    d1Old.birthDay?.getTime() ?? -1,
                );
            });

            test('requires financial support', () => {
                expect(d1.requiresFinancialSupport?.date.getTime() ?? -1).toBe(
                    d1Old.requiresFinancialSupport?.date.getTime() ?? -1,
                );
            });

            test('data permissions', () => {
                expect(d1.dataPermissions?.date.getTime() ?? -1).toBe(
                    d1Old.dataPermissions?.date.getTime() ?? -1,
                );
            });

            test('address', () => {
                expect(d1.address?.id).toBe(d1Old.address?.id);
            });

            test('parents', () => {
                expect(d1.parents.length).toBe(d1Old.parents.length);
            });

            test('emergency contacts', () => {
                expect(d1.emergencyContacts.length).toBe(
                    d1Old.emergencyContacts.length,
                );
            });

            test('review times', () => {
                expect(d1.reviewTimes.times.length).toBe(
                    d1Old.reviewTimes.times.length,
                );
            });

            test('answers', () => {
                expect(d1.recordAnswers.size).toBe(d1Old.recordAnswers.size);
            });

            test('unverifiedEmails', () => {
                expect(d1.unverifiedEmails.length).toBe(d1Old.unverifiedEmails.length);
            });

            test('unverifiedPhones', () => {
                expect(d1.unverifiedPhones.length).toBe(d1Old.unverifiedPhones.length);
            });

            test('unverifiedAddresses', () => {
                expect(d1.unverifiedAddresses.length).toBe(
                    d1Old.unverifiedAddresses.length,
                );
            });

            test('notes', () => {
                expect(d1.notes).toEqual('note1');
            });
        });

        describe('complete base and other details', () => {
            // #region arrange
            const m1 = new Member();
            const m2 = new Member();

            const recordAnswer1 = RecordAnswer.create({
                settings: RecordSettings.create({
                    name: TranslatedString.create('answer1'),
                    required: true,
                    choices: [],
                }),
            });

            const recordAnswer1b = recordAnswer1.clone();
            recordAnswer1b.date = new Date(1990, 1, 1);

            const recordAnswer2 = RecordAnswer.create({
                settings: RecordSettings.create({
                    name: TranslatedString.create('answer2'),
                    required: true,
                    choices: [],
                }),
            });

            // will not changed because cloned
            const oldParent1 = Parent.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@test.be',
                phone: '04111111',
            });

            const parent1Alt = Parent.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'oldJohn@test.be',
                phone: '0499999',
                address: Address.create({
                    street: 'John street',
                    number: '5',
                    city: 'Amsterdam',
                    postalCode: '1011AB',
                    country: Country.Belgium,
                }),
            });

            const d1Old = MemberDetails.create({
                firstName: 'Jöhn',
                lastName: 'Dôe',
                birthDay: new Date(1990, 1, 1),
                memberNumber: '123',
                uitpasNumberDetails: UitpasNumberDetails.create({
                    uitpasNumber: '56',
                }),
                email: 'b7v2x@example.com',
                phone: '04863544',
                gender: Gender.Male,
                requiresFinancialSupport: BooleanStatus.create({
                    value: true,
                    date: new Date(2021, 1, 1),
                }),
                dataPermissions: BooleanStatus.create({
                    value: true,
                    date: new Date(2020, 1, 1),
                }),
                address: Address.create({
                    city: 'Amsterdam',
                    street: 'Mozartstraat',
                    number: '1',
                    postalCode: '1011AB',
                    country: Country.Netherlands,
                }),
                parents: [oldParent1],
                emergencyContacts: [
                    EmergencyContact.create({
                        name: 'blabla',
                        title: 'title',
                        phone: '04863544654',
                    }),
                    EmergencyContact.create({
                        name: 'blabla2',
                        title: 'title2',
                        phone: '04863544654',
                    }),
                ],
                reviewTimes: ReviewTimes.create({
                    times: [
                        ReviewTime.create({
                            name: 'parents',
                            reviewedAt: new Date(2020, 1, 1),
                        }),
                        ReviewTime.create({
                            name: 'details',
                            reviewedAt: new Date(2021, 1, 1),
                        }),
                    ],
                }),
                recordAnswers: new Map([[recordAnswer1.id, recordAnswer1]]),
                unverifiedEmails: ['email1@test.be', 'email2@test.be'],
                unverifiedPhones: ['04863545', '04863546'],
                unverifiedAddresses: [
                    Address.create({
                        city: 'Amsterdam',
                        street: 'Mozartstraat',
                        number: '2',
                        postalCode: '1011AB',
                        country: Country.Netherlands,
                    }),
                ],
                notes: 'note1',
            });

            const d2Old = MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                birthDay: new Date(2000, 1, 1),
                memberNumber: '123456',
                uitpasNumberDetails: UitpasNumberDetails.create({
                    uitpasNumber: '567',
                }),
                email: 'other@example.com',
                phone: '048635449',
                gender: Gender.Female,
                // earlier date
                requiresFinancialSupport: BooleanStatus.create({
                    value: false,
                    date: new Date(2020, 1, 1),
                }),
                // older date
                dataPermissions: BooleanStatus.create({
                    value: false,
                    date: new Date(2021, 1, 1),
                }),
                address: Address.create({
                    city: 'Amsterdam',
                    street: 'Mozartstraat',
                    number: '5',
                    postalCode: '1011AB',
                    country: Country.Netherlands,
                }),
                parents: [
                    parent1Alt,
                    Parent.create({ firstName: 'John', lastName: 'Other' }),
                ],
                emergencyContacts: [
                    EmergencyContact.create({
                        name: 'other emergency contact',
                        title: 'title',
                        phone: '04863544654',
                    }),
                    EmergencyContact.create({
                        name: 'blabla',
                        title: 'title',
                        phone: '04863544654',
                    }),
                ],
                reviewTimes: ReviewTimes.create({
                    times: [
                        ReviewTime.create({
                            name: 'parents',
                            reviewedAt: new Date(2019, 1, 1),
                        }),
                        ReviewTime.create({
                            name: 'details',
                            reviewedAt: new Date(2023, 1, 1),
                        }),
                    ],
                }),
                recordAnswers: new Map([
                    [recordAnswer2.id, recordAnswer2],
                    [recordAnswer1.id, recordAnswer1],
                    [recordAnswer1b.id, recordAnswer1b],
                ]),
                unverifiedEmails: ['otherUnverivied@test.be'],
                unverifiedPhones: ['0486354599', '0486354699'],
                unverifiedAddresses: [
                    Address.create({
                        city: 'Amsterdam',
                        street: 'AndereStraat',
                        number: '100',
                        postalCode: '1011AB',
                        country: Country.Netherlands,
                    }),
                ],
                notes: 'note2',
            });

            m1.details = d1Old.clone();
            m2.details = d2Old.clone();
            // #endregion

            // act
            let d1: MemberDetails;
            let parent1: Parent;

            beforeAll(() => {
                mergeMemberDetails(m1, m2);
                d1 = m1.details;
                parent1 = d1.parents.find(p => p.id === oldParent1.id)!;
            });

            // assert
            test('firstName', () => {
                expect(d1.firstName).toBe(d1Old.firstName);
            });

            test('lastName', () => {
                expect(d1.lastName).toBe(d1Old.lastName);
            });

            test('memberNumber', () => {
                expect(d1.memberNumber).toBe(d1Old.memberNumber);
            });

            test('uitpasNumber', () => {
                expect(d1.uitpasNumberDetails?.uitpasNumber).toBe(d2Old.uitpasNumberDetails?.uitpasNumber);
            });

            test('email', () => {
                expect(d1.email).toBe(d2Old.email);
                expect(d1.alternativeEmails).toContain(d1Old.email);
                expect(d1.unverifiedEmails).not.toContain(d1Old.email);
            });

            test('phone', () => {
                expect(d1.phone).toBe(d2Old.phone);
                expect(d1.unverifiedPhones).toContain(d1Old.phone);
            });

            test('gender', () => {
                expect(d1.gender).toBe(d2Old.gender);
            });

            test('birthDay', () => {
                expect(d1.birthDay?.getTime() ?? -1).toBe(
                    d2Old.birthDay?.getTime() ?? -1,
                );
            });

            test('requires financial support', () => {
                expect(d1.requiresFinancialSupport?.date.getTime() ?? -1).toBe(
                    d1Old.requiresFinancialSupport?.date.getTime() ?? -1,
                );
            });

            test('data permissions', () => {
                expect(d1.dataPermissions?.date.getTime() ?? -1).toBe(
                    d2Old.dataPermissions?.date.getTime() ?? -1,
                );
            });

            test('address', () => {
                expect(d1.address?.id).toBe(d2Old.address?.id);
                expect(d1.unverifiedAddresses.map(a => a.id)).toContain(
                    d1Old.address?.id,
                );
            });

            test('parents', () => {
                expect(d1.parents.length).toBe(2);
                expect(parent1.firstName).toBe(parent1Alt.firstName);
                expect(parent1.lastName).toBe(parent1Alt.lastName);
                expect(parent1.email).toBe(parent1Alt.email?.toLowerCase());
                expect(parent1.phone).toBe(parent1Alt.phone);
                expect(parent1.address?.id).toBe(parent1Alt.address?.id);
                expect(d1.unverifiedPhones).toContain(oldParent1.phone);
                expect(parent1.alternativeEmails).toContain(oldParent1.email!.toLocaleLowerCase());
            });

            test('emergency contacts', () => {
                expect(d1.emergencyContacts.length).toBe(3);
            });

            test('review times', () => {
                expect(d1.reviewTimes.times.length).toBe(2);
            });

            test('answers', () => {
                expect(d1.recordAnswers.size).toBe(3);
            });

            test('unverifiedEmails', () => {
                expect(d1.unverifiedEmails.sort()).toEqual([
                    'email1@test.be',
                    'email2@test.be',
                    'otherunverivied@test.be',
                ].sort());
            });

            test('unverifiedPhones', () => {
                expect(d1.unverifiedPhones.length).toBe(6);
            });

            test('unverifiedAddresses', () => {
                // expect(d1.unverifiedAddresses.length).toBe(3);

                // Should be combination of unverified addresses + address of the second member (which coulnd't be merged)
                const addressIds = d1.unverifiedAddresses.map(a => a.id);
                expect(addressIds.sort()).toEqual([
                    d1Old.address!.id,
                    d1Old.unverifiedAddresses[0].id,
                    d2Old.unverifiedAddresses[0].id,
                ].sort());
            });

            test('notes', () => {
                expect(d1.notes).toEqual('note1\nnote2');
            });
        });
    });

    test('select base member should return last created member', () => {
        const m1 = new Member();
        m1.createdAt = new Date(2020, 0, 1);
        m1.id = uuidv4();
        const m2 = new Member();
        m2.createdAt = new Date(2021, 0, 1);
        m2.id = uuidv4();
        const m3 = new Member();
        m3.createdAt = new Date(2022, 0, 1);
        m3.id = uuidv4();

        const members = [m1, m3, m2];

        const { base, others } = selectBaseMember(members);

        expect(base.id).toBe(m3.id);

        expect(others).toHaveLength(2);
        const otherIds = others.map(m => m.id);
        expect(otherIds).toContain(m1.id);
        expect(otherIds).toContain(m2.id);
    });

    describe('Regressions', () => {
        /**
         * tests STA-460
         */
        test('Members with same email addreses do not get the email added as alternative email', () => {
            const m1 = new Member();
            const m2 = new Member();

            const base = MemberDetails.create({
                email: 'example@example.com',
                firstName: 'John',
                lastName: 'Doe',
            });

            const other = MemberDetails.create({
                email: 'example@example.com',
                firstName: 'John',
                lastName: 'Doe',
            });

            m1.details = base.clone();
            m2.details = other.clone();

            mergeMemberDetails(m1, m2);

            expect(m1.details.email).toBe('example@example.com');
            expect(m1.details.alternativeEmails).toEqual([]);
        });
    });
});
