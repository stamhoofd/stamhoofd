<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasRecordChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p>
            {{ $t('2803b7f1-be08-48ec-8b4c-2dced27f7113') }}
        </p>

        <p class="style-description-block">
            Lees <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vragenlijst kan instellen.
        </p>

        <EditRecordCategoriesBox :categories="patched.recordCategories" :settings="editorSettings" @patch:categories="addCategoriesPatch" />
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, EditRecordCategoriesBox, ErrorBox, getOrganizationUIFilterBuildersForTags, RecordEditorSettings, RecordEditorType, SaveView, useErrors, usePatch, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Address, Country, Organization, OrganizationLevelRecordsConfiguration, OrganizationPrivateMetaData, PatchAnswers, RecordCategory } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = defineProps<{
    recordsConfiguration: OrganizationLevelRecordsConfiguration;
    saveHandler: (patch: AutoEncoderPatchType<OrganizationLevelRecordsConfiguration>) => Promise<void>;
}>();

const saving = ref(false);

const pop = usePop();

const $t = useTranslate();
const title = computed(() => $t('e6405d38-2bd8-4e24-8e35-24f4daea2a37'));
const platform = usePlatform();

const { patch: patchRecords, patched, addPatch, hasChanges: hasRecordChanges } = usePatch(props.recordsConfiguration);

const errors = useErrors();

function addCategoriesPatch(p: PatchableArrayAutoEncoder<RecordCategory>) {
    addPatch({ recordCategories: p });
}

const editorSettings = computed(() => {
    return new RecordEditorSettings({
        dataPermission: false,
        type: RecordEditorType.Organization,
        filterBuilder: (_categories: RecordCategory[]) => {
            return getOrganizationUIFilterBuildersForTags(platform.value)[0];
        },
        exampleValue: Organization.create({
            name: 'Voorbeeld',
            address: Address.create({
                street: 'Voorbeeldstraat',
                number: '1',
                postalCode: '1234AB',
                city: 'Voorbeeldstad',
                country: Country.Belgium,
            }),
        })
    });
});

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;

    try {
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
