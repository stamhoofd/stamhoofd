// test should always be imported first
import { test } from '../test-fixtures/platform';

// other imports
import { UitpasMocker } from '@stamhoofd/backend/tests/helpers';
import {
    GroupFactory,
    MemberFactory,
    Organization,
    OrganizationFactory,
    OrganizationRegistrationPeriod,
    OrganizationRegistrationPeriodFactory,
    RegistrationPeriod,
    RegistrationPeriodFactory,
    User,
} from '@stamhoofd/models';
import {
    MemberDetails,
    PermissionLevel,
    Permissions,
    PropertyFilter,
    UitpasNumberDetails,
    UitpasSocialTariff,
    UitpasSocialTariffStatus,
} from '@stamhoofd/structures';
import { MemberPortalRegistrationFlow } from '../flows/MemberPortalRegistrationFlow';
import {
    TableHelper,
    TestMembers,
    TestOrganizations,
    WorkerData,
    YouthOrganization1Context,
} from '../helpers';

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
            });
        });
    });
});
