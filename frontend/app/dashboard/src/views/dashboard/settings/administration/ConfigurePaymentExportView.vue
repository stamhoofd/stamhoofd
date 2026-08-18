<template>
    <SaveView :loading="saving" :disabled="!canContinue" :save-text="$t('%16p')" :title="$t(`Statistieken`)" save-icon-right="arrow-right" @save="save">
        <h1>
            {{ $t('Statistieken en totalen berekenen') }}
        </h1>
        <p>{{ $t('Je kan ook exporteren naar Excel.') }}</p>

        <p v-if="$isStamhoofd" class="warning-box icon feature">
            {{ $t(('Dit is vernieuwd! Feedback is steeds welkom via hallo@stamhoofd.be')) }}
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errorBox" :title="$t(`%5M`)">
                <DateSelection v-model="startDate" />
            </STInputBox>

            <STInputBox error-fields="endDate" :error-box="errorBox" :title="$t(`%3w`)">
                <DateSelection v-model="endDate" />
            </STInputBox>
        </div>
        <p class="style-description-small">
            {{ $t('%P0') }}: <span v-for="(suggestion, index) in dateRangeSuggestions" :key="suggestion.name">
                <button type="button" class="inline-link" :class="isSuggestionSelected(suggestion) ? {secundary: false} : {secundary: true}" @click="selectSuggestion(suggestion)">
                    {{ suggestion.name }}
                </button><template v-if="index < dateRangeSuggestions.length - 1">, </template>
            </span>
        </p>

        <hr>
        <h2>{{ $t('%O7') }}</h2>

        <STList>
            <STListItem v-for="method in sortedPaymentMethods" :key="method" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :model-value="getPaymentMethod(method)" @update:model-value="setPaymentMethod(method, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ getMethodName(method) }}
                </h3>
            </STListItem>
        </STList>

        <template v-if="getPaymentMethod(PaymentMethod.Transfer) || getPaymentMethod(PaymentMethod.PointOfSale) || getPaymentMethod(PaymentMethod.Unknown)">
            <hr>
            <h2>{{ $t('Datumbereik') }}</h2>
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="usePaidAt" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Filter op betaaldatum in plaats van aanmaakdatum') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Als veel overschrijvingen pas laat als betaald gemarkeerd werden, is de aanmaakdatum vaak accurater.') }}
                    </p>
                </STListItem>
            </STList>
        </template>

        <template v-if="allPaymentProviders.length">
            <hr>
            <h2>{{ $t('%ZeP') }}</h2>

            <STList>
                <STListItem v-for="provider in allPaymentProviders" :key="provider" :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Checkbox :model-value="getProvider(provider)" @update:model-value="setProvider(provider, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ getProviderName(provider) }}
                    </h3>
                </STListItem>
            </STList>
        </template>

        <template v-if="showWebshopsFilter">
            <hr>
            <h2>{{ $t('Webshops') }}</h2>

            <div v-if="!allWebshopsSelected && shouldShowWebshopSearch" class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search small gray" @submit.prevent="blurFocus">
                        <input v-model="webshopSearchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
                    </form>
                </div>
            </div>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Checkbox v-model="allWebshopsSelected" :indeterminate="!!selectedWebshopIds && selectedWebshopIds.length > 0" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Alle webshops') }}
                    </h3>
                </STListItem>

                <template v-if="!allWebshopsSelected">
                    <STListItem v-for="webshop in filteredWebshops" :key="webshop.id" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox :model-value="getWebshop(webshop.id)" @update:model-value="setWebshop(webshop.id, $event)" />
                        </template>
                        <h3 class="style-title-list">
                            {{ webshop.meta.name }}
                        </h3>
                        <p v-if="webshop.meta.status === WebshopStatus.Archived" class="style-description-small">
                            {{ $t('Gearchiveerd') }}
                        </p>
                    </STListItem>
                </template>
            </STList>

            <p v-if="filteredWebshops.length === 0" class="info-box">
                {{ $t('%1AX') }}
            </p>
        </template>

        <template v-if="showGroupsFilter">
            <hr>
            <h2>{{ $t('Inschrijvingsgroepen') }}</h2>

            <div v-if="!allGroupsSelected && shouldShowGroupSearch" class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search small gray" @submit.prevent="blurFocus">
                        <input v-model="groupSearchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
                    </form>
                </div>
            </div>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Checkbox v-model="allGroupsSelected" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Alle inschrijvingsgroepen') }}
                    </h3>
                </STListItem>
                <template v-if="!allGroupsSelected">
                    <STListItem v-for="group in filteredGroups" :key="group.id" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox :model-value="getGroup(group.id)" @update:model-value="setGroup(group.id, $event)" />
                        </template>
                        <h3 class="style-title-list">
                            {{ group.settings.name }}
                        </h3>
                        <p v-if="group.settings.period" class="style-description-small">
                            {{ group.settings.period?.nameShort }}
                        </p>
                    </STListItem>
                </template>
            </STList>

            <p v-if="filteredGroups.length === 0" class="info-box">
                {{ $t('%1AX') }}
            </p>
        </template>

        <template v-if="getProvider('Stripe' as any) || useUTCTimezone">
            <hr>
            <h2>{{ $t('%P1') }}</h2>
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="useUTCTimezone" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%P2') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%P3') }}
                    </p>
                </STListItem>
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';

import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { getPaymentProviderName, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus, StripeAccount, WebshopStatus } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

import { useBreakdown } from '../../breakdown/openBreakdown';
import { getSelectableWorkbook } from '../../payments/getSelectableWorkbook';

class DateRangeSuggestion {
    name: string;
    startDate: Date;
    endDate: Date;

    constructor({ name, startDate, endDate }: { name: string; startDate: Date; endDate: Date }) {
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
    }
}

const context = useContext();
const organization = useRequiredOrganization();
const { openPayments } = useBreakdown();
const requestOwner = {};
const errorBox = ref<ErrorBox | null>(null);
const saving = ref(false);
const internalStartDate = ref(new Date());
const internalEndDate = ref(new Date());
const methods = ref<PaymentMethod[]>([]);
const providers = ref<PaymentProvider[]>([]);
const loadingStripeAccounts = ref(false);
const stripeAccounts = shallowRef<StripeAccount[]>([]);
const dateRangeSuggestions = shallowRef<DateRangeSuggestion[]>([]);
const useUTCTimezone = ref(false);
const usePaidAt = ref(false);

// null = don't filter (all selected)
const selectedWebshopIds = ref<string[] | null>(null);
const selectedGroupIds = ref<string[] | null>(null);
const webshopSearchQuery = ref('');
const groupSearchQuery = ref('');
const MAX_ITEMS_WITHOUT_SEARCH = 5;

const startDate = computed({
    get: () => internalStartDate.value,
    set: (value: Date) => {
        const d = Formatter.luxon(value).startOf('day');
        internalStartDate.value = d.toJSDate();
    },
});
const endDate = computed({
    get: () => internalEndDate.value,
    set: (value: Date) => {
        const d = Formatter.luxon(value).endOf('day');

        internalEndDate.value = d.toJSDate();
    },
});
const correctedStartDate = computed(() => {
    if (!useUTCTimezone.value) {
        return startDate.value;
    }
    const date = new Date();
    date.setUTCFullYear(startDate.value.getFullYear(), startDate.value.getMonth(), startDate.value.getDate());
    date.setUTCHours(0, 0, 0, 0);
    return date;
});
const correctedEndDate = computed(() => {
    if (!useUTCTimezone.value) {
        return endDate.value;
    }
    const date = new Date();
    date.setUTCFullYear(endDate.value.getFullYear(), endDate.value.getMonth(), endDate.value.getDate());
    date.setUTCHours(23, 59, 59, 0);
    return date;
});
const country = I18nController.shared.countryCode;
const hasPayconiq = computed(() => !!organization.value.privateMeta?.payconiqApiKey);
const hasMollie = computed(() => !!organization.value.privateMeta?.mollieOnboarding?.canReceivePayments);
const hasBuckaroo = computed(() => organization.value.privateMeta?.buckarooSettings !== null);
const sortedPaymentMethods = computed(() => {
    const result: PaymentMethod[] = [PaymentMethod.Transfer];
    if (country === Country.Netherlands) {
        result.push(PaymentMethod.iDEAL);
    }
    result.push(PaymentMethod.Bancontact);
    if (country === Country.Belgium || getPaymentMethod(PaymentMethod.Payconiq)) {
        result.push(PaymentMethod.Payconiq);
    }
    if (country !== Country.Netherlands) {
        result.push(PaymentMethod.iDEAL);
    }
    result.push(PaymentMethod.CreditCard);
    result.push(PaymentMethod.PointOfSale);
    result.push(PaymentMethod.Unknown);
    return result;
});
const allPaymentProviders = computed(() => {
    const result: PaymentProvider[] = [];
    if (stripeAccounts.value.length > 0) {
        result.push(PaymentProvider.Stripe);
    }
    if (hasPayconiq.value) {
        result.push(PaymentProvider.Payconiq);
    }
    if (hasMollie.value) {
        result.push(PaymentProvider.Mollie);
    }
    if (hasBuckaroo.value) {
        result.push(PaymentProvider.Buckaroo);
    }
    return result;
});
const enableWebshopModule = computed(() => organization.value.meta.packages.useWebshops);
const enableMemberModule = computed(() => organization.value.meta.packages.useMembers);

const allWebshops = computed(() => organization.value.webshops.slice().sort((a, b) => Sorter.stack(Sorter.byBooleanValue(a.meta.status !== WebshopStatus.Archived, b.meta.status !== WebshopStatus.Archived), Sorter.byStringValue(a.meta.name, b.meta.name))));
const allGroups = computed(() => organization.value.adminAvailableGroups);

const showWebshopsFilter = computed(() => enableWebshopModule.value && allWebshops.value.length > 0);
const showGroupsFilter = computed(() => enableMemberModule.value && allGroups.value.length > 0);

const allWebshopsSelected = computed({
    get: () => selectedWebshopIds.value === null,
    set: (value: boolean) => {
        selectedWebshopIds.value = value ? null : [];
        webshopSearchQuery.value = '';
    },
});
const allGroupsSelected = computed({
    get: () => selectedGroupIds.value === null,
    set: (value: boolean) => {
        selectedGroupIds.value = value ? null : [];
        groupSearchQuery.value = '';
    },
});

const shouldShowWebshopSearch = computed(() => allWebshops.value.length > MAX_ITEMS_WITHOUT_SEARCH);
const shouldShowGroupSearch = computed(() => allGroups.value.length > MAX_ITEMS_WITHOUT_SEARCH);

const filteredWebshops = computed(() => {
    if (!webshopSearchQuery.value) {
        const filtered = allWebshops.value.filter(w => getWebshop(w.id));
        const first = allWebshops.value.slice(0, 10).filter(w => !filtered.find(ff => ff.id === w.id));
        return [...filtered, ...first];
    }
    const query = webshopSearchQuery.value.toLowerCase();
    return allWebshops.value.filter(webshop => webshop.meta.name.toLowerCase().includes(query));
});
const filteredGroups = computed(() => {
    if (!groupSearchQuery.value) {
        const filtered = allGroups.value.filter(w => getGroup(w.id));
        const first = allGroups.value.slice(0, 10).filter(w => !filtered.find(ff => ff.id === w.id));
        return [...filtered, ...first];
    }
    const query = groupSearchQuery.value.toLowerCase();
    return allGroups.value.filter(group => group.settings.name.toString().toLowerCase().includes(query));
});

const canContinue = computed(() => methods.value.length > 0 && (
    providers.value.length > 0
    || methods.value.includes(PaymentMethod.Transfer)
    || methods.value.includes(PaymentMethod.PointOfSale)
    || methods.value.includes(PaymentMethod.Unknown)
) && (
    selectedWebshopIds.value === null || selectedWebshopIds.value.length > 0
    || selectedGroupIds.value === null || selectedGroupIds.value.length > 0
));

onMounted(() => {
    methods.value = sortedPaymentMethods.value.slice();
    buildSuggestions();
    selectSuggestion(dateRangeSuggestions.value[0]!);
    loadStripeAccounts().catch(console.error);
});
onBeforeUnmount(() => Request.cancelAll(requestOwner));

function buildSuggestions() {
    dateRangeSuggestions.value = [
        new DateRangeSuggestion({
            name: Formatter.month(Formatter.luxon().startOf('month').toJSDate()),
            startDate: Formatter.luxon().startOf('month').toJSDate(),
            endDate: Formatter.luxon().endOf('month').toJSDate(),
        }),
        new DateRangeSuggestion({
            name: Formatter.month(Formatter.luxon().minus({ month: 1 }).startOf('month').toJSDate()),
            startDate: Formatter.luxon().minus({ month: 1 }).startOf('month').toJSDate(),
            endDate: Formatter.luxon().minus({ month: 1 }).endOf('month').toJSDate(),
        }),
        new DateRangeSuggestion({
            name: Formatter.month(Formatter.luxon().minus({ month: 2 }).startOf('month').toJSDate()),
            startDate: Formatter.luxon().minus({ month: 2 }).startOf('month').toJSDate(),
            endDate: Formatter.luxon().minus({ month: 2 }).endOf('month').toJSDate(),
        }),
        new DateRangeSuggestion({
            name: Formatter.month(Formatter.luxon().minus({ month: 3 }).startOf('month').toJSDate()),
            startDate: Formatter.luxon().minus({ month: 3 }).startOf('month').toJSDate(),
            endDate: Formatter.luxon().minus({ month: 3 }).endOf('month').toJSDate(),
        }),
        new DateRangeSuggestion({
            name: Formatter.year(Formatter.luxon().startOf('year').toJSDate()).toString(),
            startDate: Formatter.luxon().startOf('year').toJSDate(),
            endDate: Formatter.luxon().endOf('year').toJSDate(),
        }),
        new DateRangeSuggestion({
            name: Formatter.year(Formatter.luxon().minus({ year: 1 }).startOf('year').toJSDate()).toString(),
            startDate: Formatter.luxon().minus({ year: 1 }).startOf('year').toJSDate(),
            endDate: Formatter.luxon().minus({ year: 1 }).endOf('year').toJSDate(),
        }),
    ];
}

function selectSuggestion(suggestion: DateRangeSuggestion) {
    startDate.value = suggestion.startDate;
    endDate.value = suggestion.endDate;
}

function isSuggestionSelected(suggestion: DateRangeSuggestion) {
    return Formatter.dateIso(startDate.value) === Formatter.dateIso(suggestion.startDate)
        && Formatter.dateIso(endDate.value) === Formatter.dateIso(suggestion.endDate);
}

async function loadStripeAccounts() {
    try {
        loadingStripeAccounts.value = true;
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/stripe/accounts',
            decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
            shouldRetry: false,
            owner: requestOwner,
        });
        stripeAccounts.value = response.data;
        providers.value = allPaymentProviders.value.slice();
    } catch (e) {
        console.error(e);
    }
    loadingStripeAccounts.value = false;
}

function getProviderName(provider: PaymentProvider) {
    return getPaymentProviderName(provider);
}

function getMethodName(paymentMethod: PaymentMethod): string {
    return PaymentMethodHelper.getNameCapitalized(paymentMethod);
}

function getPaymentMethod(method: PaymentMethod) {
    return methods.value.includes(method);
}

function setPaymentMethod(method: PaymentMethod, enabled: boolean) {
    methods.value = methods.value.filter(item => item !== method);
    if (enabled) {
        methods.value.push(method);
    }
}

function getWebshop(id: string) {
    return selectedWebshopIds.value?.includes(id) ?? true;
}

function setWebshop(id: string, enabled: boolean) {
    const ids = (selectedWebshopIds.value ?? []).filter(item => item !== id);
    if (enabled) {
        ids.push(id);
    }
    selectedWebshopIds.value = ids;
}

function getGroup(id: string) {
    return selectedGroupIds.value?.includes(id) ?? true;
}

function setGroup(id: string, enabled: boolean) {
    const ids = (selectedGroupIds.value ?? []).filter(item => item !== id);
    if (enabled) {
        ids.push(id);
    }
    selectedGroupIds.value = ids;
}

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

function getProvider(provider: PaymentProvider) {
    return providers.value.includes(provider);
}

function setProvider(provider: PaymentProvider, enabled: boolean) {
    providers.value = providers.value.filter(item => item !== provider);
    if (enabled) {
        providers.value.push(provider);
    }
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;
    try {
        const selectionName = [
            methods.value.length === 1 ? PaymentMethodHelper.getPluralNameCapitalized(methods.value[0]!) : $t('%1JH'),
            Formatter.dateRange(startDate.value, endDate.value, ' ' + $t('%ZiS') + ' ', false),
        ].filter(Boolean).join(' - ');

        const title = [
            context.value.auth.hasSomePlatformAccess() ? organization.value.name : null,
            selectionName,
        ].filter(Boolean).join(' - ');

        // Show what the selection adds up to first: from there the user can narrow it down and export
        await openPayments({
            filter: buildFilter(),
            title: selectionName,
            rootTitle: title,
            getSelectableWorkbook,
            configurationId: 'configure-payment-export',
        });
    } catch (e) {
        errorBox.value = new ErrorBox(e as Error);
    }
    saving.value = false;
}

function buildFilter(): StamhoofdFilter {
    const dateField = usePaidAt.value ? 'paidAt' : 'createdAt';

    const filters: StamhoofdFilter[] = [
        {
            status: PaymentStatus.Succeeded,
            method: {
                $in: methods.value,
            },
            provider: {
                $in: [null, ...providers.value],
            },
        },
        {
            [dateField]: {
                $gte: correctedStartDate.value,
            },
        },
        {
            [dateField]: {
                $lte: correctedEndDate.value,
            },
        },
    ];

    if (selectedWebshopIds.value !== null || selectedGroupIds.value !== null) {
        const f: StamhoofdFilter = [];

        if (selectedWebshopIds.value !== null) {
            f.push({
                $or: [
                    {
                        orderId: null,
                    },
                    {
                        order: {
                            $elemMatch: { webshopId: { $in: selectedWebshopIds.value } },
                        },
                    },
                ],
            });
        }

        if (selectedGroupIds.value !== null) {
            f.push({
                $or: [
                    {
                        registrationId: null,
                    },
                    {
                        registration: {
                            $elemMatch: { groupId: { $in: selectedGroupIds.value } },
                        },
                    },
                ],
            });
        }

        filters.push({
            balanceItemPayments: {
                $elemMatch: {
                    balanceItem: {
                        $and: f,
                    },
                },
            },
        });
    }

    return {
        $and: filters,
    };
}
</script>
