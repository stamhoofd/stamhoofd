<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-balance-item-view" :loading="loading" @save="save">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="!hasPayments(patchedBalanceItem)" class="warning-box">
            {{ $t('8a4c3084-e54d-474e-94b2-6e8d2bbc9f5e') }}
        </p>

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="description" :error-box="errors.errorBox" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
                    <input ref="firstInput" v-model="description" class="input" type="text" autocomplete="off" :disabled="!!balanceItem.relations.size" :placeholder="$t(`e61decd2-e7a4-4be9-b9d4-c46710faa1a7`)">
                </STInputBox>
                <p v-if="balanceItem.relations.size" class="style-description-small">
                    {{ $t('3dbf1fab-6adf-4050-a5dd-5c78886035cb', {platform: platform.config.name}) }}
                </p>
            </div>
            <div>
                <STInputBox error-fields="createdAt" :error-box="errors.errorBox" :title="$t(`ab0535e6-bbaa-4961-a34f-aca39ef0d785`)">
                    <DateSelection v-model="createdAt" />
                </STInputBox>
            </div>
        </div>

        <STInputBox v-if="balanceItem.status === BalanceItemStatus.Canceled" error-fields="status" :error-box="errors.errorBox" :title="$t('f21f3447-bb11-4474-8597-b9cae359faec')">
            <Dropdown v-model="status">
                <option :value="BalanceItemStatus.Due">
                    {{ $t('a8fc4892-7a37-4748-9249-3499524ad288') }}
                </option>
                <option :value="BalanceItemStatus.Canceled">
                    {{ $t('21ae7df0-9833-46e7-9735-ffabf99f8cdd') }}
                </option>
            </Dropdown>
        </STInputBox>

        <div v-if="balanceItem.status === BalanceItemStatus.Due" class="split-inputs">
            <STInputBox error-fields="unitPrice" :error-box="errors.errorBox" :title="$t(`bab8d047-63db-4d0f-82c7-3a8d69a85745`)">
                <PriceInput v-model="unitPrice" :min="null" :placeholder="$t(`99e41cea-bce3-4329-8b17-e3487c4534ac`)" />
            </STInputBox>

            <STInputBox error-fields="amount" :error-box="errors.errorBox" :title="$t(`697df3e7-fbbf-421d-81c2-9c904dce4842`)">
                <NumberInput v-model="amount" :min="Math.min(1, balanceItem.amount)" :stepper="true" :placeholder="$t(`bfcceb79-e614-4e9c-9fba-0ec2bd3f8f2a`)" />
            </STInputBox>
        </div>
        <template v-if="(patchedBalanceItem.price >= 0 && balanceItem.status === BalanceItemStatus.Due) || dueAt !== null">
            <STInputBox error-fields="dueAt" :error-box="errors.errorBox" :title="$t(`bf30128b-4c99-4a97-b4d2-1a4e62f33f41`)">
                <DateSelection v-model="dueAt" :required="false" :time="{hours: 0, minutes: 0, seconds: 0}" :placeholder="$t(`ef2b5d01-756d-46d0-8e1d-a200f43a3921`)" />
            </STInputBox>
            <p class="style-description-small">
                {{ $t('15b6f0c8-6287-4b4d-bf34-4da2f4a0e575') }}
            </p>
        </template>
        <PriceBreakdownBox :price-breakdown="patchedBalanceItem.priceBreakown" />

        <template v-if="family && family.members.length >= (originalMemberId ? 2 : 1)">
            <hr><h2>{{ $t('f4052a0b-9564-49c4-a6b6-41af3411f3b0') }}</h2>
            <p>{{ $t('00c61f8a-204c-41d5-abbb-7da96675b0e3') }}</p>

            <p v-if="!memberId" class="warning-box">
                {{ $t('14c1d37c-a2df-428f-b62a-27259600aadc') }}
            </p>

            <STList>
                <STListItem v-for="m in family.members" :key="m.id" :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="memberId" :value="m.id" />
                    </template>

                    <h3 class="style-title-list">
                        {{ m.patchedMember.name }}
                    </h3>
                    <p v-if="!memberId" class="style-description-small">
                        {{ $t('f4052a0b-9564-49c4-a6b6-41af3411f3b0') }}
                    </p>
                </STListItem>

                <STListItem v-if="user" :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="memberId" :value="null" />
                    </template>

                    <h3 class="style-title-list">
                        {{ user.name }} ({{ user.email }})
                    </h3>
                    <p class="style-description-small">
                        {{ $t('ac747fb2-d391-499b-8cee-1ed7241e6177') }}
                    </p>
                </STListItem>
            </STList>
        </template>

        <template v-if="!isNew && hasPayments(patchedBalanceItem)">
            <hr><h2>{{ $t('290c7beb-61c7-425d-b35e-333aba83bbc5') }}</h2>
            <p>{{ $t('a4474840-0a73-4268-8d06-be3361fe5fc7') }}</p>

            <p v-if="patchedBalanceItem.payments.length === 0" class="info-box">
                {{ $t('a051f89d-5456-4990-a9c1-37094445ad58') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of sortedPayments" :key="payment.id" :payment="payment.payment" :payments="patchedBalanceItem.payments.map(b => b.payment)" :price="payment.payment.isFailed ? 0 : payment.price" />
            </STList>

            <template v-if="outstanding.pending === 0 && outstanding.paid === 0">
                <hr><h2>{{ $t('dc052084-eea5-407e-8775-237bf550895a') }}</h2>

                <STList>
                    <STListItem :selectable="true" @click="doDelete">
                        <h2 class="style-title-list">
                            {{ $t('382c3c3e-7ac0-4d9d-871f-2316c85b51ae') }}
                        </h2>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon trash" />
                                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
                            </button>
                            <button type="button" class="button icon trash only-smartphone" />
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
import { CenteredMessage, DateSelection, Dropdown, ErrorBox, NumberInput, PriceBreakdownBox, PriceInput, useContext, useErrors, useOrganization, usePatch, usePlatform, usePlatformFamilyManager } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { BalanceItem, BalanceItemStatus, BalanceItemWithPayments, PlatformFamily, UserWithMembers } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import PaymentRow from './components/PaymentRow.vue';
import { useLoadFamilyFromId } from '../members/hooks/useLoadFamily';

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
const loadFamilyFromId = useLoadFamilyFromId();

// Load mmeber on load
loadMember().catch(console.error);
loadFamilyFromUser().catch(console.error);

const title = computed(() => {
    if (patchedBalanceItem.value.price < 0) {
        return props.isNew ? $t(`c40f80b1-3553-4639-ac5c-937c45baf05e`) : $t(`6c1f62aa-e2c7-40cb-8cb9-7ea3365d5cf4`);
    }
    return props.isNew ? $t(`d7d6da3d-3522-4c21-a03f-ef980380d4ae`) : $t(`620143a1-0620-483c-8cec-16747a8d4856`);
});

const sortedPayments = computed(() => {
    if (!hasPayments(patchedBalanceItem.value)) {
        return [];
    }
    return patchedBalanceItem.value.payments.slice().sort((a, b) => Sorter.byDateValue(a.payment.paidAt ?? a.payment.createdAt, b.payment.paidAt ?? b.payment.createdAt));
});

const status = computed({
    get: () => patchedBalanceItem.value.status,
    set: value => addPatch({ status: value }),
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
    if (!(await CenteredMessage.confirm($t(`7020d061-6349-4b42-8ee3-eca6b6cca87d`), $t(`faae9011-c50d-4ada-aed0-c1b578782b2a`), $t(`6260efe1-ecdb-4a22-a046-7ce84233d11b`)))) {
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
        const familyBlob = await loadFamilyFromId(props.balanceItem.memberId);
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
