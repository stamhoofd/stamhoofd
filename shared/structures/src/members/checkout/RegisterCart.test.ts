import { Group } from "../../Group"
import { GroupCategory, GroupCategorySettings } from "../../GroupCategory"
import { GroupPrices } from "../../GroupPrices"
import { GroupSettings } from "../../GroupSettings"
import { EncryptedMemberWithRegistrations } from "../EncryptedMemberWithRegistrations"
import { Registration } from "../Registration"
import { IDRegisterCart } from "./RegisterCart"
import { IDRegisterItem } from "./RegisterItem"


describe("Test register cart price calculations", () => {
    test("Family discount best combination", () => {
        const group1 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 60,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 20
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 60,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 10
                    })
                ]
            })
        })

        const group3 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 70,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 20
                    })
                ]
            })
        })

        const category = GroupCategory.create({
            groupIds: [ group1.id, group2.id, group3.id  ],
            settings: GroupCategorySettings.create({
                maximumRegistrations: 1
            })
        })

        const bart = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })
        const alice = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })
        const tom = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })

        const cart = IDRegisterCart.create({})
        cart.items.push(IDRegisterItem.create({
            groupId: group1.id,
            memberId: bart.id,
            reduced: false,
            waitingList: false
        }))

        cart.items.push(IDRegisterItem.create({
            groupId: group2.id,
            memberId: alice.id,
            reduced: false,
            waitingList: false
        }))

        cart.items.push(IDRegisterItem.create({
            groupId: group3.id,
            memberId: tom.id,
            reduced: false,
            waitingList: false
        }))

        const calculated = cart.calculatePrices([bart, alice, tom], [group1, group2, group3], [category])
        expect(calculated.items).toHaveLength(3)

        // Check if Bart got the cheapest price
        const calculatedBart = calculated.items.find(i => i.memberId === bart.id)
        expect(calculatedBart).toMatchObject({
            calculatedPrice: 60
        })

        const calculatedAlice = calculated.items.find(i => i.memberId === alice.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 10
        })

        const calculatedTom = calculated.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 40
        })

        // Try in different order
        const calculated2 = cart.calculatePrices([tom, bart, alice], [group2, group1, group3], [category])
        expect(calculated2).toEqual(calculated)
    })

    test("Family discount 4 members", () => {
        const group1 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 60,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 20
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 60,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 10
                    })
                ]
            })
        })

        const group3 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 70,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 20
                    })
                ]
            })
        })

        const group4 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 80,
                        // no discount
                    })
                ]
            })
        })

        const category = GroupCategory.create({
            groupIds: [ group1.id, group2.id, group3.id, group4.id ],
            settings: GroupCategorySettings.create({
                maximumRegistrations: 1
            })
        })

        const bart = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })
        const alice = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })
        const tom = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })
        const linda = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })

        const cart = IDRegisterCart.create({})
        cart.items.push(IDRegisterItem.create({
            groupId: group1.id,
            memberId: bart.id,
            reduced: false,
            waitingList: false
        }))

        cart.items.push(IDRegisterItem.create({
            groupId: group2.id,
            memberId: alice.id,
            reduced: false,
            waitingList: false
        }))

        cart.items.push(IDRegisterItem.create({
            groupId: group3.id,
            memberId: tom.id,
            reduced: false,
            waitingList: false
        }))

        cart.items.push(IDRegisterItem.create({
            groupId: group4.id,
            memberId: linda.id,
            reduced: false,
            waitingList: false
        }))

        const calculated = cart.calculatePrices([bart, alice, tom, linda], [group1, group2, group3, group4], [category])
        expect(calculated.items).toHaveLength(4)

        // Check if Bart got the cheapest price
        const calculatedBart = calculated.items.find(i => i.memberId === bart.id)
        expect(calculatedBart).toMatchObject({
            calculatedPrice: 40
        })

        const calculatedAlice = calculated.items.find(i => i.memberId === alice.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 10
        })

        const calculatedTom = calculated.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 20
        })

        const calculatedLinda = calculated.items.find(i => i.memberId === linda.id)
        expect(calculatedLinda).toMatchObject({
            calculatedPrice: 80
        })

        // Try in different order
        const calculated2 = cart.calculatePrices([tom, bart, alice, linda], [group2, group1, group3, group4], [category])
        expect(calculated2).toEqual(calculated)
    })

    test("With existing registration", () => {
        const group1 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 60,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 20
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 60,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 10
                    })
                ]
            })
        })

        const group3 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 70,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 20
                    })
                ]
            })
        })

        const category = GroupCategory.create({
            groupIds: [ group1.id, group2.id, group3.id  ],
            settings: GroupCategorySettings.create({
                maximumRegistrations: 1
            })
        })

        const bart = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: [
                Registration.create({
                    groupId: group1.id,
                    cycle: group1.cycle,
                    registeredAt: new Date()
                })
            ]
        })
        const alice = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })
        const tom = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })

        const cart = IDRegisterCart.create({})

        cart.items.push(IDRegisterItem.create({
            groupId: group2.id,
            memberId: alice.id,
            reduced: false,
            waitingList: false
        }))

        cart.items.push(IDRegisterItem.create({
            groupId: group3.id,
            memberId: tom.id,
            reduced: false,
            waitingList: false
        }))

        const calculated = cart.calculatePrices([bart, alice, tom], [group1, group2, group3], [category])
        expect(calculated.items).toHaveLength(2)

        const calculatedAlice = calculated.items.find(i => i.memberId === alice.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 10
        })

        const calculatedTom = calculated.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 40
        })

        // Try in different order
        const calculated2 = cart.calculatePrices([tom, bart, alice], [group2, group1, group3], [category])
        expect(calculated2).toEqual(calculated)
    })

    test("With two existing registration", () => {
        const group1 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 60,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 20
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 60,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 10
                    })
                ]
            })
        })

        const group3 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 70,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 20
                    })
                ]
            })
        })

        const category = GroupCategory.create({
            groupIds: [ group1.id, group2.id, group3.id  ],
            settings: GroupCategorySettings.create({
                maximumRegistrations: 1
            })
        })

        const bart = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: [
                Registration.create({
                    groupId: group1.id,
                    cycle: group1.cycle,
                    registeredAt: new Date()
                })
            ]
        })
        const alice = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: [
                Registration.create({
                    groupId: group1.id,
                    cycle: group1.cycle,
                    registeredAt: new Date()
                })
            ]
        })
        const tom = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })

        const cart = IDRegisterCart.create({})

        cart.items.push(IDRegisterItem.create({
            groupId: group2.id,
            memberId: alice.id,
            reduced: false,
            waitingList: false
        }))

        cart.items.push(IDRegisterItem.create({
            groupId: group3.id,
            memberId: tom.id,
            reduced: false,
            waitingList: false
        }))

        const calculated = cart.calculatePrices([bart, alice, tom], [group1, group2, group3], [category])
        expect(calculated.items).toHaveLength(2)

        const calculatedTom = calculated.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 20
        })

        // Try in different order
        const calculated2 = cart.calculatePrices([tom, bart, alice], [group2, group1, group3], [category])
        expect(calculated2).toEqual(calculated)
    })

    test("With reduced price", () => {
        const group1 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 60,
                        reducedPrice: 50,
                        familyPrice: 40,
                        extraFamilyPrice: 20
                    })
                ]
            })
        })

        const category = GroupCategory.create({
            groupIds: [ group1.id ],
            settings: GroupCategorySettings.create({
                maximumRegistrations: 1
            })
        })

        const bart = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })
        const alice = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })
        const tom = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })

        const cart = IDRegisterCart.create({})
        cart.items.push(IDRegisterItem.create({
            groupId: group1.id,
            memberId: bart.id,
            reduced: false,
            waitingList: false
        }))

        cart.items.push(IDRegisterItem.create({
            groupId: group1.id,
            memberId: alice.id,
            reduced: true,
            waitingList: false
        }))

        cart.items.push(IDRegisterItem.create({
            groupId: group1.id,
            memberId: tom.id,
            reduced: false,
            waitingList: false
        }))

        const calculated = cart.calculatePrices([bart, alice, tom], [group1], [category])
        expect(calculated.items).toHaveLength(3)

        // Check if Bart got the cheapest price
        const calculatedBart = calculated.items.find(i => i.memberId === bart.id)
        expect(calculatedBart).toMatchObject({
            calculatedPrice: 40
        })

        // Alice is the only one with the reduced price, so plan it as the first memebr without family discount
        const calculatedAlice = calculated.items.find(i => i.memberId === alice.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 50
        })

        const calculatedTom = calculated.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 20
        })

        // Try in different order
        const calculated2 = cart.calculatePrices([tom, bart, alice], [group1], [category])
        expect(calculated2).toEqual(calculated)
    })

    test("do not group if not maximum", () => {
        const group1 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 60,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 20
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        price: 60,
                        reducedPrice: 10,
                        familyPrice: 40,
                        extraFamilyPrice: 10
                    })
                ]
            })
        })

        const category = GroupCategory.create({
            groupIds: [ group1.id, group2.id ],
            settings: GroupCategorySettings.create({
                maximumRegistrations: null
            })
        })

        const bart = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: [
                Registration.create({
                    groupId: group2.id,
                    cycle: group2.cycle,
                    registeredAt: new Date()
                })
            ]
        })
        const alice = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })
        const tom = EncryptedMemberWithRegistrations.create({
            users: [],
            registrations: []
        })

        const cart = IDRegisterCart.create({})
        cart.items.push(IDRegisterItem.create({
            groupId: group1.id,
            memberId: bart.id,
            reduced: false,
            waitingList: false
        }))

        cart.items.push(IDRegisterItem.create({
            groupId: group2.id,
            memberId: alice.id,
            reduced: false,
            waitingList: false
        }))

        cart.items.push(IDRegisterItem.create({
            groupId: group2.id,
            memberId: tom.id,
            reduced: false,
            waitingList: false
        }))

        const calculated = cart.calculatePrices([bart, alice, tom], [group1, group2], [category])
        expect(calculated.items).toHaveLength(3)

        // Check if Bart got the cheapest price
        const calculatedBart = calculated.items.find(i => i.memberId === bart.id)
        expect(calculatedBart).toMatchObject({
            calculatedPrice: 60
        })

        const calculatedAlice = calculated.items.find(i => i.memberId === alice.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 40
        })

        const calculatedTom = calculated.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 10
        })

        // Try in different order
        const calculated2 = cart.calculatePrices([tom, bart, alice], [group2, group1], [category])
        expect(calculated2).toEqual(calculated)
    })
})