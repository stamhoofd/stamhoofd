<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`%3g`)" />

        <main>
            <h1>{{ $t('%17p', {'year-2025-2026': period.name}) }}</h1>
            <p>{{ $t('%17q') }} </p>
            <STErrorsDefault :error-box="errors.errorBox" />

            <ul class="style-list">
                <li>{{ $t('%WM') }}</li>
                <li>{{ $t('%17r') }}</li>
                <li>{{ $t('%8S') }}</li>
                <li>{{ $t('%WN') }}</li>
                <li>{{ $t('%17s') }}</li>
                <li>{{ $t('%1ES') }}</li>
            </ul>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="start">
                        {{ $t('%17t') }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { Toast } from '#overlays/Toast.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriods';
import type { OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/structures';
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
            $t('%17u', { 'werkjaar-2025-2026': newOrganizationPeriod.period.name }),
        ).show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
