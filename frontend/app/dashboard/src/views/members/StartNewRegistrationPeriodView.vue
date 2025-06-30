<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`b66376fb-238e-42dd-aec6-f48b9ee2e215`)" />

        <main>
            <h1>{{ $t('480abc28-3803-4d24-b5ad-4f8fb1a44471', {'year-2025-2026': period.name}) }}</h1>
            <p>{{ $t('e0433c50-b6df-4fd9-92ba-e79d3b21aaa0') }} </p>
            <STErrorsDefault :error-box="errors.errorBox" />

            <ul class="style-list">
                <li>{{ $t('11ad3320-726c-434b-938a-923f20c9c59c') }}</li>
                <li>{{ $t('bae1933a-d646-4d5c-983d-8c62319b924c') }}</li>
                <li>{{ $t('c5d21881-b70a-489e-bce9-5bb3d24b6f76') }}</li>
                <li>{{ $t('0ab03598-06c3-433b-a8c6-39daa3aa16f1') }}</li>
                <li>{{ $t('9063147f-5dee-4da0-8928-69d7dcb352c4') }}</li>
            </ul>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="start">
                        {{ $t('5d5224a4-26d6-4a01-ac3d-8ed7728522b2') }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox, Toast, useErrors, useOrganization } from '@stamhoofd/components';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking';
import { OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/structures';
import { ref } from 'vue';

const props = defineProps<{
    period: RegistrationPeriod;
    callback: () => void;
}>();

const loading = ref(false);
const organization = useOrganization();
const errors = useErrors();
const pop = usePop();
const patchOrganizationPeriods = usePatchOrganizationPeriods();

async function start() {
    if (loading.value) {
        return;
    }
    loading.value = true;

    try {
        const currentPeriod = organization.value!.period;
        const newOrganizationPeriod = currentPeriod.duplicate(props.period);

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>;
        arr.addPut(newOrganizationPeriod);

        await patchOrganizationPeriods(arr);
        props.callback();
        Toast.success(
            $t('43f93b0e-debd-4afa-b81a-fac67c7401ea', { 'werkjaar-2025-2026': newOrganizationPeriod.period.name }),
        ).show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
