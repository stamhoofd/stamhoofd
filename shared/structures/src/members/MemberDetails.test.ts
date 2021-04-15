import "jest-extended"

import { ObjectData } from "@simonbackx/simple-encoding"

import { MemberDetails } from "./MemberDetails"
import { Parent } from "./Parent"
import { Record } from "./Record"
import { RecordType } from "./RecordType"

describe("Correctly merge multiple details together", () => {
    test("Delete public records", () => {
        // The user gave permission for data collection
        const original = MemberDetails.create({
            "firstName": "Robot",
            records: [
                Record.create({
                    type: RecordType.DataPermissions,
                }),
                Record.create({
                    type: RecordType.HeartDisease,
                })
            ]
        })

        // The user didn't gave permissons for data collection
        const incoming = MemberDetails.create({
            "firstName": "Robot",
            records: [
                Record.create({
                    type: RecordType.FoodAllergies,
                    description: "milk"
                })
            ]
        })

        // Only keep the heart + food allergies
        original.merge(incoming)

        expect(original.records.map(r => r.type)).toEqual([RecordType.HeartDisease, RecordType.FoodAllergies])
    })

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

describe("Upgrade records correctly from version 53 to latest version", () => {
    const irrelevant = {
        firstName: "Test",
        lastName: "",
        memberNumber: null,
        gender: "Other",
        phone: null,
        email: null,
        birthDay: null,
        address: null,
        parents: [],
        emergencyContacts: [],
        doctor: null,
        lastReviewed: null,
        preferredGroups: [],
        existingStatus: null
    }

    const irrelevantRecord = {
        description: ""
    }
    test("empty records", () => {
        // Should create all inverted types: data, medicines, pictures
        // Version 53
        const encoded = {
            ...irrelevant,
            records: []
        }

        const details = MemberDetails.decode(new ObjectData(encoded, { version: 53 }))
        expect(details.records.map(r => r.type).sort()).toEqual([ RecordType.DataPermissions, RecordType.MedicinePermissions, RecordType.PicturePermissions ].sort())
    })

    test("no pictures", () => {
        // Version 53
        const encoded = {
            ...irrelevant,
            records: [{
                ...irrelevantRecord,
                type: "NoPictures"
            }]
        }

        const details = MemberDetails.decode(new ObjectData(encoded, { version: 53 }))
        expect(details.records.map(r => r.type).sort()).toEqual([ RecordType.DataPermissions, RecordType.MedicinePermissions ].sort())
    })

    test("no medicines", () => {
        // Version 53
        const encoded = {
            ...irrelevant,
            records: [{
                ...irrelevantRecord,
                type: "NoPermissionForMedicines"
            }]
        }

        const details = MemberDetails.decode(new ObjectData(encoded, { version: 53 }))
        expect(details.records.map(r => r.type).sort()).toEqual([ RecordType.DataPermissions, RecordType.PicturePermissions ].sort())
    })

    test("no data", () => {
        // Version 53
        const encoded = {
            ...irrelevant,
            records: [{
                ...irrelevantRecord,
                type: "NoData"
            }]
        }

        const details = MemberDetails.decode(new ObjectData(encoded, { version: 53 }))
        expect(details.records.map(r => r.type).sort()).toEqual([ RecordType.PicturePermissions, RecordType.MedicinePermissions ].sort())
    })

    test("only group pictures", () => {
        // Version 53
        const encoded = {
            ...irrelevant,
            records: [{
                ...irrelevantRecord,
                type: "OnlyGroupPictures"
            }]
        }

        const details = MemberDetails.decode(new ObjectData(encoded, { version: 53 }))
        expect(details.records.map(r => r.type).sort()).toEqual([ RecordType.DataPermissions, RecordType.GroupPicturePermissions, RecordType.MedicinePermissions ].sort())
    })

    test("only group pictures and no pictures", () => {
        // Version 53
        const encoded = {
            ...irrelevant,
            records: [
                {
                    ...irrelevantRecord,
                    type: "OnlyGroupPictures"
                },
                {
                    ...irrelevantRecord,
                    type: "NoPictures"
                }
            ]
        }

        const details = MemberDetails.decode(new ObjectData(encoded, { version: 53 }))
        expect(details.records.map(r => r.type).sort()).toEqual([ RecordType.DataPermissions, RecordType.GroupPicturePermissions, RecordType.MedicinePermissions ].sort())
    })

    test("only group pictures and no pictures reverse order", () => {
        // Version 53
        const encoded = {
            ...irrelevant,
            records: [
                {
                    ...irrelevantRecord,
                    type: "NoPictures"
                },
                {
                    ...irrelevantRecord,
                    type: "OnlyGroupPictures"
                }
            ]
        }

        const details = MemberDetails.decode(new ObjectData(encoded, { version: 53 }))
        expect(details.records.map(r => r.type).sort()).toEqual([ RecordType.DataPermissions, RecordType.GroupPicturePermissions, RecordType.MedicinePermissions ].sort())
    })

    test("no permissions", () => {
        // Version 53
        const encoded = {
            ...irrelevant,
            records: [
                {
                    ...irrelevantRecord,
                    type: "NoPictures"
                },
                {
                    ...irrelevantRecord,
                    type: "NoPermissionForMedicines"
                },
                {
                    ...irrelevantRecord,
                    type: "NoData"
                }
            ]
        }

        const details = MemberDetails.decode(new ObjectData(encoded, { version: 53 }))
        expect(details.records.map(r => r.type)).toHaveLength(0)
    })

    test("keep other records", () => {
        // Version 53
        const encoded = {
            ...irrelevant,
            records: [
                {
                    ...irrelevantRecord,
                    type: "Vegan"
                },
                {
                    ...irrelevantRecord,
                    type: "CanNotSwim"
                },
                {
                    description: "This is a test",
                    type: "Other"
                }
            ]
        }

        const details = MemberDetails.decode(new ObjectData(encoded, { version: 53 }))
        expect(details.records.map(r => r.type).sort()).toEqual([ RecordType.DataPermissions, RecordType.MedicinePermissions, RecordType.PicturePermissions, RecordType.Vegan, RecordType.CanNotSwim, RecordType.Other ].sort())
    })
})