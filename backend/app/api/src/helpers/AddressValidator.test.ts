import { City, PostalCode, Province } from "@stamhoofd/models"
import { Address, Country } from "@stamhoofd/structures"

import { AddressValidator } from "./AddressValidator"

describe("AddressValidator", () => {
    it("Can validate a city", async () => {
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

        expect(true).toBe(true)

        const validateAddress = Address.create({
            country: Country.Belgium,
            city: "Wetteren",
            street: "Kerkstraat",
            postalCode: "9230",
            number: "12"
        })
        const validated = await AddressValidator.validate(validateAddress)
        expect(validated.street).toEqual("Kerkstraat")
        expect(validated.city).toEqual("Wetteren")
        expect(validated.postalCode).toEqual("9230")
        expect(validated.number).toEqual("12")
    })
})