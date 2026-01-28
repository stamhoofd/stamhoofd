<template>
    <UitpasNumberInput
        :model-value="model?.uitpasNumber ?? null"
        :validator="validator"
        :nullable="nullable" :title="title" :disabled="disabled" :class="props.class" :required="required" :placeholder="placeholder" :error-fields="errorFields" :error-box="errors.errorBox" @update:has-errors="hasUitpasInputErrors = $event" @update:model-value="updateUitpasNumber"
    >
        <template v-if="!hasErrors && (isLoading || socialTariffStatus !== null)">
            <p v-if="isLoading" class="loading-box">
                <Spinner />
                {{ $t('Status ophalen...') }}
            </p>

            <p v-else-if="socialTariffStatus !== null" :class="socialTariffStatus.class" data-testid="social-tariff-status">
                {{ socialTariffStatus.text }}
            </p>
        </template>
    </UitpasNumberInput>
</template>

<script lang="ts" setup>
import { Request } from '@simonbackx/simple-networking';
import { useRequestOwner } from '@stamhoofd/networking';
import { UitpasNumberDetails, UitpasSocialTariff, UitpasSocialTariffStatus } from '@stamhoofd/structures';
import { throttle } from '@stamhoofd/utility';
import { computed, ref, watch } from 'vue';
import { useGetUitpasNumberDetails } from '../composables/useGetUitpasNumberDetails';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { Validator } from '../errors/Validator';
import Spinner from '../Spinner.vue';
import UitpasNumberInput from './UitpasNumberInput.vue';

const props = withDefaults(
    defineProps<{
        validator?: Validator;
        nullable?: boolean;
        title?: string;
        disabled?: boolean;
        class?: string | null;
        required?: boolean;
        placeholder?: string | null;
        errorFields?: string;
        errorBox?: ErrorBox | null;
    }>(), {
        validator: undefined,
        nullable: false,
        title: undefined,
        disabled: false,
        class: null,
        required: true,
        placeholder: null,
        errorFields: 'uitpasNumber',
        errorBox: null,
    },
);

const model = defineModel<UitpasNumberDetails | null>({ required: true });

const errors = useErrors({ validator: props.validator });

const hasUitpasInputErrors = ref(false);
const hasErrors = computed(() => hasUitpasInputErrors.value === true || errors.errorBox !== null);

const socialTariffStatus = computed<null | { text: string; class: 'success-box' | 'info-box' }>(() => {
    if (model.value === null) {
        return null;
    }

    const socialTariff = model.value.socialTariff;

    switch (socialTariff.status) {
        case UitpasSocialTariffStatus.Active: {
            return {
                text: $t('Dit UiTPAS-nummer heeft een actief kansentarief.'),
                class: 'success-box',
            };
        }
        case UitpasSocialTariffStatus.Expired: {
            return {
                text: $t('Het kansentarief van dit UiTPAS-nummer is verlopen.'),
                class: 'info-box',
            };
        }
        case UitpasSocialTariffStatus.None: {
            return {
                text: $t('Dit UiTPAS-nummer heeft geen kansentarief.'),
                class: 'info-box',
            };
        }
        case UitpasSocialTariffStatus.Unknown: {
            if (model.value.isActive) {
                return {
                    text: $t('Dit UiTPAS-nummer heeft een actief kansentarief.'),
                    class: 'success-box',
                };
            }
            return null;
        }
        default: {
            return null;
        }
    }
});

function updateUitpasNumber(value: string | null) {
    if (model.value && model.value.uitpasNumber === value) {
        return;
    }

    if (value === null) {
        model.value = null;
    }
    else {
        model.value = UitpasNumberDetails.create({ uitpasNumber: value, socialTariff: defaultStatus });
    }
}

const defaultStatus = UitpasSocialTariff.create({
    status: UitpasSocialTariffStatus.None,
});

const isLoading = ref(false);

const requestOwner = useRequestOwner();

const { getUitpasNumberDetails } = useGetUitpasNumberDetails();

watch(() => model.value?.uitpasNumber, async () => {
    await throttledCheckStatus();
});

const cachedDetails = new Map<string, UitpasNumberDetails>();

// prevent unnecessary requests
function cacheDetails(details: UitpasNumberDetails) {
    cachedDetails.set(details.uitpasNumber, details);
}

async function getDetailsFromCacheOrFetch(uitpasNumber: string) {
    if (cachedDetails.has(uitpasNumber)) {
        return cachedDetails.get(uitpasNumber)!;
    }

    const uitpasNumberDetailsArray = await getUitpasNumberDetails([uitpasNumber]);
    return uitpasNumberDetailsArray[0];
}

async function checkStatus() {
    if (quickValidate()) {
        isLoading.value = false;
        return;
    }

    // should never happen
    if (!model.value) {
        isLoading.value = false;
        return;
    }

    isLoading.value = true;
    const initialUitpasNumber = model.value.uitpasNumber;

    Request.cancelAll(requestOwner);

    try {
        const uitpasNumberDetails = await getDetailsFromCacheOrFetch(initialUitpasNumber);

        if (initialUitpasNumber !== model.value?.uitpasNumber || uitpasNumberDetails.uitpasNumber !== model.value?.uitpasNumber) {
            console.info('Ignored response, counter or uitpasNumber has already changed');
            // Ignore, because a new request has already started
            return;
        }
        errors.errorBox = null;

        model.value = uitpasNumberDetails;
        cacheDetails(uitpasNumberDetails);

        isLoading.value = false;
    }
    catch (e) {
        if (Request.isAbortError(e)) {
            // Canceled, so ignore
            return;
        }

        if (initialUitpasNumber !== model.value?.uitpasNumber) {
            console.info('Ignored error, counter or uitpasNumber has already changed');
            // Ignore, because a new request has already started
            return;
        }

        isLoading.value = false;
        errors.errorBox = new ErrorBox(e);
        throw e;
    }
}

const doThrottledCheckStatus = throttle(checkStatus, 1000);

function quickValidate() {
    if (model.value === null) {
        return true;
    }

    return false;
}

async function throttledCheckStatus() {
    Request.cancelAll(requestOwner);
    isLoading.value = true;
    errors.errorBox = null;

    doThrottledCheckStatus();
}
</script>
