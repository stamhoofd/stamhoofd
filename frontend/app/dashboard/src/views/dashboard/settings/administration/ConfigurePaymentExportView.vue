<template>
    <SaveView :loading="saving" :disabled="!canContinue" :save-text="$t('5dc070ea-ed3e-4684-b0b4-16a9defc4ed4')" :title="$t(`Exporteren`)" @save="save">
        <h1>
            {{ $t('48533fc2-71ed-4210-96b6-f27239ebdcc7') }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errorBox" :title="$t(`22761311-3065-49fd-82ca-bc60aae3c975`)">
                <DateSelection v-model="startDate" />
            </STInputBox>

            <STInputBox error-fields="endDate" :error-box="errorBox" :title="$t(`feaf0054-1b99-4526-821e-3c63e64574a0`)">
                <DateSelection v-model="endDate" />
            </STInputBox>
        </div>

        <p class="style-description-small">
            {{ $t('ccaa7fd8-9ffc-4abe-8099-c838c80ab609') }}: <span v-for="(suggestion, index) in dateRangeSuggestions" :key="suggestion.name">
                <button type="button" class="inline-link" :class="isSuggestionSelected(suggestion) ? {secundary: false} : {secundary: true}" @click="selectSuggestion(suggestion)">
                    {{ suggestion.name }}
                </button><template v-if="index < dateRangeSuggestions.length - 1">, </template>
            </span>
        </p>

        <hr><h2>{{ $t('12b644c9-c1a7-4930-afb2-79f62648d243') }}</h2>

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
            <hr><h2>{{ $t('e8600ed0-ac82-4c0f-8719-bd91173d653f') }}</h2>

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

        <template v-if="getProvider('Stripe') || useUTCTimezone">
            <hr><h2>{{ $t('1f618c07-ec09-4465-b7af-59e30b0c7585') }}</h2>
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="useUTCTimezone" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('2b87cd84-5314-4fbd-874c-3556a6c9c033') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('b7f6b10c-cf68-44fd-a36e-3dd13aecd7f6') }}
                    </p>
                </STListItem>
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { Checkbox, DateSelection, ErrorBox, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, Validator } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { Country, ExcelExportType, LimitedFilteredRequest, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus, SortItemDirection, StamhoofdFilter, StripeAccount } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
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
@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        Checkbox,
        STList,
        STListItem,
        SaveView,
        DateSelection,
        TimeInput,
    },
})
export default class ConfigurePaymentExportView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();
    saving = false;

    internalStartDate = new Date();
    internalEndDate = new Date();

    methods: PaymentMethod[] = [];
    providers: PaymentProvider[] = [];

    loadingStripeAccounts = false;
    stripeAccounts: StripeAccount[] = [];

    dateRangeSuggestions: DateRangeSuggestion[] = [];

    useUTCTimezone = false;

    created() {
        this.loadStripeAccounts().catch(console.error);
    }

    mounted() {
        this.methods = this.sortedPaymentMethods.slice();
        this.buildSuggestions();
        this.selectSuggestion(this.dateRangeSuggestions[0]);
    }

    formatDate(date: Date) {
        return Formatter.dateTime(date) + ':' + date?.getSeconds() + ':' + date?.getMilliseconds();
    }

    get startDate() {
        return this.internalStartDate;
    }

    set startDate(value: Date) {
        this.internalStartDate = new Date(value.getTime());
        this.internalStartDate.setHours(0, 0, 0, 0);
    }

    get endDate() {
        return this.internalEndDate;
    }

    set endDate(value: Date) {
        this.internalEndDate = new Date(value.getTime());
        this.internalEndDate.setHours(23, 59, 59, 0);
    }

    get correctedStartDate() {
        if (this.useUTCTimezone) {
            const date = new Date();
            date.setUTCFullYear(this.startDate.getFullYear(), this.startDate.getMonth(), this.startDate.getDate());
            date.setUTCHours(0, 0, 0, 0);
            return date;
        }
        else {
            return this.startDate;
        }
    }

    get correctedEndDate() {
        if (this.useUTCTimezone) {
            const date = new Date();
            date.setUTCFullYear(this.endDate.getFullYear(), this.endDate.getMonth(), this.endDate.getDate());
            date.setUTCHours(23, 59, 59, 0);
            return date;
        }
        else {
            return this.endDate;
        }
    }

    buildSuggestions() {
        this.dateRangeSuggestions = [
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

    selectSuggestion(suggestion: DateRangeSuggestion) {
        this.startDate = suggestion.startDate;
        this.endDate = suggestion.endDate;
    }

    isSuggestionSelected(suggestion: DateRangeSuggestion) {
        return Formatter.dateIso(this.startDate) === Formatter.dateIso(suggestion.startDate) && Formatter.dateIso(this.endDate) === Formatter.dateIso(suggestion.endDate);
    }

    beforeUnmount() {
        Request.cancelAll(this);
    }

    get organization() {
        return this.$organization;
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers;
    }

    get enableWebshopModule() {
        return this.organization.meta.modules.useWebshops;
    }

    get country() {
        return I18nController.shared.countryCode;
    }

    get hasPayconiq() {
        return !!this.organization.privateMeta?.payconiqApiKey;
    }

    get hasMollie() {
        return !!this.organization.privateMeta?.mollieOnboarding?.canReceivePayments;
    }

    get hasBuckaroo() {
        return this.organization.privateMeta?.buckarooSettings !== null;
    }

    async loadStripeAccounts() {
        try {
            this.loadingStripeAccounts = true;
            const response = await this.$context.authenticatedServer.request({
                method: 'GET',
                path: '/stripe/accounts',
                decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
                shouldRetry: false,
                owner: this,
            });
            this.stripeAccounts = response.data;
            this.providers = this.allPaymentProviders.slice();
        }
        catch (e) {
            console.error(e);
        }
        this.loadingStripeAccounts = false;
    }

    get sortedPaymentMethods() {
        const r: PaymentMethod[] = [
            PaymentMethod.Transfer,
        ];

        // Force a given ordering
        if (this.country === Country.Netherlands) {
            r.push(PaymentMethod.iDEAL);
        }

        // Force a given ordering
        r.push(PaymentMethod.Bancontact);

        // Force a given ordering
        if (this.country === Country.Belgium || this.getPaymentMethod(PaymentMethod.Payconiq)) {
            r.push(PaymentMethod.Payconiq);
        }

        // Force a given ordering
        if (this.country !== Country.Netherlands) {
            r.push(PaymentMethod.iDEAL);
        }

        r.push(PaymentMethod.CreditCard);
        r.push(PaymentMethod.PointOfSale);
        return r;
    }

    get allPaymentProviders() {
        const r: PaymentProvider[] = [];

        if (this.stripeAccounts.length > 0) {
            r.push(PaymentProvider.Stripe);
        }

        if (this.hasPayconiq) {
            r.push(PaymentProvider.Payconiq);
        }

        if (this.hasMollie) {
            r.push(PaymentProvider.Mollie);
        }

        if (this.hasBuckaroo) {
            r.push(PaymentProvider.Buckaroo);
        }

        return r;
    }

    getProviderName(provider: PaymentProvider) {
        return provider;
    }

    getMethodName(paymentMethod: PaymentMethod): string {
        return PaymentMethodHelper.getNameCapitalized(paymentMethod);
    }

    getPaymentMethod(method: PaymentMethod) {
        return this.methods.includes(method);
    }

    setPaymentMethod(method: PaymentMethod, enabled: boolean) {
        this.methods = this.methods.filter(m => m !== method);
        if (enabled) {
            this.methods.push(method);
        }
    }

    getProvider(provider: PaymentProvider) {
        return this.providers.includes(provider);
    }

    setProvider(provider: PaymentProvider, enabled: boolean) {
        this.providers = this.providers.filter(m => m !== provider);
        if (enabled) {
            this.providers.push(provider);
        }
    }

    get canContinue() {
        return this.methods.length > 0 && (this.providers.length > 0 || this.methods.includes(PaymentMethod.Transfer) || this.methods.includes(PaymentMethod.PointOfSale));
    }

    async save() {
        if (this.saving) {
            return;
        }

        this.saving = true;

        try {
            this.show({
                components: [
                    new ComponentWithProperties(ExcelExportView, {
                        type: ExcelExportType.Payments,
                        filter: new LimitedFilteredRequest({
                            filter: this.buildFilter(),
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
                    }),
                ],
            });
        }
        catch (e) {
            this.errorBox = new ErrorBox(e as Error);
        }
        this.saving = false;
    }

    buildFilter(): StamhoofdFilter {
        return {
            $and: [
                {
                    status: PaymentStatus.Succeeded,
                    method: {
                        $in: this.methods,
                    },
                    provider: {
                        $in: [null, ...this.providers],
                    },
                },
                {
                    paidAt: {
                        $gte: this.correctedStartDate,
                    },
                },
                {
                    paidAt: {
                        $lte: this.correctedEndDate,
                    },
                },
            ],
        };
    }
}
</script>
