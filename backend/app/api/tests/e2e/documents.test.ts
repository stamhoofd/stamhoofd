import { Request } from '@simonbackx/simple-endpoints';
import { Document, DocumentTemplateFactory, Group, GroupFactory, Member, MemberFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriodFactory, Registration, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { IDRegisterCart, IDRegisterCheckout, IDRegisterItem, MemberDetails, MemberWithRegistrationsBlob, PaymentMethod } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { RegisterMembersEndpoint } from '../../src/endpoints/global/registration/RegisterMembersEndpoint.js';
import { patchOrganizationMember } from '../actions/patchOrganizationMember.js';
import { markNotPaid, markPaid } from '../actions/patchPaymentStatus.js';
import { patchUserMember } from '../actions/patchUserMember.js';
import { testServer } from '../helpers/TestServer.js';
import { initAdmin } from '../init/initAdmin.js';
import { initStripe } from '../init/initStripe.js';
import { registrationUpdateQueue } from '../../src/services/BalanceItemService.js';

const baseUrl = `/members/register`;

describe('E2E.Documents', () => {
    const endpoint = new RegisterMembersEndpoint();
    let period: RegistrationPeriod;

    const post = async (body: IDRegisterCheckout, organization: Organization, token: Token) => {
        const request = Request.post({
            path: baseUrl,
            host: organization.getApiHost(),
            body,
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        return await testServer.test(endpoint, request);
    };

    beforeAll(async () => {
        const previousPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(2022, 0, 1),
            endDate: new Date(2022, 11, 31),
        }).create();

        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2030, 11, 31),
            previousPeriodId: previousPeriod.id,
        }).create();
    });

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const initOrganization = async (registrationPeriod: RegistrationPeriod = period) => {
        const organization = await new OrganizationFactory({ period: registrationPeriod })
            .create();

        const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: registrationPeriod }).create();

        return { organization, organizationRegistrationPeriod };
    };

    async function initData(options?: { paidOnly?: boolean; maxAge?: number }) {
        const { organization, organizationRegistrationPeriod } = await initOrganization(period);

        const user = await new UserFactory({
            organization,
            permissions: null,
        }).create();

        const token = await Token.createToken(user);

        const member = await new MemberFactory({ organization, user })
            .create();

        const group = await new GroupFactory({
            organization,
            price: 25_0000,
        }).create();

        const group2 = await new GroupFactory({
            organization,
            price: 15_0000,
        }).create();

        const documentTemplate = await new DocumentTemplateFactory({
            groups: [
                group,
                group2,
            ],
            minPricePaid: options?.paidOnly ? 1 : null,
            maxAge: options?.maxAge ?? null,
        }).create();

        return {
            organization,
            organizationRegistrationPeriod,
            user,
            token,
            member,
            group,
            group2,
            documentTemplate,
        };
    }

    async function assertNoDocument(registration: { id: string }) {
        await registrationUpdateQueue.flushAndWait();
        const document = await Document.select().where('registrationId', registration.id).first(false);
        expect(document).toBeNull();
    }

    async function assertDocument({ registration, organization, member, group, price, pricePaid }: { registration: { id: string }; organization: Organization; member: Member; group: Group; price: number; pricePaid?: number }) {
        await registrationUpdateQueue.flushAndWait();
        const document = await Document.select().where('registrationId', registration.id).first(false);
        expect(document).not.toBeNull();

        const html = await document!.getRenderedHtml(organization);

        const registrationModel = (await Registration.getByID(registration.id))!;

        const expectations = [
            member.firstName,
            'Member name using other variable: ' + member.firstName,
            member.lastName,
            group.settings.name.toString(),
            'Price: ' + Formatter.price(price),
            organization.name,
            Formatter.dateNumber(registrationModel.startDate!, true),
            Formatter.dateNumber(group.settings.endDate, true),
        ];

        if (pricePaid !== undefined) {
            expectations.push('Price paid: ' + Formatter.price(pricePaid));
        }

        // Assert some things in the HTML
        for (const expectation of expectations || []) {
            expect(html).toContain(expectation);
        }

        return document!;
    }

    test('A document is created when a member registers and pays online', async () => {
        const { organization, group, token, member } = await initData();
        const { stripeMocker } = await initStripe({ organization });

        // First register the member for group 1. No discount should be applied yet
        const checkout1 = IDRegisterCheckout.create({
            cart: IDRegisterCart.create({
                items: [
                    IDRegisterItem.create({
                        groupPrice: group.settings.prices[0],
                        groupId: group.id,
                        organizationId: organization.id,
                        memberId: member.id,
                    }),
                ],
            }),
            paymentMethod: PaymentMethod.Bancontact,
            totalPrice: 25_0000,
            redirectUrl: new URL('https://example.com/redirect'),
            cancelUrl: new URL('https://example.com/cancel'),
        });

        const response = await post(checkout1, organization, token);
        const registration = response.body.registrations[0];
        await assertNoDocument(registration);

        // Check no document for this registration yet
        await stripeMocker.succeedPayment(stripeMocker.getLastIntent());

        const registrationModel = await Registration.getByID(registration.id);
        expect(registrationModel).not.toBeNull();
        expect(registrationModel?.registeredAt).not.toBeNull();

        await assertDocument({ registration, organization, member, group, price: 25_0000, pricePaid: 25_0000 });
    });

    test('Documents are created for non-paid registrations by default', async () => {
        const { organization, group, token, member } = await initData({ paidOnly: false });

        // First register the member for group 1. No discount should be applied yet
        const checkout1 = IDRegisterCheckout.create({
            cart: IDRegisterCart.create({
                items: [
                    IDRegisterItem.create({
                        groupPrice: group.settings.prices[0],
                        groupId: group.id,
                        organizationId: organization.id,
                        memberId: member.id,
                    }),
                ],
            }),
            paymentMethod: PaymentMethod.PointOfSale,
            totalPrice: 25_0000,
        });

        const response = await post(checkout1, organization, token);
        const registration = response.body.registrations[0];
        await assertDocument({ registration, organization, member, group, price: 25_0000, pricePaid: 0 });

        // Mark paid
        await markPaid({ payment: response.body.payment!, organization });
        await assertDocument({ registration, organization, member, group, price: 25_0000, pricePaid: 25_0000 });

        // Mark unpaid
        await markNotPaid({ payment: response.body.payment!, organization });
        await assertDocument({ registration, organization, member, group, price: 25_0000, pricePaid: 0 });
    });

    test('A paid-only document is only created when a payment is marked as paid', async () => {
        const { organization, group, token, member } = await initData({ paidOnly: true });

        // First register the member for group 1. No discount should be applied yet
        const checkout1 = IDRegisterCheckout.create({
            cart: IDRegisterCart.create({
                items: [
                    IDRegisterItem.create({
                        groupPrice: group.settings.prices[0],
                        groupId: group.id,
                        organizationId: organization.id,
                        memberId: member.id,
                    }),
                ],
            }),
            paymentMethod: PaymentMethod.PointOfSale,
            totalPrice: 25_0000,
        });

        const response = await post(checkout1, organization, token);
        const registration = response.body.registrations[0];
        await assertNoDocument(registration);

        await markPaid({ payment: response.body.payment!, organization });
        await assertDocument({ registration, organization, member, group, price: 25_0000, pricePaid: 25_0000 });

        // Should be deleted again
        await markNotPaid({ payment: response.body.payment!, organization });
        await assertNoDocument(registration);
    });

    test('A maximum age document is not created for older members', async () => {
        const { organization, group, token, member, user } = await initData({ maxAge: 10 });
        member.details.birthDay = new Date(2000, 0, 1); // Make the member older than the maximum age
        await member.save();

        // First register the member for group 1. No discount should be applied yet
        const checkout1 = IDRegisterCheckout.create({
            cart: IDRegisterCart.create({
                items: [
                    IDRegisterItem.create({
                        groupPrice: group.settings.prices[0],
                        groupId: group.id,
                        organizationId: organization.id,
                        memberId: member.id,
                    }),
                ],
            }),
            paymentMethod: PaymentMethod.PointOfSale,
            totalPrice: 25_0000,
        });

        const response = await post(checkout1, organization, token);
        const registration = response.body.registrations[0];
        await assertNoDocument(registration);
        await markPaid({ payment: response.body.payment!, organization });
        await assertNoDocument(registration);

        // Change the age of this member via an API endpoint
        await patchOrganizationMember({
            organization,
            patch: MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    birthDay: new Date(),
                }),
            }),
        });

        await assertDocument({ registration, organization, member, group, price: 25_0000, pricePaid: 25_0000 });
        await markNotPaid({ payment: response.body.payment!, organization });
        await assertDocument({ registration, organization, member, group, price: 25_0000, pricePaid: 0 });

        // Change age again
        await patchOrganizationMember({
            organization,
            patch: MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    birthDay: new Date(2000, 0, 1), // Make the member older than the maximum age
                }),
            }),
        });

        await assertNoDocument(registration);

        // Change age as user (different endpoint, but should also have the same side effect)
        await patchUserMember({
            organization,
            user,
            patch: MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    birthDay: new Date(),
                }),
            }),
        });
        await assertDocument({ registration, organization, member, group, price: 25_0000, pricePaid: 0 });
    });

    test('A document is updated when a registration is moved by an admin', async () => {
        const { organization, group, group2, token, member } = await initData({ paidOnly: false });
        const { adminToken } = await initAdmin({ organization });

        // First register the member for group 1. No discount should be applied yet
        const checkout1 = IDRegisterCheckout.create({
            cart: IDRegisterCart.create({
                items: [
                    IDRegisterItem.create({
                        groupPrice: group.settings.prices[0],
                        groupId: group.id,
                        organizationId: organization.id,
                        memberId: member.id,
                    }),
                ],
            }),
            paymentMethod: PaymentMethod.PointOfSale,
            totalPrice: 25_0000,
        });

        const response = await post(checkout1, organization, token);
        const registration = response.body.registrations[0];
        await assertDocument({ registration, organization, member, group, price: 25_0000, pricePaid: 0 });

        // Move
        const checkout2 = IDRegisterCheckout.create({
            cart: IDRegisterCart.create({
                items: [
                    IDRegisterItem.create({
                        groupPrice: group2.settings.prices[0],
                        groupId: group2.id,
                        organizationId: organization.id,
                        memberId: member.id,
                        replaceRegistrationIds: [registration.id],
                    }),
                ],
            }),
            paymentMethod: PaymentMethod.PointOfSale,
            asOrganizationId: organization.id,
            totalPrice: -10_0000,
        });

        const response2 = await post(checkout2, organization, adminToken);
        const registration2 = response2.body.registrations[0];
        await assertDocument({ registration: registration2, organization, member, group: group2, price: 15_0000, pricePaid: 0 });
        await assertNoDocument(registration);
    });

    test('A document is deleted when a registration is deleted by an admin', async () => {
        const { organization, group, token, member } = await initData({ paidOnly: false });
        const { adminToken } = await initAdmin({ organization });

        // First register the member for group 1. No discount should be applied yet
        const checkout1 = IDRegisterCheckout.create({
            cart: IDRegisterCart.create({
                items: [
                    IDRegisterItem.create({
                        groupPrice: group.settings.prices[0],
                        groupId: group.id,
                        organizationId: organization.id,
                        memberId: member.id,
                    }),
                ],
            }),
            paymentMethod: PaymentMethod.PointOfSale,
            totalPrice: 25_0000,
        });

        const response = await post(checkout1, organization, token);
        const registration = response.body.registrations[0];
        await assertDocument({ registration, organization, member, group, price: 25_0000, pricePaid: 0 });

        // Move
        const checkout2 = IDRegisterCheckout.create({
            cart: IDRegisterCart.create({
                deleteRegistrationIds: [registration.id],
            }),
            paymentMethod: PaymentMethod.PointOfSale,
            asOrganizationId: organization.id,
            totalPrice: -25_0000,
        });

        await post(checkout2, organization, adminToken);
        await assertNoDocument(registration);
    });
});
