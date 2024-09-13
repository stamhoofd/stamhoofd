<template>
    <div class="member-payments-view">
        <main class="container">
            <STErrorsDefault :error-box="errors.errorBox" />
            <Spinner v-if="loadingPayments" />

            <template v-else>
                <p v-if="member.patchedMember.details.requiresFinancialSupport && member.patchedMember.details.requiresFinancialSupport.value" class="warning-box">
                    {{ financialSupportWarningText }}
                </p>

                <p v-if="filteredBalanceItems.length == 0" class="info-box">
                    Geen openstaande rekening
                </p>
                
                <STList>
                    <STListItem v-for="item in filteredBalanceItems" :key="item.id" :selectable="hasWrite" @click="editBalanceItem(item)">
                        <template #left>
                            <span v-if="item.amount === 0" class="style-amount min-width">
                                <span class="icon disabled gray" />
                            </span>
                            <span v-else class="style-amount min-width">{{ formatFloat(item.amount) }}</span>
                        </template>

                        <p v-if="item.itemPrefix" class="style-title-prefix-list">
                            {{ item.itemPrefix }}
                        </p>

                        
                        <h3 class="style-title-list">
                            {{ item.itemTitle }}
                        </h3>

                        <p v-if="item.itemDescription" class="style-description-small">
                            {{ item.itemDescription }}
                        </p>

                        <p class="style-description-small">
                            {{ formatDate(item.createdAt) }}
                        </p>

                        <p v-if="item.amount === 0" class="style-description-small">
                            Deze schuld werd verwijderd maar werd al (deels) betaald
                        </p>

                        <p v-else class="style-description-small">
                            {{ formatFloat(item.amount) }} x {{ formatPrice(item.unitPrice) }} te betalen
                        </p>

                        <p v-if="item.pricePaid !== 0" class="style-description-small">
                            {{ formatPrice(item.pricePaid) }} betaald
                        </p>

                        <p v-if="item.pricePending !== 0" class="style-description-small">
                            {{ formatPrice(item.pricePending) }} in verwerking
                        </p>

                        <template #right>
                            <p class="style-price-base">
                                {{ formatPrice(item.priceOpen) }}
                            </p>
                        </template>
                    </STListItem>
                </STList>

                <PriceBreakdownBox :price-breakdown="priceBreakown" />

                <button v-if="hasWrite" type="button" class="button text" @click="createBalanceItem">
                    <span class="icon add" />
                    <span>Bedrag aanrekenen</span>
                </button>

                <button v-if="hasWrite && ((outstandingBalance.total - outstandingBalance.totalPending) > 0 || outstandingBalance.total < 0)" type="button" class="button text" @click="createPayment">
                    <span class="icon card" />
                    <span>Betaling/terugbetaling registreren</span>
                </button>

                <template v-if="outstandingBalance.total > 0">
                    <hr>
                    <h2>Hoe openstaand bedrag betalen?</h2>
                    <p>Leden kunnen hun openstaand bedrag betalen door naar het ledenportaal te gaan. Bovenaan zullen ze bij 'snelle acties' een knop zien waarmee ze hun openstaand bedrag kunnen betalen (je kan een e-mail sturen met een inlogknop om naar het ledenportaal te gaan).</p>
                    <p v-if="pendingPayments.length > 0" class="style-description-block">
                        Opgelet, het deel dat in verwerking is kan niet betaald worden via het ledenportaal. Je kan wel de betalingen die in verwerking zijn annuleren zodat ze via een andere betaalmethode betaald kunnen worden via het ledenportaal. Bijvoorbeeld een overschrijving die al lang niet betaald werd kan je annuleren om vervolgens een nieuw betaalverzoek te versturen van het openstaande bedrag.
                    </p>
                    <p v-if="(outstandingBalance.total - outstandingBalance.totalPending) !== 0" class="style-description-block">
                        Je kan zelf ook manueel een betaling toevoegen (bv. als er ter plaatse werd betaald, of via een overschrijving die niet in het systeem is opgenomen) via de knop 'Betaling/terugbetaling registreren' hierboven.
                    </p>
                </template>
               
                <template v-if="pendingPayments.length > 0">
                    <hr>
                    <h2>In verwerking</h2>
                    <p>Het kan dat het openstaande bedrag eerder betaald werd via overschrijving. In dit geval weten we nog niet of die echt is uitgevoerd tot jullie het bedrag ontvangen op jullie rekening. Je kan deze overschrijvingen hier markeren als betaald of annuleren.</p>

                    <STList>
                        <PaymentRow v-for="payment of pendingPayments" :key="payment.id" :payment="payment" :payments="pendingPayments" />
                    </STList>
                </template>

                <template v-if="succeededPayments.length > 0">
                    <hr>
                    <h2>Betalingen</h2>

                    <STList>
                        <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments" />
                    </STList>
                </template>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncPaymentView, ErrorBox, GlobalEventBus, PaymentRow, PriceBreakdownBox, Spinner, useAuth, useContext, useErrors, useFinancialSupportSettings, useOrganization, usePlatform, usePlatformFamilyManager } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { BalanceItemWithPayments, FinancialSupportSettings, Payment, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentStatus, PermissionLevel, PlatformMember } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import EditBalanceItemView from '../../payments/EditBalanceItemView.vue';
import EditPaymentView from '../../payments/EditPaymentView.vue';

const props = defineProps<{
    member: PlatformMember
}>();

const loadingPayments = ref(true);
const balanceItems = ref<BalanceItemWithPayments[]>([]) as Ref<BalanceItemWithPayments[]>;
const owner = useRequestOwner();
const context = useContext();
const errors = useErrors();
const platformFamilyManager = usePlatformFamilyManager();
const auth = useAuth();
const platform = usePlatform();
const organization = useOrganization();
const present = usePresent();

reload().catch(console.error);

// Listen for patches in payments
GlobalEventBus.addListener(this, "paymentPatch", async (payment) => {
    if (payment && payment.id && paymentIds.value.has(payment.id as string)) {
        // Reload members and family
        reloadFamily().catch(console.error)

        // We need to reload because pricePaid doesn't update from balace items
        reload().catch(console.error)
    }
    return Promise.resolve()
})

const priceBreakown = computed(() => {
    const balance = outstandingBalance.value

    const all = [
        {
            name: 'Reeds betaald',
            price: balance.pricePaid
        },
        {
            name: 'In verwerking',
            price: balance.pricePending,
        }
    ].filter(a => a.price !== 0)

    if (all.length > 0) {
        all.unshift({
            name: 'Totaalprijs',
            price: balance.price
        })
    }

    return [
        ...all,
        {
            name: balance.priceOpen < 0 ? 'Terug te krijgen' : 'Te betalen',
            price: Math.abs(balance.priceOpen)
        }
    ];
});

const filteredBalanceItems = computed(() => {
    return balanceItems.value.filter(b => b.priceOpen !== 0)
});
const {financialSupportSettings} = useFinancialSupportSettings()

const financialSupportWarningText = computed(() => {
    return financialSupportSettings.value.warningText
});

const outstandingBalance = computed(() => {
    return BalanceItemWithPayments.getOutstandingBalance(filteredBalanceItems.value)
});

const paymentIds = computed(() => {
    const payments = new Set<string>()
    for (const item of balanceItems.value) {
        for (const payment of item.payments) {
            payments.add(payment.payment.id)
        }
    }
    return payments
});

const hasWrite = computed(() => {
    return auth.canAccessMemberPayments(props.member, PermissionLevel.Write)
})

const pendingPayments = computed(() => {
    const payments = new Map<string, Payment>()
    for (const item of balanceItems.value) {
        for (const payment of item.payments) {
            if (payment.payment.isPending) {
                payments.set(payment.payment.id, payment.payment)
            }
        }
    }
    return [...payments.values()].sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))
})

const succeededPayments = computed(() => {
    const payments = new Map<string, Payment>()
    for (const item of balanceItems.value) {
        for (const payment of item.payments) {
            if (payment.payment.isSucceeded) {
                payments.set(payment.payment.id, payment.payment)
            }
        }
    }
    return [...payments.values()].sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))
})

async function reloadFamily() {
    await platformFamilyManager.loadFamilyMembers(props.member, {shouldRetry: false})
}

async function reload() {
    try {
        loadingPayments.value = true;
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/organization/members/${props.member.id}/balance`,
            decoder: new ArrayDecoder(BalanceItemWithPayments as Decoder<BalanceItemWithPayments>),
            owner
        });
        response.data.sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
        
        // Try to reuse existing references
        const newItems = response.data

        for (const item of balanceItems.value) {
            const found = newItems.findIndex(i => i.id === item.id)
            if (found !== -1) {
                // Replace with existing reference
                const newItem = newItems[found];

                // Same for payments
                for (const payment of item.payments) {
                    const foundPayment = newItem.payments.findIndex(p => p.payment.id === payment.payment.id)
                    if (foundPayment !== -1) {
                        // Replace with existing reference
                        payment.set(newItem.payments[foundPayment])
                        newItem.payments[foundPayment] = payment
                    }
                }
                
                item.set(newItem)
                newItems[found] = item
            }
        }
        
        balanceItems.value = newItems;
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    loadingPayments.value = false;
}

async function createPayment() {
    const payment = PaymentGeneral.create({
        method: PaymentMethod.PointOfSale,
        status: PaymentStatus.Succeeded,
        paidAt: new Date(),
        customer: PaymentCustomer.create({
            firstName: props.member.patchedMember.details.firstName,
            lastName: props.member.patchedMember.details.lastName,
            email: props.member.patchedMember.details.email ?? props.member.patchedMember.details.getParentEmails()[0] ?? null,
        })
    })

    const component = new ComponentWithProperties(EditPaymentView, {
        payment,
        balanceItems: balanceItems.value,
        family: props.member.family,
        isNew: true,
        saveHandler: async (patch: AutoEncoderPatchType<PaymentGeneral>) => {
            const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
            arr.addPut(payment.patch(patch))
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/payments',
                body: arr,
                decoder: new ArrayDecoder(PaymentGeneral),
                shouldRetry: false
            });
            await reload();
            // Also reload member outstanding amount of the whole family
            await reloadFamily();
        }
    })
    await present({
        components: [component],
        modalDisplayStyle: "popup"
    })
}

async function openPayment(payment: Payment) {
    const component = new ComponentWithProperties(AsyncPaymentView, {
        payment
    })
    await present({
        components: [component],
        modalDisplayStyle: "popup"
    })
}

async function editBalanceItem(balanceItem: BalanceItemWithPayments) {
    if (!hasWrite.value) {
        return
    }
    const component = new ComponentWithProperties(EditBalanceItemView, {
        balanceItem,
        isNew: false,
        saveHandler: async (patch: AutoEncoderPatchType<BalanceItemWithPayments>) => {
            const arr: PatchableArrayAutoEncoder<BalanceItemWithPayments> = new PatchableArray();
            patch.id = balanceItem.id;
            arr.addPatch(patch)
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/balance',
                body: arr,
                decoder: new ArrayDecoder(BalanceItemWithPayments),
                shouldRetry: false
            });
            await reload();

            // Also reload member outstanding amount of the whole family
            await reloadFamily();
        }
    })
    await present({
        components: [component],
        modalDisplayStyle: "popup"
    })
}

async function createBalanceItem() {
    const balanceItem = BalanceItemWithPayments.create({
        memberId: props.member.id
    })
    const component = new ComponentWithProperties(EditBalanceItemView, {
        balanceItem,
        isNew: true,
        saveHandler: async (patch: AutoEncoderPatchType<BalanceItemWithPayments>) => {
            const arr: PatchableArrayAutoEncoder<BalanceItemWithPayments> = new PatchableArray();
            arr.addPut(balanceItem.patch(patch))
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/balance',
                body: arr,
                decoder: new ArrayDecoder(BalanceItemWithPayments),
                shouldRetry: false
            });
            await reload();
            // Also reload member outstanding amount of the whole family
            await reloadFamily();
        }
    })
    await present({
        components: [component],
        modalDisplayStyle: "popup"
    })
}
</script>
