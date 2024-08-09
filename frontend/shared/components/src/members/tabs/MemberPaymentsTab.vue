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
                        <h3 class="style-title-list">
                            <span class="style-price" v-if="item.amount > 1">{{ item.amount }} x</span> {{ item.description }}
                        </h3>
                        <p v-if="item.memberId && getMember(item.memberId) && multipleMembers" class="style-description-small">
                            {{ getMember(item.memberId)!.patchedMember.name }}
                        </p>
                        <p class="style-description-small">
                            {{ formatDate(item.createdAt) }}
                        </p>
                        <p class="style-description-small">
                            {{ formatPrice(item.price) }}
                        </p>
                        <template #right>
                            <span v-if="item.pricePaid === item.price" class="style-tag success">Betaald</span>
                            <span v-else-if="item.pricePaid > 0" class="style-tag warn">{{ formatPrice(item.pricePaid) }} betaald</span>
                            <span v-else-if="!item.hasPendingPayment" class="style-tag">Openstaand</span>
                            <span v-else class="style-tag warn">In verwerking</span>
                        </template>
                    </STListItem>
                </STList>

                <div v-if="filteredBalanceItems.length > 0" class="style-pricing-box">
                    <STList>
                        <STListItem v-if="outstandingBalance.total >= 0">
                            Totaal te betalen

                            <template #right>
                                {{ formatPrice(outstandingBalance.total) }}
                            </template>
                        </STListItem>
                        <STListItem v-else-if="outstandingBalance.totalPending > 0">
                            Totaal te betalen

                            <template #right>
                                {{ formatPrice(0) }}
                            </template>
                        </STListItem>
                        <STListItem v-if="outstandingBalance.totalPending > 0">
                            Waarvan in verwerking

                            <template #right>
                                {{ formatPrice(outstandingBalance.totalPending) }}
                            </template>
                        </STListItem>

                        <STListItem v-if="outstandingBalance.total < 0">
                            Totaal terug te betalen

                            <template #right>
                                {{ formatPrice(outstandingBalance.total) }}
                            </template>
                        </STListItem>
                    </STList>
                </div>

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
                        <STListItem v-for="payment of pendingPayments" :key="payment.id" :selectable="true" @click="openPayment(payment)">
                            <h3 class="style-title-list">
                                {{ getPaymentMethodName(payment.method) }}
                            </h3>
                            <p class="style-description-small">
                                Aangemaakt op {{ formatDate(payment.createdAt) }}
                            </p>

                            <template #right>
                                <span>{{ formatPrice(payment.price) }}</span>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>
                </template>

                <template v-if="succeededPayments.length > 0">
                    <hr>
                    <h2>Betalingen</h2>

                    <STList>
                        <STListItem v-for="payment of succeededPayments" :key="payment.id" :selectable="true" @click="openPayment(payment)">
                            <h3 class="style-title-list">
                                {{ getPaymentMethodName(payment.method) }}
                                <template v-if="payment.price < 0">
                                    (terugbetaling)
                                </template>
                            </h3>
                            <p v-if="!payment.paidAt || formatDate(payment.createdAt) !== formatDate(payment.paidAt)" class="style-description-small">
                                Aangemaakt op {{ formatDate(payment.createdAt) }}
                            </p>
                            <p v-if="payment.paidAt && payment.price >= 0" class="style-description-small">
                                Betaald op {{ formatDate(payment.paidAt) }}
                            </p>
                            <p v-else-if="payment.paidAt" class="style-description-small">
                                Terugbetaald op {{ formatDate(payment.paidAt) }}
                            </p>

                            <template #right>
                                <span>{{ formatPrice(payment.price) }}</span>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>
                </template>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { ErrorBox, GlobalEventBus, Spinner, useAuth, useContext, useErrors, useOrganization, usePlatform, usePlatformFamilyManager } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { BalanceItemWithPayments, FinancialSupportSettings, Payment, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PlatformMember } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import EditBalanceItemView from '../../payments/EditBalanceItemView.vue';
import EditPaymentView from '../../payments/EditPaymentView.vue';
import PaymentView from '../../payments/PaymentView.vue';

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

const filteredBalanceItems = computed(() => {
    return balanceItems.value.filter(b => b.price - b.pricePaid !== 0)
});

const multipleMembers = computed(() => {
    return props.member.family.members.length > 1
});

const financialSupportWarningText = computed(() => {
    return platform.value.config.recordsConfiguration.financialSupport?.warningText ?? organization.value?.meta.recordsConfiguration.financialSupport?.warningText ?? FinancialSupportSettings.defaultWarningText
});

const outstandingBalance = computed(() => {
    return BalanceItemWithPayments.getOutstandingBalance(balanceItems.value)
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

function getMember(id: string) {
    return props.member.family.members.find(m => m.id == id)
}

function getPaymentMethodName(method: PaymentMethod) {
    return PaymentMethodHelper.getNameCapitalized(method);
}

async function createPayment() {
    const payment = PaymentGeneral.create({
        method: PaymentMethod.PointOfSale,
        status: PaymentStatus.Succeeded,
        paidAt: new Date()
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
    const component = new ComponentWithProperties(PaymentView, {
        initialPayment: payment
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
