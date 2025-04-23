<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`b66376fb-238e-42dd-aec6-f48b9ee2e215`)" />

        <main>
            <h1>{{ period.name }}</h1>
            <p>{{ $t('b5f857ee-6c3b-43df-866c-99e7e0954eb1') }} </p>
            <STErrorsDefault :error-box="errors.errorBox" />

            <ul class="style-list">
                <li>{{ $t('11ad3320-726c-434b-938a-923f20c9c59c') }}</li>
                <li>{{ $t('c5d21881-b70a-489e-bce9-5bb3d24b6f76') }}</li>
                <li>{{ $t('0ab03598-06c3-433b-a8c6-39daa3aa16f1') }}</li>
                <li>{{ $t('62536e62-9d62-429f-97d4-2605e738fc92') }}</li>
            </ul>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="start">
                        {{ $t('8e829200-f906-49c1-a17e-dbfb193ed9f9') }}
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
import { useOrganizationManager } from '@stamhoofd/networking';
import { Organization, OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/structures';
import { ref } from 'vue';

const props = defineProps<{
    period: RegistrationPeriod;
    callback: () => void;
}>();

const loading = ref(false);
const organization = useOrganization();
const organizationManager = useOrganizationManager();
const errors = useErrors();
const pop = usePop();

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

        await organizationManager.value.patchPeriods(arr);

        await organizationManager.value.patch(
            Organization.patch({
                period: newOrganizationPeriod,
            }),
        );
        props.callback();
        new Toast(newOrganizationPeriod.period.name + ' is nu ingesteld als het huidige werkjaar', 'success').show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
