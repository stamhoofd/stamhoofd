import { MemberDetails, Address, Parent } from "@stamhoofd/structures";
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

        const p = getPatch(details, sgv)
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

        const p2 = getPatch(details2, sgv)
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

        const p = getPatch(details, sgv)
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

});