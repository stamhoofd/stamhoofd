import { Request } from '@simonbackx/simple-endpoints';
import type { Token } from '@stamhoofd/models';
import { BalanceItem, GroupFactory, MemberFactory, Organization, OrganizationFactory, RegistrationFactory, STPackage, STPackageFactory } from '@stamhoofd/models';
import {
    Address,
    BalanceItemStatus,
    BalanceItemType,
    Company,
    MollieOnboarding,
    MollieStatus,
    OrganizationCheckout,
    PackagePurchases,
    PaymentCustomer,
    PaymentMethod,
    STPackageBundle,
    STPackageBundleHelper,
    STPackageType,
    VATExcemptReason,
} from '@stamhoofd/structures';
import type { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { CreateMandateSettings } from '@stamhoofd/structures/checkout/CreateMandateSettings.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { chargeMemberFeesForOrganization } from '../../../../crons/members-fees.js';
import { PaymentMandateService } from '../../../../services/PaymentMandateService.js';
import { STPackageService } from '../../../../services/STPackageService.js';
import { MollieMocker } from '../../../../../tests/helpers/MollieMocker.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { initAdmin } from '../../../../../tests/init/index.js';
import { initMembershipOrganization } from '../../../../../tests/init/initMembershipOrganization.js';
import { OrganizationCheckoutEndpoint } from './OrganizationCheckoutEndpoint.js';

describe('Endpoint.OrganizationCheckoutEndpoint', () => {
    const endpoint = new OrganizationCheckoutEndpoint();

    // The membership organization is the seller. It is configured to receive Mollie payments and is
    // located in Belgium with a valid VAT number (so reverse charged VAT can apply for foreign buyers).
    let membershipOrganization: Organization;
    let mollieMocker: MollieMocker;

    const belgianAddress = () => Address.create({
        street: 'Demostraat',
        number: '12',
        city: 'Gent',
        postalCode: '9000',
        country: Country.Belgium,
    });

    const dutchAddress = () => Address.create({
        street: 'Demostraat',
        number: '12',
        city: 'Amsterdam',
        postalCode: '1011 AA',
        country: Country.Netherlands,
    });

    const post = async (sellingOrganizationId: string, body: OrganizationCheckout, organization: Organization, token: Token) => {
        const request = Request.buildJson('POST', `/billing/${sellingOrganizationId}/checkout`, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    /**
     * Create a paying (buyer) organization + an admin with finance permissions.
     * Optionally configures one billing company (otherwise the default company is used).
     */
    const createBuyer = async (company?: Company) => {
        const organization = await new OrganizationFactory({}).create();

        if (company) {
            organization.meta.companies.push(company);
            // Keep the organization address in sync with the company country (nicer/realistic)
            organization.address = company.address ?? organization.address;
            await organization.save();
        }

        const { adminToken } = await initAdmin({ organization });

        // The customer.company that the checkout sends needs to equal a saved company (or the default one).
        const customerCompany = company ?? organization.defaultCompanies[0];

        return { organization, token: adminToken, customerCompany };
    };

    const buildCheckout = (options: {
        bundles: STPackageBundle[];
        customerCompany: Company;
        createMandate?: boolean;
    }) => {
        return OrganizationCheckout.create({
            purchases: PackagePurchases.create({
                packageBundles: options.bundles,
            }),
            customer: PaymentCustomer.create({
                firstName: 'Test',
                lastName: 'Buyer',
                email: 'buyer@example.com',
                company: options.customerCompany,
            }),
            paymentMethod: options.createMandate ? PaymentMethod.CreditCard : null,
            createMandate: options.createMandate ? CreateMandateSettings.create({ saveAsDefault: true }) : null,
            redirectUrl: new URL('https://www.example.com/success'),
            cancelUrl: new URL('https://www.example.com/cancel'),
        });
    };

    const getPackage = async (organization: Organization, type: STPackageType) => {
        const packages = await STPackage.select().where('organizationId', organization.id).fetch();
        return packages.find(p => p.meta.type === type);
    };

    const getPackageBalanceItem = async (pack: STPackage) => {
        const items = await BalanceItem.select().where('packageId', pack.id).fetch();
        return items[0];
    };

    const getAdministrationFee = async (organization: Organization) => {
        const items = await BalanceItem.select()
            .where('payingOrganizationId', organization.id)
            .where('type', BalanceItemType.AdministrationFee)
            .fetch();
        return items[0];
    };

    /**
     * Re-fetch the organization so we read the freshly saved meta.packages
     * (STPackageService.updateOrganizationPackages loads + saves a fresh model).
     */
    const getUpdatedPackages = async (organization: Organization) => {
        const updated = await Organization.getByID(organization.id);
        return updated!.meta.packages;
    };

    /**
     * Register `count` active members (each in a non-waiting-list group, registered in the current
     * period) so Organization.getActiveMembers() reports them when charging a per-member package.
     */
    const addActiveMembers = async (organization: Organization, count: number) => {
        const group = await new GroupFactory({ organization }).create();
        for (let i = 0; i < count; i++) {
            const member = await new MemberFactory({ organization }).create();
            await new RegistrationFactory({ member, group }).create();
        }
    };

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'organization');

        mollieMocker = new MollieMocker();
        mollieMocker.start();

        membershipOrganization = await initMembershipOrganization();

        // Make the seller a Belgian company with a valid VAT number
        membershipOrganization.meta.companies = [
            Company.create({
                name: 'Stamhoofd',
                companyNumber: '0700000000',
                VATNumber: 'BE0700000000',
                address: belgianAddress(),
            }),
        ];

        // Configure Mollie so the seller can receive (mandate) payments
        membershipOrganization.privateMeta.mollieOnboarding = MollieOnboarding.create({
            canReceivePayments: true,
            canReceiveSettlements: true,
            status: MollieStatus.Completed,
        });

        const config = membershipOrganization.meta.registrationPaymentConfiguration;
        for (const method of [PaymentMethod.CreditCard, PaymentMethod.Bancontact]) {
            if (!config.paymentMethods.includes(method)) {
                config.paymentMethods.push(method);
            }
        }
        config.enableMandates = true;

        await membershipOrganization.save();
        await mollieMocker.setupToken(membershipOrganization);
    });

    afterAll(() => {
        mollieMocker.stop();
    });

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        mollieMocker.reset();
    });

    afterEach(() => {
        // Restore real timers in case a test froze the date (no-op otherwise)
        vitest.useRealTimers();
    });

    /**
     * The per-member price is prorated against the package's validity window, which depends on the
     * current date (and whether the year-long window crosses a leap day). Freeze the date so the
     * Members package always charges its full unit price (€1 / member) and the totals are deterministic.
     */
    const freezeDate = () => {
        vitest.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] }).setSystemTime(new Date('2026-06-15T10:00:00.000Z'));
    };
    const MEMBER_UNIT_PRICE = 1_0000; // €1 per member (stored with 4 decimals)
    const DAY = 1000 * 60 * 60 * 24;

    /**
     * Create an already-active package for the organization (validated in the past) with a custom
     * validity window. Used to set up a "current" package that can be renewed.
     */
    const createActivePackage = async (organization: Organization, options: {
        bundle: STPackageBundle;
        validUntil: Date | null;
        createdAt?: Date;
    }) => {
        const template = STPackageBundleHelper.getCurrentPackage(options.bundle, new Date(Date.now() - 300 * DAY));
        const pack = new STPackage();
        pack.organizationId = organization.id;
        pack.meta = template.meta;
        pack.validAt = new Date(Date.now() - 300 * DAY);
        pack.validUntil = options.validUntil;
        pack.removeAt = options.validUntil ? new Date(options.validUntil.getTime() + 31 * DAY) : null;
        pack.createdAt = options.createdAt ?? new Date(Date.now() - 300 * DAY);
        await pack.save();
        await STPackageService.markValid(pack.id);
        return (await STPackage.getByID(pack.id))!;
    };

    /**
     * Simulate a previously saved (default) Mollie mandate for the buyer, and return it as a
     * PaymentMandate the checkout can reference.
     */
    const setupExistingMandate = async (organization: Organization): Promise<PaymentMandate> => {
        const customerId = mollieMocker.createId('cst');
        mollieMocker.customers.push({ id: customerId });
        const mandate = mollieMocker.addMandate({ customerId });

        const fresh = (await Organization.getByID(organization.id))!;
        fresh.serverMeta.mollieCustomerId = customerId;
        fresh.serverMeta.mollieMandateId = mandate.id;
        await fresh.save();

        const mandates = await PaymentMandateService.getMandates({
            payingOrganization: fresh,
            sellingOrganization: (await Organization.getByID(membershipOrganization.id))!,
            user: null,
        });
        const found = mandates.find(m => m.id === mandate.id);
        if (!found) {
            throw new Error('Expected mandate to be returned by getMandates');
        }
        return found;
    };

    /**
     * Build a renewal checkout, either via explicit renew ids or via package bundles, and either
     * paying with a new payment method (creating a mandate) or reusing an existing mandate.
     */
    const buildRenewalCheckout = (options: {
        customerCompany: Company;
        renewPackageIds?: string[];
        bundles?: STPackageBundle[];
        mandate?: PaymentMandate;
        newPaymentMethod?: PaymentMethod;
    }) => {
        return OrganizationCheckout.create({
            purchases: PackagePurchases.create({
                renewPackageIds: options.renewPackageIds ?? [],
                packageBundles: options.bundles ?? [],
            }),
            customer: PaymentCustomer.create({
                firstName: 'Test',
                lastName: 'Buyer',
                email: 'buyer@example.com',
                company: options.customerCompany,
            }),
            mandate: options.mandate ?? null,
            paymentMethod: options.mandate ? null : (options.newPaymentMethod ?? null),
            // Packages that require a mandate always need createMandate.saveAsDefault. When reusing an
            // existing mandate it is passed alongside `mandate` and simply marks that mandate as default.
            createMandate: CreateMandateSettings.create({ saveAsDefault: true }),
            redirectUrl: new URL('https://www.example.com/success'),
            cancelUrl: new URL('https://www.example.com/cancel'),
        });
    };

    const getPackages = async (organization: Organization) => {
        return await STPackage.select().where('organizationId', organization.id).fetch();
    };

    describe('Trials', () => {
        test('Activating a trial works for an organization without any companies set (using the default company)', async () => {
            const { organization, token, customerCompany } = await createBuyer();

            const checkout = buildCheckout({
                bundles: [STPackageBundle.TrialMembers],
                customerCompany,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            // A trial is free, so it is activated immediately (no online payment needed)
            const pack = await getPackage(organization, STPackageType.TrialMembers);
            expect(pack).toBeDefined();
            expect(pack!.validAt).not.toBeNull();

            // The organization now uses members, but only as a trial
            const packages = await getUpdatedPackages(organization);
            expect(packages.useMembers).toBe(true);
            expect(packages.isMembersTrial).toBe(true);
            expect(packages.useWebshops).toBe(false);
            expect(packages.isWebshopsTrial).toBe(false);

            // A trial is free
            const balanceItem = await getPackageBalanceItem(pack!);
            expect(balanceItem.unitPrice).toBe(0);
            expect(balanceItem.priceWithVAT).toBe(0);

            // No VAT reverse charge for a Belgian buyer
            expect(balanceItem.VATExcempt).toBeNull();
        });

        test('Activating a trial works for a Dutch organization buying from the Belgian seller (both with a valid VAT number)', async () => {
            const dutchCompany = Company.create({
                name: 'Nederlandse vereniging',
                companyNumber: '12345678',
                VATNumber: 'NL123456789B01',
                address: dutchAddress(),
            });
            const { organization, token, customerCompany } = await createBuyer(dutchCompany);

            const checkout = buildCheckout({
                bundles: [STPackageBundle.TrialMembers],
                customerCompany,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            const pack = await getPackage(organization, STPackageType.TrialMembers);
            expect(pack).toBeDefined();
            expect(pack!.validAt).not.toBeNull();

            const packages = await getUpdatedPackages(organization);
            expect(packages.useMembers).toBe(true);
            expect(packages.isMembersTrial).toBe(true);
            expect(packages.useWebshops).toBe(false);
            expect(packages.isWebshopsTrial).toBe(false);

            // A trial is free
            const balanceItem = await getPackageBalanceItem(pack!);
            expect(balanceItem.unitPrice).toBe(0);
            expect(balanceItem.priceWithVAT).toBe(0);

            // Intra community reverse charge applies (Dutch buyer, Belgian seller, both with VAT)
            expect(balanceItem.VATExcempt).toBe(VATExcemptReason.IntraCommunityServices);
        });
    });

    describe('Members package', () => {
        test('Activating the members package charges all members of the organization (default company)', async () => {
            freezeDate();
            const { organization, token, customerCompany } = await createBuyer();
            await addActiveMembers(organization, 10);

            const checkout = buildCheckout({
                bundles: [STPackageBundle.Members],
                customerCompany,
                createMandate: true,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);
            expect(response.body.paymentUrl).not.toBeNull();

            // Not valid yet, only after the (Mollie) payment succeeds
            const pack = await getPackage(organization, STPackageType.Members);
            expect(pack).toBeDefined();
            expect(pack!.validAt).toBeNull();

            await mollieMocker.succeedPayment();

            await pack!.refresh();
            expect(pack!.validAt).not.toBeNull();

            // The organization now uses members as a full package (not a trial)
            const packages = await getUpdatedPackages(organization);
            expect(packages.useMembers).toBe(true);
            expect(packages.isMembersTrial).toBe(false);
            expect(packages.useWebshops).toBe(false);

            // All 10 members are charged at €1 each
            const balanceItem = await getPackageBalanceItem(pack!);
            expect(balanceItem.quantity).toBe(10);
            expect(balanceItem.unitPrice).toBe(MEMBER_UNIT_PRICE);
            expect(balanceItem.priceWithoutVAT).toBe(10 * MEMBER_UNIT_PRICE); // €10

            // Belgian buyer with no VAT number: 21% VAT is charged on top (no reverse charge)
            expect(balanceItem.VATExcempt).toBeNull();
            expect(balanceItem.VATPercentage).toBe(21);
            expect(balanceItem.VATIncluded).toBe(false);
            expect(balanceItem.VAT).toBe(2_1000); // 21% of €10 = €2.10
            expect(balanceItem.priceWithVAT).toBe(12_1000); // €12.10
        });

        test('Activating the members package charges all members of the organization (Belgian VAT company)', async () => {
            const belgianCompany = Company.create({
                name: 'Belgische vereniging',
                companyNumber: '0123456789',
                VATNumber: 'BE0123456789',
                address: belgianAddress(),
            });
            freezeDate();
            const { organization, token, customerCompany } = await createBuyer(belgianCompany);
            await addActiveMembers(organization, 10);

            const checkout = buildCheckout({
                bundles: [STPackageBundle.Members],
                customerCompany,
                createMandate: true,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            await mollieMocker.succeedPayment();

            const pack = await getPackage(organization, STPackageType.Members);
            expect(pack).toBeDefined();
            await pack!.refresh();
            expect(pack!.validAt).not.toBeNull();

            const packages = await getUpdatedPackages(organization);
            expect(packages.useMembers).toBe(true);
            expect(packages.isMembersTrial).toBe(false);
            expect(packages.useWebshops).toBe(false);

            // All 10 members are charged at €1 each
            const balanceItem = await getPackageBalanceItem(pack!);
            expect(balanceItem.quantity).toBe(10);
            expect(balanceItem.unitPrice).toBe(MEMBER_UNIT_PRICE);
            expect(balanceItem.priceWithoutVAT).toBe(10 * MEMBER_UNIT_PRICE); // €10

            // Same country as the seller: 21% VAT is charged, no reverse charge
            expect(balanceItem.VATExcempt).toBeNull();
            expect(balanceItem.VATPercentage).toBe(21);
            expect(balanceItem.VATIncluded).toBe(false);
            expect(balanceItem.VAT).toBe(2_1000); // €2.10
            expect(balanceItem.priceWithVAT).toBe(12_1000); // €12.10
        });

        test('Activating the members package charges all members of the organization (Dutch VAT company - no VAT)', async () => {
            const dutchCompany = Company.create({
                name: 'Nederlandse vereniging',
                companyNumber: '12345678',
                VATNumber: 'NL123456789B01',
                address: dutchAddress(),
            });
            freezeDate();
            const { organization, token, customerCompany } = await createBuyer(dutchCompany);
            await addActiveMembers(organization, 10);

            const checkout = buildCheckout({
                bundles: [STPackageBundle.Members],
                customerCompany,
                createMandate: true,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            await mollieMocker.succeedPayment();

            const pack = await getPackage(organization, STPackageType.Members);
            expect(pack).toBeDefined();
            await pack!.refresh();
            expect(pack!.validAt).not.toBeNull();

            const packages = await getUpdatedPackages(organization);
            expect(packages.useMembers).toBe(true);
            expect(packages.isMembersTrial).toBe(false);
            expect(packages.useWebshops).toBe(false);

            // All 10 members are charged at €1 each
            const balanceItem = await getPackageBalanceItem(pack!);
            expect(balanceItem.quantity).toBe(10);
            expect(balanceItem.unitPrice).toBe(MEMBER_UNIT_PRICE);
            expect(balanceItem.priceWithoutVAT).toBe(10 * MEMBER_UNIT_PRICE); // €10

            // Dutch buyer, Belgian seller, both with VAT: intra community reverse charge, no VAT charged
            expect(balanceItem.VATExcempt).toBe(VATExcemptReason.IntraCommunityServices);
            expect(balanceItem.VAT).toBe(0);
            expect(balanceItem.priceWithVAT).toBe(10 * MEMBER_UNIT_PRICE); // €10, no VAT added
        });
    });

    describe('Members package (edge cases)', () => {
        test('Activating the members package with zero members charges the minimum of 1 member', async () => {
            freezeDate();
            const { organization, token, customerCompany } = await createBuyer();

            // No members registered: the organization has zero active members
            const checkout = buildCheckout({
                bundles: [STPackageBundle.Members],
                customerCompany,
                createMandate: true,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            await mollieMocker.succeedPayment();

            const pack = await getPackage(organization, STPackageType.Members);
            expect(pack).toBeDefined();
            await pack!.refresh();
            expect(pack!.validAt).not.toBeNull();

            // We always charge at least 1 member (the minimum), even with zero active members
            const balanceItem = await getPackageBalanceItem(pack!);
            expect(balanceItem.quantity).toBe(1);
            expect(balanceItem.unitPrice).toBe(MEMBER_UNIT_PRICE);
            expect(balanceItem.priceWithoutVAT).toBe(MEMBER_UNIT_PRICE); // €1
            // Belgian default company: 21% VAT on top
            expect(balanceItem.VAT).toBe(2100); // 21% of €1 = €0.21
            expect(balanceItem.priceWithVAT).toBe(1_2100); // €1.21
        });
    });

    describe('Webshops package', () => {
        test('Activating the webshops package works with the default company', async () => {
            const { organization, token, customerCompany } = await createBuyer();

            const checkout = buildCheckout({
                bundles: [STPackageBundle.Webshops],
                customerCompany,
                createMandate: true,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);
            expect(response.body.paymentUrl).not.toBeNull();

            const pack = await getPackage(organization, STPackageType.Webshops);
            expect(pack).toBeDefined();
            expect(pack!.validAt).toBeNull();

            await mollieMocker.succeedPayment();

            await pack!.refresh();
            expect(pack!.validAt).not.toBeNull();

            // The organization now uses webshops as a full package (not a trial)
            const packages = await getUpdatedPackages(organization);
            expect(packages.useWebshops).toBe(true);
            expect(packages.isWebshopsTrial).toBe(false);
            expect(packages.useMembers).toBe(false);

            // The webshops package itself is free (revenue comes from service fees per order)
            const balanceItem = await getPackageBalanceItem(pack!);
            expect(balanceItem.VATExcempt).toBeNull();
            expect(balanceItem.unitPrice).toBe(0);
            expect(balanceItem.priceWithVAT).toBe(0);

            // But a €2 minimum is charged to set up the payment mandate
            const adminFee = await getAdministrationFee(organization);
            expect(adminFee).toBeDefined();
            expect(adminFee.priceWithVAT).toBe(2_00);
        });

        test('Activating the webshops package works with a Belgian VAT company', async () => {
            const belgianCompany = Company.create({
                name: 'Belgische vereniging',
                companyNumber: '0123456789',
                VATNumber: 'BE0123456789',
                address: belgianAddress(),
            });
            const { organization, token, customerCompany } = await createBuyer(belgianCompany);

            const checkout = buildCheckout({
                bundles: [STPackageBundle.Webshops],
                customerCompany,
                createMandate: true,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            await mollieMocker.succeedPayment();

            const pack = await getPackage(organization, STPackageType.Webshops);
            expect(pack).toBeDefined();
            await pack!.refresh();
            expect(pack!.validAt).not.toBeNull();

            const packages = await getUpdatedPackages(organization);
            expect(packages.useWebshops).toBe(true);
            expect(packages.isWebshopsTrial).toBe(false);
            expect(packages.useMembers).toBe(false);

            // The webshops package itself is free
            const balanceItem = await getPackageBalanceItem(pack!);
            expect(balanceItem.VATExcempt).toBeNull();
            expect(balanceItem.unitPrice).toBe(0);
            expect(balanceItem.priceWithVAT).toBe(0);
        });

        test('Activating the webshops package works with a Dutch VAT company - no VAT is charged', async () => {
            const dutchCompany = Company.create({
                name: 'Nederlandse vereniging',
                companyNumber: '12345678',
                VATNumber: 'NL123456789B01',
                address: dutchAddress(),
            });
            const { organization, token, customerCompany } = await createBuyer(dutchCompany);

            const checkout = buildCheckout({
                bundles: [STPackageBundle.Webshops],
                customerCompany,
                createMandate: true,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            await mollieMocker.succeedPayment();

            const pack = await getPackage(organization, STPackageType.Webshops);
            expect(pack).toBeDefined();
            await pack!.refresh();
            expect(pack!.validAt).not.toBeNull();

            const packages = await getUpdatedPackages(organization);
            expect(packages.useWebshops).toBe(true);
            expect(packages.isWebshopsTrial).toBe(false);
            expect(packages.useMembers).toBe(false);

            // Reverse charge: no VAT is charged on the package balance item (which is free anyway)
            const balanceItem = await getPackageBalanceItem(pack!);
            expect(balanceItem.VATExcempt).toBe(VATExcemptReason.IntraCommunityServices);
            expect(balanceItem.unitPrice).toBe(0);
            expect(balanceItem.priceWithVAT).toBe(0);
        });

        test('Activating the webshops package ends an existing webshops trial', async () => {
            const { organization, token, customerCompany } = await createBuyer();

            // The organization already runs an active webshops trial
            const trial = await new STPackageFactory({
                organization,
                bundle: STPackageBundle.TrialWebshops,
            }).create();

            // Sanity check: the trial is active before checkout
            const activeBefore = await STPackageService.getActivePackages(organization.id);
            expect(activeBefore.map(p => p.meta.type)).toContain(STPackageType.TrialWebshops);

            const checkout = buildCheckout({
                bundles: [STPackageBundle.Webshops],
                customerCompany,
                createMandate: true,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            await mollieMocker.succeedPayment();

            const pack = await getPackage(organization, STPackageType.Webshops);
            expect(pack).toBeDefined();
            await pack!.refresh();
            expect(pack!.validAt).not.toBeNull();

            // The trial has been ended (removeAt set in the past)
            await trial.refresh();
            expect(trial.removeAt).not.toBeNull();
            expect(trial.removeAt!.getTime()).toBeLessThanOrEqual(Date.now());

            // The trial is no longer active, but the full webshops package is.
            // (meta.packages cannot distinguish this on its own: isWebshopsTrial is false because a
            // full package is active, so we verify the trial end via the active packages directly.)
            const activeAfter = await STPackageService.getActivePackages(organization.id);
            const activeTypes = activeAfter.map(p => p.meta.type);
            expect(activeTypes).toContain(STPackageType.Webshops);
            expect(activeTypes).not.toContain(STPackageType.TrialWebshops);

            const packages = await getUpdatedPackages(organization);
            expect(packages.useWebshops).toBe(true);
            expect(packages.isWebshopsTrial).toBe(false);
        });
    });

    describe('Renewing packages', () => {
        // Assert the renewed package starts when the current one ends (not now).
        const expectStartsAtEndOfCurrent = (renewed: STPackage, current: STPackage) => {
            expect(renewed.meta.startDate.getTime()).toBeGreaterThan(Date.now() + 20 * DAY);
            expect(Math.abs(renewed.meta.startDate.getTime() - current.validUntil!.getTime())).toBeLessThan(DAY);
        };

        const findRenewed = (packages: STPackage[], type: STPackageType, excludeId: string) => {
            return packages.find(p => p.meta.type === type && p.id !== excludeId);
        };

        test('Members renewal via renew ids, paying with a new payment method (Bancontact)', async () => {
            freezeDate();
            const { organization, token, customerCompany } = await createBuyer();

            // A members package that is about to expire (so a renewal stays within the 2 year limit)
            const current = await createActivePackage(organization, {
                bundle: STPackageBundle.Members,
                validUntil: new Date(Date.now() + 30 * DAY),
            });

            const checkout = buildRenewalCheckout({
                customerCompany,
                renewPackageIds: [current.id],
                newPaymentMethod: PaymentMethod.Bancontact,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);
            expect(response.body.paymentUrl).not.toBeNull();

            await mollieMocker.succeedPayment();

            const renewed = findRenewed(await getPackages(organization), STPackageType.Members, current.id)!;
            expect(renewed).toBeDefined();
            await renewed.refresh();
            expect(renewed.validAt).not.toBeNull();
            expectStartsAtEndOfCurrent(renewed, current);
        });

        test('Members renewal via renew ids, paying with an existing mandate', async () => {
            freezeDate();
            const { organization, token, customerCompany } = await createBuyer();
            const mandate = await setupExistingMandate(organization);

            const current = await createActivePackage(organization, {
                bundle: STPackageBundle.Members,
                validUntil: new Date(Date.now() + 30 * DAY),
            });

            const checkout = buildRenewalCheckout({
                customerCompany,
                renewPackageIds: [current.id],
                mandate,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            // A recurring Mollie payment is created against the existing mandate
            await mollieMocker.succeedPayment();

            const renewed = findRenewed(await getPackages(organization), STPackageType.Members, current.id)!;
            expect(renewed).toBeDefined();
            await renewed.refresh();
            expect(renewed.validAt).not.toBeNull();
            expectStartsAtEndOfCurrent(renewed, current);
        });

        test('Members renewal via package bundles starts at the end of the current package (existing mandate)', async () => {
            freezeDate();
            const { organization, token, customerCompany } = await createBuyer();
            const mandate = await setupExistingMandate(organization);

            const current = await createActivePackage(organization, {
                bundle: STPackageBundle.Members,
                validUntil: new Date(Date.now() + 30 * DAY),
            });

            const checkout = buildRenewalCheckout({
                customerCompany,
                bundles: [STPackageBundle.Members],
                mandate,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            await mollieMocker.succeedPayment();

            const renewed = findRenewed(await getPackages(organization), STPackageType.Members, current.id)!;
            expect(renewed).toBeDefined();
            await renewed.refresh();
            expect(renewed.validAt).not.toBeNull();
            // Dates start from the end of the current package, not from now
            expectStartsAtEndOfCurrent(renewed, current);
        });

        test('Members renewal via package bundles starts at the end of the current package (new Bancontact)', async () => {
            freezeDate();
            const { organization, token, customerCompany } = await createBuyer();

            const current = await createActivePackage(organization, {
                bundle: STPackageBundle.Members,
                validUntil: new Date(Date.now() + 30 * DAY),
            });

            const checkout = buildRenewalCheckout({
                customerCompany,
                bundles: [STPackageBundle.Members],
                newPaymentMethod: PaymentMethod.Bancontact,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            await mollieMocker.succeedPayment();

            const renewed = findRenewed(await getPackages(organization), STPackageType.Members, current.id)!;
            expect(renewed).toBeDefined();
            await renewed.refresh();
            expect(renewed.validAt).not.toBeNull();
            expectStartsAtEndOfCurrent(renewed, current);
        });

        test('Webshops renewal via package bundles starts at the end of the current package (existing mandate)', async () => {
            freezeDate();
            const { organization, token, customerCompany } = await createBuyer();
            const mandate = await setupExistingMandate(organization);

            // An (exceptionally) expiring webshops package, so a new one can stack after it
            const current = await createActivePackage(organization, {
                bundle: STPackageBundle.Webshops,
                validUntil: new Date(Date.now() + 30 * DAY),
            });

            const checkout = buildRenewalCheckout({
                customerCompany,
                bundles: [STPackageBundle.Webshops],
                mandate,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            // The webshops package itself is free; paying with an existing mandate settles immediately
            const renewed = findRenewed(await getPackages(organization), STPackageType.Webshops, current.id)!;
            expect(renewed).toBeDefined();
            await renewed.refresh();
            expect(renewed.validAt).not.toBeNull();
            expect(renewed.validUntil).toBeNull(); // a fresh webshops package is non-expiring
            expectStartsAtEndOfCurrent(renewed, current);
        });

        test('Webshops renewal via package bundles starts at the end of the current package (new Bancontact)', async () => {
            freezeDate();
            const { organization, token, customerCompany } = await createBuyer();

            const current = await createActivePackage(organization, {
                bundle: STPackageBundle.Webshops,
                validUntil: new Date(Date.now() + 30 * DAY),
            });

            const checkout = buildRenewalCheckout({
                customerCompany,
                bundles: [STPackageBundle.Webshops],
                newPaymentMethod: PaymentMethod.Bancontact,
            });

            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);

            // A €2 minimum is charged to set up the new mandate
            await mollieMocker.succeedPayment();

            const renewed = findRenewed(await getPackages(organization), STPackageType.Webshops, current.id)!;
            expect(renewed).toBeDefined();
            await renewed.refresh();
            expect(renewed.validAt).not.toBeNull();
            expectStartsAtEndOfCurrent(renewed, current);

            const adminFee = await getAdministrationFee(organization);
            expect(adminFee).toBeDefined();
            expect(adminFee.priceWithVAT).toBe(2_00);
        });
    });

    describe('Members fees cron (charging extra members)', () => {
        test('Members who register after activation are charged automatically', async () => {
            freezeDate();
            const { organization, token, customerCompany } = await createBuyer();
            await addActiveMembers(organization, 10);

            // Activate the members package: the initial 10 members are charged
            const checkout = buildCheckout({
                bundles: [STPackageBundle.Members],
                customerCompany,
                createMandate: true,
            });
            const response = await post(membershipOrganization.id, checkout, organization, token);
            expect(response.status).toBe(200);
            await mollieMocker.succeedPayment();

            const pack = (await getPackage(organization, STPackageType.Members))!;
            await pack.refresh();
            expect(pack.validAt).not.toBeNull();

            // The first charge covered exactly 10 members and is now paid (Due)
            const initialItem = await getPackageBalanceItem(pack);
            expect(initialItem.quantity).toBe(10);
            expect(initialItem.status).toBe(BalanceItemStatus.Due);

            // Pretend the package was bought a while ago (otherwise the cron treats the charge as
            // not-yet-settled and would recharge everything).
            pack.createdAt = new Date(Date.now() - 2 * DAY);
            await pack.save();

            // 5 more members register
            await addActiveMembers(organization, 5);

            // Run the nightly cron logic for this organization
            await chargeMemberFeesForOrganization(
                (await Organization.getByID(organization.id))!,
                (await Organization.getByID(membershipOrganization.id))!,
            );

            // A new balance item charges only the 5 extra members
            const items = await BalanceItem.select()
                .where('packageId', pack.id)
                .where('status', BalanceItemStatus.Due)
                .fetch();
            const extraItem = items.find(i => i.id !== initialItem.id);
            expect(extraItem).toBeDefined();
            expect(extraItem!.quantity).toBe(5);
            expect(extraItem!.unitPrice).toBe(MEMBER_UNIT_PRICE);
            expect(extraItem!.priceWithoutVAT).toBe(5 * MEMBER_UNIT_PRICE); // €5
            expect(extraItem!.VATPercentage).toBe(21);

            // The total charged quantity now matches the 15 active members
            const totalCharged = items.reduce((sum, i) => sum + i.quantity, 0);
            expect(totalCharged).toBe(15);

            // Running the cron again does not double-charge (everyone is already paid/pending)
            await chargeMemberFeesForOrganization(
                (await Organization.getByID(organization.id))!,
                (await Organization.getByID(membershipOrganization.id))!,
            );
            const itemsAfter = await BalanceItem.select()
                .where('packageId', pack.id)
                .where('status', BalanceItemStatus.Due)
                .fetch();
            expect(itemsAfter.reduce((sum, i) => sum + i.quantity, 0)).toBe(15);
        });
    });
});
