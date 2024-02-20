import { Address, Country, Group, GroupSettings, MemberDetails, Parent, ParentType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

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
                country: Country.Belgium
            }),
            birthDay: new Date(new Date().getFullYear() - 12, 0, 1),
            parents: [
                Parent.create({
                    firstName: "",
                    lastName: "",
                    address: Address.create({
                        street: "Teststraat",
                        number: "11",
                        city: "Gent",
                        postalCode: "9000",
                        country: Country.Belgium
                    })
                })
            ]
        })

        const details2 = MemberDetails.create({
            birthDay: new Date(new Date().getFullYear() - 12, 0, 1),
            parents: [
                Parent.create({
                    firstName: "",
                    lastName: "",
                    address: Address.create({
                        street: "Andere straat",
                        number: "11",
                        city: "Gent",
                        postalCode: "9000",
                        country: Country.Belgium
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
                        country: Country.Belgium
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
                land: Country.Belgium,
                "omschrijving": "",
                "unknownSGVProperty": "test"

            }],
            contacten: []
        };

        const p = getPatch(details, sgv, "groepnummer", [], groepFuncties)
        expect(p.adressen).toHaveLength(1)
        expect(p.adressen[0]).toMatchObject({
            id: "SGVID",
            straat: "Teststraat",
            nummer: "11",
            gemeente: "Gent",
            postcode: "9000",
            land: Country.Belgium,
            unknownSGVProperty: "test",
            postadres: true
        })

        const p2 = getPatch(details2, sgv, "groepnummer", [], groepFuncties)
        expect(p2.adressen).toHaveLength(2)

        expect(p2.adressen[1]).toMatchObject({
            id: "SGVID",
            straat: "Teststraat",
            nummer: "11",
            gemeente: "Gent",
            postcode: "9000",
            land: Country.Belgium,
            unknownSGVProperty: "test",
            postadres: true
        })
        
        expect(p2.adressen[0]).toMatchObject({
            straat: "Andere straat",
            nummer: "11",
            gemeente: "Gent",
            postcode: "9000",
            land: Country.Belgium,
            postadres: false
        })

        expect(p2.adressen[0].id).toBeDefined()
        expect(p2.adressen[0].id).not.toEqual("SGVID")
    })

    test("No address change", () => {
        const details = MemberDetails.create({
            birthDay: new Date(new Date().getFullYear() - 12, 0, 1),
            address: Address.create({
                street: "Teststraat",
                number: "11",
                city: "Gent",
                postalCode: "9000",
                country: Country.Belgium
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
                land: Country.Belgium,
                "omschrijving": "",
                "unknownSGVProperty": "test",
                hasErrors: false,
                showme: true,

            }],
            contacten: []
        };

        const p = getPatch(details, sgv, "groepnummer", [], groepFuncties)
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
            birthDay: new Date(new Date().getFullYear() - 12, 0, 1),
            address: Address.create({
                street: "Teststraat",
                number: "11",
                city: "Gent",
                postalCode: "9000",
                country: Country.Belgium
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
                        country: Country.Belgium
                    })
                })
            ]
        })


        const sgv = {
            adressen: [],
            contacten: []
        };

        const p = getPatch(details, sgv, "groepnummer", [], groepFuncties)
        expect(p.adressen).toHaveLength(2)
        expect(p.adressen[0]).toMatchObject({
            straat: "Teststraat",
            nummer: "11",
            gemeente: "Gent",
            postcode: "9000",
            land: Country.Belgium,
            postadres: true
        })

        expect(p.adressen[1]).toMatchObject({
            straat: "Andere",
            nummer: "11",
            gemeente: "Gent",
            postcode: "9000",
            land: Country.Belgium,
            postadres: false
        })
    })

    test("Keep contact id", () => {
        const details = MemberDetails.create({
            birthDay: new Date(new Date().getFullYear() - 12, 0, 1),
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
                        country: Country.Belgium
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
                        country: Country.Belgium
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
                    land: Country.Belgium,
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

        const p = getPatch(details, sgv, "groepnummer", [], groepFuncties)
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


    test("Behoud de huidige functie als al ingeschreven", () => {
        const details = MemberDetails.create({
            // 18 jaar = jin
            birthDay: new Date(new Date().getFullYear() - 18, 0, 1),
            parents: []
        })

        const sgv = {
            "links": [],
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
                { 
                    // = jin
                    "functie": "d5f75b320b812440010b812555c1039b",
                    "begin": "123",
                }
            ],
            adressen: [],
            contacten: []
        };

        const jin = Group.create({
            settings: GroupSettings.create({
                name: "Jin",
                startDate: new Date(),
                endDate: new Date(),
                registrationEndDate: new Date(),
                registrationStartDate: new Date(),
            })
        });

        const p = getPatch(details, sgv, "groepnummer", [jin], groepFuncties)
        expect(p.functies).toBeUndefined();
    });

    test("Behoud volwassen Akabe functie als al ingeschreven", () => {
        const details = MemberDetails.create({
            // 24 jaar en Akabe lid
            birthDay: new Date(new Date().getFullYear() - 24, 0, 1),
            parents: []
        })

        const sgv = {
            "links": [],
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
                { 
                    // = akabe
                    "functie": "d5f75b320b812440010b812554790354",
                    "begin": "123",
                }
            ],
            adressen: [],
            contacten: []
        };

        const akabe = Group.create({
            settings: GroupSettings.create({
                name: "Akabe",
                startDate: new Date(),
                endDate: new Date(),
                registrationEndDate: new Date(),
                registrationStartDate: new Date(),
            })
        });

        const p = getPatch(details, sgv, "groepnummer", [akabe], groepFuncties)
        expect(p.functies).toBeUndefined();
    });

    test("Behoud functies van leiding", () => {
        const details = MemberDetails.create({
            // 24 jaar
            birthDay: new Date(new Date().getFullYear() - 24, 0, 1),
            parents: []
        })

        const sgv = {
            "links": [],
            persoonsgegevens: {},
            functies: [
                {
                    "functie": "859",
                    "begin": "123",
                    "einde": "586"
                },
                {
                    "functie": "d5f75b320b812440010b812555e603a4", // kapoenenleiding
                    "begin": "123",
                }
            ],
            adressen: [],
            contacten: []
        };

        const leiding = Group.create({
            settings: GroupSettings.create({
                name: "Leiding",
                startDate: new Date(),
                endDate: new Date(),
                registrationEndDate: new Date(),
                registrationStartDate: new Date(),
            })
        });

        const p = getPatch(details, sgv, "groepnummer", [leiding], groepFuncties)
        expect(p.functies).toBeUndefined();
    });

    test("Schrap Akabe functie indien lid leiding wordt", () => {
        const details = MemberDetails.create({
            // 24 jaar en Akabe lid
            birthDay: new Date(new Date().getFullYear() - 24, 0, 1),
            parents: []
        })

        const sgv = {
            "links": [],
            persoonsgegevens: {

            },
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
                { 
                    // = akabe
                    "functie": "d5f75b320b812440010b812554790354",
                    "begin": "123",
                }
            ],
            adressen: [],
            contacten: []
        };

        const leiding = Group.create({
            settings: GroupSettings.create({
                name: "Leiding",
                startDate: new Date(),
                endDate: new Date(),
                registrationEndDate: new Date(),
                registrationStartDate: new Date(),
            })
        });

        const p = getPatch(details, sgv, "groepnummer", [leiding], groepFuncties)
        expect(p.functies).toEqual([
            {"begin": "123", "einde": "586", "functie": "859"}, 
            {"begin": "123", "functie": "notmanaged"}, 
            {"begin": "123", "einde": Formatter.dateIso(new Date()), "functie": "d5f75b320b812440010b812554790354"} // = stopgezet
        ])
    });

    test("Voeg Akabe functie toe indien nog niet ingeschreven", () => {
        const details = MemberDetails.create({
            // 24 jaar en Akabe lid
            birthDay: new Date(new Date().getFullYear() - 24, 0, 1),
            parents: []
        })

        const sgv = {
            "links": [],
            functies: [
                {
                    "functie": "859",
                    "begin": "123",
                    "einde": "586"
                },
                {
                    "functie": "notmanaged",
                    "begin": "123",
                }
            ],
            adressen: [],
            contacten: []
        };

        const akabe = Group.create({
            settings: GroupSettings.create({
                name: "Akabe",
                startDate: new Date(),
                endDate: new Date(),
                registrationEndDate: new Date(),
                registrationStartDate: new Date(),
            })
        });

        const p = getPatch(details, sgv, "groepnummer", [akabe], groepFuncties)
        expect(p.functies).toEqual([
            {"begin": "123", "einde": "586", "functie": "859"}, 
            {"begin": "123", "functie": "notmanaged"}, 
            {"begin": Formatter.dateIso(new Date()), "functie": "d5f75b320b812440010b812554790354", "groep": "groepnummer"} // = akabe gestart
        ])
    });

    test("Voeg kapoenen functie toe indien nog niet ingeschreven", () => {
        const details = MemberDetails.create({
            birthDay: new Date(new Date().getFullYear() - 6, 0, 1),
            parents: []
        })

        const sgv = {
            "links": [],
            functies: [
                {
                    "functie": "859",
                    "begin": "123",
                    "einde": "586"
                },
                {
                    "functie": "notmanaged",
                    "begin": "123",
                }
            ],
            adressen: [],
            contacten: []
        };

        const interneGroep = Group.create({
            settings: GroupSettings.create({
                name: "Interne benaming",
                startDate: new Date(),
                endDate: new Date(),
                registrationEndDate: new Date(),
                registrationStartDate: new Date(),
            })
        });

        const p = getPatch(details, sgv, "groepnummer", [interneGroep], groepFuncties)
        expect(p.functies).toEqual([
            {"begin": "123", "einde": "586", "functie": "859"}, 
            {"begin": "123", "functie": "notmanaged"}, 
            {"begin": Formatter.dateIso(new Date()), "functie": "d5f75b320b812440010b812555de03a2", "groep": "groepnummer"} // = kapoenen gestart
        ])
    });

    test("Behoud een lid bij kapoenen als de naam in Stamhoofd exact overeenkomt", () => {
        const details = MemberDetails.create({
            birthDay: new Date(new Date().getFullYear() - 9, 0, 1),
            parents: []
        })

        const sgv = {
            "links": [],
            functies: [
                {
                    "functie": "859",
                    "begin": "123",
                    "einde": "586"
                },
                {
                    "functie": "notmanaged",
                    "begin": "123",
                }
            ],
            adressen: [],
            contacten: []
        };

        const kapoenen = Group.create({
            settings: GroupSettings.create({
                name: "Kapoenen",
                startDate: new Date(),
                endDate: new Date(),
                registrationEndDate: new Date(),
                registrationStartDate: new Date(),
            })
        });

        const p = getPatch(details, sgv, "groepnummer", [kapoenen], groepFuncties)
        expect(p.functies).toEqual([
            {"begin": "123", "einde": "586", "functie": "859"}, 
            {"begin": "123", "functie": "notmanaged"}, 
            {"begin": Formatter.dateIso(new Date()), "functie": "d5f75b320b812440010b812555de03a2", "groep": "groepnummer"} // = kapoenen gestart
        ])
    });

    test("Als lid onduidelijke groepen heeft nemen we gewoon de leeftijd", () => {
        const details = MemberDetails.create({
            birthDay: new Date(new Date().getFullYear() - 9, 0, 1),
            parents: []
        })

        const sgv = {
            "links": [],
            functies: [
                {
                    "functie": "859",
                    "begin": "123",
                    "einde": "586"
                },
                {
                    "functie": "notmanaged",
                    "begin": "123",
                }
            ],
            adressen: [],
            contacten: []
        };

        const kapoenen = Group.create({
            settings: GroupSettings.create({
                name: "Kapoenen",
                startDate: new Date(),
                endDate: new Date(),
                registrationEndDate: new Date(),
                registrationStartDate: new Date(),
            })
        });

        const jin = Group.create({
            settings: GroupSettings.create({
                name: "Jin",
                startDate: new Date(),
                endDate: new Date(),
                registrationEndDate: new Date(),
                registrationStartDate: new Date(),
            })
        });

        const p = getPatch(details, sgv, "groepnummer", [kapoenen, jin], groepFuncties)
        expect(p.functies).toEqual([
            {"begin": "123", "einde": "586", "functie": "859"}, 
            {"begin": "123", "functie": "notmanaged"}, 
            {"begin": Formatter.dateIso(new Date()), "functie": "d5f75b320b812440010b8125567703cb", "groep": "groepnummer"} // = wouters gestart
        ])
    });

    test("Wissel van kapoenen naar wouters functie", () => {
        const details = MemberDetails.create({
            birthDay: new Date(new Date().getFullYear() - 9, 0, 1),
            parents: []
        })

        const sgv = {
            "links": [],
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
                { 
                    // = kapoenen
                    "functie": "d5f75b320b812440010b812555de03a2",
                    "begin": "123",
                }
            ],
            adressen: [],
            contacten: []
        };

        const interneGroep = Group.create({
            settings: GroupSettings.create({
                name: "Interne benaming",
                startDate: new Date(),
                endDate: new Date(),
                registrationEndDate: new Date(),
                registrationStartDate: new Date(),
            })
        });

        const p = getPatch(details, sgv, "groepnummer", [interneGroep], groepFuncties)
        expect(p.functies).toEqual([
            {"begin": "123", "einde": "586", "functie": "859"}, 
            {"begin": "123", "functie": "notmanaged"}, 
            {"begin": "123", "einde": Formatter.dateIso(new Date()), "functie": "d5f75b320b812440010b812555de03a2"}, // = kapoenen gestopt
            {"begin": Formatter.dateIso(new Date()), "functie": "d5f75b320b812440010b8125567703cb", "groep": "groepnummer"} // = wouters gestart
        ])

        const secondPatch = getPatch(details, {...sgv, ...p}, "groepnummer", [interneGroep], groepFuncties)
        expect(secondPatch.functies).toBeUndefined();
    });
});