<template>
    <SaveView :loading="saving" :disabled="!canContinue" :save-text="$t('%Oy')" :title="$t(`%Oy`)" @save="save">
        <h1>
            {{ $t('%95') }}
        </h1>

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

        <hr><h2>{{ $t('%O7') }}</h2>

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

        <template v-if="allPaymentProviders.length">
            <hr><h2>{{ $t('%40') }}</h2>

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

        <template v-if="getProvider('Stripe' as any) || useUTCTimezone">
            <hr><h2>{{ $t('%P1') }}</h2>
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
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
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
import { ExcelExportType, LimitedFilteredRequest, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus, SortItemDirection, StripeAccount } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

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
const show = useShow();
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

const startDate = computed({
    get: () => internalStartDate.value,
    set: (value: Date) => {
        internalStartDate.value = new Date(value.getTime());
        internalStartDate.value.setHours(0, 0, 0, 0);
    },
});
const endDate = computed({
    get: () => internalEndDate.value,
    set: (value: Date) => {
        internalEndDate.value = new Date(value.getTime());
        internalEndDate.value.setHours(23, 59, 59, 0);
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
const canContinue = computed(() => methods.value.length > 0 && (
    providers.value.length > 0
    || methods.value.includes(PaymentMethod.Transfer)
    || methods.value.includes(PaymentMethod.PointOfSale)
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
    return provider;
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
        await show({
            components: [
                AsyncComponent(() => import('@stamhoofd/frontend-excel-export/ExcelExportView.vue'), {
                    type: ExcelExportType.Payments,
                    filter: new LimitedFilteredRequest({
                        filter: buildFilter(),
                        limit: 100,
                        sort: [
                            {
                                key: 'paidAt',
                                order: SortItemDirection.ASC,
                            },
                            {
                                key: 'id',
                                order: SortItemDirection.ASC,
                            },
                        ],
                    }),
                    workbook: getSelectableWorkbook(),
                    configurationId: 'configure-payment-export',
                    title: [
                        context.value.auth.hasSomePlatformAccess() ? organization.value.name : null,
                        methods.value.length === 1 ? PaymentMethodHelper.getPluralNameCapitalized(methods.value[0]!) : $t('%1JH'),
                        Formatter.dateRange(startDate.value, endDate.value, ' tem ', false),
                    ].filter(Boolean).join(' - '),
                }),
            ],
        });
    } catch (e) {
        errorBox.value = new ErrorBox(e as Error);
    }
    saving.value = false;
}

function buildFilter(): StamhoofdFilter {
    return {
        $and: [
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
                paidAt: {
                    $gte: correctedStartDate.value,
                },
            },
            {
                paidAt: {
                    $lte: correctedEndDate.value,
                },
            },
        ],
    };
}
</script>
