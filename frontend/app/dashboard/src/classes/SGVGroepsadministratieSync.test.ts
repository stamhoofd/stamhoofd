import { Address, Group, GroupSettings,MemberDetails, Parent, ParentType } from "@stamhoofd/structures";

import groepFuncties from './SGVDefaultFuncties.json';
import { getPatch, splitStreetNumber } from './SGVGroepsadministratieSync';


describe("Groepsadministratie Sync", () => {
    test("Reuse the address id", () => {
        const details = MemberDetails.create({
            address: Address.create({
                street: "Teststraat",
                number: "11",
                city: "Gent",
                postalCode: "9000",
                country: "BE"
            }),
            parents: [
                Parent.create({
                    firstName: "",
                    lastName: "",
                    address: Address.create({
                        street: "Teststraat",
                        number: "11",
                        city: "Gent",
                        postalCode: "9000",
                        country: "BE"
                    })
                })
            ]
        })

        const details2 = MemberDetails.create({
            parents: [
                Parent.create({
                    firstName: "",
                    lastName: "",
                    address: Address.create({
                        street: "Andere straat",
                        number: "11",
                        city: "Gent",
                        postalCode: "9000",
                        country: "BE"
                    })
                }),
                Parent.create({
                    firstName: "",
                    lastName: "",
                    address: Address.create({
                        street: "Teststraat",
                        number: "11",
                        city: "Gent",
                        postalCode: "9000",
                        country: "BE"
                    })
                })
            ]
        })

        const sgv = {
            adressen: [{
                id: "SGVID",
                straat: "Teststraat",
                nummer: "11",
                gemeente: "Gent",
                postcode: "9000",
                telefoon: "",
                "status": "normaal",
                "postadres": true,
                "positie": {
                    "latitude": 51,
                    "longitude": 3.8
                },
                land: "BE",
                "omschrijving": "",
                "unknownSGVProperty": "test"

            }],
            contacten: []
        };

        const p = getPatch(details, sgv, "groepnummer", [], [], groepFuncties)
        expect(p.adressen).toHaveLength(1)
        expect(p.adressen[0]).toMatchObject({
            id: "SGVID",
            straat: "Teststraat",
            nummer: "11",
            gemeente: "Gent",
            postcode: "9000",
            land: "BE",
            unknownSGVProperty: "test",
            postadres: true
        })

        const p2 = getPatch(details2, sgv, "groepnummer", [], [], groepFuncties)
        expect(p2.adressen).toHaveLength(2)

        expect(p2.adressen[1]).toMatchObject({
            id: "SGVID",
            straat: "Teststraat",
            nummer: "11",
            gemeente: "Gent",
            postcode: "9000",
            land: "BE",
            unknownSGVProperty: "test",
            postadres: true
        })
        
        expect(p2.adressen[0]).toMatchObject({
            straat: "Andere straat",
            nummer: "11",
            gemeente: "Gent",
            postcode: "9000",
            land: "BE",
            postadres: false
        })

        expect(p2.adressen[0].id).toBeDefined()
        expect(p2.adressen[0].id).not.toEqual("SGVID")
    })

    test("No address change", () => {
        const details = MemberDetails.create({
            address: Address.create({
                street: "Teststraat",
                number: "11",
                city: "Gent",
                postalCode: "9000",
                country: "BE"
            })
        })

        const sgv = {
            adressen: [{
                id: "SGVID",
                straat: "Teststraat",
                nummer: "11",
                bus: "",
                gemeente: "Gent",
                postcode: "9000",
                telefoon: "",
                "status": "normaal",
                "postadres": true,
                "positie": {
                    "latitude": 51,
                    "longitude": 3.8
                },
                land: "BE",
                "omschrijving": "",
                "unknownSGVProperty": "test",
                hasErrors: false,
                showme: true,

            }],
            contacten: []
        };

        const p = getPatch(details, sgv, "groepnummer", [], [], groepFuncties)
        expect(p.adressen).not.toBeDefined()
    })

    test("Huisnummer opsplitsen", () => {
        expect(splitStreetNumber("13 bus 3")).toMatchObject({
            number: "13",
            bus: "3"
        })

        expect(splitStreetNumber("13/3")).toMatchObject({
            number: "13",
            bus: "3"
        })

        expect(splitStreetNumber("13 3")).toMatchObject({
            number: "13",
            bus: "3"
        })

        expect(splitStreetNumber("13A3")).toMatchObject({
            number: "13A3",
            bus: ""
        })

        expect(splitStreetNumber("13A 3")).toMatchObject({
            number: "13A",
            bus: "3"
        })

        expect(splitStreetNumber("13 A 3")).toMatchObject({
            number: "13A",
            bus: "3"
        })

        expect(splitStreetNumber("13AA 3")).toMatchObject({
            number: "13AA",
            bus: "3"
        })

        expect(splitStreetNumber("13AA")).toMatchObject({
            number: "13AA",
            bus: ""
        })

        expect(splitStreetNumber("1")).toMatchObject({
            number: "1",
            bus: ""
        })

        expect(splitStreetNumber("101")).toMatchObject({
            number: "101",
            bus: ""
        })

        expect(splitStreetNumber("A12")).toMatchObject({
            number: "A12",
            bus: ""
        })

    });

    test("Only one postadres", () => {
        const details = MemberDetails.create({
            address: Address.create({
                street: "Teststraat",
                number: "11",
                city: "Gent",
                postalCode: "9000",
                country: "BE"
            }),
            parents: [
                Parent.create({
                    firstName: "",
                    lastName: "",
                    address: Address.create({
                        street: "Andere",
                        number: "11",
                        city: "Gent",
                        postalCode: "9000",
                        country: "BE"
                    })
                })
            ]
        })


        const sgv = {
            adressen: [],
            contacten: []
        };

        const p = getPatch(details, sgv, "groepnummer", [], [], groepFuncties)
        expect(p.adressen).toHaveLength(2)
        expect(p.adressen[0]).toMatchObject({
            straat: "Teststraat",
            nummer: "11",
            gemeente: "Gent",
            postcode: "9000",
            land: "BE",
            postadres: true
        })

        expect(p.adressen[1]).toMatchObject({
            straat: "Andere",
            nummer: "11",
            gemeente: "Gent",
            postcode: "9000",
            land: "BE",
            postadres: false
        })
    })

    test("Keep contact id", () => {
        const details = MemberDetails.create({
            parents: [
                Parent.create({
                    firstName: "Simon",
                    lastName: "Backx",
                    type: ParentType.Father,
                    address: Address.create({
                        street: "Teststraat",
                        number: "11",
                        city: "Gent",
                        postalCode: "9000",
                        country: "BE"
                    })
                }),
                Parent.create({
                    firstName: "Test",
                    lastName: "Achternaam",
                    type: ParentType.Other,
                    address: Address.create({
                        street: "Andere",
                        number: "11",
                        city: "Gent",
                        postalCode: "9000",
                        country: "BE"
                    })
                })
            ]
        })


        const sgv = {
            adressen: [
                {
                    id: "SGVID",
                    straat: "Teststraat",
                    nummer: "11",
                    gemeente: "Gent",
                    postcode: "9000",
                    telefoon: "",
                    "status": "normaal",
                    "postadres": true,
                    "positie": {
                        "latitude": 51,
                        "longitude": 3.8
                    },
                    land: "BE",
                    "omschrijving": "",
                    "unknownSGVProperty": "test"
                }
            ],
            contacten: [
                {
                    "id": "SGVIDOUDER1",
                    "voornaam": "Simon",
                    "achternaam": "Backx",
                    "gsm": "",
                    "email": "",
                    "rol": "moeder",
                    "adres": "SGVID"
                },
                {
                    "id": "SGVIDOUDER2",
                    "voornaam": "Oude",
                    "achternaam": "Backx",
                    "gsm": "",
                    "email": "",
                    "rol": "vader",
                    "adres": "SGVID"
                }
            ]
        };

        const p = getPatch(details, sgv, "groepnummer", [], [], groepFuncties)
        expect(p.adressen).toHaveLength(2)
        expect(p.contacten).toHaveLength(2)

        expect(p.contacten[0]).toMatchObject({
             "id": "SGVIDOUDER1",
            "voornaam": "Simon",
            "achternaam": "Backx",
            "gsm": "",
            "email": "",
            "rol": "vader",
            "adres": "SGVID"
        })

        expect(p.contacten[1]).toMatchObject({
            "voornaam": "Test",
            "achternaam": "Achternaam",
            "gsm": "",
            "email": "",
            "rol": "voogd",
        })

        expect(p.contacten[1].id).toBeDefined()
        expect(p.contacten[1].adres).toEqual(p.adressen[1].id)
        
    })

    test("Keep existing functies, remove managed functies", () => {
         const details = MemberDetails.create({
            parents: []
        })


        const sgv = {
            functies: [
                {
                    "functie": "859",
                    "begin": "123",
                    "einde": "586"
                },
                {
                    "functie": "notmanaged",
                    "begin": "123",
                },
                { // will get removed = managed by stamhoofd
                    "functie": "d5f75b320b812440010b812555c1039b",
                    "begin": "123",
                }
            ],
            adressen: [],
            contacten: []
        };

        const j = Group.create({
            settings: GroupSettings.create({
                name: "Jin",
                startDate: new Date(),
                endDate: new Date()
            })
        })

        const g = Group.create({
            settings: GroupSettings.create({
                name: "Kapoenen",
                startDate: new Date(),
                endDate: new Date()
            })
        })

        const wl = Group.create({ // Matcht op woudlopers custom functie + welpen
            settings: GroupSettings.create({
                name: "Woudlopers",
                startDate: new Date(),
                endDate: new Date(),
            })
        })

        const wolf = Group.create({ // Moet matchen op givers op basis van leeftijd
            settings: GroupSettings.create({
                name: "Onbestaandenaamwolf",
                startDate: new Date(),
                endDate: new Date(),
                minAge: 16,
                maxAge: 17
            })
        })

        const p = getPatch(details, sgv, "groepnummer", [g, wl], [g, wl, j], groepFuncties)
        const p2 = getPatch(details, sgv, "groepnummer", [g, wolf], [g, wolf], groepFuncties) // only delete jin if jin is inside stamhoofd
        const p3 = getPatch(details, sgv, "groepnummer", [g, wl], [g, wl, j], groepFuncties.slice(0, groepFuncties.length - 1)) // if woudlopers is nog defined in groepsadmin -> check if to wouters

        expect(p.functies).toHaveLength(6);
        expect(p2.functies).toHaveLength(5);
        expect(p3.functies).toHaveLength(5);

        expect(p.functies[0]).toMatchObject({
            "functie": "859",
            "begin": "123",
            "einde": "586"
        })
        expect(p2.functies[0]).toMatchObject({
            "functie": "859",
            "begin": "123",
            "einde": "586"
        })
        
        expect(p.functies[1]).toMatchObject({
            "functie": "notmanaged",
            "begin": "123",
        })
        expect(p2.functies[1]).toMatchObject({
            "functie": "notmanaged",
            "begin": "123",
        })
        expect(p.functies[1].einde).not.toBeDefined()
        expect(p2.functies[1].einde).not.toBeDefined()

        expect(p.functies[2]).toMatchObject({
            "functie": "d5f75b320b812440010b812555de03a2",
        })
        expect(p.functies[2].einde).not.toBeDefined()
        expect(p2.functies[3]).toMatchObject({
            "functie": "d5f75b320b812440010b812555de03a2",
        })
        expect(p2.functies[3].einde).not.toBeDefined()


        expect(p.functies[3]).toMatchObject({
            "functie": "woudloperscustom",
        })
        expect(p.functies[3].einde).not.toBeDefined()

        expect(p2.functies[4]).toMatchObject({
            "functie": "d5f75b320b812440010b8125565203c1", // givers
        })
        expect(p2.functies[4].einde).not.toBeDefined()

        expect(p3.functies[3]).toMatchObject({
            "functie": "d5f75b320b812440010b8125567703cb", // when woutloper is missing in groepsadmin => to wouters
        })
        expect(p3.functies[3].einde).not.toBeDefined()

        // Tussentakken ook bij bijhorende leeftijdsgroep inschrijven
        expect(p.functies[4]).toMatchObject({
            "functie": "d5f75b320b812440010b8125567703cb",
        })
        expect(p.functies[4].einde).not.toBeDefined()

        // Ended functies
        expect(p.functies[5]).toMatchObject({
            "functie": "d5f75b320b812440010b812555c1039b",
            "begin": "123",
        })
        expect(p2.functies[2]).toMatchObject({
            "functie": "d5f75b320b812440010b812555c1039b",
            "begin": "123",
        })
        expect(p.functies[5].einde).toBeDefined()
        expect(p2.functies[2].einde).not.toBeDefined() // do not end this, since this is managed by stamhoofd
    });

});