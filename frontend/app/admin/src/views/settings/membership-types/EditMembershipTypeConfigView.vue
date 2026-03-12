<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('%7e')" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}" />
            </STInputBox>

            <STInputBox :title="$t('%wB')" error-fields="endDate" :error-box="errors.errorBox">
                <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}" />
            </STInputBox>
        </div>
        <p v-if="type.behaviour === PlatformMembershipTypeBehaviour.Days" class="style-description-small">
            {{ $t('%I1') }}
        </p>

        <STInputBox v-if="type.behaviour === PlatformMembershipTypeBehaviour.Period" :title="$t('%1J7')" error-fields="expireDate" :error-box="errors.errorBox">
            <DateSelection v-model="expireDate" :required="false" :placeholder="$t('%3S')" :time="{hours: 23, minutes: 59, seconds: 59}" />
        </STInputBox>
        <p v-if="type.behaviour === PlatformMembershipTypeBehaviour.Period" class="style-description-small">
            {{ $t('%3R') }}
        </p>

        <PlatformMembershipTypePriceConfigEditBox v-for="(priceConfig, index) of prices" :key="priceConfig.id" :config="patched" :has-multiple-prices="prices.length > 1" :show-start-date="index > 0" :show-price-per-day="$showPricePerDay" :error-box="errors.errorBox" :validator="errors.validator" :price-config="priceConfig" @patch:price-config="patchPrice(priceConfig, $event)" @delete="deletePrice(priceConfig)" />

        <hr><p>
            <button class="button text" type="button" @click="addPrice">
                <span class="icon add" />
                <span>{{ $t('%3V') }}</span>
            </button>
        </p>

        <hr><STInputBox error-fields="price" :error-box="errors.errorBox" :title="$t(`%I3`)">
            <NumberInput v-model="amountFree" :suffix="type.behaviour === PlatformMembershipTypeBehaviour.Days ? 'dagen' : 'leden'" :suffix-singular="type.behaviour === PlatformMembershipTypeBehaviour.Days ? 'dag' : 'lid'" :placeholder="$t(`%1FW`)" />
        </STInputBox>

        <template v-if="$feature('member-trials')">
            <STInputBox :title="$t('%CG')+ '*'" error-fields="trialDays" :error-box="errors.errorBox">
                <NumberInput v-model="trialDays" :suffix="$t('%1N6')" :suffix-singular="$t('%1N7')" :min="0" />
            </STInputBox>
            <p class="style-description-small">
                * {{ $t('%I2') }}
            </p>
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import NumberInput from '@stamhoofd/components/inputs/NumberInput.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PlatformMembershipType, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig, PlatformMembershipTypeConfigPrice, RegistrationPeriod } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import PlatformMembershipTypePriceConfigEditBox from './components/PlatformMembershipTypePriceConfigEditBox.vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    type: PlatformMembershipType;
    config: PlatformMembershipTypeConfig;
    period: RegistrationPeriod;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<PlatformMembershipTypeConfig>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const title = computed(() => $t('%3Z', { periodName: props.period.name }));
const pop = usePop();

const { patched, addPatch, hasChanges, patch } = usePatch(props.config);

const $showPricePerDay = computed(() => props.type.behaviour === PlatformMembershipTypeBehaviour.Days);

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;

    try {
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }

        const startDateInPeriod = props.period.startDate.getTime() <= patched.value.startDate.getTime() && props.period.endDate.getTime() >= patched.value.startDate.getTime();
        const endDate = patched.value.expireDate || patched.value.endDate;
        const endDateInPeriod = props.period.startDate.getTime() <= endDate.getTime() && props.period.endDate.getTime() >= endDate.getTime();

        if (!startDateInPeriod || !endDateInPeriod) {
            throw new SimpleError({
                code: 'invalid_date_range',
                message: $t('%8H'),
                field: 'startDate',
            });
        }

        if (patched.value.expireDate && (patched.value.expireDate.getTime() > patched.value.endDate.getTime() || patched.value.expireDate.getTime() < patched.value.startDate.getTime())) {
            throw new SimpleError({
                code: 'invalid_date_range',
                message: $t(`%I4`),
                field: 'expireDate',
            });
        }

        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm($t('%3X'), $t('%CJ'))) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

const startDate = computed({
    get: () => patched.value.startDate,
    set: startDate => addPatch({ startDate }),
});

const endDate = computed({
    get: () => patched.value.endDate,
    set: endDate => addPatch({ endDate }),
});

const expireDate = computed({
    get: () => patched.value.expireDate,
    set: expireDate => addPatch({ expireDate }),
});

const prices = computed({
    get: () => patched.value.prices,
    set: prices => addPatch({ prices: prices as any }),
});

const amountFree = computed({
    get: () => patched.value.amountFree,
    set: amountFree => addPatch({ amountFree }),
});

const trialDays = computed({
    get: () => patched.value.trialDays,
    set: trialDays => addPatch({ trialDays }),
});

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }

    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

function patchPrice(priceConfig: PlatformMembershipTypeConfigPrice, patch: AutoEncoderPatchType<PlatformMembershipTypeConfigPrice>) {
    patch.id = priceConfig.id;
    const array: PatchableArrayAutoEncoder<PlatformMembershipTypeConfigPrice> = new PatchableArray();
    array.addPatch(patch);
    addPatch({ prices: array });
}

function addPrice() {
    prices.value = [...prices.value, PlatformMembershipTypeConfigPrice.create({
        startDate: new Date(),
    })].sort((a, b) => {
        if (!a.startDate) {
            return -1;
        }
        if (!b.startDate) {
            return 1;
        }
        return a.startDate.getTime() - b.startDate.getTime();
    });
}

function deletePrice(price: PlatformMembershipTypeConfigPrice) {
    prices.value = prices.value.filter(p => p.id !== price.id);
}

defineExpose({
    shouldNavigateAway,
});
</script>
