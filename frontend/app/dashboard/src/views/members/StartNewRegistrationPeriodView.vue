<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`b66376fb-238e-42dd-aec6-f48b9ee2e215`)" />

        <main>
            <h1>{{ $t('{year-2025-2026} aanmaken', {'year-2025-2026': period.name}) }}</h1>
            <p>{{ $t('Je kan een kopie maken van de instellingen van je huidige werkjaar (bv. de prijzen en onderverdelingen) als voorbereiding op je nieuwe werkjaar. Je kan daarna op een moment naar keuze overschakelen naar het nieuwe werkjaar (bv. als je al in juli begint met inschrijvingen voor het volgende werkjaar). Maar je kan ook wachten tot het einde van het huidige werkjaar, dan zal je automatisch worden overgeschakeld.') }} </p>
            <STErrorsDefault :error-box="errors.errorBox" />

            <ul class="style-list">
                <li>{{ $t('11ad3320-726c-434b-938a-923f20c9c59c') }}</li>
                <li>{{ $t('De inschrijvingen van elke inschrijvingsgroep wordt gesloten, je kan deze na controle open zetten.') }}</li>
                <li>{{ $t('c5d21881-b70a-489e-bce9-5bb3d24b6f76') }}</li>
                <li>{{ $t('0ab03598-06c3-433b-a8c6-39daa3aa16f1') }}</li>
                <li>{{ $t('Na controle van alle instellingen kan je overschakelen op het nieuwe werkjaar. Dit kan ten vroegste vanaf juli.') }}</li>
            </ul>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="start">
                        {{ $t('Kopie maken') }}
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
            $t('{werkjaar-2025-2026} is nu aangemaakt als kopie van je huidige werkjaar. Kijk de prijzen en instellingen goed na van je kopie.', { 'werkjaar-2025-2026': newOrganizationPeriod.period.name }),
        ).show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
