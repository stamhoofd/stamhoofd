<template>
    <SaveView :loading="saving" :title="$t('%Or')" :disabled="!hasChanges" @save="save">
        <h1>
            {{ $t('%Or') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <hr><h2 v-if="app === 'admin'">
            {{ $t('%9r') }}
        </h2>
        <h2 v-else>
            {{ $t('%9s') }}
        </h2>

        <p v-if="app === 'admin'">
            {{ $t('%9t') }}
        </p>
        <p v-if="app === 'admin'" class="style-description-block">
            {{ $t(`%AF`) }}
        </p>

        <p v-if="app === 'dashboard'">
            {{ $t('%9u') }}
        </p>

        <p v-if="!getFilterConfiguration('emailAddress') && !getFilterConfiguration('parents')" class="error-box">
            {{ $t('%9v') }}
        </p>

        <InheritedRecordsConfigurationBox :inherited-records-configuration="props.inheritedRecordsConfiguration" :records-configuration="patched" @patch:records-configuration="addPatch" />

        <hr><h2 v-if="app === 'admin'">
            {{ $t('%9w') }}
        </h2>
        <h2 v-else>
            {{ $t('%9x') }}
        </h2>

        <p v-if="app === 'dashboard'">
            {{ $t('%9y') }}
        </p>
        <p v-if="app === 'admin'">
            {{ $t('%9z') }}
        </p>
        <p class="style-description-block">
            {{ $t('%Hv') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('%Hw') }}</a> {{ $t('%Hx') }}
        </p>

        <p class="info-box">
            {{ $t(`%AG`) }}
        </p>

        <EditRecordCategoriesBox :categories="patched.recordCategories" :settings="settings" @patch:categories="addCategoriesPatch" />
    </SaveView>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useAppContext } from '#context/appContext.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePatch } from '#hooks/usePatch.ts';
import type { PropertyFilter, RecordCategory } from '@stamhoofd/structures';
import { BooleanStatus, MemberDetails, MemberWithRegistrationsBlob, OrganizationRecordsConfiguration, Platform, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { usePlatformMemberFilterBuilders } from '../filters/filter-builders/members';
import { RecordEditorSettings, RecordEditorType } from './RecordEditorSettings';
import EditRecordCategoriesBox from './components/EditRecordCategoriesBox.vue';
import InheritedRecordsConfigurationBox from './components/InheritedRecordsConfigurationBox.vue';

type PropertyName = 'emailAddress' | 'phone' | 'gender' | 'birthDay' | 'address' | 'parents' | 'emergencyContacts';

const props = withDefaults(
    defineProps<{
        recordsConfiguration: OrganizationRecordsConfiguration;
        inheritedRecordsConfiguration?: OrganizationRecordsConfiguration | null;
        saveHandler: (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => Promise<void>;
    }>(), {
        inheritedRecordsConfiguration: null,
    },
);

// Hooks
const errors = useErrors();
const saving = ref(false);
const pop = usePop();
const { patch, patched, addPatch, hasChanges } = usePatch(props.recordsConfiguration);

const organization = useOrganization();
const app = useAppContext();
const getPlatformMemberFilterBuilders = usePlatformMemberFilterBuilders();

const settings = computed(() => {
    const family = new PlatformFamily({
        platform: Platform.shared,
        contextOrganization: organization.value,
    });
    const ss = new RecordEditorSettings({
        type: RecordEditorType.PlatformMember,
        dataPermission: true,
        toggleDefaultEnabled: true,
        inheritedRecordsConfiguration: props.inheritedRecordsConfiguration ? OrganizationRecordsConfiguration.mergeChild(props.inheritedRecordsConfiguration, patched.value) : patched.value,
        filterBuilder: (categories: RecordCategory[]) => {
            const patchedSelf = patched.value.patch({
                recordCategories: categories,
            });
            const baseConfig = props.inheritedRecordsConfiguration ? OrganizationRecordsConfiguration.mergeChild(props.inheritedRecordsConfiguration, patchedSelf) : patchedSelf;
            return getPlatformMemberFilterBuilders(baseConfig)[0];
        },
        exampleValue: new PlatformMember({
            member: MemberWithRegistrationsBlob.create({
                details: MemberDetails.create({
                    firstName: $t('%ID'),
                    lastName: $t('%1PM'),
                    dataPermissions: BooleanStatus.create({ value: true }),
                    birthDay: new Date('2020-01-01'),
                }),
                users: [],
                registrations: [],
            }),
            isNew: true,
            family,
        }),
    });
    family.members.push(ss.exampleValue);
    return ss;
});

function getFilterConfiguration(property: PropertyName): PropertyFilter | null {
    return props.inheritedRecordsConfiguration?.[property] ?? patched.value[property];
}

function addCategoriesPatch(p: PatchableArrayAutoEncoder<RecordCategory>) {
    addPatch({ recordCategories: p });
}

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;

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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
