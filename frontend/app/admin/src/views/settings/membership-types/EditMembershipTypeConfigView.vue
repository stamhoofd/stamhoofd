<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('a656bc79-940d-4cfd-a7f8-4700cd95a4f3')" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}" />
            </STInputBox>

            <STInputBox :title="$t('7955066a-93c8-4872-8ac7-e7ccdc7f61f9')" error-fields="endDate" :error-box="errors.errorBox">
                <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}" />
            </STInputBox>
        </div>
        <p v-if="type.behaviour === PlatformMembershipTypeBehaviour.Days" class="style-description-small">
            {{ $t('ec5437dc-5d11-4092-8ab7-e9090af1f71a') }}
        </p>

        <STInputBox v-if="type.behaviour === PlatformMembershipTypeBehaviour.Period" :title="$t('b0215bc3-b94d-47de-99d2-4dcb9f59b299')" error-fields="expireDate" :error-box="errors.errorBox">
            <DateSelection v-model="expireDate" :required="false" :placeholder="$t('f19516b2-0c37-4dce-86f4-46690ec3dfc9')" :time="{hours: 23, minutes: 59, seconds: 59}" />
        </STInputBox>
        <p v-if="type.behaviour === PlatformMembershipTypeBehaviour.Period" class="style-description-small">
            {{ $t('e866488b-bc8d-481f-900b-9cf1779f44b8') }}
        </p>

        <PlatformMembershipTypePriceConfigEditBox v-for="(priceConfig, index) of prices" :key="priceConfig.id" :config="patched" :has-multiple-prices="prices.length > 1" :show-start-date="index > 0" :show-price-per-day="$showPricePerDay" :error-box="errors.errorBox" :validator="errors.validator" :price-config="priceConfig" @patch:price-config="patchPrice(priceConfig, $event)" @delete="deletePrice(priceConfig)" />

        <hr><p>
            <button class="button text" type="button" @click="addPrice">
                <span class="icon add" />
                <span>{{ $t('285539ab-4119-4dcd-b0fe-87952f71d90d') }}</span>
            </button>
        </p>

        <hr><STInputBox error-fields="price" :error-box="errors.errorBox" :title="$t(`7a010291-3eac-4690-b6d8-2972d3ab8e58`)">
            <NumberInput v-model="amountFree" :suffix="type.behaviour === PlatformMembershipTypeBehaviour.Days ? 'dagen' : 'leden'" :suffix-singular="type.behaviour === PlatformMembershipTypeBehaviour.Days ? 'dag' : 'lid'" :placeholder="$t(`45ff02db-f404-4d91-853f-738d55c40cb6`)" />
        </STInputBox>

        <template v-if="$feature('member-trials')">
            <STInputBox :title="$t('31d7f684-a6e1-4df5-8ac7-c971e5919cc7')+ '*'" error-fields="trialDays" :error-box="errors.errorBox">
                <NumberInput v-model="trialDays" suffix="dagen" suffix-singular="dag" :min="0" />
            </STInputBox>
            <p class="style-description-small">
                * {{ $t('513b343f-6a4e-402c-90c4-c0d73e4f65a3') }}
            </p>
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, ErrorBox, NumberInput, SaveView, useErrors, usePatch } from '@stamhoofd/components';
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
const title = computed(() => $t('8301bf8b-569b-4a66-8985-455392098279', { periodName: props.period.name }));
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
                message: $t('e821b318-928b-4eee-9bca-d00366554792'),
                field: 'startDate',
            });
        }

        if (patched.value.expireDate && (patched.value.expireDate.getTime() > patched.value.endDate.getTime() || patched.value.expireDate.getTime() < patched.value.startDate.getTime())) {
            throw new SimpleError({
                code: 'invalid_date_range',
                message: $t(`de1f0a0d-4251-41db-bc28-c332cc20dc8b`),
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

    if (!await CenteredMessage.confirm($t('0d0147f0-f42e-4f6b-bf04-16c21fb8ae7d'), $t('838cae8b-92a5-43d2-82ba-01b8e830054b'))) {
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

    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
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
