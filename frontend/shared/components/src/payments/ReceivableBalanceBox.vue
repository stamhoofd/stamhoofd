<template>
    <LoadingBoxTransition :error-box="errors.errorBox">
        <div v-if="detailedItem" class="container">
            <template v-if="detailedItem.filteredBalanceItems.length">
                <SegmentedControl v-if="!hideSegmentedControl" v-model="selectedTab" :items="['grouped', 'individual']" :labels="[$t(`%10j`), $t(`%10i`)]" />
                <ReceivableBalanceList v-if="selectedTab === 'individual'" :item="detailedItem" />
                <GroupedBalanceList v-else :item="detailedItem" />
                <BalancePriceBreakdown :item="detailedItem" />
            </template>
            <p v-else class="info-box">
                {{ $t('%hX') }}
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
                        {{ $t('%gx') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%gy') }}
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
                        {{ $t('%hY') }}
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
                        {{ $t('%hZ') }}
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
                        {{ $t('%16w') }}
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
                <hr><h2>{{ $t('%wc') }}</h2>
                <p>{{ $t('%ha') }}</p>

                <STList>
                    <PaymentRow v-for="payment of pendingPayments" :key="payment.id" :payments="pendingPayments" :payment="payment" />
                </STList>
            </template>

            <hr><h2>{{ $t('%1JH') }}</h2>

            <p v-if="succeededPayments.length === 0" class="info-box">
                {{ $t('%hb') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments" />
            </STList>

            <hr><h2>{{ $t('%hc') }}</h2>

            <p>{{ $t('%hd') }}</p>

            <STList v-if="detailedItem.object.contacts.length" class="info">
                <STListItem v-for="(contact, index) of detailedItem.object.contacts" :key="index">
                    <h3 class="style-definition-label">
                        {{ contact.firstName || 'Onbekende naam' }} {{ contact.lastName }}
                    </h3>
                    <p v-for="(email, j) of contact.emails" :key="email" class="style-definition-text">
                        <EmailAddress :email="email" />
                    </p>
                    <p v-if="contact.emails.length === 0" class="style-definition-text">
                        {{ $t('%1Mo') }}
                    </p>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                {{ $t('%he') }}
            </p>
        </div>
    </LoadingBoxTransition>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import BalancePriceBreakdown from '#payments/BalancePriceBreakdown.vue';
import EditBalanceItemView from '#payments/EditBalanceItemView.vue';
import EditPaymentView from '#payments/EditPaymentView.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { GlobalEventBus } from '#EventBus.ts';
import GroupedBalanceList from '#payments/GroupedBalanceList.vue';
import IconContainer from '#icons/IconContainer.vue';
import LoadingBoxTransition from '#containers/LoadingBoxTransition.vue';
import PaymentRow from '#payments/components/PaymentRow.vue';
import SegmentedControl from '#inputs/SegmentedControl.vue';
import { Toast } from '#overlays/Toast.ts';
import { useContext } from '#hooks/useContext.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useExternalOrganization } from '#groups/hooks/useExternalOrganization.ts';
import { useLoadFamily } from '#members/hooks/useLoadFamily.ts';
import { usePlatformFamilyManager } from '#members/PlatformFamilyManager.ts';
import { useRequestOwner } from '@stamhoofd/networking';
import { BalanceItemWithPayments, BaseOrganization, DetailedReceivableBalance, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentStatus, PaymentType, PaymentTypeHelper, PlatformMember, ReceivableBalance, ReceivableBalanceType } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, onMounted, ref, Ref } from 'vue';
import ReceivableBalanceList from './ReceivableBalanceList.vue';
import EmailAddress from '../email/EmailAddress.vue';

const props = withDefaults(
    defineProps<{
        item: ReceivableBalance;
        member?: PlatformMember | null;
        hideSegmentedControl?: boolean;
        payingOrganization?: BaseOrganization | null;
    }>(),
    {
        member: null,
        hideSegmentedControl: true,
        payingOrganization: null,
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
                    new Toast($t('%1I4'), 'wand ' + newLastPayment.theme).show();
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
        payingOrganization: props.payingOrganization,
        customer: detailedItem.value.object.customers.length > 0
            ? detailedItem.value.object.customers[0]
            : null,
    });

    if (props.item.objectType === ReceivableBalanceType.organization) {
        payment.payingOrganizationId = props.item.object.id;
    }

    const component = new ComponentWithProperties(EditPaymentView, {
        createBalanceItem,
        payment,
        customers: detailedItem.value.object.customers,
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
