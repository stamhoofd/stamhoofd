<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`c17d34c1-757d-40ca-b23d-997d7dfc8843`)"/>

        <main>
            <h1>{{ period.name }}</h1>
            <p>{{ $t('b5f857ee-6c3b-43df-866c-99e7e0954eb1') }} </p>
            <STErrorsDefault :error-box="errors.errorBox"/>

            <ul class="style-list">
                <li>{{ $t('dcde3300-62fe-4fb5-8edd-fb4c1ab3d744') }}</li>
                <li>{{ $t('c5d21881-b70a-489e-bce9-5bb3d24b6f76') }}</li>
                <li>{{ $t('7b0cbfb8-c2f4-4b0e-b29b-38ca5b7944e6') }}</li>
                <li>{{ $t('099f075f-9ac2-4735-be99-36ec222840f1') }}</li>
            </ul>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="start">
                        {{ $t('13842f4e-0c55-4751-ab34-6c015fe4337c') }}
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
