<template>
    <div class="st-view">
        <STNavigationBar title="Nieuw werkjaar" />

        <main>
            <h1>{{ period.name }}</h1>
            <p>Hoera! Tijd voor een nieuw werkjaar. </p>
            <STErrorsDefault :error-box="errors.errorBox" />

            <ul class="style-list">
                <li>De structuur van jouw leeftijdsgroepen blijft behouden, maar je moet zelf nog de prijs en datums goed zetten. Vergeet dit niet.</li>
                <li>Alle leden moeten opnieuw inschrijven voor het nieuwe werkjaar, of schrijf je zelf opnieuw in</li>
                <li>Je kan nog steeds aan de gegevens van vorig jaar</li>
                <li>Alle leiding en leden verliezen hun functies en moet je opnieuw instellen</li>
            </ul>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="start">
                        Starten
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { ErrorBox, Toast, useErrors, useOrganization } from '@stamhoofd/components';
import { Group, Organization, OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/structures';
import { ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { useOrganizationManager } from '@stamhoofd/networking';
import { usePop } from '@simonbackx/vue-app-navigation';

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
