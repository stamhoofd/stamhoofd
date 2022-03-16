import { City, PostalCode, Province } from "@stamhoofd/models"
import { Address, Country } from "@stamhoofd/structures"

import { AddressValidator } from "./AddressValidator"

describe("AddressValidator", () => {
    it("download street names", async () => {
        const streets = await AddressValidator.downloadStreets(Country.Belgium, "Wetteren")
        expect(streets).toBeArrayOfSize(292)
    })

    it("sync some cities", async () => {
        const province = new Province()
        province.name = "Oost-Vlaanderen"
        province.country = Country.Belgium
        await province.save()

        const city = new City()
        city.name = "Wetteren"
        city.country = Country.Belgium
        city.provinceId = province.id
        await city.save()

        const postalCode = new PostalCode()
        postalCode.cityId = city.id
        postalCode.postalCode = "9230"
        postalCode.country = Country.Belgium
        await postalCode.save()

        await AddressValidator.syncCity(city)

        expect(true).toBe(true)

        const validateAddress = Address.create({
            country: Country.Belgium,
            city: "Wetteren",
            street: "Krkstraat",
            postalCode: "9230",
            number: "12"
        })
        const validated = await AddressValidator.validate(validateAddress)
        expect(validated.street).toEqual("Kerkstraat")

        const validateAddress2 = Address.create({
            country: Country.Belgium,
            city: "Wetteren",
            street: "krkwgl",
            postalCode: "9230",
            number: "12"
        })
        const validated2 = await AddressValidator.validate(validateAddress2)
        expect(validated2.street).toEqual("Kerkwegel")

        const validateAddress3 = Address.create({
            country: Country.Belgium,
            city: "Wetteren",
            street: "Mrkt",
            postalCode: "9230",
            number: "12"
        })
        const validated3 = await AddressValidator.validate(validateAddress3)
        expect(validated3.street).toEqual("Markt")

        const validateAddress4 = Address.create({
            country: Country.Belgium,
            city: "Wetteren",
            street: "Dr. De Bruyckerstraat",
            postalCode: "9230",
            number: "12"
        })
        const validated4 = await AddressValidator.validate(validateAddress4)
        expect(validated4.street).toEqual("Dokter De Bruyckerstraat")
    })
})