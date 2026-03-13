<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasRecordChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p>
            {{ $t('%8E') }}
        </p>

        <p class="style-description-block">
            {{ $t('%Hv') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('%Hw') }}</a> {{ $t('%Hx') }}
        </p>

        <EditRecordCategoriesBox :categories="patched.recordCategories" :settings="editorSettings" @patch:categories="addCategoriesPatch" />
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { getOrganizationUIFilterBuildersForTags } from '@stamhoofd/components/filters/filterBuilders.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import EditRecordCategoriesBox from '@stamhoofd/components/records/components/EditRecordCategoriesBox.vue';
import { RecordEditorSettings, RecordEditorType } from '@stamhoofd/components/records/RecordEditorSettings.ts';
import { Address, Country, Organization, OrganizationLevelRecordsConfiguration, OrganizationPrivateMetaData, RecordCategory } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = defineProps<{
    recordsConfiguration: OrganizationLevelRecordsConfiguration;
    saveHandler: (patch: AutoEncoderPatchType<OrganizationLevelRecordsConfiguration>) => Promise<void>;
}>();

const saving = ref(false);

const pop = usePop();

const title = computed(() => $t('%89'));
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
            name: $t(`%ID`),
            address: Address.create({
                street: $t(`%IE`),
                number: '1',
                postalCode: '1234AB',
                city: $t(`%IF`),
                country: Country.Belgium,
            }),
            privateMeta: OrganizationPrivateMetaData.create({}),
        }),
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
