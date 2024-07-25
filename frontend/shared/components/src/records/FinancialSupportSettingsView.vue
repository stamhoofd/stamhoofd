<template>
    <SaveView :loading="saving" title="Financiële ondersteuning" :disabled="!hasChanges" @save="save">
        <h1>
            Financiële ondersteuning
        </h1>
        <p>Net voor het betalen van inschrijvingen is het in Stamhoofd mogelijk om te vragen of een gezin wenst gebruik te maken van financiële ondersteuning. Dit kunnen ze kenbaar maken door heel laagdrempelig een aankruisvakje aan te vinken. Als je deze functie aanzet kan je per inschrijvingsgroep een verminderd tarief instellen dat automatisch wordt toegepast, of je kan deze informatie zelf gebruiken voor andere zaken (bv. uitdelen tweedehands materiaal).</p>

        <p class="info-box">
            Wil je dat leden een kaart of bewijs voorleggen, dan raden we aan om dit achteraf manueel (en discreet) te controleren. Leg dit dan uit in de beschrijving (kan je hieronder zelf intypen als je het aanzet). Dat houdt de drempel voldoende laag voor kansarme gezinnen (er is al genoeg administratie en regelgeving). Je kan dit later altijd corrigeren wanneer een lid foutief het aankruisvakje heeft aangeduid, het omgekeerde is veel moeilijker.
        </p>

        <p class="info-box icon privacy">
            Om in orde te zijn met de GDPR-wetgeving moet je altijd toestemming gekregen hebben voor je deze informatie kan opslaan. Je kan deze toestemming aanzetten via de instellingen.
        </p>
            
        <STErrorsDefault :error-box="errors.errorBox" />          

        <Checkbox v-model="enabled">
            Vraag of het gezin financiële ondersteuning nodig heeft (kansarm gezin)
        </Checkbox>

        <template v-if="enabled">
            <hr>
            <h2>Wijzig uitleg voor leden</h2>
            <p>Kies zelf de uitleg en titels die zichtbaar zijn voor leden op de pagina (net voor het afrekenen).</p>

            <STInputBox title="Titel" class="max">
                <input v-model="title" class="input" :placeholder="FinancialSupportSettings.defaultTitle">
            </STInputBox>
            <p class="style-description-small">
                De titel bovenaan de pagina waar leden zelf kunnen aangeven dat ze deze financiële ondersteuning nodig hebben. Normaal neem je hier gewoon '{{ FinancialSupportSettings.defaultTitle }}', maar als je bijvoorbeeld met een UiTPAS werkt, kan je dat wat wijzigen naar bijvoorbeeld 'UiTPAS kansentarief'.
            </p>

            <STInputBox title="Beschrijving" class="max">
                <textarea v-model="description" class="input" :placeholder="FinancialSupportSettings.defaultDescription" />
            </STInputBox>
            <p class="style-description-small">
                Tekst onder de titel. Leg hier uit wat voor financiële ondersteuning je geeft en wie er gebruik van kan maken. Leg uit dat ze discreet kunnen aanvinken dat ze gebruik willen maken van de ondersteuning.
            </p>

            <STInputBox title="Tekst naast aankruisvakje" class="max">
                <input v-model="checkboxLabel" class="input" :placeholder="FinancialSupportSettings.defaultCheckboxLabel">
            </STInputBox>
            <p class="style-description-small">
                Deze tekst is zichtbaar naast het aankruisvakje (dat ze moeten aanvinken als ze de ondersteuning willen gebruiken). Zorg dat je duidelijk bent, bv. "{{ FinancialSupportSettings.defaultCheckboxLabel }}"
            </p>

            <hr>
            <h2>Waarschuwing bij leden</h2>
            <p>Als een lid gebruik wil maken van de financiële ondersteuning, dan tonen we dit als waarschuwing als je dat lid bekijkt in Stamhoofd. Je kan zelf de tekst in deze waarschuwing wijzigen. Dit is niet zichtbaar voor de leden zelf.</p>
            
            <STInputBox title="Waarschuwingstekst" class="max">
                <input v-model="warningText" class="input" :placeholder="FinancialSupportSettings.defaultWarningText">
            </STInputBox>

            <hr>
            <h2>Benaming verlaagd tarief</h2>
            <p>Overal in het systeem krijg je nu de optie om een 2de prijs in te vullen voor personen met deze financiële ondersteuning. Je kan deze prijs daar een naam geven.</p>
            
            <STInputBox title="Benaming">
                <input v-model="priceName" class="input" :placeholder="FinancialSupportSettings.defaultPriceName">
            </STInputBox>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { FinancialSupportSettings, OrganizationRecordsConfiguration } from '@stamhoofd/structures';
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
    get: () => patched.value.financialSupport !== null,
    set: (value: boolean) => {
        if (value) {
            addPatch({
                financialSupport: props.recordsConfiguration.financialSupport ?? FinancialSupportSettings.create({})
            });
        } else {
            addPatch({financialSupport: null});
        }
    }
});

const title = computed({
    get: () => patched.value.financialSupport?.title ?? "",
    set: (title) => {
        addPatch({
            financialSupport: FinancialSupportSettings.patch({title})
        });
    }
});

const description = computed({
    get: () => patched.value.financialSupport?.description ?? "",
    set: (description) => {
        addPatch({
            financialSupport: FinancialSupportSettings.patch({description})
        });
    }
});

const checkboxLabel = computed({
    get: () => patched.value.financialSupport?.checkboxLabel ?? "",
    set: (checkboxLabel) => {
        addPatch({
            financialSupport: FinancialSupportSettings.patch({checkboxLabel})
        });
    }
});

const warningText = computed({
    get: () => patched.value.financialSupport?.warningText ?? "",
    set: (warningText) => {
        addPatch({
            financialSupport: FinancialSupportSettings.patch({warningText})
        });
    }
});

const priceName = computed({
    get: () => patched.value.financialSupport?.priceName ?? "",
    set: (priceName) => {
        addPatch({
            financialSupport: FinancialSupportSettings.patch({priceName})
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
