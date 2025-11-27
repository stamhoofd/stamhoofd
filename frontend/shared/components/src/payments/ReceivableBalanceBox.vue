<template>
    <LoadingBoxTransition :error-box="errors.errorBox">
        <div v-if="detailedItem" class="container">
            <template v-if="detailedItem.filteredBalanceItems.length">
                <SegmentedControl v-if="!hideSegmentedControl" v-model="selectedTab" :items="['grouped', 'individual']" :labels="[$t(`07929b60-3a4c-4de1-8d85-c25e836e0535`), $t(`9544ddfe-bde7-452b-8bfb-0f3ffe8cd0e8`)]" />
                <ReceivableBalanceList v-if="selectedTab === 'individual'" :item="detailedItem" />
                <GroupedBalanceList v-else :item="detailedItem" />
                <BalancePriceBreakdown :item="detailedItem" />
            </template>
            <p v-else class="info-box">
                {{ $t('4c4f6571-f7b5-469d-a16f-b1547b43a610') }}
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
                        {{ $t('f2babc21-ce3a-4000-acb5-c1623b7b9e43') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('b79653ad-3b9b-4586-bd26-cbca7ccb2ecf') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="detailedItem.amountOpen >= 0 && detailedItem.filteredBalanceItems.length" :selectable="true" element-name="button" @click="createPayment(PaymentType.Payment)">
                    <template #left>
                        <IconContainer icon="receive">
                            <template #aside>
                                <span class="icon add small primary" />
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('b60dbf08-bc14-4cf0-81c4-a4bcb20e28cd') }}
                    </h3>
                    <p class="style-description-small">
                        {{ PaymentTypeHelper.getDescription(PaymentType.Payment) }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-else-if="detailedItem.amountOpen < 0 && detailedItem.filteredBalanceItems.length" :selectable="true" element-name="button" class="theme-error" @click="createPayment(PaymentType.Refund)">
                    <template #left>
                        <IconContainer icon="undo">
                            <template #aside>
                                <span class="icon add small primary" />
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('81f26de9-5a67-4ea2-985e-069aa4803409') }}
                    </h3>
                    <p class="style-description-small">
                        {{ PaymentTypeHelper.getDescription(PaymentType.Refund) }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="detailedItem.amountOpen === 0 && detailedItem.filteredBalanceItems.length" :selectable="true" element-name="button" class="theme-secundary" @click="createPayment(PaymentType.Reallocation)">
                    <template #left>
                        <IconContainer icon="wand">
                            <template #aside>
                                <span class="icon add small primary" />
                            </template>
                        </IconContainer>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('f70ecedf-608c-4330-89e6-8e0a7a5ac264') }}
                    </h3>
                    <p class="style-description-small">
                        {{ PaymentTypeHelper.getDescription(PaymentType.Reallocation) }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="pendingPayments.length > 0">
                <hr><h2>{{ $t('ac279f6b-0c7c-4ef1-9178-1fd030fe7cc8') }}</h2>
                <p>{{ $t('f06c6769-1e42-4a15-b44d-f74a32980d26') }}</p>

                <STList>
                    <PaymentRow v-for="payment of pendingPayments" :key="payment.id" :payments="pendingPayments" :payment="payment" />
                </STList>
            </template>

            <hr><h2>{{ $t('290c7beb-61c7-425d-b35e-333aba83bbc5') }}</h2>

            <p v-if="succeededPayments.length === 0" class="info-box">
                {{ $t('a0b932dc-3f60-45a5-aca3-32918474e315') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments" />
            </STList>

            <hr><h2>{{ $t('c4fe92c5-851c-422a-842b-da21e56e6f4c') }}</h2>

            <p>{{ $t('18bfe74f-21d2-4eec-aced-31f6e8383cda') }}</p>

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
                {{ $t('6b4ac7f1-7e9f-489b-87e0-58fc493209f2') }}
            </p>
        </div>
    </LoadingBoxTransition>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { BalancePriceBreakdown, EditBalanceItemView, EditPaymentView, ErrorBox, GlobalEventBus, GroupedBalanceList, IconContainer, LoadingBoxTransition, PaymentRow, SegmentedControl, Toast, useContext, useErrors, useLoadFamily, usePlatformFamilyManager } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { BalanceItemWithPayments, DetailedReceivableBalance, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentStatus, PaymentType, PaymentTypeHelper, PlatformMember, ReceivableBalance, ReceivableBalanceType } from '@stamhoofd/structures';
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
const selectedTab = ref(props.hideSegmentedControl ? 'individual' : 'grouped') as Ref<'grouped' | 'individual'>;
const owner = useRequestOwner();
const hasWrite = true;
const present = usePresent();
const loadFamily = useLoadFamily();

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
                selectedTab.value = 'individual';
            }
        }
        else {
            const lastPayment = detailedItem.value.payments.sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))[0];
            detailedItem.value.deepSet(response.data);
            const newLastPayment = detailedItem.value.payments.sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))[0];

            // Show a toast when an automatic reallocation happened because of some change
            if ((newLastPayment && !lastPayment) || (newLastPayment && lastPayment && lastPayment.createdAt < newLastPayment.createdAt)) {
                if (newLastPayment.type === PaymentType.Reallocation) {
                    new Toast($t('Een nieuwe automatische saldoverrekening werd aangemaakt'), 'wand ' + newLastPayment.theme).show();
                }
            }
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

async function reloadFamily() {
    if (!props.member) {
        return;
    }
    await loadFamily(props.member, { shouldRetry: false });
}

async function createPayment(type: PaymentType) {
    if (!detailedItem.value) {
        return;
    }

    const payment = PaymentGeneral.create({
        method: PaymentMethod.Transfer,
        status: PaymentStatus.Succeeded,
        type,
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
        components: [
            new ComponentWithProperties(NavigationController, {
                root: component,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
