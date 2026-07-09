<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-balance-item-view" :loading="loading" @save="save">
        <h1>
            {{ title }}
        </h1>
        <button v-if="patchedBalanceItem.status === BalanceItemStatus.Canceled" class="error-box icon disabled selectable" type="button" @click="markDue">
            <span>{{ $t('%1Jl') }}</span>
            <span class="button text">{{ $t('%hP') }}</span>
        </button>

        <p v-if="patchedBalanceItem.status === BalanceItemStatus.Hidden" class="error-box icon disabled">
            <span>{{ $t('%1dD') }}</span>
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox v-if="balanceItem.relations.size === 0 && !balanceItem.startDate" error-fields="description" :error-box="errors.errorBox" :title="$t(`%6o`)" class="max">
            <input ref="firstInput" v-model="description" class="input" type="text" autocomplete="off" :disabled="!!balanceItem.relations.size" :placeholder="$t(`%gp`)">
        </STInputBox>
        <STList v-else>
            <STListItem>
                <h3 class="style-definition-label">
                    {{ $t('%1LP') }}
                </h3>
                <p class="style-definition-text">
                    {{ getBalanceItemTypeName(patchedBalanceItem.type) }}
                </p>
            </STListItem>

            <STListItem v-if="balanceItem.startDate || balanceItem.endDate">
                <h3 class="style-definition-label">
                    {{ $t('%Ah') }}
                </h3>
                <p class="style-definition-text">
                    {{ formatDateRange(balanceItem.startDate ?? balanceItem.endDate!, balanceItem.endDate ?? balanceItem.startDate!) }}
                </p>
            </STListItem>

            <STListItem v-for="[type, relation] in patchedBalanceItem.relations" :key="type" :selectable="canOpenRelation(type)" @click="canOpenRelation(type) ? openRelation(type, relation) : undefined">
                <h3 class="style-definition-label">
                    {{ getBalanceItemRelationTypeName(type) }}
                </h3>
                <p class="style-definition-text">
                    {{ relation.name.toString() }}
                </p>
                <p class="style-description-small">
                    {{ getBalanceItemRelationTypeDescription(type) }}
                </p>

                <template v-if="canOpenRelation(type)" #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="unitPrice" :error-box="errors.errorBox" :title="$t(`%6q`)">
                    <PriceInput v-model="unitPrice" :min="null" :placeholder="$t(`%1Mn`)" />

                    <template v-if="organization?.meta.invoicesEnabled || !VATIncluded" #right>
                        <button class="button text small" type="button" @click="VATIncluded = !VATIncluded">
                            <span v-if="VATIncluded">{{ $t('%1Hs') }}</span>
                            <span v-else>{{ $t('%1Ht') }}</span>
                            <span class="icon arrow-swap small" />
                        </button>
                    </template>

                    <p v-if="patchedBalanceItem.status === BalanceItemStatus.Canceled && (patchedBalanceItem.unitPrice !== balanceItem.unitPrice || patchedBalanceItem.amount !== balanceItem.amount)" class="warning-box small">
                        {{ $t('%1Jm') }}
                    </p>
                </STInputBox>
            </div>

            <NumberInputBox v-model="amount" error-fields="amount" :error-box="errors.errorBox" :title="$t(`%M4`)" :min="Math.min(1, balanceItem.amount)" :stepper="true" :placeholder="$t(`%20`)" :validator="errors.validator" />
        </div>

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="createdAt" :error-box="errors.errorBox" :title="$t(`%gq`)">
                    <DateSelection v-model="createdAt" :adjust-initial-time="isNew" :max="now" />
                </STInputBox>
            </div>

            <div v-if="(patchedBalanceItem.unitPrice >= 0 && balanceItem.status === BalanceItemStatus.Due) || dueAt !== null">
                <STInputBox error-fields="dueAt" :error-box="errors.errorBox" :title="$t(`%Cj`)">
                    <template #right>
                        <span v-tooltip="$t('%94')" class="style-tooltip"><span class="icon small gray help" /></span>
                    </template>
                    <DateSelection v-model="dueAt" :required="false" :time="{hours: 0, minutes: 0, seconds: 0}" :placeholder="$t(`%gr`)" />
                </STInputBox>
            </div>
        </div>

        <STInputBox v-if="organization?.meta.invoicesEnabled || VATPercentage !== null" error-fields="VATPercentage" :error-box="errors.errorBox" :title="$t('%1Hu')" class="max">
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
                        {{ $t('%1Hv') }}
                        <span v-if="VATPercentage === null && VATExcempt" class="style-tag inline-first">{{ $t('%1Hw') }}</span>
                    </h4>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="VATPercentage" :value="21" autocomplete="off" name="VATPercentage" />
                    </template>
                    <h4 class="style-list-title">
                        21%
                        <span v-if="VATPercentage === 21 && VATExcempt" class="style-tag inline-first">{{ $t('%1Hw') }}</span>
                    </h4>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="VATPercentage" :value="12" autocomplete="off" name="VATPercentage" />
                    </template>
                    <h4 class="style-list-title">
                        12%
                        <span v-if="VATPercentage === 12 && VATExcempt" class="style-tag inline-first">{{ $t('%1Hw') }}</span>
                    </h4>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="VATPercentage" :value="6" autocomplete="off" name="VATPercentage" />
                    </template>
                    <h4 class="style-list-title">
                        6%
                        <span v-if="VATPercentage === 6 && VATExcempt" class="style-tag inline-first">{{ $t('%1Hw') }}</span>
                    </h4>
                </STListItem>
            </STList>
        </STInputBox>
        <p v-if="VATExcempt" class="style-description-small">
            <I18nComponent :t="$t('%1Hx', {reden: getVATExcemptReasonName(VATExcempt)})">
                <template #button="{content}">
                    <button class="inline-link" type="button" @click="toggleVATExcempt">
                        {{ content }}
                    </button>
                </template>
            </I18nComponent>
        </p>

        <PriceBreakdownBox :price-breakdown="patchedBalanceItem.priceBreakown" />

        <template v-if="patchedBalanceItem.relations.size === 0 && family && family.members.length >= (originalMemberId ? 2 : 1)">
            <hr><h2>{{ $t('%1PM') }}</h2>
            <p>{{ $t('%gk') }}</p>

            <p v-if="!memberId" class="warning-box">
                {{ $t('%gl') }}
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
                        {{ $t('%1PM') }}
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
                        {{ $t('%1o') }}
                    </p>
                </STListItem>
            </STList>
        </template>

        <template v-if="!isNew && hasPaymentsRelation(patchedBalanceItem)">
            <hr><h2>{{ $t('%1JH') }}</h2>
            <p>{{ $t('%gm') }}</p>

            <p v-if="patchedBalanceItem.payments.length === 0" class="info-box">
                {{ $t('%gn') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of sortedPayments" :key="payment.id" :payment="payment.payment" :payments="patchedBalanceItem.payments.map(b => b.payment)" :price="payment.payment.isFailed ? 0 : payment.price" />
            </STList>

            <template v-if="invoices.length > 0">
                <hr><h2>{{ $t('%1JA') }}</h2>
                <p>{{ $t('%Za7') }}</p>

                <STList>
                    <STListItem v-for="invoice of invoices" :key="invoice.id" :selectable="true" class="right-stack" @click="openInvoice(invoice)">
                        <h3 class="style-title-list">
                            {{ getInvoiceTitle(invoice) }}
                        </h3>
                        <p v-if="invoice.invoicedAt" class="style-description-small">
                            {{ formatDate(invoice.invoicedAt, true) }}
                        </p>
                        <p v-else class="style-description-small">
                            {{ $t('%1D2') }}
                        </p>

                        <template #right>
                            <span class="style-price-base">{{ formatPrice(getInvoicedAmount(invoice)) }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <ActionButtonsBox :title="$t('%16X')" :actions="balanceItemActions" />
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import DateSelection from '#inputs/DateSelection.vue';
import PriceInput from '#inputs/PriceInput.vue';
import { useShowMember } from '#members/hooks/useShowMember.ts';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu.ts';
import { Toast } from '#overlays/Toast.ts';
import PriceBreakdownBox from '#views/PriceBreakdownBox.vue';
import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop, useShow } from '@simonbackx/vue-app-navigation';
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { BalanceItemRelation, Invoice } from '@stamhoofd/structures';
import { AccessRight, BalanceItem, BalanceItemRelationType, BalanceItemStatus, BalanceItemWithPayments, getBalanceItemRelationTypeDescription, getBalanceItemRelationTypeName, getBalanceItemTypeName, getVATExcemptReasonName, InvoiceTypeHelper, LimitedFilteredRequest, PlatformFamily, SortItemDirection, UserWithMembers, VATExcemptReason } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, onMounted, ref } from 'vue';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useInvoicesObjectFetcher } from '#fetchers/useInvoicesObjectFetcher.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { GlobalEventBus } from '../EventBus';
import NumberInputBox from '../inputs/NumberInputBox.vue';
import { useLoadFamilyFromId } from '../members/hooks/useLoadFamily';
import ActionButtonsBox from './components/ActionButtonsBox.vue';
import type { ActionButton } from './components/ActionButtonsBox.vue';
import PaymentRow from './components/PaymentRow.vue';

const props = withDefaults(defineProps<{
    balanceItem: BalanceItemWithPayments | BalanceItem;
    isNew: boolean;
    saveHandler?: (() => Promise<void>) | null;
}>(), {
    saveHandler: null,
});

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
const now = new Date();
const auth = useAuth();
const show = useShow();
const invoicesObjectFetcher = useInvoicesObjectFetcher();
const invoices = ref([]) as Ref<Invoice[]>;

// Load mmeber on load
loadMember().catch(console.error);
loadFamilyFromUser().catch(console.error);
loadInvoices().catch(console.error);

const title = computed(() => {
    if (patchedBalanceItem.value.price < 0) {
        return props.isNew ? $t(`%10d`) : $t(`%10e`);
    }
    return props.isNew ? $t(`%1Mj`) : $t(`%1Mk`);
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

const balanceItemActions = computed<ActionButton[]>(() => {
    const canDelete = outstanding.value.pending === 0 && outstanding.value.paid === 0;

    return [
        {
            name: $t('%1Jn'),
            description: $t('%1Jo'),
            icon: 'receive',
            asideIcon: 'undo stroke small',
            enabled: balanceItem.value.status === BalanceItemStatus.Canceled,
            action: markDue,
        },
        {
            name: $t('%go'),
            icon: 'receive',
            iconClass: 'error',
            asideIcon: 'trash small stroke',
            listItemClass: 'theme-error',
            enabled: canDelete,
            action: doDelete,
        },
        {
            name: $t('%1Jp'),
            description: $t('%1Jq'),
            icon: 'receive',
            iconClass: 'error',
            asideIcon: 'disabled small',
            listItemClass: 'theme-error',
            enabled: !canDelete && balanceItem.value.status !== BalanceItemStatus.Canceled,
            action: doCancel,
        },
    ];
});

async function toggleVATExcempt(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('%1Hy'),
                selected: VATExcempt.value === null,
                action: () => {
                    VATExcempt.value = null;
                },
            }),
            new ContextMenuItem({
                name: getVATExcemptReasonName(VATExcemptReason.IntraCommunityServices),
                selected: VATExcempt.value === VATExcemptReason.IntraCommunityServices,
                action: () => {
                    VATExcempt.value = VATExcemptReason.IntraCommunityServices;
                },
            }),
            new ContextMenuItem({
                name: getVATExcemptReasonName(VATExcemptReason.IntraCommunityGoods),
                selected: VATExcempt.value === VATExcemptReason.IntraCommunityGoods,
                action: () => {
                    VATExcempt.value = VATExcemptReason.IntraCommunityGoods;
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
                human: $t('%1Hz'),
            });
        }
        if (patchedBalanceItem.value.unitPrice === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'unitPrice',
                message: 'unitPrice cannot be zero',
                human: $t('%1I0'),
            });
        }

        const arr: PatchableArrayAutoEncoder<BalanceItem> = new PatchableArray();

        if (props.isNew) {
            arr.addPut(patchedBalanceItem.value);
        } else {
            patch.value.id = patchedBalanceItem.value.id;
            arr.addPatch(patch.value);
        }

        await doPatch(arr);
        await props.saveHandler?.();
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function doSinglePatch(patch: AutoEncoderPatchType<BalanceItem>) {
    const arr: PatchableArrayAutoEncoder<BalanceItem> = new PatchableArray();
    patch.id = patchedBalanceItem.value.id;
    arr.addPatch(patch);

    await doPatch(arr);
}

async function doPatch(arr: PatchableArrayAutoEncoder<BalanceItem>) {
    const result = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/organization/balance',
        body: arr,
        decoder: new ArrayDecoder(BalanceItemWithPayments as Decoder<BalanceItemWithPayments>),
        shouldRetry: false,
    });
    if (result.data && result.data.length === 1) {
        if (result.data[0].id === props.balanceItem.id) {
            props.balanceItem.deepSet(result.data[0]);
            if (balanceItemWithPayments.value) {
                balanceItemWithPayments.value.deepSet(result.data[0]);
            }
        } else {
            GlobalEventBus.sendEvent('balanceItemPatch', result.data[0]).catch(console.error);
        }
    }
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
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loadingPayments.value = false;
}

async function markDue() {
    if (loading.value) {
        return;
    }
    if (!(await CenteredMessage.confirm($t(`%1Ju`), $t(`%1Jv`), $t(`%1Jw`)))) {
        return;
    }
    if (loading.value) {
        return;
    }

    errors.errorBox = null;

    try {
        loading.value = true;
        await doSinglePatch(BalanceItem.patch({
            status: BalanceItemStatus.Due,
        }));

        Toast.success($t('%1Jr')).show();
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function doCancel() {
    if (loading.value) {
        return;
    }
    if (!(await CenteredMessage.confirm($t(`%1Jx`), $t(`%1Jy`), $t(`%1Jz`)))) {
        return;
    }
    if (loading.value) {
        return;
    }

    errors.errorBox = null;

    try {
        loading.value = true;
        await doSinglePatch(BalanceItem.patch({
            status: BalanceItemStatus.Canceled,
        }));
        Toast.success($t('%1Js')).show();
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function doDelete() {
    if (loading.value) {
        return;
    }
    if (!(await CenteredMessage.confirm($t(`%10f`), $t(`%CJ`), $t(`%1Fc`)))) {
        return;
    }
    if (loading.value) {
        return;
    }

    errors.errorBox = null;

    try {
        loading.value = true;
        await doSinglePatch(BalanceItem.patch({
            status: BalanceItemStatus.Hidden,
            price: 0,
        }));
        Toast.success($t('%1Jt')).show();
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function loadMember() {
    if (patchedBalanceItem.value.relations.size > 0) {
        return;
    }

    if (!props.balanceItem.memberId) {
        return;
    }
    try {
        const familyBlob = await loadFamilyFromId(props.balanceItem.memberId);
        family.value = PlatformFamily.create(familyBlob, {
            contextOrganization: organization.value,
            platform: platform.value,
        });
    } catch (e) {
        console.error(e);
        return;
    }
}

async function loadFamilyFromUser() {
    if (patchedBalanceItem.value.relations.size > 0) {
        return;
    }

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
    } catch (e) {
        console.error(e);
        return;
    }
}

async function loadInvoices() {
    if (props.isNew) {
        return;
    }
    if (!organization.value?.meta.invoicesEnabled) {
        return;
    }
    if (!auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
        return;
    }

    const result = await invoicesObjectFetcher.fetch(new LimitedFilteredRequest({
        filter: {
            items: {
                $elemMatch: {
                    balanceItemId: props.balanceItem.id,
                },
            },
        },
        sort: [{ key: 'invoicedAt', order: SortItemDirection.DESC }],
        limit: 100,
    }));
    invoices.value = result.results;
}

function getInvoiceTitle(invoice: Invoice) {
    return Formatter.capitalizeFirstLetter(InvoiceTypeHelper.getName(invoice.type)) + (invoice.number ? ' ' + invoice.number : '');
}

function getInvoicedAmount(invoice: Invoice) {
    return invoice.items.filter(i => i.balanceItemId === props.balanceItem.id).reduce((sum, i) => sum + i.balanceInvoicedAmount, 0);
}

async function openInvoice(invoice: Invoice) {
    await show({
        components: [
            AsyncComponent(() => import('./InvoiceView.vue'), { invoice }),
        ],
    });
}

function canOpenRelation(type: BalanceItemRelationType) {
    if (type === BalanceItemRelationType.Member) {
        return true;
    }
}

const showMember = useShowMember();

function openRelation(type: BalanceItemRelationType, relation: BalanceItemRelation) {
    if (type === BalanceItemRelationType.Member) {
        return showMember(relation.id);
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
