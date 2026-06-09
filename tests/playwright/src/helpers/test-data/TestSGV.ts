import { OrganizationFactory, Token, UserFactory } from "@stamhoofd/models";
import type {
    Group,
    MemberWithUsersRegistrationsAndGroups,
    Organization,
    User,
} from "@stamhoofd/models";
import {
    Address,
    Gender,
    MemberDetails,
    OrganizationMetaData,
    OrganizationType,
    Parent,
    ParentType,
    PermissionLevel,
    Permissions,
    STPackageStatus,
    STPackageType,
    UmbrellaOrganization,
} from "@stamhoofd/structures";
import { Country } from "@stamhoofd/types/Country";
import { TestGroups } from "./TestGroups.js";
import { TestMembers } from "./TestMembers.js";
import { TestOrganizations } from "./TestOrganizations.js";

export type SGVYouthOrganizationContext = Awaited<
    ReturnType<typeof TestOrganizations.youthOrganization1>
> & {
    organization: Organization;
};

export type SGVUserContext = {
    user: User;
    email: string;
    password: string;
};

/** Test-data factory for SGV sync scenarios, including compatible organizations, users, and members. */
export class TestSGV {
    static async youthOrganization(
        name = "SGV Playwright Scouts",
    ): Promise<SGVYouthOrganizationContext> {
        const organization = await new OrganizationFactory({
            name,
            meta: OrganizationMetaData.create({
                type: OrganizationType.Youth,
                umbrellaOrganization:
                    UmbrellaOrganization.ScoutsEnGidsenVlaanderen,
            }),
        }).create();

        const context =
            await TestOrganizations.youthOrganization1(organization);

        organization.meta.type = OrganizationType.Youth;
        organization.meta.umbrellaOrganization =
            UmbrellaOrganization.ScoutsEnGidsenVlaanderen;
        organization.meta.packages.packages.set(
            STPackageType.Members,
            STPackageStatus.create({
                startDate: new Date(),
            }),
        );
        organization.meta.recordsConfiguration.financialSupport = true;

        const kapoenen = await TestGroups.defaultGroup("Kapoenen")(
            organization,
            context.periods[0],
        );
        context.categories.takken.groupIds.push(kapoenen.id);
        await context.organizationPeriods[0].save();
        await organization.save();

        return context;
    }

    static async nonSGVYouthOrganization(name = "Non SGV Playwright Youth") {
        const organization = await new OrganizationFactory({
            name,
            meta: OrganizationMetaData.create({
                type: OrganizationType.Youth,
                umbrellaOrganization: null,
            }),
        }).create();

        const context =
            await TestOrganizations.youthOrganization1(organization);

        organization.meta.type = OrganizationType.Youth;
        organization.meta.umbrellaOrganization = null;
        organization.meta.packages.packages.set(
            STPackageType.Members,
            STPackageStatus.create({
                startDate: new Date(),
            }),
        );
        await organization.save();

        return context;
    }

    static async user(
        organization: Organization,
        options: {
            email?: string;
            password?: string;
            level?: PermissionLevel;
        } = {},
    ): Promise<SGVUserContext> {
        const email =
            options.email ??
            `sgv-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
        const password = options.password ?? "testAbc123456";
        const user = await new UserFactory({
            firstName: "SGV",
            lastName: "Tester",
            email,
            password,
            organization,
            permissions: Permissions.create({
                level: options.level ?? PermissionLevel.Full,
            }),
        }).create();

        await Token.createToken(user);

        return { user, email, password };
    }

    static async member(
        organization: Organization,
        group: Group,
        options: {
            firstName?: string;
            lastName?: string;
            birthDay?: { year: number; month: number; day: number };
            lastExternalSync?: Date | null;
        } = {},
    ): Promise<MemberWithUsersRegistrationsAndGroups> {
        const details = MemberDetails.create({
            firstName: options.firstName ?? "Lotte",
            lastName: options.lastName ?? "Peeters",
            gender: Gender.Female,
            birthDay: new Date(
                options.birthDay?.year ?? 2014,
                (options.birthDay?.month ?? 4) - 1,
                options.birthDay?.day ?? 12,
            ),
            address: Address.create({
                street: "Scoutstraat",
                number: "13",
                postalCode: "9000",
                city: "Gent",
                country: Country.Belgium,
            }),
            parents: [
                Parent.create({
                    type: ParentType.Mother,
                    firstName: "Sara",
                    lastName: "Peeters",
                    email: "sara.peeters@example.com",
                    phone: "+32470000000",
                    address: Address.create({
                        street: "Scoutstraat",
                        number: "13",
                        postalCode: "9000",
                        city: "Gent",
                        country: Country.Belgium,
                    }),
                }),
            ],
            lastExternalSync: options.lastExternalSync ?? null,
        });

        const member = await TestMembers.defaultMember({
            firstName: details.firstName,
            lastName: details.lastName,
            organization,
            group,
        });
        member.details = details;
        await member.save();

        return member;
    }
}
