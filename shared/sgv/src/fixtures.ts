import { Country } from '@stamhoofd/types/Country';
import {
    SGVAdres,
    SGVFunctie,
    SGVGroep,
    SGVLidGet,
    SGVMyFunctie,
    SGVProfielResponse,
} from './types.js';

/** Stable group number used by SGV fixtures so tests can share matching groups, functions, and members. */
export const defaultSGVGroepNumber = 'O2209G';

export const defaultSGVGroep: SGVGroep = SGVGroep.create({
    id: 'group-1',
    groepsnummer: defaultSGVGroepNumber,
    naam: 'Prins Boudewijn Wetteren',
    adressen: [
        SGVAdres.create({
            id: 'address-group-1',
            land: Country.Belgium,
            postcode: '9230',
            gemeente: 'Wetteren',
            straat: 'Demostraat',
            nummer: '1',
            // bus: '',
            telefoon: '',
            postadres: true,
            // status: 'normaal',
            // positie: { latitude: 0, longitude: 0 },
            // omschrijving: '',
        }),
    ],
});

export const defaultSGVGroepen: SGVGroep[] = [
    defaultSGVGroep,
    SGVGroep.create({
        id: 'group-2',
        groepsnummer: defaultSGVGroepNumber,
        naam: 'Stamhoofd',
        adressen: [
            SGVAdres.create({
                id: 'address-group-2',
                land: Country.Belgium,
                postcode: '9230',
                gemeente: 'Wetteren',
                straat: 'Collegiebaan',
                nummer: '54',
                telefoon: '',
                postadres: true,
            }),
        ],
    }),
];

export const defaultSGVFuncties: SGVFunctie[] = [
    SGVFunctie.create({
        id: 'd5f75b320b812440010b812555de03a2',
        beschrijving: 'Kapoen',
        type: 'groepseigen',
        groepen: [defaultSGVGroepNumber],
        code: 'KAP',
    }),
    SGVFunctie.create({
        id: 'd5f75b320b812440010b8125567703cb',
        beschrijving: 'Kabouter/Welp',
        type: 'groepseigen',
        groepen: [defaultSGVGroepNumber],
        code: 'KW',
    }),
    SGVFunctie.create({
        id: 'd5f75b320b812440010b812555d603a0',
        beschrijving: 'Jonggids/Jongverkenner',
        type: 'groepseigen',
        groepen: [defaultSGVGroepNumber],
        code: 'JGJV',
    }),
    SGVFunctie.create({
        id: 'd5f75b320b812440010b8125565203c1',
        beschrijving: 'Gids/Verkenner',
        type: 'groepseigen',
        groepen: [defaultSGVGroepNumber],
        code: 'GVE',
    }),
    SGVFunctie.create({
        id: 'd5f75b320b812440010b812554790354',
        beschrijving: 'Akabelid',
        type: 'groepseigen',
        groepen: [defaultSGVGroepNumber],
        code: 'AKAB',
    }),
    SGVFunctie.create({
        id: 'd5f75b320b812440010b812555c1039b',
        beschrijving: 'Jin',
        type: 'groepseigen',
        groepen: [defaultSGVGroepNumber],
        code: 'JIN',
    }),
];

export const defaultSGVProfile: SGVProfielResponse = SGVProfielResponse.create({
    functies: [
        SGVMyFunctie.create({
            groep: defaultSGVGroepNumber,
            begin: '2024-09-01T00:00:00.000+02:00',
            code: 'VGA',
        }),
    ],
});

/** Creates a complete SGV member payload with realistic defaults and shallow overrides for focused tests. */
export function createSGVLidFixture(
    overrides: Partial<SGVLidGet> = {},
): SGVLidGet {
    const id = overrides.id ?? 'member-1';
    const vgagegevens = {
        voornaam: 'Existing',
        achternaam: 'Member',
        geboortedatum: '2000-02-01',
        beperking: false,
        verminderdlidgeld: false,
        individueleSteekkaartdatumaangepast: '2024-09-01',
        ...overrides.vgagegevens,
    };
    const verbondsgegevens = {
        lidnummer: '123',
        klantnummer: 'I00000',
        lidgeldbetaald: false,
        lidkaartafgedrukt: false,
        ...overrides.verbondsgegevens,
    };
    const [year, month, day] = vgagegevens.geboortedatum.split('-').map(value => Number.parseInt(value, 10));

    const member = new SGVLidGet({
        id,
        firstName: vgagegevens.voornaam,
        lastName: vgagegevens.achternaam,
        lidNummer: verbondsgegevens.lidnummer,
        birthDay: new Date(year, month - 1, day, 12),
    });
    Object.assign(member, {
        links: [{ method: 'PATCH', sections: ['email'] }],
        persoonsgegevens: {
            geslacht: 'vrouw',
            gsm: '+32 411 11 11 11',
            ...overrides.persoonsgegevens,
        },
        vgagegevens,
        verbondsgegevens,
        email: '',
        adressen: [
            SGVAdres.create({
                id: 'address-1',
                land: Country.Belgium,
                postcode: '9000',
                gemeente: 'Gent',
                straat: 'Demostraat',
                nummer: '1',
                telefoon: '',
                postadres: true,
            }),
        ],
        contacten: [
            {
                id: 'contact-1',
                adres: 'address-1',
                voornaam: 'Testpersoon',
                achternaam: 'Test',
                zelfdeAdres: false,
                gsm: '+32 411 11 11 11',
                email: 'voorbeeld@geenemail.be',
                rol: 'moeder',
            },
        ],
        functies: [
            SGVMyFunctie.create({
                groep: defaultSGVGroepNumber,
                functie: 'd5f75b320b812440010b812555c1039b',
                begin: '2020-01-01T00:00:00.000+02:00',
                code: 'JIN',
                omschrijving: 'Jin',
            }),
        ],
        ...overrides,
    });
    return member;
}
