import { Country } from "@stamhoofd/structures";

import { City } from "./City";
import { PostalCode } from './PostalCode';
import { Province } from './Province';


describe("Model.PostalCode", () => {
    let oostVlaanderen!: Province;
    let gent!: City;
    let mariakerke!: City;

    let wetteren!: City;
    let massemen!: City;

    let gentZip!: PostalCode;
    let mariakerkeZip!: PostalCode;

    let wetterenZip!: PostalCode;
    let massemenZip!: PostalCode;

    beforeAll(async () => {
        oostVlaanderen = new Province()
        oostVlaanderen.name = "Oost-Vlaanderen"
        oostVlaanderen.country = Country.Belgium
        await oostVlaanderen.save()

        // Create some cities
        gent = new City()
        gent.name = "Gent"
        gent.provinceId = oostVlaanderen.id
        gent.country = Country.Belgium
        await gent.save()

        // Create some cities
        mariakerke = new City()
        mariakerke.name = "Mariakerke"
        mariakerke.provinceId = oostVlaanderen.id
        mariakerke.parentCityId = gent.id
        mariakerke.country = Country.Belgium
        await mariakerke.save()

        // Create some cities
        wetteren = new City()
        wetteren.name = "Wetteren"
        wetteren.provinceId = oostVlaanderen.id
        wetteren.country = Country.Belgium
        await wetteren.save()

        // Create some cities
        massemen = new City()
        massemen.name = "Massemen"
        massemen.provinceId = oostVlaanderen.id
        massemen.parentCityId = wetteren.id
        massemen.country = Country.Belgium
        await massemen.save()

        // Create postal codes
        gentZip = new PostalCode()
        gentZip.postalCode = "9000"
        gentZip.cityId = gent.id
        gentZip.country = Country.Belgium
        await gentZip.save()

        // Create postal codes
        mariakerkeZip = new PostalCode()
        mariakerkeZip.postalCode = "9030"
        mariakerkeZip.cityId = mariakerke.id
        mariakerkeZip.country = Country.Belgium
        await mariakerkeZip.save()

        // Create postal codes
        wetterenZip = new PostalCode()
        wetterenZip.postalCode = "9230"
        wetterenZip.cityId = wetteren.id
        wetterenZip.country = Country.Belgium
        await wetterenZip.save()

        // Create postal codes
        massemenZip = new PostalCode()
        massemenZip.postalCode = "9230"
        massemenZip.cityId = massemen.id
        massemenZip.country = Country.Belgium
        await massemenZip.save()
    });

    test("Normal flow", async () => {
        const test = await PostalCode.getCity("9000", "Gent", Country.Belgium);
        expect(test).toMatchObject(gent)
    });

    test("Entering the postal code of the parent city works", async () => {
        const test = await PostalCode.getCity("9000", "Mariakerke", Country.Belgium);
        expect(test).toMatchObject(gent)
    });

     test("Entering the postal code of a child city works", async () => {
        const test = await PostalCode.getCity("9030", "Gent", Country.Belgium);
        expect(test).toMatchObject(mariakerke)
    });

    test("Search normal", async () => {
        const test = await PostalCode.getCity("9230", "Wetteren", Country.Belgium);
        expect(test).toMatchObject(wetteren)

        const test2 = await PostalCode.getCity("9230", "Massemen", Country.Belgium);
        expect(test2).toMatchObject(massemen)
    });

    test("Allow typo", async () => {
        const test = await PostalCode.getCity("9230", "Wettern", Country.Belgium);
        expect(test).toMatchObject(wetteren)

        const test2 = await PostalCode.getCity("9230", "Masemen", Country.Belgium);
        expect(test2).toMatchObject(massemen)
    });
});
