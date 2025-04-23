<template>
    <LoadingBoxTransition :error-box="errors.errorBox">
        <div v-if="detailedItem" class="container">
            <template v-if="detailedItem.filteredBalanceItems.length">
                <SegmentedControl v-if="!hideSegmentedControl" v-model="selectedTab" :items="['Gegroepeerd', 'Individueel']" />
                <ReceivableBalanceList v-if="selectedTab === 'Individueel'" :item="detailedItem" />
                <GroupedBalanceList v-else :item="detailedItem" />
                <BalancePriceBreakdown :item="detailedItem" />
            </template>
            <p v-else class="info-box">
                {{ $t('Geen openstaand bedrag') }}
            </p>

            <STList v-if="hasWrite">
                <STListItem :selectable="true" element-name="button" @click="createBalanceItem">
                    <template #left>
                        <IconContainer icon="box">
                            <template #aside>
                                <span class="icon add small primary" />
                            </template>
                        </IconContainer>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Item toevoegen') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Voeg een item toe aan het openstaand bedrag of geef een tegoed') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="detailedItem.amountOpen >= 0" :selectable="true" element-name="button" @click="createPayment">
                    <template #left>
                        <IconContainer icon="receive">
                            <template #aside>
                                <span class="icon add small primary" />
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('Betaling registreren') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Via een betaling kan je één of meerdere items markeren als betaald') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-else :selectable="true" element-name="button" class="theme-error" @click="createPayment">
                    <template #left>
                        <IconContainer icon="undo">
                            <template #aside>
                                <span class="icon add small primary" />
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('Terugbetaling registreren') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Via een betaling kan je één of meerdere items markeren als betaald') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="item.objectType === ReceivableBalanceType.member || item.objectType === ReceivableBalanceType.user">
                <hr><h2>{{ $t('Hoe kan men dit betalen?') }}</h2>
                <p>{{ $t("Leden kunnen hun openstaand bedrag betalen door naar het ledenportaal te gaan. Bovenaan zullen ze bij 'snelle acties' een knop zien waarmee ze hun openstaand bedrag kunnen betalen (je kan een e-mail sturen met een inlogknop om naar het ledenportaal te gaan).") }}</p>
                <p v-if="detailedItem.amountPending !== 0" class="style-description-block">
                    {{ $t('Opgelet, het deel dat in verwerking is kan niet betaald worden via het ledenportaal. Je kan wel de betalingen die in verwerking zijn annuleren zodat ze via een andere betaalmethode betaald kunnen worden via het ledenportaal. Bijvoorbeeld een overschrijving die al lang niet betaald werd kan je annuleren om vervolgens een nieuw betaalverzoek te versturen van het openstaande bedrag.') }}
                </p>
                <p v-if="detailedItem.amountOpen !== 0" class="style-description-block">
                    {{ $t("Je kan zelf ook manueel een betaling toevoegen (bv. als er ter plaatse werd betaald, of via een overschrijving die niet in het systeem is opgenomen) via de knop 'Betaling/terugbetaling registreren' hierboven.") }}
                </p>
            </template>

            <template v-if="pendingPayments.length > 0">
                <hr><h2>{{ $t('In verwerking') }}</h2>
                <p>{{ $t('Bij betalingen via overschrijving of domiciliëring kan het even duren voor een betaling wordt bevestigd.') }}</p>

                <STList>
                    <PaymentRow v-for="payment of pendingPayments" :key="payment.id" :payments="pendingPayments" :payment="payment" />
                </STList>
            </template>

            <hr><h2>{{ $t('Betalingen') }}</h2>

            <p v-if="succeededPayments.length === 0" class="info-box">
                {{ $t('Je hebt nog geen betalingen ontvangen') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments" />
            </STList>

            <hr><h2>{{ $t('Contactpersonen') }}</h2>

            <p>{{ $t('Deze personen ontvangen een e-mail bij elke communicatie rond dit openstaand bedrag.') }}</p>

            <STList v-if="detailedItem.object.contacts.length" class="info">
                <STListItem v-for="(contact, index) of detailedItem.object.contacts" :key="index">
                    <h3 class="style-definition-label">
                        {{ contact.firstName || 'Onbekende naam' }} {{ contact.lastName }}
                    </h3>
                    <p v-for="(email, j) of contact.emails" :key="j" v-copyable class="style-definition-text style-copyable">
                        {{ email }}
                    </p>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                {{ $t('Geen contactpersonen gevonden') }}
            </p>
        </div>
    </LoadingBoxTransition>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { BalancePriceBreakdown, EditBalanceItemView, EditPaymentView, ErrorBox, GlobalEventBus, GroupedBalanceList, IconContainer, LoadingBoxTransition, PaymentRow, SegmentedControl, useContext, useErrors, usePlatformFamilyManager } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { BalanceItemWithPayments, DetailedReceivableBalance, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentStatus, PaymentType, PlatformMember, ReceivableBalance, ReceivableBalanceType } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, onMounted, ref, Ref } from 'vue';
import ReceivableBalanceList from './ReceivableBalanceList.vue';

const props = withDefaults(
    defineProps<{
        item: ReceivableBalance;
        member?: PlatformMember | null;
        hideSegmentedControl?: boolean;
    }>(),
    {
        member: null,
        hideSegmentedControl: true,
    });

const errors = useErrors();
const detailedItem = ref(null) as Ref<null | DetailedReceivableBalance>;
const context = useContext();
const selectedTab = ref(props.hideSegmentedControl ? 'Individueel' : 'Gegroepeerd') as Ref<'Gegroepeerd' | 'Individueel'>;
const owner = useRequestOwner();
const hasWrite = true;
const present = usePresent();

const pendingPayments = computed(() => {
    return detailedItem.value?.payments.filter(p => p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt)) ?? [];
});

const succeededPayments = computed(() => {
    return detailedItem.value?.payments.filter(p => !p.isPending).sort((a, b) => Sorter.byDateValue(a.paidAt ?? a.createdAt, b.paidAt ?? b.createdAt)) ?? [];
});

// Load detailed item
onMounted(async () => {
    await reload();
});

async function reload() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/receivable-balances/${props.item.objectType}/${props.item.object.id}`,
            decoder: DetailedReceivableBalance as Decoder<DetailedReceivableBalance>,
            owner,
        });

        if (!detailedItem.value) {
            detailedItem.value = response.data;

            if (detailedItem.value.filteredBalanceItems.length <= 4) {
                selectedTab.value = 'Individueel';
            }
        }
        else {
            detailedItem.value.deepSet(response.data);
        }

        props.item.deepSet(response.data);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

// Listen for patches in payments
GlobalEventBus.addListener(owner, 'paymentPatch', async () => {
    // Reload members and family
    reloadFamily().catch(console.error);

    await reload();
});

GlobalEventBus.addListener(owner, 'balanceItemPatch', async () => {
    await reload();
});

const platformFamilyManager = usePlatformFamilyManager();

async function reloadFamily() {
    if (!props.member) {
        return;
    }
    await platformFamilyManager.loadFamilyMembers(props.member, { shouldRetry: false });
}

async function createPayment() {
    if (!detailedItem.value) {
        return;
    }

    const payment = PaymentGeneral.create({
        method: PaymentMethod.Transfer,
        status: PaymentStatus.Succeeded,
        type: detailedItem.value.amountOpen >= 0 ? PaymentType.Payment : PaymentType.Refund,
        paidAt: new Date(),
        customer: detailedItem.value.object.contacts.length > 0
            ? PaymentCustomer.create({
                firstName: detailedItem.value.object.contacts[0].firstName,
                lastName: detailedItem.value.object.contacts[0].lastName,
                email: detailedItem.value.object.contacts[0].emails[0] ?? null,
            })
            : null,
    });

    if (props.item.objectType === ReceivableBalanceType.organization) {
        payment.payingOrganizationId = props.item.object.id;
    }

    const component = new ComponentWithProperties(EditPaymentView, {
        createBalanceItem,
        payment,
        balanceItems: computed(() => detailedItem.value?.filteredBalanceItems ?? []),
        family: props.member?.family ?? null,
        isNew: true,
        saveHandler: async (patch: AutoEncoderPatchType<PaymentGeneral>) => {
            const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
            arr.addPut(payment.patch(patch));
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/payments',
                body: arr,
                decoder: new ArrayDecoder(PaymentGeneral),
                shouldRetry: false,
            });
            await reload();
            // Also reload member outstanding amount of the whole family
            await reloadFamily();
        },
    });
    await present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}

async function createBalanceItem() {
    const balanceItem = BalanceItemWithPayments.create({});

    if (props.item.objectType === ReceivableBalanceType.member) {
        balanceItem.memberId = props.item.object.id;
    }

    if (props.item.objectType === ReceivableBalanceType.organization) {
        balanceItem.payingOrganizationId = props.item.object.id;
    }

    if (props.item.objectType === ReceivableBalanceType.user) {
        balanceItem.userId = props.item.object.id;
    }

    const component = new ComponentWithProperties(EditBalanceItemView, {
        balanceItem,
        isNew: true,
        saveHandler: async (patch: AutoEncoderPatchType<BalanceItemWithPayments>) => {
            const arr: PatchableArrayAutoEncoder<BalanceItemWithPayments> = new PatchableArray();
            arr.addPut(balanceItem.patch(patch));
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/balance',
                body: arr,
                decoder: new ArrayDecoder(BalanceItemWithPayments),
                shouldRetry: false,
            });
            await reload();
            // Also reload member outstanding amount of the whole family
            await reloadFamily();
        },
    });
    await present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}
</script>
