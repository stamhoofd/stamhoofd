<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title || FinancialSupportSettings.defaultTitle }}
        </h1>

        <p>{{ $t("Net voor het betalen van inschrijvingen is het mogelijk om te vragen of een gezin wenst gebruik te maken van financiële ondersteuning. Of dat aanstaat kan je op verschillende niveau's configureren, o.a. via 'Gegevens van leden'. Maar als het ingeschakeld is, bepaal je hier hoe het werkt voor alle groepen.") }}</p>

        <p class="info-box">
            {{ $t('Leden die een UiTPAS-nummer met kansentarief ingaven, slaan deze stap automatisch over') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!inheritedFinancialSupport">
            <STInputBox class="max" :title="$t(`Benaming`)">
                <input v-model="title" class="input" :placeholder="FinancialSupportSettings.defaultTitle">
            </STInputBox>
            <p class="style-description-small">
                {{ $t(`De benaming van het systeem voor financiële ondersteuning. Bijvoorbeeld: "Financiële ondersteuning" of "Kansentarief"`) }}
            </p>
        </template>

        <hr><h2>{{ $t('Wijzig uitleg voor leden') }}</h2>
        <p>{{ $t('Kies zelf de uitleg en titels die zichtbaar zijn voor leden op de pagina (net voor het afrekenen).') }}</p>

        <STInputBox class="max" :title="$t(`Beschrijving`)">
            <textarea v-model="description" class="input" :placeholder="inheritedFinancialSupport?.description || FinancialSupportSettings.defaultDescription" />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('Tekst onder de titel. Leg hier uit wat voor financiële ondersteuning je geeft en wie er gebruik van kan maken. Leg uit dat ze discreet kunnen aanvinken dat ze gebruik willen maken van de ondersteuning.') }}
        </p>

        <STInputBox class="max" :title="$t(`Tekst naast aankruisvakje`)">
            <input v-model="checkboxLabel" class="input" :placeholder="inheritedFinancialSupport?.checkboxLabel || FinancialSupportSettings.defaultCheckboxLabel">
        </STInputBox>
        <p class="style-description-small">
            {{ $t(`Deze tekst is zichtbaar naast het aankruisvakje (dat ze moeten aanvinken als ze de ondersteuning willen gebruiken). Zorg dat je duidelijk bent, bv. "`) }}{{ FinancialSupportSettings.defaultCheckboxLabel }}"
        </p>

        <hr><h2>{{ $t('Waarschuwing bij leden') }}</h2>
        <p>{{ $t('Als een lid gebruik wil maken van de financiële ondersteuning, dan tonen we dit als waarschuwing als je dat lid bekijkt. Je kan zelf de tekst in deze waarschuwing wijzigen. Dit is niet zichtbaar voor de leden zelf.') }}</p>

        <STInputBox class="max" :title="$t(`Waarschuwingstekst`)">
            <input v-model="warningText" class="input" :placeholder="inheritedFinancialSupport?.warningText || FinancialSupportSettings.defaultWarningText">
        </STInputBox>

        <hr><h2>{{ $t('Benaming verlaagd tarief') }}</h2>
        <p>{{ $t('Overal in het systeem krijg je nu de optie om een 2de prijs in te vullen voor personen met deze financiële ondersteuning. Je kan deze prijs daar een naam geven.') }}</p>

        <STInputBox :title="$t(`Benaming`)">
            <input v-model="priceName" class="input" :placeholder="inheritedFinancialSupport?.priceName || FinancialSupportSettings.defaultPriceName">
        </STInputBox>

        <hr><h2>{{ $t('Verhinder automatische toekenning') }}</h2>
        <p>{{ $t('Normaal wordt de financiële ondersteuning automatisch goedgekeurd zodra een lid bij het inschrijven het aanvinkvakje aankruist. Je kan dit uitschakelen. In dat geval kan een lid niet verder met inschrijven als ze gebruik willen maken van de financiële ondersteuning. Een beheerder moet het dan zelf eerst aanvinken bij dat lid alvorens het lid verder kan inschrijven aan de verlaagde tarieven. Als het lid een UiTPAS-nummer met kansentarief opgeeft dan krijgt het lid wel automatisch financiële ondersteuning en kan het lid meteen inschrijven met de verlaagde tarieven.') }}</p>

        <STList>
            <STListItem>
                <Checkbox v-model="preventSelfAssignment" :locked="inheritedFinancialSupport?.preventSelfAssignment">
                    {{ $t('Verhinder automatische toekenning van financiële ondersteuning door een lid') }}
                </Checkbox>

                <template v-if="preventSelfAssignment">
                    <STInputBox class="max extra-padding" :title="$t(`Verduidelijking voor een lid als hij niet kan inschrijven`)">
                        <textarea v-model="preventSelfAssignmentText" class="input" :placeholder="FinancialSupportSettings.defaultPreventSelfAssignmentText" />
                    </STInputBox>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { FinancialSupportSettings } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { usePatch } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';

const props = withDefaults(
    defineProps<{
        financialSupport: FinancialSupportSettings;
        inheritedFinancialSupport?: FinancialSupportSettings | null;
        saveHandler: (patch: AutoEncoderPatchType<FinancialSupportSettings>) => Promise<void>;
    }>(), {
        inheritedFinancialSupport: null,
    },
);

const { patched, patch, addPatch, hasChanges } = usePatch(props.financialSupport);
const errors = useErrors();
const pop = usePop();

const saving = ref(false);

const title = computed({
    get: () => patched.value.title,
    set: (title) => {
        addPatch({
            title,
        });
    },
});

const description = computed({
    get: () => patched.value.description,
    set: (description) => {
        addPatch({
            description,
        });
    },
});

const checkboxLabel = computed({
    get: () => patched.value.checkboxLabel ?? '',
    set: (checkboxLabel) => {
        addPatch({
            checkboxLabel,
        });
    },
});

const warningText = computed({
    get: () => patched.value.warningText ?? '',
    set: (warningText) => {
        addPatch({
            warningText,
        });
    },
});

const priceName = computed({
    get: () => patched.value.priceName ?? '',
    set: (priceName) => {
        addPatch({
            priceName,
        });
    },
});

const preventSelfAssignment = computed({
    get: () => patched.value.preventSelfAssignment === true || props.inheritedFinancialSupport?.preventSelfAssignment === true,
    set: (preventSelfAssignment: boolean) => {
        addPatch({
            preventSelfAssignment,
        });
    },
});

const preventSelfAssignmentText = computed({
    get: () => patched.value.preventSelfAssignmentText,
    set: (preventSelfAssignmentText) => {
        addPatch({
            preventSelfAssignmentText,
        });
    },
});

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    try {
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
};

defineExpose({
    shouldNavigateAway,
});
</script>
