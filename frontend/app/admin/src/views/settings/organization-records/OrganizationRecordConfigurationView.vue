<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasRecordChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <hr>
        <h2>Soorten lokalen</h2>
        <PremiseTypesList v-model="draggableTypes" :add-array-patch="addArrayPatch" />

        <hr>
        <h2 v-if="app === 'admin'">
            Ingebouwde organisatiegegevens uitbreiden
        </h2>
        <h2 v-else>
            Extra organisatiegegevens
        </h2>

        <p>
            Breid het aantal organisatiegegevens zelf nog uit.
        </p>

        <p class="style-description-block">
            Lees <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vragenlijst kan instellen.
        </p>

        <EditOrganizationRecordSettings :categories="patched.recordCategories" :settings="editorSettings" @patch:categories="addCategoriesPatch" />
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, checkoutUIFilterBuilders, ErrorBox, RecordEditorSettings, RecordEditorType, SaveView, useAppContext, useDraggableArray, useErrors, usePatch, usePatchArray, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager } from '@stamhoofd/networking';
import { Address, BaseOrganization, Country, OrganizationLvlRecordsConfiguration, OrganizationMetaData, PatchAnswers, Platform, PlatformConfig, RecordCategory } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import PremiseTypesList from '../event-types/PremiseTypesList.vue';
import EditOrganizationRecordSettings from './EditOrganizationRecordSettings.vue';

const props = defineProps<{
    recordsConfiguration: OrganizationLvlRecordsConfiguration;
    saveHandler: (patch: AutoEncoderPatchType<OrganizationLvlRecordsConfiguration>) => Promise<void>;
}>();

const saving = ref(false);

const title = 'Gegevens van organisaties';
const app = useAppContext();
const pop = usePop();
const platform = usePlatform();
const platformManager = usePlatformManager();

const $t = useTranslate();

const { patch: patchRecords, patched, addPatch, hasChanges: hasRecordChanges } = usePatch(props.recordsConfiguration);

const originalTypes = computed(() => platform.value.config.premiseTypes);
const { patched: premiseTypes, patch: premiseTypesPatch, addArrayPatch, hasChanges: hasPremiseTypeChanges } = usePatchArray(originalTypes);
const draggableTypes = useDraggableArray(() => premiseTypes.value, addArrayPatch);
const errors = useErrors();

function addCategoriesPatch(p: PatchableArrayAutoEncoder<RecordCategory>) {
    addPatch({ recordCategories: p });
}

const editorSettings = computed(() => {
    return new RecordEditorSettings({
        dataPermission: false,
        type: RecordEditorType.Organization,
        filterBuilder: (_categories: RecordCategory[]) => {
            return checkoutUIFilterBuilders[0];
        },
        exampleValue: BaseOrganization.create({
            name: 'Voorbeeld',
            address: Address.create({
                street: 'Voorbeeldstraat',
                number: '1',
                postalCode: '1234AB',
                city: 'Voorbeeldstad',
                country: Country.Belgium,
            }),
        }),
        patchExampleValue(value: BaseOrganization, patch: PatchAnswers) {
            const cloned = value.clone();

            value.patch(BaseOrganization.patch({
                meta: OrganizationMetaData.patch({ recordAnswers: patch }),
            }));

            return cloned;
        },
    });
});

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;

    try {
        if (hasPremiseTypeChanges.value) {
            await platformManager.value.patch(Platform.patch({
                config: PlatformConfig.patch({
                    premiseTypes: premiseTypesPatch.value,
                }),
            }));
        }
        await props.saveHandler(patchRecords.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasRecordChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
