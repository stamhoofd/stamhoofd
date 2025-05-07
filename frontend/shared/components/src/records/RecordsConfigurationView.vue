<template>
    <SaveView :loading="saving" :title="$t('69a7751b-c316-42cd-a766-98e7e11fe3d6')" :disabled="!hasChanges" @save="save">
        <h1>
            {{ $t('69a7751b-c316-42cd-a766-98e7e11fe3d6') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <hr><h2 v-if="app === 'admin'">
            {{ $t('0581e6ae-5695-4132-89d3-7f1c542d44f4') }}
        </h2>
        <h2 v-else>
            {{ $t('34b986e3-111d-493c-ba71-7dbcf403a9ba') }}
        </h2>

        <p v-if="app === 'admin'">
            {{ $t('44bb1bad-d516-4694-939b-748bf534352b') }}
        </p>
        <p v-if="app === 'admin'" class="style-description-block">
            {{ $t(`b422c6f2-be24-4edd-aa99-a2d72d59c496`) }}
        </p>

        <p v-if="app === 'dashboard'">
            {{ $t('b291402c-fd6a-4a9f-bfa6-78bca95ff48f') }}
        </p>

        <p v-if="!getFilterConfiguration('emailAddress') && !getFilterConfiguration('parents')" class="error-box">
            {{ $t('0ad0ab12-37bf-425e-871c-b91161ee45f8') }}
        </p>

        <InheritedRecordsConfigurationBox :inherited-records-configuration="props.inheritedRecordsConfiguration" :records-configuration="patched" @patch:records-configuration="addPatch" />

        <hr><h2 v-if="app === 'admin'">
            {{ $t('4e842082-57fa-49ed-a806-6861cc913d12') }}
        </h2>
        <h2 v-else>
            {{ $t('09eb3057-c765-4909-b821-e75877b44135') }}
        </h2>

        <p v-if="app === 'dashboard'">
            {{ $t('a72d08ad-b23c-4079-b375-1dd569da140a') }}
        </p>
        <p v-if="app === 'admin'">
            {{ $t('07d18e1b-2935-4945-9595-50e16a929b19') }}
        </p>
        <p class="style-description-block">
            {{ $t('8485e7ea-6d66-4f2c-b92a-bd44cb2f4eb4') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('0487c3b0-3f93-4344-a34a-9a9198f37023') }}</a> {{ $t('69551005-512c-4240-8e20-fd546cefafaa') }}
        </p>

        <p class="info-box">
            {{ $t(`b4cd468d-e3fd-47d2-b59c-cf19b1d3aee0`) }}
        </p>

        <EditRecordCategoriesBox :categories="patched.recordCategories" :settings="settings" @patch:categories="addCategoriesPatch" />
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, useAppContext, useErrors, useOrganization, usePatch } from '@stamhoofd/components';
import { BooleanStatus, MemberDetails, MemberWithRegistrationsBlob, OrganizationRecordsConfiguration, Platform, PlatformFamily, PlatformMember, PropertyFilter, RecordCategory } from '@stamhoofd/structures';
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
                    firstName: $t('a9c8e948-2bf2-4915-90a0-1513397d747c'),
                    lastName: $t('e9a2ed45-f158-4e88-9a3c-75ee502f0e7a'),
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
    return await CenteredMessage.confirm($t('1cb53933-ed06-45ae-9240-dd389298823c'), $t('9bd792a4-fb4a-4275-8308-e316285be890'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
