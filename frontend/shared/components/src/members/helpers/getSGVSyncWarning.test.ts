import {
    Group,
    GroupPrice,
    GroupType,
    MemberDetails,
    MemberWithRegistrationsBlob,
    Organization,
    OrganizationMetaData,
    OrganizationRegistrationPeriod,
    OrganizationType,
    Registration,
    RegistrationPeriod,
    SGVSyncStatus,
    UmbrellaOrganization,
} from "@stamhoofd/structures";
import { Country } from "@stamhoofd/types/Country";
import { getSGVSyncWarning } from "./getSGVSyncWarning";

(globalThis as any).$t = (
    text: string,
    replacements?: Record<string, string>,
) => {
    if (text === "%tN") {
        return replacements?.singular ?? text;
    }
    if (text === "%2d") {
        return replacements?.number ?? text;
    }
    return text;
};
(globalThis as any).$getCountry = () => Country.Belgium;

describe("getSGVSyncWarning", () => {
    const now = new Date(2026, 5, 1, 12);

    function createOrganization({
        type = OrganizationType.Youth,
        umbrellaOrganization = UmbrellaOrganization.ScoutsEnGidsenVlaanderen,
    }: {
        type?: OrganizationType;
        umbrellaOrganization?: UmbrellaOrganization | null;
    } = {}) {
        return Organization.create({
            meta: OrganizationMetaData.create({
                type,
                umbrellaOrganization,
            }),
            period: OrganizationRegistrationPeriod.create({
                period: RegistrationPeriod.create({ id: "period-id" }),
            }),
        });
    }

    function createGroup(type = GroupType.Membership, periodId = "period-id") {
        return Group.create({
            id: `${type}-${periodId}`,
            type,
            periodId,
        });
    }

    function createMember({
        lastExternalSync = new Date(now.getTime() - 1000 * 60),
        updatedAt = lastExternalSync ?? now,
        registeredAt = new Date(now.getTime() - 1000 * 60 * 2),
        group = createGroup(),
    }: {
        lastExternalSync?: Date | null;
        updatedAt?: Date;
        registeredAt?: Date | null;
        group?: Group;
    } = {}) {
        return MemberWithRegistrationsBlob.create({
            updatedAt,
            details: MemberDetails.create({
                lastExternalSync,
            }),
            registrations: [
                Registration.create({
                    group,
                    groupPrice: GroupPrice.create({}),
                    registeredAt,
                    deactivatedAt: null,
                }),
            ],
        });
    }

    test("returns null for non-SGV organizations", () => {
        const member = createMember({ lastExternalSync: null });

        expect(getSGVSyncWarning([member], null, true)).toBeNull();
        expect(
            getSGVSyncWarning(
                [member],
                createOrganization({ type: OrganizationType.Other }),
                true,
            ),
        ).toBeNull();
        expect(
            getSGVSyncWarning(
                [member],
                createOrganization({ umbrellaOrganization: null }),
                true,
            ),
        ).toBeNull();
    });

    test("returns null when all managed members are synced", () => {
        expect(
            getSGVSyncWarning([createMember()], createOrganization(), true),
        ).toBeNull();
    });

    test("ignores unmanaged members", () => {
        const member = createMember({
            lastExternalSync: null,
            group: createGroup(GroupType.EventRegistration),
        });

        expect(
            getSGVSyncWarning([member], createOrganization(), true),
        ).toBeNull();
    });

    test("prioritizes never above other statuses and combines warning text", () => {
        const warning = getSGVSyncWarning(
            [
                createMember({ lastExternalSync: null }),
                createMember({
                    lastExternalSync: new Date(now.getTime() - 1000 * 60 * 2),
                    registeredAt: new Date(now.getTime() - 1000 * 60),
                }),
                createMember({
                    lastExternalSync: new Date(now.getTime() - 1000 * 60 * 2),
                    updatedAt: new Date(now.getTime() - 1000 * 60),
                }),
            ],
            createOrganization(),
            true,
        );

        expect(warning?.status).toBe(SGVSyncStatus.Never);
        expect(warning?.text).toContain("nog niet in de groepsadministratie");
        expect(warning?.text).toContain("gewijzigde inschrijving");
        expect(warning?.text).toContain("gewijzigde gegevens");
        expect(warning?.text).toContain(
            "Synchroniseer met de groepsadministratie.",
        );
    });

    test("prioritizes outdated above changed when no members are missing", () => {
        const warning = getSGVSyncWarning(
            [
                createMember({
                    lastExternalSync: new Date(now.getTime() - 1000 * 60 * 2),
                    registeredAt: new Date(now.getTime() - 1000 * 60),
                }),
                createMember({
                    lastExternalSync: new Date(now.getTime() - 1000 * 60 * 2),
                    updatedAt: new Date(now.getTime() - 1000 * 60),
                }),
            ],
            createOrganization(),
            true,
        );

        expect(warning?.status).toBe(SGVSyncStatus.Outdated);
    });

    test("uses limited-access wording", () => {
        const warning = getSGVSyncWarning(
            [createMember({ lastExternalSync: null })],
            createOrganization(),
            false,
        );

        expect(warning?.text).toContain(
            "Vraag je VGA of groepsleiding om te synchroniseren.",
        );
    });

    test("uses the organization period to calculate registration changes", () => {
        const warning = getSGVSyncWarning(
            [
                createMember({
                    lastExternalSync: new Date(now.getTime() - 1000 * 60 * 2),
                    registeredAt: new Date(now.getTime() - 1000 * 60),
                    group: createGroup(GroupType.Membership, "other-period"),
                }),
            ],
            createOrganization(),
            true,
        );

        expect(warning).toBeNull();
    });
});
