import { Database, Migration } from '@simonbackx/simple-database';
import { BalanceItem, BalanceItemPayment, Group,Member, Organization, Payment, Registration } from '@stamhoofd/models';
import { BalanceItemStatus, EncryptedMemberWithRegistrations, GroupCategory, IDRegisterCart, IDRegisterItem, PaymentMethod, PaymentStatus, RegisterCart } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

let groups: Group[] = []
const organizationCache = new Map<string, Organization>()
const groupCycleCache = new Map<string, number>()
const skipRegistrations = new Set<string>()
const skipPayments = new Set<string>()
const paymentsTotalAdded = new Map<string, {expected: number, total: number}>()

const retryRegistrations: Registration[] = []

const stats = {
    counted: 0,
    price: 0,
    singleRegistration: 0,
    recalculated: 0,
    divided: 0,
    cached: 0,
    dividedOld: 0, // divided in older cycles
    zero: 0,
    roundingErrors: 0,
    correctPayments: 0,
}

const avgTotal = 96000
let lastPercentage = 0

function doCount() {
    stats.counted++
    const percentage = Math.round(stats.counted / avgTotal * 100)
    if (percentage !== lastPercentage) {
        lastPercentage = percentage
        console.log(percentage+"%")
    }
}

function setCachedPrice(registration: Registration, price: number) {
    const groupCycleCacheKey = registration.groupId + "-" + registration.cycle
    const existing = groupCycleCache.get(groupCycleCacheKey) ?? 0
    groupCycleCache.set(groupCycleCacheKey, Math.max(price, existing))
}

function getCachedPrice(registration: Registration): number | null {
    const groupCycleCacheKey = registration.groupId + "-" + registration.cycle
    return groupCycleCache.get(groupCycleCacheKey) ?? null
}

function checkPayment(payment: Payment, price: number) {
    const n = (paymentsTotalAdded.get(payment.id)?.total ?? 0) + price

    if (n > 0) {
        paymentsTotalAdded.set(payment.id, {expected: payment.price, total: n})
    }

    if (price !== 0 && n === payment.price) {
        // Mark this as correct
        stats.correctPayments++
    }
}

async function storePrice(registration: Registration, price: number, group: Group, payment: Payment) {
    if (skipRegistrations.has(registration.id)) {
        console.log('Skip registration', registration.id)
        return
    }
    skipRegistrations.add(registration.id)

    if (price === 0) {
        return;
    }

    // Create balance item
    const balanceItem = new BalanceItem();
    balanceItem.registrationId = registration.id;
    balanceItem.price = price
    balanceItem.description = `Inschrijving ${group.settings.name}`
    balanceItem.pricePaid = payment.status == PaymentStatus.Succeeded ? price : 0;
    balanceItem.memberId = registration.memberId;
    //balanceItem.userId = registration.us
    balanceItem.organizationId = group.organizationId;
    balanceItem.status = payment.status == PaymentStatus.Succeeded ? BalanceItemStatus.Paid : (registration.registeredAt ? BalanceItemStatus.Pending : BalanceItemStatus.Hidden);
    balanceItem.createdAt = registration.createdAt
    await balanceItem.save();

    // Create one balance item payment to pay it in one payment
    const balanceItemPayment = new BalanceItemPayment()
    balanceItemPayment.balanceItemId = balanceItem.id;
    balanceItemPayment.paymentId = payment.id;
    balanceItemPayment.organizationId = group.organizationId;
    balanceItemPayment.price = balanceItem.price;
    await balanceItemPayment.save();

    checkPayment(payment, balanceItem.price)

    return Promise.resolve()

}

async function storeFreeContribution(registration: Registration, group: Group, payment: Payment) {
    if ((payment.freeContribution ?? 0) === 0) {
        return
    }

    if (skipPayments.has(payment.id)) {
        console.log('Skip payment', payment.id)
        return;
    }
    skipPayments.add(payment.id)

    // Create balance item
    const balanceItem = new BalanceItem();
    //balanceItem.registrationId = registration.id;
    balanceItem.price = payment.freeContribution ?? 0
    balanceItem.description = `Vrije bijdrage`
    balanceItem.pricePaid = payment.status == PaymentStatus.Succeeded ? (payment.freeContribution ?? 0) : 0;
    balanceItem.memberId = registration.memberId;
    
    //balanceItem.userId = registration.us
    balanceItem.organizationId = group.organizationId;
    balanceItem.status = payment.status == PaymentStatus.Succeeded ? BalanceItemStatus.Paid : (registration.registeredAt ? BalanceItemStatus.Pending : BalanceItemStatus.Hidden);
    balanceItem.createdAt = payment.createdAt
    await balanceItem.save();

    // Create one balance item payment to pay it in one payment
    const balanceItemPayment = new BalanceItemPayment()
    balanceItemPayment.balanceItemId = balanceItem.id;
    balanceItemPayment.paymentId = payment.id;
    balanceItemPayment.organizationId = group.organizationId;
    balanceItemPayment.price = balanceItem.price;
    await balanceItemPayment.save();
    
    checkPayment(payment, balanceItem.price)
    return Promise.resolve()
}

async function processRegistrations(registrations: Registration[], canRetry: boolean) {
    for (const registration of registrations) {
        doCount()
        if (skipRegistrations.has(registration.id)) {
            continue;
        }

        if (registration.paymentId) {
            const payment = await Payment.getByID(registration.paymentId)
            if (!payment) {
                console.warn('Payment not found for registration', registration.id)
                continue;
            }
            const thisGroup = groups.find(g => g.id == registration.groupId)     
            if (!thisGroup) {
                console.log('Group not found')
                continue
            }

            if (payment.organizationId === null) {
                payment.organizationId = thisGroup.organizationId
                await payment.save()
            }

            if (payment.price === 0 && payment.freeContribution === 0) {
                stats.zero++;
                continue;
            }

            const organization = organizationCache.get(thisGroup.organizationId) ?? await Organization.getByID(thisGroup.organizationId)

            if (!organization) {
                console.log('organization not found')
                continue;
            }       
            organizationCache.set(organization.id, organization)

            const mutualRegistrations = await Registration.where({ paymentId: payment.id })
        
            if (mutualRegistrations.length === 1) {
                if (mutualRegistrations[0].id !== registration.id) {
                    console.log('Registration not found')
                    continue;
                }
                // We know the price with certainty
                const price = payment.price - (payment.freeContribution ?? 0)
                stats.singleRegistration++;

                setCachedPrice(registration, price)

                await storePrice(registration, price, thisGroup, payment)
                await storeFreeContribution(registration, thisGroup, payment)
            } else if (mutualRegistrations.length > 1 && payment.price - (payment.freeContribution ?? 0) > 0) {
                // Try saved prices
                if (mutualRegistrations.every(p => p.price !== null)) {
                    const total = mutualRegistrations.reduce((a, b) => a + b.price!, 0)
                    
                    if (total === payment.price - (payment.freeContribution ?? 0)) {
                        for (const reg of mutualRegistrations) {
                            if (reg.price === 0) {
                                // Skip
                                skipRegistrations.add(reg.id)
                                continue;
                            }
                            const price = reg.price!;
                            stats.price++;

                            setCachedPrice(reg, price)
                            await storePrice(reg, price, groups.find(g => g.id === reg.groupId) ?? thisGroup, payment)
                        }
                        await storeFreeContribution(registration, thisGroup, payment)
                        continue;
                    }
                }
                    
                // First try using cached prices
                const cachedPrices = mutualRegistrations.map(r => getCachedPrice(r))
                if (cachedPrices.every(p => p !== null)) {
                    const total = cachedPrices.reduce((a, b) => a! + b!, 0)
                    if (total === payment.price - (payment.freeContribution ?? 0)) {
                        // We can use the cached price for all registrations
                        for (const reg of mutualRegistrations) {
                            const price = getCachedPrice(reg)!

                            if (price === 0) {
                                skipRegistrations.add(reg.id)
                                continue;
                            }
                            stats.cached++;

                            await storePrice(reg, price, groups.find(g => g.id === reg.groupId) ?? thisGroup, payment)
                        }
                        await storeFreeContribution(registration, thisGroup, payment)
                        continue;
                    }
                }
                
                const members = await Member.getByIDs(...Formatter.uniqueArray(mutualRegistrations.map(r => r.memberId)))

                // Do a manual recalculation of the price
                const cart = new IDRegisterCart()
                const filteredGroups = groups.filter(g => mutualRegistrations.some(r => r.groupId === g.id))

                try {
                    // Fix deleted categories
                    for (const group of filteredGroups) {
                        if (!organization.meta.categories.find(c => c.groupIds.includes(group.id))) {
                            organization.meta.categories.push(
                                GroupCategory.create({
                                    groupIds: [group.id]
                                })
                            )
                        }
                    }

                    for (const reg of mutualRegistrations) {
                        cart.items.push(IDRegisterItem.create({
                            memberId: reg.memberId,
                            groupId: reg.groupId,
                            reduced: members[0].details.requiresFinancialSupport?.value ?? false,
                            waitingList: reg.waitingList,
                        }))
                    }

                    cart.calculatePrices(
                        members.map(m => EncryptedMemberWithRegistrations.create({
                            ...m,
                            registrations: [],
                            details: m.details,
                            users: [],
                        })),
                        filteredGroups.map(g => g.getStructure()), 
                        organization?.meta.categories ?? [],
                        registration.createdAt
                    )
                } catch (e) {
                    // Category doesn't exist anymore
                    console.error(e)
                }

                if (cart.price === payment.price - (payment.freeContribution ?? 0) && cart.items.length === mutualRegistrations.length) {
                    for (const reg of mutualRegistrations) {
                        const item = cart.items.shift()
                        stats.recalculated++;

                        if (!item) {
                            console.log('Warning: item not found for registration in cart')
                            continue;
                        }

                        const price = item.calculatedPrice

                        if (price === 0) {
                            skipRegistrations.add(reg.id)
                            continue;
                        }

                        setCachedPrice(reg, price)
                        await storePrice(reg, price, filteredGroups.find(g => g.id === reg.groupId) ?? thisGroup, payment)
                    }
                    await storeFreeContribution(registration, thisGroup, payment)
                    
                } else {
                    // Mark this one for retry
                    if (canRetry) {
                        retryRegistrations.push(registration)
                    } else {
                        // It the price doesn't match: devide the price by the number of registrations
                        const p = (payment.price - (payment.freeContribution ?? 0))
                        const price = Math.floor(p / mutualRegistrations.length)
                        let roundCorrection = 0;
                        if (price * mutualRegistrations.length !== p) {
                            stats.roundingErrors++;
                            roundCorrection = p - (price * mutualRegistrations.length)
                        }

                        for (const reg of mutualRegistrations) {
                            if (thisGroup && thisGroup.cycle === reg.cycle && payment.method !== PaymentMethod.Unknown && payment.createdAt > new Date("2021-09-01") && thisGroup.deletedAt === null) {
                                stats.divided++;

                                //console.log("Divided", mutualRegistrations.map(r => r.id), 'expected', payment.price - (payment.freeContribution ?? 0), 'actual', cart.price)
                            } else {
                                stats.dividedOld++;
                            }

                            let ppp = price;
                            if (reg.id === registration.id) {
                                ppp += roundCorrection
                            }

                            await storePrice(reg, ppp, filteredGroups.find(g => g.id === reg.groupId) ?? thisGroup, payment)
                        }
                        await storeFreeContribution(registration, thisGroup, payment)
                    }
                }
            } else {
                if (payment.price === 0 && payment.freeContribution !== 0) {
                    await storeFreeContribution(registration, thisGroup, payment)
                }

                // Don't create balances
                stats.zero++;
            }
        }

        //console.log('Calculated price for registration', registration.id, price)
    }
}

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    let lastId = ""
    let registrations = await Registration.where({
        id: {
            sign: ">",
            value: lastId
        }
    }, {
        limit: 200,
        sort: ["id"]
    })

    // Delete all balance items
    await Database.delete("DELETE FROM `balance_items` where registrationId is not null");

    groups = await Group.all()

    // eslint-disable-next-line no-constant-condition
    while (true) {
        if (registrations.length == 0) {
            break;
        }

        lastId = registrations[registrations.length - 1].id

        // Split registrations in batches of 200 using vanilla js
        const batches: Registration[][] = []
        for (let i = 0; i < registrations.length; i += 1000) {
            batches.push(registrations.slice(i, i + 1000))
        }

        // Process batches in parallel
        await Promise.all([
            processRegistrations(registrations, true),
            (async () => {
                // Fetch the next registrations in parallel
                registrations = await Registration.where({
                    id: {
                        sign: ">",
                        value: lastId
                    }
                }, {
                    limit: 1000,
                    sort: ["id"]
                })
            })()
        ])
    }

    // Retry using all available cached prices
    await processRegistrations(retryRegistrations, false)

    console.log('Stats', stats)
    console.log('Total affected payments', paymentsTotalAdded.size)
    console.log('Precision', (stats.correctPayments / paymentsTotalAdded.size * 100).toFixed(2) + '%')

    // loop throught payments that do not match total
    for (const [paymentId, total] of paymentsTotalAdded) {
        if (total.total !== total.expected) {
            console.log('Payment', paymentId, 'does not match total', total.total, 'expected', total.expected)
        }
    }

    // Update total balances
    await Registration.updateOutstandingBalance('all')
    await Member.updateOutstandingBalance('all')
});


