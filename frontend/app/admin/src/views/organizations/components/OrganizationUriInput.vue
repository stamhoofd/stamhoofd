<template>
    <div>
        <STErrorsDefault :error-box="errors.errorBox" />
        <PrefixInput v-model="uri" :prefix="prefix" :placeholder="$t(`6e520558-40b8-4d02-90fb-e4160ec305cf`)" @blur="onBlur" />
        <template v-if="errors.errorBox === null && (checkingAvailability || (isAvailable !== null)) ">
            <p v-if="checkingAvailability" class="loading-box">
                <Spinner />
                {{ $t('ee01f571-fe9c-4c00-a4ec-68a22376edd2') }}
            </p>

            <p v-else-if="uri.length === 0" class="error-box">
                {{ $t('07997a0a-bbf6-44dc-9627-d17dd30aedd7') }}
            </p>

            <p v-else-if="!isAvailable" class="error-box">
                {{ $t('65e788b6-1f3f-43f0-ad5b-0a1f165b828b') }}
            </p>

            <p v-else class="success-box">
                {{ $t('f2da81c3-cc48-4f1a-be93-f3833fe0d834') }}
            </p>
        </template>
    </div>
</template>

<script lang="ts" setup>
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ErrorBox, PrefixInput, Spinner, Validator, useErrors, useValidation } from '@stamhoofd/components';
import { NetworkManager, useRequestOwner } from '@stamhoofd/networking';
import { Formatter, throttle } from '@stamhoofd/utility';
import { ref, watch } from 'vue';

const uri = defineModel({ required: true, type: String });
const props = withDefaults(
    defineProps<{
        validator: Validator;
        allowValue: string;
    }>(),
    {},
);

const prefix = STAMHOOFD.domains.dashboard + '/';
const checkingAvailability = ref(false);
const isAvailable = ref<boolean | null>(null);
const lastCheckedUri = ref<string | null>(null);
const owner = useRequestOwner();
let checkCount = 0;
const errors = useErrors({ validator: props.validator });

useValidation(props.validator, async () => {
    if (uri.value.length === 0) {
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
});
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

    if (uri.value.length === 0) {
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
    doThrottledCheck();
});

async function onBlur() {
    uri.value = Formatter.slug(uri.value);
    await checkAvailable();
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

    if (uri.value.length === 0) {
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
            owner,
        });
    }
    catch (e) {
        if (initialCheckCount !== checkCount) {
            return false;
        }
        checkingAvailability.value = false;

        if (isSimpleError(e) || isSimpleErrors(e)) {
            if (e.hasCode('unknown_organization')) {
                isAvailable.value = true;
                lastCheckedUri.value = Formatter.slug(uri.value);
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
    lastCheckedUri.value = Formatter.slug(uri.value);
    return false;
}

</script>
