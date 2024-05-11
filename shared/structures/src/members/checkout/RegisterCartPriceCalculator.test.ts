import { Group } from "../../Group"
import { GroupCategory, GroupCategorySettings } from "../../GroupCategory"
import { GroupPrice, GroupPrices } from "../../GroupPrices"
import { GroupSettings } from "../../GroupSettings"
import { PaymentConfiguration } from "../../PaymentConfiguration"
import { MemberDetails } from "../MemberDetails"
import { MemberWithRegistrationsBlob } from "../MemberWithRegistrationsBlob"
import { Registration } from "../Registration"
import { IDRegisterCart } from "./RegisterCart"
import { IDRegisterItem } from "./RegisterItem"

const defaultPaymentConfiguration = PaymentConfiguration.create({})

describe("Test register cart price calculations", () => {
    test("Family discount best combination", () => {
        const group1 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 60,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 20,
                                reducedPrice: 10,
                            })
                        ]
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 60,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 10,
                                reducedPrice: 10,
                            })
                        ]
                    })
                ]
            })
        })

        const group3 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 70,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 20,
                                reducedPrice: 10,
                            })
                        ]
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

        const bart = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: []
        })
        const alice = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: []
        })
        const tom = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
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

        cart.calculatePrices([bart, alice, tom], [group1, group2, group3], [category], defaultPaymentConfiguration)
        expect(cart.items).toHaveLength(3)

        // Check if Bart got the cheapest price
        const calculatedBart = cart.items.find(i => i.memberId === bart.id)
        expect(calculatedBart).toMatchObject({
            calculatedPrice: 60
        })

        const calculatedAlice = cart.items.find(i => i.memberId === alice.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 10
        })

        const calculatedTom = cart.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 40
        })

        // Try in different order
        const cached = cart.price
        cart.calculatePrices([tom, bart, alice], [group2, group1, group3], [category], defaultPaymentConfiguration)
        expect(cart.price).toEqual(cached)
    })

    test("Family discount 4 members", () => {
        const group1 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 60,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 20,
                                reducedPrice: 10,
                            })
                        ]
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 60,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 10
                            })
                        ]
                    })
                ]
            })
        })

        const group3 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 70,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 20,
                                reducedPrice: 10,
                            })
                        ]
                    })
                ]
            })
        })

        const group4 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 80,
                            })
                        ]
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

        const bart = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: []
        })
        const alice = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: []
        })
        const tom = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: []
        })
        const linda = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
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

        cart.calculatePrices([bart, alice, tom, linda], [group1, group2, group3, group4], [category], defaultPaymentConfiguration)
        expect(cart.items).toHaveLength(4)

        // Check if Bart got the cheapest price
        const calculatedBart = cart.items.find(i => i.memberId === bart.id)
        expect(calculatedBart).toMatchObject({
            calculatedPrice: 40
        })

        const calculatedAlice = cart.items.find(i => i.memberId === alice.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 10
        })

        const calculatedTom = cart.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 20
        })

        const calculatedLinda = cart.items.find(i => i.memberId === linda.id)
        expect(calculatedLinda).toMatchObject({
            calculatedPrice: 80
        })

        // Try in different order
        const cached = cart.price
        cart.calculatePrices([tom, bart, alice, linda], [group2, group1, group3, group4], [category], defaultPaymentConfiguration)
        expect(cart.price).toEqual(cached)
    })

    test("With existing registration", () => {
        const group1 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 60,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 20,
                                reducedPrice: 10,
                            })
                        ]
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 60,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 10
                            })
                        ]
                    })
                ]
            })
        })

        const group3 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 70,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 20,
                                reducedPrice: 10,
                            })
                        ]
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

        const bart = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: [
                Registration.create({
                    groupId: group1.id,
                    cycle: group1.cycle,
                    registeredAt: new Date()
                })
            ]
        })
        const alice = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: []
        })
        const tom = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
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

        cart.calculatePrices([bart, alice, tom], [group1, group2, group3], [category], defaultPaymentConfiguration)
        expect(cart.items).toHaveLength(2)

        const calculatedAlice = cart.items.find(i => i.memberId === alice.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 10
        })

        const calculatedTom = cart.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 40
        })

        // Try in different order
        const cached = cart.price
        cart.calculatePrices([tom, bart, alice], [group2, group1, group3], [category], defaultPaymentConfiguration)
        expect(cart.price).toEqual(cached)
    })

    test("With two existing registration", () => {
        const group1 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 60,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 20,
                                reducedPrice: 10,
                            })
                        ]
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 60,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 10
                            })
                        ]
                    })
                ]
            })
        })

        const group3 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 70,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 20,
                                reducedPrice: 10,
                            })
                        ]
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

        const bart = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: [
                Registration.create({
                    groupId: group1.id,
                    cycle: group1.cycle,
                    registeredAt: new Date()
                })
            ]
        })
        const alice = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: [
                Registration.create({
                    groupId: group1.id,
                    cycle: group1.cycle,
                    registeredAt: new Date()
                })
            ]
        })
        const tom = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
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

        cart.calculatePrices([bart, alice, tom], [group1, group2, group3], [category], defaultPaymentConfiguration)
        expect(cart.items).toHaveLength(2)

        const calculatedTom = cart.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 20
        })

        // Try in different order
        const cached = cart.price
        cart.calculatePrices([tom, bart, alice], [group2, group1, group3], [category], defaultPaymentConfiguration)
        expect(cart.price).toEqual(cached)
    })

    test("With reduced price", () => {
        const group1 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        prices: [
                            GroupPrice.create({
                                price: 60,
                                reducedPrice: 50,
                            }),
                            GroupPrice.create({
                                price: 40,
                            }),
                            GroupPrice.create({
                                price: 20,
                            })
                        ]
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

        const bart = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: []
        })
        const alice = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: []
        })
        const tom = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
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

        cart.calculatePrices([bart, alice, tom], [group1], [category], defaultPaymentConfiguration)
        expect(cart.items).toHaveLength(3)

        // Check if Bart got the cheapest price
        const calculatedBart = cart.items.find(i => i.memberId === bart.id)
        expect(calculatedBart).toMatchObject({
            calculatedPrice: 40
        })

        // Alice is the only one with the reduced price, so plan it as the first memebr without family discount
        const calculatedAlice = cart.items.find(i => i.memberId === alice.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 50
        })

        const calculatedTom = cart.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 20
        })

        // Try in different order
        const cached = cart.price
        cart.calculatePrices([tom, bart, alice], [group1], [category], defaultPaymentConfiguration)
        expect(cart.price).toEqual(cached)
    })

    test("Group only discounts", () => {
        const group1 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        onlySameGroup: true,
                        prices: [
                            GroupPrice.create({
                                price: 60,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 20,
                                reducedPrice: 10,
                            })
                        ]
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        onlySameGroup: true,
                        prices: [
                            GroupPrice.create({
                                price: 60,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 40,
                                reducedPrice: 10,
                            }),
                            GroupPrice.create({
                                price: 10
                            })
                        ]
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

        const bart = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: [
                Registration.create({
                    groupId: group2.id,
                    cycle: group2.cycle,
                    registeredAt: new Date()
                })
            ]
        })
        const alice = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: []
        })
        const tom = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
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

        cart.calculatePrices([bart, alice, tom], [group1, group2], [category], defaultPaymentConfiguration)
        expect(cart.items).toHaveLength(3)

        // Check if Bart got the cheapest price
        const calculatedBart = cart.items.find(i => i.memberId === bart.id)
        expect(calculatedBart).toMatchObject({
            calculatedPrice: 60
        })

        const calculatedAlice = cart.items.find(i => i.memberId === alice.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 40
        })

        const calculatedTom = cart.items.find(i => i.memberId === tom.id)
        expect(calculatedTom).toMatchObject({
            calculatedPrice: 10
        })

        // Try in different order
        const cached = cart.price
        cart.calculatePrices([tom, bart, alice], [group2, group1], [category], defaultPaymentConfiguration)
        expect(cart.price).toEqual(cached)
    })

    test("Discount if same member registers for multiple groups", () => {
        const group1 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        sameMemberOnlyDiscount: true,
                        prices: [
                            GroupPrice.create({
                                price: 60,
                            }),
                            GroupPrice.create({
                                price: 40,
                            }),
                            GroupPrice.create({
                                price: 20,
                            }),
                            GroupPrice.create({
                                price: 10,
                            })
                        ]
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        sameMemberOnlyDiscount: true,
                        prices: [
                            GroupPrice.create({
                                price: 100,
                            }),
                            GroupPrice.create({
                                price: 200,
                            })
                        ]
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

        const bart = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: [
                Registration.create({
                    groupId: group2.id,
                    cycle: group2.cycle,
                    registeredAt: new Date()
                })
            ]
        })
        const alice = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
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
            groupId: group1.id,
            memberId: alice.id,
            reduced: false,
            waitingList: false
        }))

        cart.calculatePrices([bart, alice], [group1, group2], [category], defaultPaymentConfiguration)
        expect(cart.items).toHaveLength(3)

        // Check if Bart got the cheapest price
        const calculatedBart = cart.items.find(i => i.memberId === bart.id)
        expect(calculatedBart).toMatchObject({
            calculatedPrice: 40
        })

        const calculatedAlice = cart.items.find(i => i.memberId === alice.id && i.groupId === group2.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 100
        })

        const calculatedAlice2 = cart.items.find(i => i.memberId === alice.id && i.groupId === group1.id)
        expect(calculatedAlice2).toMatchObject({
            calculatedPrice: 40
        })

        // Try in different order
        const cached = cart.price
        cart.calculatePrices([bart, alice], [group2, group1], [category], defaultPaymentConfiguration)
        expect(cart.price).toEqual(cached)
    })

    test("Combination of group and category based discounts", () => {
        const group1 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        sameMemberOnlyDiscount: false,
                        onlySameGroup: true,
                        prices: [
                            GroupPrice.create({
                                price: 60,
                            }),
                            GroupPrice.create({
                                price: 40,
                            }),
                            GroupPrice.create({
                                price: 20,
                            }),
                            GroupPrice.create({
                                price: 10,
                            })
                        ]
                    })
                ]
            })
        })

        // 
        const group2 = Group.create({
            organizationId: 'test',
            settings: GroupSettings.create({
                registrationStartDate: new Date(),
                registrationEndDate: new Date(),
                startDate: new Date(),
                endDate: new Date(),
                prices: [
                    GroupPrices.create({
                        sameMemberOnlyDiscount: true,
                        onlySameGroup: false,
                        prices: [
                            GroupPrice.create({
                                price: 100,
                            }),
                            GroupPrice.create({
                                price: 50,
                            }),
                            GroupPrice.create({
                                price: 10,
                            })
                        ]
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

        const bart = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            users: [],
            registrations: [
                Registration.create({
                    groupId: group2.id,
                    cycle: group2.cycle,
                    registeredAt: new Date()
                })
            ]
        })
        const alice = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
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
            groupId: group1.id,
            memberId: alice.id,
            reduced: false,
            waitingList: false
        }))

        cart.calculatePrices([bart, alice], [group1, group2], [category], defaultPaymentConfiguration)
        expect(cart.items).toHaveLength(3)

        const calculatedBart = cart.items.find(i => i.memberId === bart.id)
        expect(calculatedBart).toMatchObject({
            calculatedPrice: 60
        })

        const calculatedAlice = cart.items.find(i => i.memberId === alice.id && i.groupId === group2.id)
        expect(calculatedAlice).toMatchObject({
            calculatedPrice: 50
        })

        const calculatedAlice2 = cart.items.find(i => i.memberId === alice.id && i.groupId === group1.id)
        expect(calculatedAlice2).toMatchObject({
            calculatedPrice: 40
        })

        // Try in different order
        const cached = cart.price
        cart.calculatePrices([bart, alice], [group2, group1], [category], defaultPaymentConfiguration)
        expect(cart.price).toEqual(cached)
    })
})
