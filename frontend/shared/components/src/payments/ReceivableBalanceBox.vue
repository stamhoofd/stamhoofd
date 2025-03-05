<template>
    <LoadingBoxTransition :error-box="errors.errorBox">
        <div v-if="detailedItem" class="container">
            <template v-if="detailedItem.filteredBalanceItems.length">
                <SegmentedControl v-if="!hideSegmentedControl" v-model="selectedTab" :items="['Gegroepeerd', 'Individueel']"/>
                <ReceivableBalanceList v-if="selectedTab === 'Individueel'" :item="detailedItem"/>
                <GroupedBalanceList v-else :item="detailedItem"/>
                <BalancePriceBreakdown :item="detailedItem"/>
            </template>
            <p v-else class="info-box">
                {{ $t('8e3db09e-b04b-4f29-866c-ab202093fa99') }}
            </p>

            <STList v-if="hasWrite">
                <STListItem :selectable="true" element-name="button" @click="createBalanceItem">
                    <template #left>
                        <IconContainer icon="box">
                            <template #aside>
                                <span class="icon add small primary"/>
                            </template>
                        </IconContainer>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('fa974919-91ab-4005-930c-5df57de4532f') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('ffbb5f15-84cb-48be-98f4-cf392fd6f227') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-if="detailedItem.amountOpen >= 0" :selectable="true" element-name="button" @click="createPayment">
                    <template #left>
                        <IconContainer icon="receive">
                            <template #aside>
                                <span class="icon add small primary"/>
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('8bb10f83-0c50-4dc0-bb2a-a99582b1e378') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('957c4689-d573-4e71-8438-1a07764cafe8') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-else :selectable="true" element-name="button" class="theme-error" @click="createPayment">
                    <template #left>
                        <IconContainer icon="undo">
                            <template #aside>
                                <span class="icon add small primary"/>
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('22bc0216-abd2-44ff-81cb-d4476b1e8e75') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('957c4689-d573-4e71-8438-1a07764cafe8') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </STList>

            <template v-if="item.objectType === ReceivableBalanceType.member || item.objectType === ReceivableBalanceType.user">
                <hr><h2>{{ $t('cbd5c9a7-70dc-4dcb-bb65-3d46ef49401c') }}</h2>
                <p>{{ $t("9ae0414a-e2d9-4f1c-b0db-dc38de1bd62a") }}</p>
                <p v-if="detailedItem.amountPending !== 0" class="style-description-block">
                    {{ $t('2afc84b6-337e-48a6-9892-37a7913c07ff') }}
                </p>
                <p v-if="detailedItem.amountOpen !== 0" class="style-description-block">
                    {{ $t("ca839440-2f49-434a-8bc6-1a5d1d7ab9b7") }}
                </p>
            </template>

            <template v-if="pendingPayments.length > 0">
                <hr><h2>{{ $t('8083d1d7-7325-4b2c-a708-9ddf0c5d38c8') }}</h2>
                <p>{{ $t('35a6d90a-2aec-4104-bdc0-ccce5465a6b0') }}</p>

                <STList>
                    <PaymentRow v-for="payment of pendingPayments" :key="payment.id" :payments="pendingPayments" :payment="payment"/>
                </STList>
            </template>

            <hr><h2>{{ $t('e8b43c8b-cc18-46bd-bc0c-d40f2dfc306c') }}</h2>

            <p v-if="succeededPayments.length === 0" class="info-box">
                {{ $t('0d3b57c0-0dd1-4e4e-8377-25e1cd917323') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments"/>
            </STList>

            <hr><h2>{{ $t('af3d8f0d-cfb4-470e-b092-d460f0eec7f3') }}</h2>

            <p>{{ $t('97b88796-3507-4c70-a493-09e6cf4d321c') }}</p>

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
                {{ $t('44298d09-608b-45e7-b398-8835ab6e1a4e') }}
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
