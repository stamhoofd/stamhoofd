<template>
    <SaveView :loading="saving" :title="$t('Opgeslagen uitbetalingen exporteren')" :save-text="$t('Exporteren')" @save="save">
        <h1>
            {{ $t('Opgeslagen uitbetalingen exporteren') }}
        </h1>
        <p>{{ $t('Bouwt het overzicht van de opgeslagen uitbetalingen, betalingen en kosten (zonder de betaalproviders opnieuw te bevragen) en mailt het resultaat als Excel-bestand naar jouw e-mailadres.') }}</p>

        <STErrorsDefault :error-box="errorBox" />

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errorBox" :title="$t('%5M')">
                <DateSelection v-model="startDate" />
            </STInputBox>

            <STInputBox error-fields="endDate" :error-box="errorBox" :title="$t('%3w')">
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

        <hr><h2>{{ $t('%P1') }}</h2>

        <STInputBox error-fields="provider" :error-box="errorBox" :title="$t('Betaalprovider')">
            <Dropdown v-model="provider">
                <option :value="null">
                    {{ $t('Alle providers') }}
                </option>
                <option v-for="p in providers" :key="p" :value="p">
                    {{ p }}
                </option>
            </Dropdown>
        </STInputBox>
    </SaveView>
</template>

<script lang="ts" setup>
import { Request } from '@simonbackx/simple-networking';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { PaymentProvider } from '@stamhoofd/structures';
import { SETTLING_PAYMENT_PROVIDERS } from '@stamhoofd/structures/PaymentSettlement.js';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

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
const pop = usePop();

const requestOwner = {};
const errorBox = ref<ErrorBox | null>(null);
const saving = ref(false);
const internalStartDate = ref(new Date());
const internalEndDate = ref(new Date());
const provider = ref<PaymentProvider | null>(null);
const providers = SETTLING_PAYMENT_PROVIDERS;
const dateRangeSuggestions = shallowRef<DateRangeSuggestion[]>([]);

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

onMounted(() => {
    buildSuggestions();
    selectSuggestion(dateRangeSuggestions.value[0]!);
});

onBeforeUnmount(() => {
    Request.cancelAll(requestOwner);
});

function buildSuggestions() {
    dateRangeSuggestions.value = [
        new DateRangeSuggestion({
            name: Formatter.month(Formatter.luxon().minus({ month: 1 }).startOf('month').toJSDate()),
            startDate: Formatter.luxon().minus({ month: 1 }).startOf('month').toJSDate(),
            endDate: Formatter.luxon().minus({ month: 1 }).endOf('month').toJSDate(),
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

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;
    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/settlements/export',
            body: {
                start: startDate.value.getTime(),
                end: endDate.value.getTime(),
                provider: provider.value,
            },
            owner: requestOwner,
        });
        new Toast($t('De export is gestart. Je ontvangt het resultaat via e-mail.'), 'success').show();
        await pop({ force: true });
    } catch (e) {
        errorBox.value = new ErrorBox(e as Error);
    }
    saving.value = false;
}
</script>
