<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-balance-item-view" :loading="loading" @save="save">
        <h1>
            {{ title }}
        </h1>
        <button v-if="patchedBalanceItem.status === BalanceItemStatus.Canceled" class="error-box icon disabled selectable" type="button" @click="markDue">
            <span>{{ $t('39e508ae-7803-4da8-ac84-89cde3d46867') }}</span>
            <span class="button text">{{ $t('659662e6-8a63-4e5a-93c2-8b878e3ab0b0') }}</span>
        </button>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="description" :error-box="errors.errorBox" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)" class="max">
            <input ref="firstInput" v-model="description" class="input" type="text" autocomplete="off" :disabled="!!balanceItem.relations.size" :placeholder="$t(`e61decd2-e7a4-4be9-b9d4-c46710faa1a7`)">
        </STInputBox>
        <p v-if="patchedBalanceItem.relations.size" class="style-description-small">
            {{ $t('3dbf1fab-6adf-4050-a5dd-5c78886035cb', {platform: platform.config.name}) }}
        </p>

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="unitPrice" :error-box="errors.errorBox" :title="$t(`bab8d047-63db-4d0f-82c7-3a8d69a85745`)">
                    <PriceInput v-model="unitPrice" :min="null" :placeholder="$t(`99e41cea-bce3-4329-8b17-e3487c4534ac`)" />

                    <template v-if="$feature('vat') || !VATIncluded" #right>
                        <button class="button text small" type="button" @click="VATIncluded = !VATIncluded">
                            <span v-if="VATIncluded">{{ $t('f107bcb8-5414-4abf-954f-3e63855d65e1') }}</span>
                            <span v-else>{{ $t('63713e8d-73e7-4013-a7be-549f035b563f') }}</span>
                            <span class="icon arrow-swap small" />
                        </button>
                    </template>

                    <p v-if="patchedBalanceItem.status === BalanceItemStatus.Canceled && (patchedBalanceItem.unitPrice !== balanceItem.unitPrice || patchedBalanceItem.amount !== balanceItem.amount)" class="warning-box small">
                        {{ $t('81b36015-481c-4c6f-9a79-8e1038c78796') }}
                    </p>
                </STInputBox>
            </div>

            <STInputBox error-fields="amount" :error-box="errors.errorBox" :title="$t(`697df3e7-fbbf-421d-81c2-9c904dce4842`)">
                <NumberInput v-model="amount" :min="Math.min(1, balanceItem.amount)" :stepper="true" :placeholder="$t(`bfcceb79-e614-4e9c-9fba-0ec2bd3f8f2a`)" />
            </STInputBox>
        </div>

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="createdAt" :error-box="errors.errorBox" :title="$t(`ab0535e6-bbaa-4961-a34f-aca39ef0d785`)">
                    <DateSelection v-model="createdAt" :adjust-initial-time="isNew" :time="{hours: 12}" />
                </STInputBox>
            </div>

            <div v-if="(patchedBalanceItem.unitPrice >= 0 && balanceItem.status === BalanceItemStatus.Due) || dueAt !== null">
                <STInputBox error-fields="dueAt" :error-box="errors.errorBox" :title="$t(`bf30128b-4c99-4a97-b4d2-1a4e62f33f41`)">
                    <template #right>
                        <span v-tooltip="$t('15b6f0c8-6287-4b4d-bf34-4da2f4a0e575')" class="style-tooltip"><span class="icon small gray help" /></span>
                    </template>
                    <DateSelection v-model="dueAt" :required="false" :time="{hours: 0, minutes: 0, seconds: 0}" :placeholder="$t(`ef2b5d01-756d-46d0-8e1d-a200f43a3921`)" />
                </STInputBox>
            </div>
        </div>

        <STInputBox v-if="$feature('vat') || VATPercentage !== null" error-fields="VATPercentage" :error-box="errors.errorBox" :title="$t('9ad5f13f-0c61-4109-b733-7015740c64cf')" class="max">
            <template #right>
                <button v-if="!VATExcempt" class="button text small" type="button" @click="toggleVATExcempt">
                    <span>Verleggen</span>
                    <span class="icon arrow-down-small small" />
                </button>
            </template>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="VATPercentage" :value="null" autocomplete="off" name="VATPercentage" />
                    </template>
                    <h4 class="style-list-title">
                        {{ $t('7288e80f-000d-4409-a7ad-12a6353ea6c2') }}
                        <span v-if="VATPercentage === null && VATExcempt" class="style-tag inline-first">{{ $t('c6635e05-c09a-4c55-acc5-1c07280a608f') }}</span>
                    </h4>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="VATPercentage" :value="21" autocomplete="off" name="VATPercentage" />
                    </template>
                    <h4 class="style-list-title">
                        21%
                        <span v-if="VATPercentage === 21 && VATExcempt" class="style-tag inline-first">{{ $t('c6635e05-c09a-4c55-acc5-1c07280a608f') }}</span>
                    </h4>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="VATPercentage" :value="12" autocomplete="off" name="VATPercentage" />
                    </template>
                    <h4 class="style-list-title">
                        12%
                        <span v-if="VATPercentage === 12 && VATExcempt" class="style-tag inline-first">{{ $t('c6635e05-c09a-4c55-acc5-1c07280a608f') }}</span>
                    </h4>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="VATPercentage" :value="6" autocomplete="off" name="VATPercentage" />
                    </template>
                    <h4 class="style-list-title">
                        6%
                        <span v-if="VATPercentage === 6 && VATExcempt" class="style-tag inline-first">{{ $t('c6635e05-c09a-4c55-acc5-1c07280a608f') }}</span>
                    </h4>
                </STListItem>
            </STList>
        </STInputBox>
        <p v-if="VATExcempt" class="style-description-small">
            <I18nComponent :t="$t('8a3444b1-38a5-4199-bd71-c40eec709833', {reden: getVATExcemptReasonName(VATExcempt)})">
                <template #button="{content}">
                    <button class="inline-link" type="button" @click="toggleVATExcempt">
                        {{ content }}
                    </button>
                </template>
            </I18nComponent>
        </p>

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

        <template v-if="!isNew && hasPaymentsRelation(patchedBalanceItem)">
            <hr><h2>{{ $t('290c7beb-61c7-425d-b35e-333aba83bbc5') }}</h2>
            <p>{{ $t('a4474840-0a73-4268-8d06-be3361fe5fc7') }}</p>

            <p v-if="patchedBalanceItem.payments.length === 0" class="info-box">
                {{ $t('a051f89d-5456-4990-a9c1-37094445ad58') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of sortedPayments" :key="payment.id" :payment="payment.payment" :payments="patchedBalanceItem.payments.map(b => b.payment)" :price="payment.payment.isFailed ? 0 : payment.price" />
            </STList>

            <hr>
            <h2>{{ $t('dc052084-eea5-407e-8775-237bf550895a') }}</h2>

            <STList>
                <STListItem v-if="balanceItem.status === BalanceItemStatus.Canceled" :selectable="true" @click="markDue">
                    <template #left>
                        <IconContainer icon="receive">
                            <template #aside>
                                <span class="icon undo stroke small" />
                            </template>
                        </IconContainer>
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('db67c24e-cb6b-499e-9bee-8dcbc1710c10') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('c556cc16-1755-48bb-a16d-8b9c73d57ec7') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="outstanding.pending === 0 && outstanding.paid === 0" :selectable="true" class="theme-error" @click="doDelete">
                    <template #left>
                        <IconContainer icon="receive" class="error">
                            <template #aside>
                                <span class="icon trash small stroke" />
                            </template>
                        </IconContainer>
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('382c3c3e-7ac0-4d9d-871f-2316c85b51ae') }}
                    </h2>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-else-if="balanceItem.status !== BalanceItemStatus.Canceled" :selectable="true" class="theme-error" @click="doCancel">
                    <template #left>
                        <IconContainer icon="receive" class="error">
                            <template #aside>
                                <span class="icon disabled small" />
                            </template>
                        </IconContainer>
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('b548b1b7-8366-49e1-9111-bc14c758acc1') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('6d3b3257-d194-4cd7-bdd2-ffebd3f237c2') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, DateSelection, Dropdown, ErrorBox, IconContainer, NumberInput, PriceBreakdownBox, PriceInput, Toast, useContext, useErrors, useOrganization, usePatch, usePlatform } from '@stamhoofd/components';
import { I18nComponent } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { BalanceItem, BalanceItemStatus, BalanceItemWithPayments, getVATExcemptReasonName, PlatformFamily, UserWithMembers, VATExcemptReason } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, onMounted, Ref, ref } from 'vue';
import { useLoadFamilyFromId } from '../members/hooks/useLoadFamily';
import PaymentRow from './components/PaymentRow.vue';

const props = defineProps<{
    balanceItem: BalanceItemWithPayments | BalanceItem;
    isNew: boolean;
    saveHandler: ((patch: AutoEncoderPatchType<BalanceItem>) => Promise<void>);
}>();

const balanceItemWithPayments = ref<null | BalanceItemWithPayments>(null);
const balanceItem = computed(() => {
    return balanceItemWithPayments.value ?? props.balanceItem;
});
const { hasChanges, addPatch, patch, patched: patchedBalanceItem } = usePatch(balanceItem);
const family = ref(null) as Ref<PlatformFamily | null>;
const organization = useOrganization();
const platform = usePlatform();
const loading = ref(false);
const errors = useErrors();
const pop = usePop();
const context = useContext();
const owner = useRequestOwner();
const loadFamilyFromId = useLoadFamilyFromId();
const loadingPayments = ref(false);

// Load mmeber on load
loadMember().catch(console.error);
loadFamilyFromUser().catch(console.error);

const title = computed(() => {
    if (patchedBalanceItem.value.price < 0) {
        return props.isNew ? $t(`c40f80b1-3553-4639-ac5c-937c45baf05e`) : $t(`6c1f62aa-e2c7-40cb-8cb9-7ea3365d5cf4`);
    }
    return props.isNew ? $t(`Aanrekening toevoegen`) : $t(`Aanrekening bewerken`);
});

const sortedPayments = computed(() => {
    if (!hasPaymentsRelation(patchedBalanceItem.value)) {
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

const VATPercentage = computed({
    get: () => patchedBalanceItem.value.VATPercentage,
    set: value => addPatch({ VATPercentage: value }),
});

const VATIncluded = computed({
    get: () => patchedBalanceItem.value.VATIncluded,
    set: value => addPatch({ VATIncluded: value }),
});

const VATExcempt = computed({
    get: () => patchedBalanceItem.value.VATExcempt,
    set: value => addPatch({ VATExcempt: value }),
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

async function toggleVATExcempt(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('60faa1ad-58e5-484a-b10e-21835398ca84'),
                selected: VATExcempt.value === null,
                action: () => {
                    VATExcempt.value = null;
                },
            }),
            new ContextMenuItem({
                name: getVATExcemptReasonName(VATExcemptReason.IntraCommunity),
                selected: VATExcempt.value === VATExcemptReason.IntraCommunity,
                action: () => {
                    VATExcempt.value = VATExcemptReason.IntraCommunity;
                },
            }),
        ],
    ]);
    await menu.show({ clickEvent: event });
}

onMounted(() => {
    if (!hasPaymentsRelation(props.balanceItem)) {
        reload().catch(console.error);
    }
});

function hasPaymentsRelation(balanceItem: BalanceItemWithPayments | BalanceItem): balanceItem is BalanceItemWithPayments {
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
        if (patchedBalanceItem.value.description.length === 0 && patchedBalanceItem.value.relations.size === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'description',
                message: 'description cannot be empty',
                human: $t('fc883ab4-2743-4f39-9048-4afbf548ba76'),
            });
        }
        if (patchedBalanceItem.value.unitPrice === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'unitPrice',
                message: 'unitPrice cannot be zero',
                human: $t('7596149b-b7cf-4624-99e1-b8fd949d593d'),
            });
        }
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function reload() {
    if (props.isNew) {
        return;
    }
    if (loadingPayments.value) {
        return;
    }
    errors.errorBox = null;
    loadingPayments.value = true;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/balance-items/' + props.balanceItem.id,
            decoder: BalanceItemWithPayments as Decoder<BalanceItemWithPayments>,
        });

        props.balanceItem.deepSet(response.data);
        balanceItemWithPayments.value = response.data;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loadingPayments.value = false;
}

async function markDue() {
    if (loading.value) {
        return;
    }
    if (!(await CenteredMessage.confirm($t(`c2b671e8-d20a-469a-8636-c80ddd18b474`), $t(`0cbc8bd6-b4ac-4141-a177-c571010d2275`), $t(`50b0083d-a783-4364-8f2c-007947ec613e`)))) {
        return;
    }
    if (loading.value) {
        return;
    }

    errors.errorBox = null;

    try {
        loading.value = true;
        await props.saveHandler(BalanceItemWithPayments.patch({
            status: BalanceItemStatus.Due,
        }));

        Toast.success($t('e5ec1057-507d-48ef-aa51-d4b0af98fbe6')).show();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function doCancel() {
    if (loading.value) {
        return;
    }
    if (!(await CenteredMessage.confirm($t(`85f9a47d-520b-4a73-b765-582b4b231a68`), $t(`cdf0fafe-b364-4dbb-ae31-b593cf447298`), $t(`81c3580c-d7b5-483c-bfb1-2eec511e36fb`)))) {
        return;
    }
    if (loading.value) {
        return;
    }

    errors.errorBox = null;

    try {
        loading.value = true;
        await props.saveHandler(BalanceItemWithPayments.patch({
            status: BalanceItemStatus.Canceled,
        }));
        Toast.success($t('81735589-1395-4067-87e5-43b5e2ce335e')).show();
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
        Toast.success($t('a2110850-3b10-45ef-964f-1c1f497691f7')).show();
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

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
