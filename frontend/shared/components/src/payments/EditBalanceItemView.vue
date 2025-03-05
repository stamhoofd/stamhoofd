<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-balance-item-view" :loading="loading" @save="save">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox"/>

        <p v-if="!hasPayments(patchedBalanceItem)" class="warning-box">
            {{ $t('0aa69d9c-8d7a-467e-9538-ae938c93b8b7') }}
        </p>

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="description" :error-box="errors.errorBox" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
                    <input ref="firstInput" v-model="description" class="input" type="text" autocomplete="off" :disabled="!!balanceItem.relations.size" :placeholder="$t(`0bed1a8e-c0b4-4105-8f1e-51bf4f53fe0b`)"></STInputBox>
                <p v-if="balanceItem.relations.size" class="style-description-small">
                    {{ $t('538615bc-59bf-4d9e-b020-ea3434361550') }} {{ platform.config.name }}
                </p>
            </div>
            <div>
                <STInputBox error-fields="createdAt" :error-box="errors.errorBox" :title="$t(`c310682e-6fd1-44c0-9ebc-365809a03d62`)">
                    <DateSelection v-model="createdAt"/>
                </STInputBox>
            </div>
        </div>

        <div class="split-inputs">
            <STInputBox error-fields="unitPrice" :error-box="errors.errorBox" :title="$t(`107957bf-22a6-41fe-9437-2c033529ef76`)">
                <PriceInput v-model="unitPrice" :min="null" :placeholder="$t(`74de7e46-000a-4f52-aa70-3365e88fec05`)"/>
            </STInputBox>

            <STInputBox error-fields="amount" :error-box="errors.errorBox" :title="$t(`ab09a97a-20f7-4a90-8482-58be993bb12e`)">
                <NumberInput v-model="amount" :min="Math.min(1, balanceItem.amount)" :stepper="true" :placeholder="$t(`b1d104a3-1b5d-4ff2-90a3-6d9c041ee3cb`)"/>
            </STInputBox>
        </div>
        <template v-if="$feature('member-trials') && (patchedBalanceItem.price >= 0 || dueAt !== null)">
            <STInputBox error-fields="dueAt" :error-box="errors.errorBox" :title="$t(`e9507548-39f1-43a0-a1b7-095dfa3bd5ab`)">
                <DateSelection v-model="dueAt" :required="false" :time="{hours: 0, minutes: 0, seconds: 0}" :placeholder="$t(`614752cd-50aa-4e9e-8ed7-e35c49f784d3`)"/>
            </STInputBox>
            <p class="style-description-small">
                {{ $t('15b6f0c8-6287-4b4d-bf34-4da2f4a0e575') }}
            </p>
        </template>
        <PriceBreakdownBox :price-breakdown="patchedBalanceItem.priceBreakown"/>

        <template v-if="family && family.members.length >= (originalMemberId ? 2 : 1)">
            <hr><h2>{{ $t('1dd7003e-4be8-4c17-93e1-c24a3ce5c482') }}</h2>
            <p>{{ $t('e56fb70b-c8ba-4f65-98d8-bbc6dea17588') }}</p>

            <p v-if="!memberId" class="warning-box">
                {{ $t('05c4ceb2-d544-457c-b961-7fb380d7d739') }}
            </p>

            <STList>
                <STListItem v-for="m in family.members" :key="m.id" :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="memberId" :value="m.id"/>
                    </template>

                    <h3 class="style-title-list">
                        {{ m.patchedMember.name }}
                    </h3>
                    <p class="style-description-small" v-if="!memberId">
                        {{ $t('1dd7003e-4be8-4c17-93e1-c24a3ce5c482') }}
                    </p>
                </STListItem>

                <STListItem v-if="user" :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="memberId" :value="null"/>
                    </template>

                    <h3 class="style-title-list">
                        {{ user.name }} ({{ user.email }})
                    </h3>
                    <p class="style-description-small">
                        {{ $t('c609ca00-e0e3-48e3-8805-2b47adb40080') }}
                    </p>
                </STListItem>
            </STList>
        </template>

        <template v-if="!isNew && hasPayments(patchedBalanceItem)">
            <hr><h2>{{ $t('e8b43c8b-cc18-46bd-bc0c-d40f2dfc306c') }}</h2>
            <p>{{ $t('49815a27-1561-4ca6-82ce-c3d93033bc41') }}</p>

            <p v-if="patchedBalanceItem.payments.length === 0" class="info-box">
                {{ $t('683d553f-60d0-45cd-8e87-ebc42ad7260c') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of sortedPayments" :key="payment.id" :payment="payment.payment" :payments="patchedBalanceItem.payments.map(b => b.payment)" :price="payment.payment.isFailed ? 0 : payment.price"/>
            </STList>

            <template v-if="outstanding.pending === 0 && outstanding.paid === 0">
                <hr><h2>{{ $t('8424a02d-2147-40d1-9db2-ddece074a650') }}</h2>

                <STList>
                    <STListItem :selectable="true" @click="doDelete">
                        <h2 class="style-title-list">
                            {{ $t('ac346f06-3b7c-40e9-b450-e730cbe57b24') }}
                        </h2>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon trash"/>
                                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
                            </button>
                            <button type="button" class="button icon trash only-smartphone"/>
                        </template>
                    </STListItem>
                </STList>
            </template>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, ErrorBox, NumberInput, PriceBreakdownBox, PriceInput, useContext, useErrors, useOrganization, usePatch, usePlatform, usePlatformFamilyManager } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { BalanceItem, BalanceItemStatus, BalanceItemWithPayments, PlatformFamily, UserWithMembers } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import PaymentRow from './components/PaymentRow.vue';

const props = defineProps<{
    balanceItem: BalanceItemWithPayments | BalanceItem;
    isNew: boolean;
    saveHandler: ((patch: AutoEncoderPatchType<BalanceItem>) => Promise<void>);
}>();

const { hasChanges, addPatch, patch, patched: patchedBalanceItem } = usePatch(props.balanceItem);
const family = ref(null) as Ref<PlatformFamily | null>;
const platformFamilyManager = usePlatformFamilyManager();
const organization = useOrganization();
const platform = usePlatform();
const loading = ref(false);
const errors = useErrors();
const pop = usePop();
const context = useContext();
const owner = useRequestOwner();

// Load mmeber on load
loadMember().catch(console.error);
loadFamilyFromUser().catch(console.error);

const title = computed(() => {
    if (patchedBalanceItem.value.price < 0) {
        return props.isNew ? 'Terug te betalen bedrag toevoegen' : 'Terug te betalen bedrag bewerken';
    }
    return props.isNew ? 'Verschuldigd bedrag toevoegen' : 'Verschuldigd bedrag bewerken';
});

const sortedPayments = computed(() => {
    if (!hasPayments(patchedBalanceItem.value)) {
        return [];
    }
    return patchedBalanceItem.value.payments.slice().sort((a, b) => Sorter.byDateValue(a.payment.paidAt ?? a.payment.createdAt, b.payment.paidAt ?? b.payment.createdAt));
});

const description = computed({
    get: () => patchedBalanceItem.value.description,
    set: value => addPatch({ description: value }),
});

const unitPrice = computed({
    get: () => patchedBalanceItem.value.unitPrice,
    set: value => addPatch({ unitPrice: value }),
});

const amount = computed({
    get: () => patchedBalanceItem.value.amount,
    set: value => addPatch({ amount: value }),
});

const createdAt = computed({
    get: () => patchedBalanceItem.value.createdAt,
    set: value => addPatch({ createdAt: value }),
});

const dueAt = computed({
    get: () => patchedBalanceItem.value.dueAt,
    set: value => addPatch({ dueAt: value }),
});

const memberId = computed({
    get: () => patchedBalanceItem.value.memberId,
    set: value => addPatch({ memberId: value }),
});

const originalMemberId = computed(
    () => props.balanceItem.memberId,
);

const user = ref(null) as Ref<UserWithMembers | null>;

const outstanding = computed(() => {
    const paid = patchedBalanceItem.value.pricePaid;
    const pending = patchedBalanceItem.value.pricePending;
    const remaining = patchedBalanceItem.value.price - paid - pending;

    return {
        paid,
        pending,
        remaining,
    };
});

function hasPayments(balanceItem: BalanceItemWithPayments | BalanceItem): balanceItem is BalanceItemWithPayments {
    return (balanceItem instanceof BalanceItemWithPayments);
}

async function save() {
    if (loading.value) {
        return;
    }
    errors.errorBox = null;
    loading.value = true;

    try {
        const valid = await errors.validator.validate();
        if (!valid) {
            loading.value = false;
            return;
        }
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function doDelete() {
    if (loading.value) {
        return;
    }
    if (!(await CenteredMessage.confirm('Deze aanrekening verwijderen?', 'Verwijderen', 'Je kan dit niet ongedaan maken.'))) {
        return;
    }
    if (loading.value) {
        return;
    }

    errors.errorBox = null;

    try {
        loading.value = true;
        await props.saveHandler(BalanceItemWithPayments.patch({
            status: BalanceItemStatus.Hidden,
            price: 0,
        }));
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function loadMember() {
    if (!props.balanceItem.memberId) {
        return;
    }
    try {
        const familyBlob = await platformFamilyManager.loadFamilyBlob(props.balanceItem.memberId);
        family.value = PlatformFamily.create(familyBlob, {
            contextOrganization: organization.value,
            platform: platform.value,
        });
    }
    catch (e) {
        console.error(e);
        return;
    }
}

async function loadFamilyFromUser() {
    if (!props.balanceItem.userId) {
        return;
    }
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/user/' + props.balanceItem.userId,
            decoder: UserWithMembers as Decoder<UserWithMembers>,
            owner,
        });

        const blob = response.data.members;
        blob.markReceivedFromBackend();

        user.value = response.data;
        family.value = PlatformFamily.create(blob, {
            contextOrganization: organization.value,
            platform: platform.value,
        });
    }
    catch (e) {
        console.error(e);
        return;
    }
}
</script>
