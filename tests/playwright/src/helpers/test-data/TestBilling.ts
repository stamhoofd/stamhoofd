import type { MollieMocker } from '@stamhoofd/backend/tests/helpers';
import type { User } from '@stamhoofd/models';
import { Organization, Platform, STPackage } from '@stamhoofd/models';
import {
    Company,
    MollieOnboarding,
    MollieStatus,
    PaymentMethod,
    PermissionLevel,
    Permissions,
    STPackageMeta,
    STPackageType,
    STPricingType,
    UserPermissions,
} from '@stamhoofd/structures';

/**
 * Reusable seeding for the SAAS package activation / billing flow.
 *
 * The "selling" organization is always the platform membership organization (created by
 * initMembershipOrganization). The "paying" organization is the worker organization the
 * authenticated user belongs to.
 */
export class TestBilling {
    /**
     * Configure the membership (selling) organization so it can receive Mollie payments and
     * create mandates. Also registers a Mollie OAuth token via the mocker.
     */
    static async setupMembershipOrganization(mollieMocker: MollieMocker): Promise<Organization> {
        const platform = await Platform.getShared();
        if (!platform.membershipOrganizationId) {
            throw new Error('No membership organization configured');
        }
        const membershipOrganization = await Organization.getByID(platform.membershipOrganizationId);
        if (!membershipOrganization) {
            throw new Error('Membership organization not found');
        }

        // Enable Mollie as the payment provider (privateMeta.getPaymentProviderFor checks mollieOnboarding)
        membershipOrganization.privateMeta.mollieOnboarding = MollieOnboarding.create({
            canReceivePayments: true,
            canReceiveSettlements: true,
            status: MollieStatus.Completed,
        });

        // Offer credit card (a mandate-capable method that maps to Mollie) to buyers and enable mandates
        const config = membershipOrganization.meta.registrationPaymentConfiguration;
        for (const method of [PaymentMethod.CreditCard, PaymentMethod.Bancontact]) {
            if (!config.paymentMethods.includes(method)) {
                config.paymentMethods.push(method);
            }
        }
        config.enableMandates = true;

        await membershipOrganization.save();

        await mollieMocker.setupToken(membershipOrganization);

        return membershipOrganization;
    }

    /**
     * The worker organization the authenticated user belongs to (the paying organization).
     */
    static async getPayingOrganization(user: User): Promise<Organization> {
        if (!user.organizationId) {
            throw new Error('User has no organization');
        }
        const organization = await Organization.getByID(user.organizationId);
        if (!organization) {
            throw new Error('Paying organization not found');
        }
        return organization;
    }

    /**
     * Give the user full permissions (required for canActivatePackages) and make sure the paying
     * organization has a billing company (required for B2B checkout customer validation).
     */
    static async preparePayingOrganization(user: User, organization: Organization) {
        if (organization.meta.companies.length === 0) {
            organization.meta.companies.push(Company.create({
                name: organization.name,
                companyNumber: '0123456789',
                address: organization.address,
            }));
            await organization.save();
        }

        // Reset any Mollie state left over from a previous test so each test starts clean.
        organization.serverMeta.mollieCustomerId = undefined;
        organization.serverMeta.mollieMandateId = null;
        await organization.save();

        if (!user.permissions) {
            user.permissions = UserPermissions.create({});
        }
        user.permissions.organizationPermissions.set(
            organization.id,
            Permissions.create({ level: PermissionLevel.Full }),
        );
        await user.save();
    }

    /**
     * Create an already-active package for the paying organization, with custom validity dates.
     * Use this to put a package "near expiry" or "expired" without waiting.
     */
    static async createActivePackage(organization: Organization, options: {
        type: STPackageType;
        validUntil: Date | null;
        removeAt?: Date | null;
        validAt?: Date;
    }): Promise<STPackage> {
        const pack = new STPackage();
        pack.organizationId = organization.id;
        pack.meta = TestBilling.metaForType(options.type);
        pack.validAt = options.validAt ?? new Date(Date.now() - 1000 * 60 * 60 * 24);
        pack.validUntil = options.validUntil;
        pack.removeAt = options.removeAt ?? (options.validUntil ? new Date(options.validUntil.getTime() + 1000 * 60 * 60 * 24 * 31) : null);
        await pack.save();
        return pack;
    }

    static metaForType(type: STPackageType): STPackageMeta {
        const startDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 360);
        switch (type) {
            case STPackageType.Members:
                return STPackageMeta.create({
                    type: STPackageType.Members,
                    unitPrice: 1_0000,
                    minimumAmount: 0,
                    allowRenew: true,
                    pricingType: STPricingType.PerMember,
                    startDate,
                    canDeactivate: false,
                });
            case STPackageType.Webshops:
                return STPackageMeta.create({
                    type: STPackageType.Webshops,
                    unitPrice: 0,
                    minimumAmount: 0,
                    allowRenew: false,
                    pricingType: STPricingType.Fixed,
                    serviceFeeFixed: 0,
                    serviceFeePercentage: 2_00,
                    serviceFeeMaximum: 2000,
                    startDate,
                    canDeactivate: true,
                });
            default:
                throw new Error('Unsupported package type for seeding: ' + type);
        }
    }
}
