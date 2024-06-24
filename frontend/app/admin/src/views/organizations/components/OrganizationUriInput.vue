<template>
    <div>
        <STErrorsDefault :error-box="errors.errorBox" />
        <PrefixInput v-model="uri" placeholder="Vul ene URI in" :prefix="prefix" @blur="onBlur" />
        <template v-if="errors.errorBox === null && (checkingAvailability || (isAvailable !== null)) ">
            <p v-if="checkingAvailability" class="loading-box">
                <Spinner />
                Nakijken of deze nog beschikbaar is...
            </p>

            <p v-else-if="uri.length == 0" class="error-box">
                Dit mag niet leeg zijn
            </p>

            <p v-else-if="!isAvailable" class="error-box">
                Deze URI is al in gebruik. Kies een andere.
            </p>

            <p v-else class="success-box">
                Deze URI is nog beschikbaar!
            </p>
        </template>
    </div>
</template>

<script lang="ts" setup>
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ErrorBox, PrefixInput, Validator, useErrors, useValidation, Spinner } from '@stamhoofd/components';
import { NetworkManager, useRequestOwner } from '@stamhoofd/networking';
import { Formatter, throttle } from '@stamhoofd/utility';
import { ref, watch } from 'vue';

const uri = defineModel({ required: true, type: String });
const props = withDefaults(
    defineProps<{
        validator: Validator,
        allowValue: string
    }>(),
    {}
);

const prefix = STAMHOOFD.domains.dashboard + '/';
const checkingAvailability = ref(false);
const isAvailable = ref<boolean | null>(null);
const lastCheckedUri = ref<string|null>(null)
const owner = useRequestOwner()
let checkCount = 0;
const errors = useErrors({validator: props.validator});

useValidation(props.validator, async () => {
    if (uri.value.length == 0) {
        return false;
    }

    if (isAvailable.value === false) {
        return false;
    }

    const available = await checkAvailable();

    if (!available) {
        return false;
    }

    return true;
})
const doThrottledCheck = throttle(checkAvailable, 1000);

watch(uri, () => {    
    if (uri.value === props.allowValue && props.allowValue) {
        checkCount += 1;
        Request.cancelAll(owner);
        isAvailable.value = true;
        lastCheckedUri.value = uri.value;
        checkingAvailability.value = false;
        return true;
    }

    if (uri.value.length == 0) {
        checkCount += 1;
        Request.cancelAll(owner);
        isAvailable.value = null;
        checkingAvailability.value = false;
        return false;
    }

    if (isAvailable.value !== null && lastCheckedUri.value === Formatter.slug(uri.value)) {
        checkCount += 1;
        Request.cancelAll(owner);
        checkingAvailability.value = false;
        return isAvailable.value;
    }

    checkingAvailability.value = true;
    doThrottledCheck()
});

async function onBlur() {
    uri.value = Formatter.slug(uri.value)
    await checkAvailable()
}

async function checkAvailable(): Promise<boolean> {
    checkCount += 1;
    Request.cancelAll(owner);

    if (uri.value === props.allowValue && props.allowValue) {
        isAvailable.value = true;
        lastCheckedUri.value = uri.value;
        checkingAvailability.value = false;
        return true;
    }

    if (uri.value.length == 0) {
        isAvailable.value = null;
        checkingAvailability.value = false;
        return false;
    }

    if (isAvailable.value !== null && lastCheckedUri.value === Formatter.slug(uri.value)) {
        checkingAvailability.value = false;
        return isAvailable.value ?? false;
    }

    return await doCheckAvailable();
}

async function doCheckAvailable() {
    if (lastCheckedUri.value === Formatter.slug(uri.value)) {
        checkingAvailability.value = false;
        return isAvailable.value ?? false;
    }

    const initialCheckCount = checkCount;

    // fetch
    try {
        checkingAvailability.value = true;
        await NetworkManager.server.request({
            method: 'GET',
            path: '/organization-from-uri',
            query: {
                uri: Formatter.slug(uri.value),
            },
            shouldRetry: true,
            owner
        });
    } catch (e) {
        if (initialCheckCount !== checkCount) {
            return false;
        }
        checkingAvailability.value = false;

        if (isSimpleError(e) || isSimpleErrors(e)) {
            if (e.hasCode('unknown_organization')) {
                isAvailable.value = true;
                lastCheckedUri.value = Formatter.slug(uri.value)
                return true;
            }
        }

        errors.errorBox = new ErrorBox(e);
        return false;
    }

    if (initialCheckCount !== checkCount) {
        return false;
    }
    checkingAvailability.value = false;
    isAvailable.value = false;
    lastCheckedUri.value = Formatter.slug(uri.value)
    return false;
}

</script>
