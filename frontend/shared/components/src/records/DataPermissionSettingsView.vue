<template>
    <SaveView title="Toestemming gegevensverzameling" :disabled="!hasChanges" :loading="saving" @save="save">
        <h1>
            Toestemming gegevensverzameling
        </h1>
        <p>
            Verzamel je gevoelige informatie? Dan moet je daar in de meeste gevallen toestemming voor vragen volgens de GDPR-wetgeving. We raden je aan om altijd toestemming te vragen zodra je ook maar een beetje twijfelt. In onze gids geven we enkele voorbeelden, lees die zeker na. <a :href="'https://'+$t('shared.domains.marketing')+'/docs/toestemming-gegevens-verzamelen'" class="inline-link" target="_blank" rel="noopener">
                Lees onze gids
            </a>
        </p>

        <p class="info-box">
            Je kan toestemming nooit verplichten volgens de GDPR-wetgeving. Als een lid geen toestemming geeft, kan je enkel gegevens verzamelen die noodzakelijk zijn (zoals bepaald volgens de vijf verwerkingsgronden in de GDPR-wetgeving). We verbergen automatisch vragen waarvoor toestemming noodzakelijk is in dat geval.
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />          

        <Checkbox v-model="enabled">
            Vraag toestemming voor gegevensverzameling
        </Checkbox>

        <template v-if="enabled">
            <hr>
            <h2>Wijzig uitleg voor leden</h2>
            <p>Kies zelf de uitleg en titels die zichtbaar zijn op het moment we naar toestemming vragen</p>

            <STInputBox title="Titel" class="max">
                <input v-model="title" class="input" :placeholder="DataPermissionsSettings.defaultTitle">
            </STInputBox>

            <STInputBox title="Beschrijving" class="max">
                <textarea v-model="description" class="input" placeholder="Optioneel" />
            </STInputBox>

            <STInputBox title="Tekst naast aankruisvakje" class="max">
                <input v-model="checkboxLabel" class="input" :placeholder="DataPermissionsSettings.defaultCheckboxLabel">
            </STInputBox>
            <p class="style-description-small">
                Deze tekst is zichtbaar naast het aankruisvakje (dat ze moeten aanvinken als ze de toestemming geven). 
            </p>

            <hr>
            <h2>Waarschuwing bij leden</h2>
            <p>Als een lid geen toestemming gaf, dan tonen we dit als waarschuwing als je dat lid bekijkt als beheerder. Je kan zelf de tekst in deze waarschuwing wijzigen. Dit is niet zichtbaar voor de leden zelf.</p>
        
            <STInputBox title="Waarschuwingstekst" class="max">
                <input v-model="warningText" class="input" :placeholder="DataPermissionsSettings.defaultWarningText">
            </STInputBox>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { DataPermissionsSettings, OrganizationRecordsConfiguration } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { usePatch } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';

const props = defineProps<{
    recordsConfiguration: OrganizationRecordsConfiguration,
    saveHandler: (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => Promise<void>
}>();

const {patched, patch, addPatch, hasChanges} = usePatch(props.recordsConfiguration);
const errors = useErrors();
const pop = usePop();

const saving = ref(false);

const enabled = computed({
    get: () => patched.value.dataPermission !== null,
    set: (value: boolean) => {
        if (value) {
            addPatch({
                dataPermission: props.recordsConfiguration.dataPermission ?? DataPermissionsSettings.create({})
            });
        } else {
            addPatch({dataPermission: null});
        }
    }
});

const title = computed({
    get: () => patched.value.dataPermission?.title ?? "",
    set: (title) => {
        addPatch({
            dataPermission: DataPermissionsSettings.patch({title})
        });
    }
});

const description = computed({
    get: () => patched.value.dataPermission?.description ?? "",
    set: (description) => {
        addPatch({
            dataPermission: DataPermissionsSettings.patch({description})
        });
    }
});

const checkboxLabel = computed({
    get: () => patched.value.dataPermission?.checkboxLabel ?? "",
    set: (checkboxLabel) => {
        addPatch({
            dataPermission: DataPermissionsSettings.patch({checkboxLabel})
        });
    }
});

const warningText = computed({
    get: () => patched.value.dataPermission?.warningText ?? "",
    set: (warningText) => {
        addPatch({
            dataPermission: DataPermissionsSettings.patch({warningText})
        });
    }
});

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    try {
        await props.saveHandler(patch.value);
        await pop({force: true});
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}


const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

defineExpose({
    shouldNavigateAway
})

</script>
