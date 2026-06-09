import { SimpleError } from "@simonbackx/simple-errors";
import {
    defaultSGVFunctions,
    defaultSGVGroupNumber,
    type SGVFunction,
    type SGVMember,
} from "@stamhoofd/sgv";
import {
    Address,
    BooleanStatus,
    ExternalSyncData,
    Gender,
    Group,
    GroupPrice,
    GroupSettings,
    GroupType,
    MemberDetails,
    MemberWithRegistrationsBlob,
    Organization,
    OrganizationMetaData,
    OrganizationRegistrationPeriod,
    OrganizationType,
    Parent,
    ParentType,
    Registration,
    RegistrationPeriod,
    TranslatedString,
    UmbrellaOrganization,
} from "@stamhoofd/structures";
import { Country } from "@stamhoofd/types/Country";
import {
    SGVGroupAdministration,
    SGVSyncReport,
    splitStreetNumber,
} from "./SGVGroupAdministration";

(globalThis as any).$t = (text: string) => text;
(globalThis as any).$getCountry = () => Country.Belgium;

describe("SGVGroupAdministration patch generation", () => {
    function createSgv() {
        const organization = Organization.create({
            name: "Stamhoofd Scouts",
            address: createAddress(),
            meta: OrganizationMetaData.create({
                type: OrganizationType.Youth,
                umbrellaOrganization:
                    UmbrellaOrganization.ScoutsEnGidsenVlaanderen,
            }),
            period: OrganizationRegistrationPeriod.create({
                period: RegistrationPeriod.create({ id: "period-id" }),
            }),
        });
        const sgv = new SGVGroupAdministration(
            { user: null } as any,
            { organization } as any,
            {} as any,
        );
        sgv.groupNumber = defaultSGVGroupNumber;
        sgv.functions = [
            ...defaultSGVFunctions,
            createFunction({
                id: "managed-in-stamhoofd",
                beschrijving: "Beheerd in Stamhoofd",
            }),
            createFunction({
                id: "kapoenenleiding",
                beschrijving: "Kapoenenleiding",
                code: null,
            }),
        ];
        return sgv;
    }

    function createFunction(overrides: Partial<SGVFunction>) {
        return {
            id: "function-id",
            beschrijving: "Functie",
            type: "groepseigen",
            groepen: [defaultSGVGroupNumber],
            code: "KAP",
            ...overrides,
        } satisfies SGVFunction;
    }

    function createAddress({
        street = "Teststraat",
        number = "11",
        city = "Gent",
        postalCode = "9000",
    } = {}) {
        return Address.create({
            street,
            number,
            city,
            postalCode,
            country: Country.Belgium,
        });
    }

    function createGroup(name = "Jin") {
        return Group.create({
            id: name,
            type: GroupType.Membership,
            periodId: "period-id",
            settings: GroupSettings.create({
                name: TranslatedString.create(name),
            }),
        });
    }

    function createParent({
        firstName = "Simon",
        lastName = "Backx",
        type = ParentType.Father,
        address = createAddress(),
        phone = "+32 400 00 00 00",
        email = "ouder@example.com",
    }: {
        firstName?: string;
        lastName?: string;
        type?: ParentType;
        address?: Address | null;
        phone?: string | null;
        email?: string | null;
    } = {}) {
        return Parent.create({
            firstName,
            lastName,
            type,
            address,
            phone,
            email,
        });
    }

    function createMember({
        birthDay = new Date(2009, 0, 1, 12),
        address = createAddress(),
        parents = [createParent()],
        group = createGroup(),
        email = "lid@example.com",
        gender = Gender.Male,
        requiresFinancialSupport = false,
    }: {
        birthDay?: Date | null;
        address?: Address | null;
        parents?: Parent[];
        group?: Group;
        email?: string | null;
        gender?: Gender;
        requiresFinancialSupport?: boolean;
    } = {}) {
        return MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: "Test",
                lastName: "Lid",
                birthDay,
                address,
                parents,
                email,
                gender,
                phone: "+32 499 00 00 00",
                requiresFinancialSupport: BooleanStatus.create({
                    value: requiresFinancialSupport,
                }),
            }),
            registrations: [
                Registration.create({
                    group,
                    groupPrice: GroupPrice.create({}),
                    registeredAt: new Date(2025, 8, 1),
                    deactivatedAt: null,
                }),
            ],
        });
    }

    function createSGVMember(overrides: Partial<SGVMember> = {}): SGVMember {
        return {
            id: "sgv-member",
            aangepast: "2025-01-01T00:00:00.000+01:00",
            links: [{ method: "PATCH", sections: ["email"] }],
            persoonsgegevens: {},
            vgagegevens: {
                voornaam: "Old",
                achternaam: "Name",
                geboortedatum: "2000-01-01",
            },
            verbondsgegevens: { lidnummer: "123" },
            email: "old@example.com",
            adressen: [],
            contacten: [],
            functies: [],
            ...overrides,
        };
    }

    test("splits street numbers into number and bus fields", () => {
        expect(splitStreetNumber("13 bus 3")).toEqual({
            number: "13",
            bus: "3",
        });
        expect(splitStreetNumber("13/3")).toEqual({ number: "13", bus: "3" });
        expect(splitStreetNumber("13 3")).toEqual({ number: "13", bus: "3" });
        expect(splitStreetNumber("13A3")).toEqual({ number: "13A3", bus: "" });
        expect(splitStreetNumber("13A 3")).toEqual({ number: "13A", bus: "3" });
        expect(splitStreetNumber("13 A 3")).toEqual({
            number: "13A",
            bus: "3",
        });
        expect(splitStreetNumber("13AA 3")).toEqual({
            number: "13AA",
            bus: "3",
        });
        expect(splitStreetNumber("A12")).toEqual({ number: "A12", bus: "" });
        expect(splitStreetNumber("001 bus B03")).toEqual({
            number: "1",
            bus: "3",
        });
    });

    test("reuses matching address ids and preserves SGV address fields", () => {
        const sgv = createSgv();
        const patch = sgv.getPatch(
            createMember(),
            createSGVMember({
                adressen: [
                    {
                        id: "address-existing",
                        straat: "Teststraat",
                        nummer: "11",
                        bus: "",
                        gemeente: "Gent",
                        postcode: "9000",
                        land: Country.Belgium,
                        telefoon: "",
                        postadres: true,
                        status: "normaal",
                        omschrijving: "keep me",
                    },
                ],
            }),
        );

        expect(patch.adressen?.[0]).toMatchObject({
            id: "address-existing",
            straat: "Teststraat",
            nummer: "11",
            gemeente: "Gent",
            postcode: "9000",
            postadres: true,
            omschrijving: "keep me",
        });
    });

    test("deduplicates addresses and keeps exactly one post address", () => {
        const sgv = createSgv();
        const patch = sgv.getPatch(
            createMember({
                address: createAddress(),
                parents: [
                    createParent({ address: createAddress() }),
                    createParent({
                        firstName: "Marie",
                        type: ParentType.Mother,
                        address: createAddress({ street: "Andere straat" }),
                    }),
                ],
            }),
            createSGVMember(),
        );

        expect(patch.adressen).toHaveLength(2);
        expect(patch.adressen?.filter((a) => a.postadres)).toHaveLength(1);
        expect(
            patch.adressen?.find((a) => a.straat === "Teststraat")?.postadres,
        ).toBe(true);
    });

    test("falls back to the first parent address as post address when the member has no address", () => {
        const sgv = createSgv();
        const patch = sgv.getPatch(
            createMember({
                address: null,
                parents: [
                    createParent({
                        address: createAddress({ street: "Ouderstraat" }),
                    }),
                ],
            }),
            createSGVMember(),
        );

        expect(patch.adressen).toHaveLength(1);
        expect(patch.adressen?.[0]).toMatchObject({
            straat: "Ouderstraat",
            postadres: true,
        });
    });

    test("throws a human error when a parent address is missing", () => {
        const sgv = createSgv();

        expect(() =>
            sgv.getPatch(
                createMember({
                    parents: [createParent({ address: null })],
                }),
                createSGVMember(),
            ),
        ).toThrow(SimpleError);
    });

    test("reuses matching contacts and maps parent roles", () => {
        const sgv = createSgv();
        const patch = sgv.getPatch(
            createMember({
                parents: [
                    createParent({ type: ParentType.Father }),
                    createParent({
                        firstName: "Marie",
                        lastName: "Peeters",
                        type: ParentType.Mother,
                        address: createAddress({ street: "Moederstraat" }),
                    }),
                    createParent({
                        firstName: "Voogd",
                        lastName: "Janssens",
                        type: ParentType.Other,
                        address: createAddress({ street: "Voogdstraat" }),
                    }),
                ],
            }),
            createSGVMember({
                adressen: [
                    {
                        id: "address-existing",
                        straat: "Teststraat",
                        nummer: "11",
                        bus: "",
                        gemeente: "Gent",
                        postcode: "9000",
                        land: Country.Belgium,
                        telefoon: "",
                        postadres: true,
                    },
                ],
                contacten: [
                    {
                        id: "contact-existing",
                        adres: "address-existing",
                        voornaam: "Simon",
                        achternaam: "Backx",
                        rol: "moeder",
                    },
                ],
            }),
        );

        expect(patch.contacten).toHaveLength(3);
        expect(patch.contacten?.[0]).toMatchObject({
            id: "contact-existing",
            rol: "vader",
            adres: "address-existing",
        });
        expect(patch.contacten?.[1]).toMatchObject({ rol: "moeder" });
        expect(patch.contacten?.[2]).toMatchObject({ rol: "voogd" });
    });

    test("only patches email when SGV exposes the email patch section", () => {
        const sgv = createSgv();
        const member = createMember({ email: "new@example.com" });

        expect(
            sgv.getPatch(
                member,
                createSGVMember({
                    email: "old@example.com",
                    links: [{ method: "PATCH", sections: ["email"] }],
                }),
            ),
        ).toMatchObject({ email: "new@example.com" });
        expect(
            sgv.getPatch(
                member,
                createSGVMember({
                    email: "old@example.com",
                    links: [{ method: "PATCH", sections: [] }],
                }),
            ),
        ).not.toHaveProperty("email");
        expect(
            sgv.getPatch(
                member,
                createSGVMember({
                    email: "new@example.com",
                    links: [{ method: "PATCH", sections: ["email"] }],
                }),
            ),
        ).not.toHaveProperty("email");
    });

    test("maps member details to SGV personal and VGA fields", () => {
        const sgv = createSgv();
        const patch = sgv.getPatch(
            createMember({
                gender: Gender.Female,
                requiresFinancialSupport: true,
            }),
            createSGVMember(),
        );

        expect(patch.persoonsgegevens).toMatchObject({
            geslacht: "vrouw",
            gsm: "+32 499 00 00 00",
        });
        expect(patch.vgagegevens).toMatchObject({
            voornaam: "Test",
            achternaam: "Lid",
            geboortedatum: "2009-01-01",
            beperking: false,
            verminderdlidgeld: true,
        });
    });

    test("requires a birth date", () => {
        const sgv = createSgv();

        expect(() =>
            sgv.getPatch(createMember({ birthDay: null }), createSGVMember()),
        ).toThrow(SimpleError);
    });

    test("adds expected youth and Stamhoofd managed functions", () => {
        const sgv = createSgv();
        const report = new SGVSyncReport();
        const patch = sgv.getPatch(
            createMember({ group: createGroup("Kapoenen") }),
            createSGVMember(),
            report,
        );

        expect(patch.functies?.map((f) => f.functie)).toContain(
            "d5f75b320b812440010b812555de03a2",
        );
        expect(patch.functies?.map((f) => f.functie)).toContain(
            "managed-in-stamhoofd",
        );
        expect(
            report.info.some((text) =>
                text.includes("functie toegekend Kapoen"),
            ),
        ).toBe(true);
    });

    test("preserves unmanaged functions and ends obsolete managed functions", () => {
        const sgv = createSgv();
        const patch = sgv.getPatch(
            createMember({ group: createGroup("Welpen") }),
            createSGVMember({
                functies: [
                    {
                        groep: defaultSGVGroupNumber,
                        functie: "kapoenenleiding",
                        begin: "2020-01-01",
                        omschrijving: "Kapoenenleiding",
                    },
                    {
                        groep: defaultSGVGroupNumber,
                        functie: "d5f75b320b812440010b812555de03a2",
                        begin: "2020-01-01",
                        code: "KAP",
                    },
                ],
            }),
        );

        expect(
            patch.functies?.find((f) => f.functie === "kapoenenleiding")?.einde,
        ).toBeUndefined();
        expect(
            patch.functies?.find(
                (f) => f.functie === "d5f75b320b812440010b812555de03a2",
            )?.einde,
        ).toBeTruthy();
        expect(patch.functies?.map((f) => f.functie)).toContain(
            "d5f75b320b812440010b8125567703cb",
        );
    });
});

describe("SGVGroupAdministration matching", () => {
    function createSgv() {
        const organization = Organization.create({
            name: "Stamhoofd Scouts",
            address: Address.create({
                street: "Teststraat",
                number: "1",
                postalCode: "9000",
                city: "Gent",
                country: Country.Belgium,
            }),
            meta: OrganizationMetaData.create({
                type: OrganizationType.Youth,
                umbrellaOrganization:
                    UmbrellaOrganization.ScoutsEnGidsenVlaanderen,
            }),
            period: OrganizationRegistrationPeriod.create({
                period: RegistrationPeriod.create({ id: "period-id" }),
            }),
        });
        return new SGVGroupAdministration(
            { user: null } as any,
            { organization } as any,
            {} as any,
        );
    }

    function createMember({
        firstName = "Jan",
        lastName = "Janssens",
        birthDay = new Date(2010, 0, 1, 12),
        memberNumber = null,
        registrations = undefined,
    }: {
        firstName?: string;
        lastName?: string;
        birthDay?: Date | null;
        memberNumber?: string | null;
        registrations?: Registration[];
    } = {}) {
        const group = Group.create({
            id: "group-id",
            type: GroupType.Membership,
            periodId: "period-id",
            settings: GroupSettings.create({
                name: TranslatedString.create("Jonggivers"),
            }),
        });
        return MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName,
                lastName,
                birthDay,
                memberNumber,
            }),
            registrations: registrations ?? [
                Registration.create({
                    group,
                    groupPrice: GroupPrice.create({}),
                    registeredAt: new Date(2025, 8, 1),
                    deactivatedAt: null,
                }),
            ],
        });
    }

    function createRegistration({
        periodId = "period-id",
        registeredAt = new Date(2025, 8, 1),
        deactivatedAt = null,
        waitingList = false,
    }: {
        periodId?: string;
        registeredAt?: Date | null;
        deactivatedAt?: Date | null;
        waitingList?: boolean;
    } = {}) {
        return Registration.create({
            group: Group.create({
                id: `group-${periodId}-${waitingList ? "waiting" : "active"}`,
                type: GroupType.Membership,
                periodId,
                settings: GroupSettings.create({
                    name: TranslatedString.create("Jonggivers"),
                }),
            }),
            groupPrice: GroupPrice.create({}),
            registeredAt,
            deactivatedAt,
            waitingList,
        });
    }

    function createNavigationActions(onMatches: (matches: any[]) => void) {
        return {
            present: async (options: any) => {
                const props = options.components[0].properties;
                onMatches(props.matches);
                props.onVerified(props.matches);
            },
        } as any;
    }

    test("matches exact member numbers before name and birth date", async () => {
        const sgv = createSgv();
        const member = createMember({ memberNumber: "123" });
        sgv.members = [
            {
                id: "sgv-1",
                firstName: "Different",
                lastName: "Name",
                memberNumber: "123",
                birthDay: new Date(2000, 0, 1, 12),
            },
        ];
        sgv.loadOrganizationMembers = async () => [member];
        sgv.searchSimilar = async () => {
            throw new Error(
                "Similar search should not be called for exact member-number matches",
            );
        };

        const result = await sgv.matchAndSync(
            createNavigationActions(() => undefined),
            () => undefined,
        );

        expect(result.matchedMembers).toEqual([
            { member: member, sgvId: "sgv-1" },
        ]);
        expect(result.newMembers).toEqual([]);
    });

    test("matches exact similar-search results without manual verification", async () => {
        const sgv = createSgv();
        const member = createMember();
        sgv.members = [];
        sgv.loadOrganizationMembers = async () => [member];
        sgv.searchSimilar = async () => ({
            id: "sgv-1",
            voornaam: "Jan",
            achternaam: "Janssens",
            geboortedatum: "2010-01-01",
        });

        const result = await sgv.matchAndSync(
            createNavigationActions(() => {
                throw new Error(
                    "Exact search result should not open verification",
                );
            }),
            () => undefined,
        );

        expect(result.matchedMembers).toEqual([
            { member: member, sgvId: "sgv-1" },
        ]);
        expect(result.newMembers).toEqual([]);
    });

    test("opens verification for probable matches and accepts checked matches", async () => {
        const sgv = createSgv();
        const member = createMember({ firstName: "Jan", lastName: "Janssens" });
        let openedPopup = false;
        let verify: boolean | null = null;
        sgv.members = [];
        sgv.loadOrganizationMembers = async () => [member];
        sgv.searchSimilar = async () => ({
            id: "sgv-1",
            voornaam: "Jon",
            achternaam: "Janssens",
            geboortedatum: "2010-01-01",
        });

        const result = await sgv.matchAndSync(
            createNavigationActions((matches) => {
                verify = matches[0].verify;
            }),
            () => {
                openedPopup = true;
            },
        );

        expect(openedPopup).toBe(true);
        expect(verify).toBe(true);
        expect(result.matchedMembers).toEqual([
            { member: member, sgvId: "sgv-1" },
        ]);
        expect(result.newMembers).toEqual([]);
    });

    test("defaults last-resort similar-search matches to unchecked", async () => {
        const sgv = createSgv();
        const member = createMember({ firstName: "Jan", lastName: "Janssens" });
        let verify: boolean | null = null;
        sgv.members = [];
        sgv.loadOrganizationMembers = async () => [member];
        sgv.searchSimilar = async () => ({
            id: "sgv-1",
            voornaam: "Jon",
            achternaam: "Janssens",
            geboortedatum: "2010-01-03",
        });

        const result = await sgv.matchAndSync(
            createNavigationActions((matches) => {
                verify = matches[0].verify;
            }),
            () => undefined,
        );

        expect(verify).toBe(false);
        expect(result.matchedMembers).toEqual([]);
        expect(result.newMembers).toEqual([member]);
    });

    test("moves rejected existing downloaded probable matches back to new members", async () => {
        const sgv = createSgv();
        const member = createMember({ firstName: "Jan", lastName: "Janssens" });
        sgv.members = [
            {
                id: "sgv-1",
                firstName: "Jon",
                lastName: "Janssens",
                memberNumber: "",
                birthDay: new Date(2010, 0, 1, 12),
            },
        ];
        sgv.loadOrganizationMembers = async () => [member];
        sgv.searchSimilar = async () => undefined;

        const result = await sgv.matchAndSync(
            {
                present: async (options: any) => {
                    const props = options.components[0].properties;
                    props.matches[0].verify = false;
                    props.onVerified(props.matches);
                },
            } as any,
            () => undefined,
        );

        expect(result.matchedMembers).toEqual([]);
        expect(result.newMembers).toEqual([member]);
    });

    test("keeps clear non-matches as new members", async () => {
        const sgv = createSgv();
        const member = createMember({ firstName: "Jan", lastName: "Janssens" });
        sgv.members = [
            {
                id: "sgv-1",
                firstName: "Completely",
                lastName: "Different",
                memberNumber: "",
                birthDay: new Date(2000, 0, 1, 12),
            },
        ];
        sgv.loadOrganizationMembers = async () => [member];
        sgv.searchSimilar = async () => undefined;

        const result = await sgv.matchAndSync(
            createNavigationActions(() => {
                throw new Error(
                    "Clear non-matches should not open verification",
                );
            }),
            () => undefined,
        );

        expect(result.matchedMembers).toEqual([]);
        expect(result.newMembers).toEqual([member]);
    });

    test("only syncs members with an active registration in the organization period", async () => {
        const sgv = createSgv();
        const registeredMember = createMember({
            firstName: "Actief",
            lastName: "Lid",
        });
        const unregisteredMember = createMember({
            firstName: "Geen",
            lastName: "Lid",
            registrations: [],
        });
        const deactivatedMember = createMember({
            firstName: "Gestopt",
            lastName: "Lid",
            registrations: [
                createRegistration({ deactivatedAt: new Date(2025, 9, 1) }),
            ],
        });
        const waitingListMember = createMember({
            firstName: "Wachtlijst",
            lastName: "Lid",
            registrations: [
                createRegistration({ registeredAt: null, waitingList: true }),
            ],
        });
        const notYetRegisteredMember = createMember({
            firstName: "Niet",
            lastName: "Ingeschreven",
            registrations: [createRegistration({ registeredAt: null })],
        });
        const previousPeriodMember = createMember({
            firstName: "Oud",
            lastName: "Werkjaar",
            registrations: [
                createRegistration({ periodId: "previous-period-id" }),
            ],
        });
        sgv.members = [];
        sgv.loadOrganizationMembers = async () => [
            registeredMember,
            unregisteredMember,
            deactivatedMember,
            waitingListMember,
            notYetRegisteredMember,
            previousPeriodMember,
        ];
        sgv.searchSimilar = async () => undefined;

        const result = await sgv.matchAndSync(
            createNavigationActions(() => {
                throw new Error(
                    "Clear non-matches should not open verification",
                );
            }),
            () => undefined,
        );

        expect(result.matchedMembers).toEqual([]);
        expect(result.newMembers).toEqual([registeredMember]);
    });
});

describe("SGVGroupAdministration request middleware and metadata", () => {
    function createOrganization() {
        return Organization.create({
            name: "Stamhoofd Scouts",
            address: Address.create({
                street: "Teststraat",
                number: "1",
                postalCode: "9000",
                city: "Gent",
                country: Country.Belgium,
            }),
            meta: OrganizationMetaData.create({
                type: OrganizationType.Youth,
                umbrellaOrganization:
                    UmbrellaOrganization.ScoutsEnGidsenVlaanderen,
            }),
            period: OrganizationRegistrationPeriod.create({
                period: RegistrationPeriod.create({ id: "period-id" }),
            }),
        });
    }

    function createSgv(user: any = null) {
        const sgv = new SGVGroupAdministration(
            { user } as any,
            { organization: createOrganization() } as any,
            {} as any,
        );
        sgv.groupNumber = defaultSGVGroupNumber;
        sgv.functions = [
            ...defaultSGVFunctions,
            {
                id: "managed-in-stamhoofd",
                beschrijving: "Beheerd in Stamhoofd",
                type: "groepseigen",
                groepen: [defaultSGVGroupNumber],
                code: null,
            },
        ];
        return sgv;
    }

    function createRequest(responseType: "json" | "text" = "json") {
        return {
            headers: {},
            responseType,
            responseContentTypeOverride: undefined,
            errorDecoder: undefined,
        } as any;
    }

    function createMember(name = "Test Lid") {
        const [firstName, lastName] = name.split(" ");
        const group = Group.create({
            id: "group-id",
            type: GroupType.Membership,
            periodId: "period-id",
            settings: GroupSettings.create({
                name: TranslatedString.create("Kapoenen"),
            }),
        });
        return MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName,
                lastName,
                birthDay: new Date(2018, 0, 1, 12),
            }),
            registrations: [
                Registration.create({
                    group,
                    groupPrice: GroupPrice.create({}),
                    registeredAt: new Date(2025, 8, 1),
                    deactivatedAt: null,
                }),
            ],
        });
    }

    test("sets SGV request headers and JSON response override", async () => {
        const sgv = createSgv();
        sgv.token = {
            accessToken: "access-token",
            refreshToken: "refresh-token",
            validUntil: new Date(Date.now() + 1000 * 60),
        };
        const request = createRequest();

        await sgv.onBeforeRequest(request);

        expect(request.headers).toMatchObject({
            Authorization: "Bearer access-token",
            Accept: "application/json",
        });
        expect(request.responseContentTypeOverride).toBe("application/json");
        expect(request.errorDecoder).toBeTruthy();
    });

    test("does not set JSON response override for text requests", async () => {
        const sgv = createSgv();
        sgv.token = {
            accessToken: "access-token",
            refreshToken: "refresh-token",
            validUntil: new Date(Date.now() + 1000 * 60),
        };
        const request = createRequest("text");

        await sgv.onBeforeRequest(request);

        expect(request.responseContentTypeOverride).toBeUndefined();
    });

    test("refreshes expired tokens before requests", async () => {
        const sgv = createSgv();
        sgv.token = {
            accessToken: "old-token",
            refreshToken: "refresh-token",
            validUntil: new Date(Date.now() - 1000),
        };
        let didRefresh = false;
        sgv.refreshToken = async () => {
            didRefresh = true;
            sgv.token = {
                accessToken: "new-token",
                refreshToken: "new-refresh-token",
                validUntil: new Date(Date.now() + 1000 * 60),
            };
        };
        const request = createRequest();

        await sgv.onBeforeRequest(request);

        expect(didRefresh).toBe(true);
        expect(request.headers.Authorization).toBe("Bearer new-token");
    });

    test("requires a token before authenticated SGV requests", async () => {
        const sgv = createSgv();

        await expect(sgv.onBeforeRequest(createRequest())).rejects.toThrow(
            "Could not authenticate SGV request without token",
        );
    });

    test("keeps current external sync metadata when the report has errors", () => {
        const sgv = createSgv();
        const current = ExternalSyncData.create({
            lastExternalSync: new Date(2025, 0, 1),
            counts: new Map([["Kapoen", 1]]),
        });
        const report = new SGVSyncReport();
        report.addError(new Error("Failed"));

        expect(sgv.createExternalSyncData(report, current)).toBe(current);
    });

    test("creates external sync metadata from successful report counts", () => {
        const sgv = createSgv({
            firstName: "Sync",
            lastName: "User",
            email: "sync@example.com",
        });
        const report = new SGVSyncReport();
        const member = createMember("Nieuw Lid");
        report.markCreated(member, {
            id: "sgv-member",
            aangepast: "2025-01-01T00:00:00.000+01:00",
            persoonsgegevens: {},
            vgagegevens: {
                voornaam: "Nieuw",
                achternaam: "Lid",
                geboortedatum: "2018-01-01",
            },
            verbondsgegevens: { lidnummer: "123" },
            adressen: [],
            contacten: [],
            functies: [
                {
                    groep: defaultSGVGroupNumber,
                    functie: "d5f75b320b812440010b812555de03a2",
                    code: "KAP",
                    omschrijving: "Kapoen",
                },
                {
                    groep: defaultSGVGroupNumber,
                    functie: "ended",
                    code: "KW",
                    omschrijving: "Welpen",
                    einde: "2025-01-01",
                },
            ],
        });
        report.markDeleted({
            id: "old",
            firstName: "Oud",
            lastName: "Lid",
            birthDay: new Date(2010, 0, 1),
            memberNumber: "456",
        });

        const metadata = sgv.createExternalSyncData(report, null);

        expect(metadata?.lastSyncedBy).toBe("Sync User");
        expect(metadata?.lastDeleted).toBeInstanceOf(Date);
        expect(metadata?.counts.get("Kapoen")).toBe(1);
        expect(metadata?.counts.has("Welpen")).toBe(false);
    });

    test("keeps previous deletion date when no members were deleted", () => {
        const sgv = createSgv();
        const previousDeleted = new Date(2025, 0, 1);
        const current = ExternalSyncData.create({
            lastDeleted: previousDeleted,
        });
        const report = new SGVSyncReport();

        const metadata = sgv.createExternalSyncData(report, current);

        expect(metadata?.lastDeleted).toBe(previousDeleted);
    });
});
