import { TestUtils } from '@stamhoofd/test-utils';
import { BalanceItemRelationType, BalanceItemType, getApplicableBalanceItemRelationTypes, getApplicableBalanceItemTypes } from './BalanceItem.js';
import { Organization } from './Organization.js';
import { Platform } from './Platform.js';

describe('getApplicableBalanceItemTypes / getApplicableBalanceItemRelationTypes', () => {
    const membershipOrganization = Organization.create({ id: 'membership-org' });
    const otherOrganization = Organization.create({ id: 'other-org' });
    const platform = Platform.create({ membershipOrganizationId: 'membership-org' });

    describe('a regular organization (organization mode, not the membership organization)', () => {
        test('hides Stamhoofd billing and platform membership items', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            TestUtils.setEnvironment('platformName', 'stamhoofd');

            const types = getApplicableBalanceItemTypes(otherOrganization, platform);
            expect(types).not.toContain(BalanceItemType.STPackage);
            expect(types).not.toContain(BalanceItemType.ServiceFee);
            expect(types).not.toContain(BalanceItemType.TransferFee);
            expect(types).not.toContain(BalanceItemType.ReferralDiscount);
            expect(types).not.toContain(BalanceItemType.PlatformMembership);
            expect(types).toContain(BalanceItemType.Registration);

            const relations = getApplicableBalanceItemRelationTypes(otherOrganization, platform);
            expect(relations).not.toContain(BalanceItemRelationType.STPackage);
            expect(relations).not.toContain(BalanceItemRelationType.STPricingType);
            expect(relations).not.toContain(BalanceItemRelationType.PaymentProvider);
            expect(relations).not.toContain(BalanceItemRelationType.MembershipType);
            expect(relations).toContain(BalanceItemRelationType.Group);
        });
    });

    describe('the Stamhoofd membership organization (organization mode)', () => {
        test('shows Stamhoofd billing items but still hides the platform membership', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            // Comparison is case-insensitive
            TestUtils.setEnvironment('platformName', 'Stamhoofd');

            const types = getApplicableBalanceItemTypes(membershipOrganization, platform);
            expect(types).toContain(BalanceItemType.STPackage);
            expect(types).toContain(BalanceItemType.ServiceFee);
            expect(types).toContain(BalanceItemType.TransferFee);
            expect(types).toContain(BalanceItemType.ReferralDiscount);
            expect(types).not.toContain(BalanceItemType.PlatformMembership);

            const relations = getApplicableBalanceItemRelationTypes(membershipOrganization, platform);
            expect(relations).toContain(BalanceItemRelationType.STPackage);
            expect(relations).toContain(BalanceItemRelationType.STPricingType);
            expect(relations).toContain(BalanceItemRelationType.PaymentProvider);
            expect(relations).not.toContain(BalanceItemRelationType.MembershipType);
        });

        test('hides Stamhoofd billing items on a non-Stamhoofd platform', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            TestUtils.setEnvironment('platformName', 'My platform');

            const types = getApplicableBalanceItemTypes(membershipOrganization, platform);
            expect(types).not.toContain(BalanceItemType.STPackage);

            const relations = getApplicableBalanceItemRelationTypes(membershipOrganization, platform);
            expect(relations).not.toContain(BalanceItemRelationType.STPackage);
        });
    });

    describe('the membership organization (platform mode)', () => {
        test('shows the platform membership but hides Stamhoofd billing items', () => {
            TestUtils.setEnvironment('userMode', 'platform');
            TestUtils.setEnvironment('platformName', 'My platform');

            const types = getApplicableBalanceItemTypes(membershipOrganization, platform);
            expect(types).toContain(BalanceItemType.PlatformMembership);
            expect(types).not.toContain(BalanceItemType.STPackage);
            expect(types).not.toContain(BalanceItemType.ServiceFee);

            const relations = getApplicableBalanceItemRelationTypes(membershipOrganization, platform);
            expect(relations).toContain(BalanceItemRelationType.MembershipType);
            expect(relations).not.toContain(BalanceItemRelationType.STPackage);
        });
    });

    describe('a non-membership organization (platform mode)', () => {
        test('hides both the platform membership and Stamhoofd billing items', () => {
            TestUtils.setEnvironment('userMode', 'platform');
            TestUtils.setEnvironment('platformName', 'My platform');

            const types = getApplicableBalanceItemTypes(otherOrganization, platform);
            expect(types).not.toContain(BalanceItemType.PlatformMembership);
            expect(types).not.toContain(BalanceItemType.STPackage);

            const relations = getApplicableBalanceItemRelationTypes(otherOrganization, platform);
            expect(relations).not.toContain(BalanceItemRelationType.MembershipType);
            expect(relations).not.toContain(BalanceItemRelationType.STPackage);
        });
    });

    describe('a platform-wide view (null organization, treated as the membership organization)', () => {
        test('in organization mode on the Stamhoofd platform, shows Stamhoofd billing items but not the platform membership', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            TestUtils.setEnvironment('platformName', 'stamhoofd');

            const types = getApplicableBalanceItemTypes(null, platform);
            expect(types).toContain(BalanceItemType.STPackage);
            expect(types).not.toContain(BalanceItemType.PlatformMembership);

            const relations = getApplicableBalanceItemRelationTypes(null, platform);
            expect(relations).toContain(BalanceItemRelationType.STPackage);
            expect(relations).not.toContain(BalanceItemRelationType.MembershipType);
        });

        test('in platform mode, shows the platform membership but not Stamhoofd billing items', () => {
            TestUtils.setEnvironment('userMode', 'platform');
            TestUtils.setEnvironment('platformName', 'My platform');

            const types = getApplicableBalanceItemTypes(null, platform);
            expect(types).toContain(BalanceItemType.PlatformMembership);
            expect(types).not.toContain(BalanceItemType.STPackage);

            const relations = getApplicableBalanceItemRelationTypes(null, platform);
            expect(relations).toContain(BalanceItemRelationType.MembershipType);
            expect(relations).not.toContain(BalanceItemRelationType.STPackage);
        });
    });
});
