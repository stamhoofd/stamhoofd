import "jest-extended"

import { ObjectData } from "@simonbackx/simple-encoding"

import { MemberDetails } from "./MemberDetails"
import { Parent } from "./Parent"
import { LegacyRecordType } from "./records/LegacyRecordType"

describe("Correctly merge multiple details together", () => {
    test("Merge parents", () => {
        const parent = Parent.create({
            firstName: "Gekke",
            lastName: "Test"
        })
        // The user gave permission for data collection
        const original = MemberDetails.create({
            "firstName": "Robot",
            "parents": [
                Parent.create({
                    firstName: "Linda",
                    lastName: "Aardappel"
                }),
                parent
            ]
        })

        // The user didn't gave permissons for data collection
        const incoming = MemberDetails.create({
            "firstName": "Robot",
            "parents": [
                Parent.create({
                    firstName: "Andere",
                    lastName: "Test"
                }),
                Parent.create({
                    firstName: "Linda",
                    lastName: "Aardappel"
                }),
                Parent.create({
                    id: parent.id,
                    firstName: "Gewijzigd",
                    lastName: "Aardappel"
                })
            ]
        })

        // Only keep the heart + food allergies
        original.merge(incoming)

        expect(original.parents.map(r => r.firstName)).toEqual(["Linda", "Gewijzigd", "Andere"])
    })
})