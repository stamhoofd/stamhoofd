// test should always be imported first
import { test } from '../test-fixtures/platform.js';

// other imports
import { StripeMocker, UitpasMocker } from '@stamhoofd/backend/tests/helpers';
import type {
    Organization,
    OrganizationRegistrationPeriod,
    RegistrationPeriod,
    User,
} from '@stamhoofd/models';
import {
    BalanceItemFactory,
    GroupFactory,
    MemberFactory,
    OrganizationFactory,
    OrganizationRegistrationPeriodFactory,
    RegistrationPeriodFactory,
} from '@stamhoofd/models';
import {
    BalanceItemType,
    MemberDetails,
    PaymentMethod,
    PermissionLevel,
    Permissions,
    PropertyFilter,
    UitpasNumberDetails,
    UitpasSocialTariff,
    UitpasSocialTariffStatus,
} from '@stamhoofd/structures';
import { MemberPortalRegistrationFlow } from '../flows/MemberPortalRegistrationFlow.js';
import type {
    YouthOrganization1Context,
} from '../helpers/index.js';
import {
    TableHelper,
    TestMembers,
    TestOrganizations,
    WorkerData,
} from '../helpers/index.js';

/**
 * todo:
 * - add tests to check if uitpas step is not shown anymore if not necessary
 */

test.describe('Registration', () => {
    const uitpasMocker = new UitpasMocker();

    test.beforeEach(() => {
        uitpasMocker.start();
    });

    test.afterEach(async () => {
        uitpasMocker.stop();
    });

    /**
     * Register a member as a platform user without permissions in the member portal.
     */
    test.describe('member portal', () => {
        let organization: Organization;
        let period: RegistrationPeriod;
        let user: User;
        let organizationPeriod: OrganizationRegistrationPeriod;
        let organizationName: string;

        test.beforeAll(async () => {
            user = WorkerData.user;
            organization = await new OrganizationFactory({
                name: `Vereniging${WorkerData.id}`,
            }).create();
            organizationName = organization.name;

            organization.meta.recordsConfiguration.financialSupport = true;
            organization.meta.recordsConfiguration.uitpasNumber
                = new PropertyFilter(null, null);
            await organization.save();

            period = await new RegistrationPeriodFactory({
                startDate: new Date('2000-01-01'),
                endDate: new Date('2001-01-01'),
                organization,
            }).create();

            organization.periodId = period.id;
            await organization.save();

            organizationPeriod
                = await new OrganizationRegistrationPeriodFactory({
                    period,
                    organization,
                }).create();
        });

        test.afterAll(async () => {
            await WorkerData.resetDatabase();
        });

        /**
         * Test registration with uitpas number.
         */
        test.describe('Uitpas number', () => {
            test.afterEach(async () => {
                await WorkerData.databaseHelper.clearRegistrations();
                await WorkerData.databaseHelper.clearMembers();
                await WorkerData.databaseHelper.clearGroups();
            });

            test('Happy flow - active number', async ({ page, pages }) => {
                // create group with reduced price
                const group = await new GroupFactory({
                    organization,
                    price: 500000,
                    reducedPrice: 400000,
                }).create();

                // set longer registration end date (else an error is thrown )
                group.settings.registrationEndDate = new Date(
                    (
                        group.settings.registrationEndDate ?? new Date()
                    ).getTime()
                    + 60 * 1000,
                );

                await group.save();

                // add group to root category
                organizationPeriod.settings.rootCategory?.groupIds.push(
                    group.id,
                );
                await organizationPeriod.save();

                // create member for user
                await new MemberFactory({
                    firstName: 'John',
                    lastName: 'Doe',
                    user,
                }).create();

                const registrationFlow = new MemberPortalRegistrationFlow({
                    page,
                    pages,
                });

                await registrationFlow.startRegister({
                    organizationName,
                    groupName: group.settings.name.toString(),
                    memberName: 'John Doe',
                });

                await registrationFlow.continueMemberStep();

                await registrationFlow.completeUitpasStep('0900011354819', 'Dit UiTPAS-nummer heeft een actief kansentarief.');

                await test.step('should go to checkout', async () => {
                    await registrationFlow.goToCheckout();
                });

                await test.step('should apply reduced price', async () => {
                    await registrationFlow.expectTotalText('Totaal: € 40');
                });

                await test.step('should show success', async () => {
                    await registrationFlow.confirmPaymentMethod();
                    await registrationFlow.expectSuccessView();
                });
            });

            const inactiveNumberScenarios: {
                number: string;
                status: UitpasSocialTariffStatus;
                expectMessage: string;
            }[] = [
                {
                    number: '0900000095902',
                    status: UitpasSocialTariffStatus.None,
                    expectMessage: 'Dit UiTPAS-nummer heeft geen kansentarief.',
                },
                {
                    number: '0900000031618',
                    status: UitpasSocialTariffStatus.Expired,
                    expectMessage:
                        'Het kansentarief van dit UiTPAS-nummer is verlopen.',
                },
            ];

            inactiveNumberScenarios.forEach((scenario) => {
                test(`Inactive number with status ${scenario.status}`, async ({
                    page,
                    pages,
                }) => {
                    // create group with reduced price
                    const group = await new GroupFactory({
                        organization,
                        price: 500000,
                        reducedPrice: 400000,
                    }).create();

                    // set longer registration end date (else an error is thrown )
                    group.settings.registrationEndDate = new Date(
                        (
                            group.settings.registrationEndDate ?? new Date()
                        ).getTime()
                        + 60 * 1000,
                    );

                    await group.save();

                    // add group to root category
                    organizationPeriod.settings.rootCategory?.groupIds.push(
                        group.id,
                    );
                    await organizationPeriod.save();

                    // create member for user
                    await new MemberFactory({
                        firstName: 'John',
                        lastName: 'Doe',
                        user,
                    }).create();

                    const registrationFlow = new MemberPortalRegistrationFlow({
                        page,
                        pages,
                    });

                    await registrationFlow.startRegister({
                        organizationName,
                        groupName: group.settings.name.toString(),
                        memberName: 'John Doe',
                    });

                    await registrationFlow.continueMemberStep();

                    await test.step('should show uitpas step', async () => {
                        await registrationFlow.completeUitpasStep(
                            scenario.number,
                            scenario.expectMessage,
                        );
                    });

                    await test.step('Should show requires financial support step next with checkbox that is not disabled', async () => {
                        await registrationFlow.expectFinancialSupportStep();
                        await registrationFlow.expectFinancialSupportNotToBeDisabled();
                        await registrationFlow.continueFinancialSupportStep();
                    });

                    await test.step('Should go to checkout', async () => {
                        await registrationFlow.goToCheckout();
                    });

                    await test.step('should not apply reduced price', async () => {
                        await registrationFlow.expectTotalText('Totaal: € 50');
                    });

                    await test.step('should show success', async () => {
                        await registrationFlow.confirmPaymentMethod();
                        await registrationFlow.expectSuccessView();
                    });
                });
            });

            const invalidNumberScenarios: {
                title: string;
                number: string;
                errorMessage: string;
            }[] = [
                {
                    title: 'does not exist',
                    number: '0900011354999',
                    errorMessage:
                        'Het UiTPAS-nummer dat je invulde konden we niet terugvinden',
                },
                {
                    title: 'is invalid',
                    number: '99',
                    errorMessage: 'Ongeldig UiTPAS-nummer',
                },
            ];

            invalidNumberScenarios.forEach((scenario) => {
                test(`Should show error if number ${scenario.title}`, async ({
                    page,
                    pages,
                }) => {
                    // create group with reduced price
                    const group = await new GroupFactory({
                        organization,
                        price: 500000,
                        reducedPrice: 400000,
                    }).create();

                    // set longer registration end date (else an error is thrown )
                    group.settings.registrationEndDate = new Date(
                        (
                            group.settings.registrationEndDate ?? new Date()
                        ).getTime()
                        + 60 * 1000,
                    );

                    await group.save();

                    // add group to root category
                    organizationPeriod.settings.rootCategory?.groupIds.push(
                        group.id,
                    );
                    await organizationPeriod.save();

                    // create member
                    const member = await new MemberFactory({
                        firstName: 'John',
                        lastName: 'Doe',
                        user,
                    }).create();

                    const registrationFlow = new MemberPortalRegistrationFlow({
                        page,
                        pages,
                    });

                    await registrationFlow.startRegister({
                        organizationName,
                        groupName: group.settings.name.toString(),
                        memberName: member.details.name,
                    });

                    await registrationFlow.continueMemberStep();

                    // number that does not exist
                    const uitpasStep
                        = await registrationFlow.completeUitpasStep(
                            scenario.number,
                        );

                    await test
                        .expect(uitpasStep)
                        .toContainText(scenario.errorMessage);
                });
            });

            /**
             * Situation:
             * The uitpas number is filled in while registering but after that the uitpas api is unavailable.
             *
             * Expect:
             * The member should be able to register because the socialTariff was checked recently.
             */
            test('Should be able to register if uitpas number was updated recently and uitpas api is unavailable on register', async ({
                page,
                pages,
            }) => {
                // create group with reduced price
                const group = await new GroupFactory({
                    organization,
                    price: 500000,
                    reducedPrice: 400000,
                }).create();

                // set longer registration end date (else an error is thrown )
                group.settings.registrationEndDate = new Date(
                    (
                        group.settings.registrationEndDate ?? new Date()
                    ).getTime()
                    + 60 * 1000,
                );

                await group.save();

                // add group to root category
                organizationPeriod.settings.rootCategory?.groupIds.push(
                    group.id,
                );
                await organizationPeriod.save();

                // create member for user
                await new MemberFactory({
                    firstName: 'John',
                    lastName: 'Doe',
                    user,
                }).create();

                const registrationFlow = new MemberPortalRegistrationFlow({
                    page,
                    pages,
                });

                await registrationFlow.startRegister({
                    organizationName,
                    groupName: group.settings.name.toString(),
                    memberName: 'John Doe',
                });

                await registrationFlow.continueMemberStep();

                // fill in active uitpas number
                await registrationFlow.completeUitpasStep('0900011354819');

                await registrationFlow.goToCheckout();

                // force fail of uitpas api
                uitpasMocker.forceFailure();

                // confirm payment method
                await registrationFlow.confirmPaymentMethod();

                // await registration success to be shown
                await registrationFlow.expectSuccessView();
            });

            test.skip('Step should always be shown if status is unknown', async ({ page, pages }) => {
                // create group with reduced price
                const group = await new GroupFactory({
                    organization,
                    price: 500000,
                    reducedPrice: 400000,
                }).create();

                // set longer registration end date (else an error is thrown )
                group.settings.registrationEndDate = new Date(
                    (
                        group.settings.registrationEndDate ?? new Date()
                    ).getTime()
                    + 60 * 1000,
                );

                await group.save();

                // add group to root category
                organizationPeriod.settings.rootCategory?.groupIds.push(
                    group.id,
                );
                await organizationPeriod.save();

                // create member for user
                const member = await new MemberFactory({
                    firstName: 'John',
                    lastName: 'Doe',
                    user,
                    details: MemberDetails.create({
                        uitpasNumberDetails: UitpasNumberDetails.create({
                            // active (but status is still unknown)
                            uitpasNumber: '0900011354819',
                            socialTariff: UitpasSocialTariff.create({
                                status: UitpasSocialTariffStatus.Unknown,
                            }),
                        }) }),
                }).create();

                member.details.reviewTimes.markReviewed('uitpasNumber');
                await member.save();

                const registrationFlow = new MemberPortalRegistrationFlow({
                    page,
                    pages,
                });

                await registrationFlow.startRegister({
                    organizationName,
                    groupName: group.settings.name.toString(),
                    memberName: 'John Doe',
                });

                await registrationFlow.continueMemberStep();

                await test.step('should show uitpas step', async () => {
                    await registrationFlow.expectUitpasInput();
                });
            });
        });

        /**
         * Test registration without uitpas when the total price is zero.
         * In that case the payment step is a confirmation page instead of a payment selection page.
         *
         * KNOWN BUG: after confirming, the app navigates back instead of showing the success view.
         */
        test.describe('Happy path - zero price', () => {
            let freeOrganization: Organization;
            let freeOrganizationPeriod: OrganizationRegistrationPeriod;

            test.beforeAll(async () => {
                freeOrganization = await new OrganizationFactory({
                    name: `FreeVer${WorkerData.id}`,
                }).create();

                const freePeriod = await new RegistrationPeriodFactory({
                    startDate: new Date('2000-01-01'),
                    endDate: new Date('2001-01-01'),
                    organization: freeOrganization,
                }).create();

                freeOrganization.periodId = freePeriod.id;
                await freeOrganization.save();

                freeOrganizationPeriod
                    = await new OrganizationRegistrationPeriodFactory({
                        period: freePeriod,
                        organization: freeOrganization,
                    }).create();
            });

            test.afterEach(async () => {
                await WorkerData.databaseHelper.clearRegistrations();
                await WorkerData.databaseHelper.clearMembers();
                await WorkerData.databaseHelper.clearGroups();
            });

            test('Happy flow - zero price', async ({ page, pages }) => {
                const group = await new GroupFactory({
                    organization: freeOrganization,
                    price: 0,
                }).create();

                group.settings.registrationEndDate = new Date(
                    (
                        group.settings.registrationEndDate ?? new Date()
                    ).getTime()
                    + 60 * 1000,
                );
                await group.save();

                freeOrganizationPeriod.settings.rootCategory?.groupIds.push(
                    group.id,
                );
                await freeOrganizationPeriod.save();

                await new MemberFactory({
                    firstName: 'Jane',
                    lastName: 'Doe',
                    user,
                }).create();

                const registrationFlow = new MemberPortalRegistrationFlow({
                    page,
                    pages,
                });

                await registrationFlow.startRegister({
                    organizationName: freeOrganization.name,
                    groupName: group.settings.name.toString(),
                    memberName: 'Jane Doe',
                });

                await registrationFlow.continueMemberStep();

                await test.step('should go to checkout', async () => {
                    await registrationFlow.goToCheckout();
                });

                await test.step('payment step should be a confirmation page showing zero total', async () => {
                    await registrationFlow.expectTotalText('Totaal: € 0');
                });

                await test.step('should show success view after confirming', async () => {
                    await registrationFlow.confirmPaymentMethod();
                    await registrationFlow.expectSuccessView();
                });
            });
        });

        /**
         * Test registration when the member has an outstanding credit (a negative balance item).
         * The credit should automatically be applied as a discount, capped at the cart price,
         * so a € 30 registration paid with a € 40 credit becomes free.
         */
        test.describe('Happy path - balance credit', () => {
            let creditOrganization: Organization;
            let creditOrganizationPeriod: OrganizationRegistrationPeriod;

            test.beforeAll(async () => {
                creditOrganization = await new OrganizationFactory({
                    name: `CreditVer${WorkerData.id}`,
                }).create();

                const creditPeriod = await new RegistrationPeriodFactory({
                    startDate: new Date('2000-01-01'),
                    endDate: new Date('2001-01-01'),
                    organization: creditOrganization,
                }).create();

                creditOrganization.periodId = creditPeriod.id;
                await creditOrganization.save();

                creditOrganizationPeriod
                    = await new OrganizationRegistrationPeriodFactory({
                        period: creditPeriod,
                        organization: creditOrganization,
                    }).create();
            });

            test.afterEach(async () => {
                await WorkerData.databaseHelper.clearRegistrations();
                await WorkerData.databaseHelper.clearMembers();
                await WorkerData.databaseHelper.clearGroups();
            });

            test('Happy flow - credit reduces price to zero', async ({ page, pages }) => {
                const group = await new GroupFactory({
                    organization: creditOrganization,
                    price: 30_0000,
                }).create();

                group.settings.registrationEndDate = new Date(
                    (
                        group.settings.registrationEndDate ?? new Date()
                    ).getTime()
                    + 60 * 1000,
                );
                await group.save();

                creditOrganizationPeriod.settings.rootCategory?.groupIds.push(
                    group.id,
                );
                await creditOrganizationPeriod.save();

                const member = await new MemberFactory({
                    firstName: 'John',
                    lastName: 'Doe',
                    user,
                }).create();

                const creditName = 'Terugbetaling kamp';
                await new BalanceItemFactory({
                    organizationId: creditOrganization.id,
                    memberId: member.id,
                    type: BalanceItemType.Other,
                    description: creditName,
                    amount: 1,
                    unitPrice: -40_0000,
                }).create();

                const registrationFlow = new MemberPortalRegistrationFlow({
                    page,
                    pages,
                });

                await registrationFlow.startRegister({
                    organizationName: creditOrganization.name,
                    groupName: group.settings.name.toString(),
                    memberName: 'John Doe',
                });

                await registrationFlow.continueMemberStep();

                await test.step('cart should apply the credit as a discount', async () => {
                    await registrationFlow.expectCartCredit('- € 30');
                });

                await test.step('credit details popup should show the balance item name', async () => {
                    await registrationFlow.openCartCreditDetails();
                    await registrationFlow.expectCreditDetail(creditName);
                    await registrationFlow.closeCreditDetails(creditName);
                });

                await test.step('should go to checkout with a zero total', async () => {
                    await registrationFlow.goToCheckout();
                    await registrationFlow.expectTotalText('Totaal: € 0');
                });

                await test.step('should show success view after confirming', async () => {
                    await registrationFlow.confirmPaymentMethod();
                    await registrationFlow.expectSuccessView();
                });
            });
        });

        /**
         * Test registration with an online payment method (Bancontact via Stripe).
         * The browser is redirected to a mocked Stripe page; the StripeMocker is then used
         * to mark the payment succeeded, and the test navigates to the return URL the
         * mocker captured from the Stripe API request.
         */
        test.describe('Happy path - online payment via Stripe', () => {
            let stripeOrganization: Organization;
            let stripeOrganizationPeriod: OrganizationRegistrationPeriod;
            let stripeMocker: StripeMocker;

            test.beforeAll(async () => {
                // Required so Stripe fee VAT can be calculated; the platform
                // refuses online payments without an invoicing organization.
                // const platform = await Platform.getForEditing();
                // if (!platform.membershipOrganizationId) {
                //    const membershipOrganization = await new OrganizationFactory({}).create();
                //    platform.membershipOrganizationId = membershipOrganization.id;
                //    await platform.save();
                // }

                stripeOrganization = await new OrganizationFactory({
                    name: `BancontactVer${WorkerData.id}`,
                }).create();

                const stripePeriod = await new RegistrationPeriodFactory({
                    startDate: new Date('2000-01-01'),
                    endDate: new Date('2001-01-01'),
                    organization: stripeOrganization,
                }).create();

                stripeOrganization.periodId = stripePeriod.id;
                await stripeOrganization.save();

                stripeOrganizationPeriod
                    = await new OrganizationRegistrationPeriodFactory({
                        period: stripePeriod,
                        organization: stripeOrganization,
                    }).create();
            });

            test.afterEach(async () => {
                stripeMocker?.stop();
                await WorkerData.databaseHelper.clearRegistrations();
                await WorkerData.databaseHelper.clearMembers();
                await WorkerData.databaseHelper.clearGroups();
            });

            test('Happy flow - Bancontact via Stripe', async ({ page, pages }) => {
                stripeMocker = new StripeMocker();
                stripeMocker.start();

                const stripeAccount = await stripeMocker.createStripeAccount(
                    stripeOrganization.id,
                    'standard',
                );
                stripeOrganization.meta.registrationPaymentConfiguration.paymentMethods.push(
                    PaymentMethod.Bancontact,
                );
                stripeOrganization.privateMeta.registrationPaymentConfiguration.stripeAccountId
                    = stripeAccount.id;
                await stripeOrganization.save();

                const group = await new GroupFactory({
                    organization: stripeOrganization,
                    price: 25_0000,
                }).create();

                group.settings.registrationEndDate = new Date(
                    (
                        group.settings.registrationEndDate ?? new Date()
                    ).getTime()
                    + 60 * 1000,
                );
                await group.save();

                stripeOrganizationPeriod.settings.rootCategory?.groupIds.push(
                    group.id,
                );
                await stripeOrganizationPeriod.save();

                await new MemberFactory({
                    firstName: 'John',
                    lastName: 'Doe',
                    user,
                }).create();

                // Intercept the Stripe-hosted payment page so the redirect lands somewhere.
                await page.route('https://paymenturl/', route =>
                    route.fulfill({
                        contentType: 'text/html',
                        body: '<html><body data-testid="stripe-mock-page">Mock Stripe Bancontact page</body></html>',
                    }),
                );

                const registrationFlow = new MemberPortalRegistrationFlow({
                    page,
                    pages,
                });

                await registrationFlow.startRegister({
                    organizationName: stripeOrganization.name,
                    groupName: group.settings.name.toString(),
                    memberName: 'John Doe',
                });

                await registrationFlow.continueMemberStep();
                await registrationFlow.goToCheckout();
                await registrationFlow.expectTotalText('Totaal: € 25');

                await test.step('should select Bancontact and confirm', async () => {
                    await registrationFlow.selectPaymentMethod('Bancontact');
                    await registrationFlow.confirmPaymentMethod();
                });

                await test.step('should redirect to mocked Stripe payment page', async () => {
                    await page.waitForURL('https://paymenturl/');
                    await test
                        .expect(page.getByTestId('stripe-mock-page'))
                        .toBeVisible();
                });

                const intent = stripeMocker.getLastIntent();
                test.expect(intent).toBeDefined();
                test.expect(intent.return_url).toBeDefined();

                await test.step('should succeed the payment via StripeMocker', async () => {
                    await stripeMocker.succeedPayment(intent);
                });

                await test.step('should land on the captured success url', async () => {
                    if (!intent.return_url) {
                        throw new Error('Typescript assert failed');
                    }
                    // The return URL points at the organization's registration subdomain,
                    // which is not routable in the test caddy setup — intercept it so the
                    // navigation can complete and we can assert it lands there.
                    await page.goto(intent.return_url);
                    await registrationFlow.expectSuccessView();
                });
            });
        });
    });

    /**
     * Register members as an organization admin.
     */
    test.describe('admin', () => {
        /**
         * Test registration with uitpas number.
         */
        test.describe('Uitpas number', () => {
            let organizationContext: YouthOrganization1Context;
            let organization: Organization;

            test.beforeAll(async () => {
                organization = await new OrganizationFactory({
                    name: `Vereniging${WorkerData.id}`,
                }).create();

                organizationContext
                    = await TestOrganizations.youthOrganization1(organization);

                // configure uitpas number and financial support
                organization.meta.recordsConfiguration.financialSupport = true;
                organization.meta.recordsConfiguration.uitpasNumber
                    = new PropertyFilter(null, null);
                await organization.save();

                await WorkerData.configureUser
                    .setOrganizationPermissions(
                        Permissions.create({
                            level: PermissionLevel.Full,
                        }),
                        organization,
                    )
                    .save();
            });

            test.afterAll(async () => {
                await WorkerData.resetDatabase();
            });

            test.afterEach(async () => {
                await WorkerData.databaseHelper.clearRegistrations();
                await WorkerData.databaseHelper.clearMembers();
            });

            test('Happy flow - register multiple members with uitpas should succeed', async ({
                pages,
                page,
            }) => {
                const group = organizationContext.groups.bevers;

                // init members
                const member1 = await TestMembers.defaultMemberFromId({
                    id: 1,
                    organization: organizationContext.organization,
                    group,
                });

                member1.details.uitpasNumberDetails
                    = UitpasNumberDetails.create({
                        // active
                        uitpasNumber: '0900011354819',
                        socialTariff: UitpasSocialTariff.create({
                            status: UitpasSocialTariffStatus.Active,
                            endDate: new Date(2050, 1, 1),
                        }),
                    });

                const member2 = await TestMembers.defaultMemberFromId({
                    id: 2,
                    organization,
                    group,
                });

                member2.details.uitpasNumberDetails
                    = UitpasNumberDetails.create({
                        // expired
                        uitpasNumber: '0900000031618',
                        socialTariff: UitpasSocialTariff.create({
                            status: UitpasSocialTariffStatus.Expired,
                            endDate: new Date(2001, 1, 1),
                        }),
                    });

                const member3 = await TestMembers.defaultMemberFromId({
                    id: 3,
                    organization,
                    group,
                });

                member3.details.uitpasNumberDetails
                    = UitpasNumberDetails.create({
                        // none
                        uitpasNumber: '0900000095902',
                        socialTariff: UitpasSocialTariff.create({
                            status: UitpasSocialTariffStatus.None,
                        }),
                    });

                const member4 = await TestMembers.defaultMemberFromId({
                    id: 4,
                    organization,
                    group,
                });

                // save all members
                await Promise.all(
                    [member1, member2, member3, member4].map(async (m) => {
                        m.details.cleanData();
                        await m.save();
                    }),
                );

                // go to bevers registrations
                await pages
                    .groupOverview({ organization, group })
                    .gotoRegistrations();

                // select all members
                const table = new TableHelper(page);
                await table.toggleSelectAllRows();

                // register members for other group
                await table.clickActions([
                    'Inschrijven voor',
                    'Takken',
                    'Welpen',
                ]);

                // go to checkout
                await page.getByTestId('save-button').click();

                await test.step('should show success view listing every registered member', async () => {
                    const successView = page.getByTestId('payment-success-view');
                    await test.expect(successView).toBeVisible();

                    await test
                        .expect(successView)
                        .toContainText('en 2 andere leden zijn ingeschreven', { ignoreCase: true });
                });
            });
        });

        /**
         * Bulk-register a set of existing members into another group via the
         * "Inschrijven voor" admin action. The admin acts as the same
         * organization, so the checkout steps are skipped and the success
         * view is shown directly after the cart save.
         */
        test.describe('Bulk register existing members', () => {
            let organizationContext: YouthOrganization1Context;
            let organization: Organization;

            test.beforeAll(async () => {
                organization = await new OrganizationFactory({
                    name: `Bulk${WorkerData.id}`,
                }).create();

                organizationContext
                    = await TestOrganizations.youthOrganization1(organization);

                // Strip optional records so no extra steps appear during checkout.
                organization.meta.recordsConfiguration.financialSupport = false;
                organization.meta.recordsConfiguration.uitpasNumber = null;
                await organization.save();

                await WorkerData.configureUser
                    .setOrganizationPermissions(
                        Permissions.create({
                            level: PermissionLevel.Full,
                        }),
                        organization,
                    )
                    .save();
            });

            test.afterAll(async () => {
                await WorkerData.resetDatabase();
            });

            test.afterEach(async () => {
                await WorkerData.databaseHelper.clearRegistrations();
                await WorkerData.databaseHelper.clearMembers();
            });

            test('admin registers multiple existing members in a group at once', async ({
                page,
                pages,
            }) => {
                const sourceGroup = organizationContext.groups.bevers;
                const targetGroup = organizationContext.groups.welpen;

                // create existing members, each already registered to bevers
                const members = await Promise.all(
                    [1, 2, 3].map(id =>
                        TestMembers.defaultMemberFromId({
                            id,
                            organization,
                            group: sourceGroup,
                        }),
                    ),
                );

                // open the bevers registrations table
                await pages
                    .groupOverview({ organization, group: sourceGroup })
                    .gotoRegistrations();

                // select every member in the table
                const table = new TableHelper(page);
                await table.waitForFirstRow();
                await table.toggleSelectAllRows();

                // bulk-register them for the welpen group
                await table.clickActions([
                    'Inschrijven voor',
                    'Takken',
                    targetGroup.settings.name.toString(),
                ]);

                // confirm the cart (admin from same org skips the payment steps)
                await page.getByTestId('save-button').click();

                await test.step('should show success view listing every registered member', async () => {
                    const successView = page.getByTestId('payment-success-view');
                    await test.expect(successView).toBeVisible();

                    // The admin checkout returns no payment, so the success view
                    // renders the registrations fallback which lists first names.
                    for (const member of members) {
                        await test
                            .expect(successView)
                            .toContainText(member.details.firstName, { ignoreCase: true });
                    }
                });
            });
        });
    });
});
