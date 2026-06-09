import type {
    SGVFunction,
    SGVGroup,
    SGVMember,
    SGVProfileResponse,
} from "./types.js";

/** Stable group number used by SGV fixtures so tests can share matching groups, functions, and members. */
export const defaultSGVGroupNumber = "O1234";

export const defaultSGVGroup: SGVGroup = {
    id: "group-1",
    groepsnummer: defaultSGVGroupNumber,
    naam: "Stamhoofd Scouts",
    adressen: [
        {
            id: "address-group-1",
            land: "BE",
            postcode: "9000",
            gemeente: "Gent",
            straat: "Demostraat",
            nummer: "1",
            bus: "",
            telefoon: "",
            postadres: true,
            status: "normaal",
            positie: { latitude: 0, longitude: 0 },
            omschrijving: "",
        },
    ],
};

export const defaultSGVFunctions: SGVFunction[] = [
    {
        id: "d5f75b320b812440010b812555de03a2",
        beschrijving: "Kapoen",
        type: "groepseigen",
        groepen: [defaultSGVGroupNumber],
        code: "KAP",
    },
    {
        id: "d5f75b320b812440010b8125567703cb",
        beschrijving: "Kabouter/Welp",
        type: "groepseigen",
        groepen: [defaultSGVGroupNumber],
        code: "KW",
    },
    {
        id: "d5f75b320b812440010b812555d603a0",
        beschrijving: "Jonggids/Jongverkenner",
        type: "groepseigen",
        groepen: [defaultSGVGroupNumber],
        code: "JGJV",
    },
    {
        id: "d5f75b320b812440010b8125565203c1",
        beschrijving: "Gids/Verkenner",
        type: "groepseigen",
        groepen: [defaultSGVGroupNumber],
        code: "GVE",
    },
    {
        id: "d5f75b320b812440010b812554790354",
        beschrijving: "Akabelid",
        type: "groepseigen",
        groepen: [defaultSGVGroupNumber],
        code: "AKAB",
    },
    {
        id: "d5f75b320b812440010b812555c1039b",
        beschrijving: "Jin",
        type: "groepseigen",
        groepen: [defaultSGVGroupNumber],
        code: "JIN",
    },
];

export const defaultSGVProfile: SGVProfileResponse = {
    functies: [
        {
            groep: defaultSGVGroupNumber,
            begin: "2024-09-01T00:00:00.000+02:00",
            code: "VGA",
        },
    ],
};

/** Creates a complete SGV member payload with realistic defaults and shallow overrides for focused tests. */
export function createSGVMemberFixture(
    overrides: Partial<SGVMember> = {},
): SGVMember {
    const id = overrides.id ?? "member-1";
    return {
        links: [{ method: "PATCH", sections: ["email"] }],
        id,
        aangepast: "2024-09-01T00:00:00.000+02:00",
        persoonsgegevens: {
            geslacht: "vrouw",
            gsm: "+32 411 11 11 11",
        },
        vgagegevens: {
            voornaam: "Existing",
            achternaam: "Member",
            geboortedatum: "2000-02-01",
            beperking: false,
            verminderdlidgeld: false,
            individueleSteekkaartdatumaangepast: "2024-09-01",
        },
        verbondsgegevens: {
            lidnummer: "123",
            klantnummer: "I00000",
            lidgeldbetaald: false,
            lidkaartafgedrukt: false,
        },
        email: "",
        adressen: [
            {
                id: "address-1",
                land: "BE",
                postcode: "9000",
                gemeente: "Gent",
                straat: "Demostraat",
                nummer: "1",
                bus: "",
                telefoon: "",
                postadres: true,
                status: "normaal",
                positie: { latitude: 0, longitude: 0 },
                omschrijving: "",
            },
        ],
        contacten: [
            {
                id: "contact-1",
                adres: "address-1",
                voornaam: "Testpersoon",
                achternaam: "Test",
                zelfdeAdres: false,
                gsm: "+32 411 11 11 11",
                email: "voorbeeld@geenemail.be",
                rol: "moeder",
            },
        ],
        groepseigenVelden: {},
        functies: [
            {
                links: [],
                groep: defaultSGVGroupNumber,
                functie: "d5f75b320b812440010b812555c1039b",
                begin: "2020-01-01T00:00:00.000+02:00",
                code: "JIN",
                omschrijving: "Jin",
            },
        ],
        ...overrides,
    };
}
