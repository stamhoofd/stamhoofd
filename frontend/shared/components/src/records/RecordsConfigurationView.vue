<template>
    <SaveView :loading="saving" title="Gegevens van leden" :disabled="!hasChanges" @save="save">
        <h1>
            Gegevens van leden
        </h1>
            
        <STErrorsDefault :error-box="errors.errorBox" />

        <hr>
        <h2>Ingebouwde gegevens</h2>

        <p>Bepaalde gegevens zijn ingebouwd zodat we die ook op een speciale manier kunnen verwerken. Je kan deze hier aan of uit zetten, en eventueel bepaalde gegevens optioneel maken (altijd of bijvoorbeeld op basis van de leeftijd).</p>

        <p v-if="!getFilterConfiguration('emailAddress') && !getFilterConfiguration('parents')" class="error-box">
            Je moet minstens het e-mailadres van een lid of de gegevens van ouders verzamelen. Je kan niet beide uitschakelen.
        </p>

        <InheritedRecordsConfigurationBox :inherited-records-configuration="props.inheritedRecordsConfiguration" :records-configuration="patched" @patch:records-configuration="addPatch" />

        <hr>
        <h2>Vragenlijsten</h2>
        <p>
            Lees <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/vragenlijsten-instellen/'" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vragenlijst kan instellen.
        </p>

        <STList v-model="categories" :draggable="true">
            <template #item="{item: category}">
                <RecordCategoryRow :category="category" :categories="categories" :selectable="true" :settings="settings" @patch="addCategoriesPatch" @edit="editCategory" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="$navigate(Routes.NewRecordCategory)">
                <span class="icon add" />
                <span>Nieuwe vragenlijst</span>
            </button>
        </p>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate, usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, memberWithRegistrationsBlobUIFilterBuilders, useDraggableArray, useErrors, useOrganization, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { BooleanStatus, MemberDetails, MemberWithRegistrationsBlob, OrganizationRecordsConfiguration, Platform, PlatformFamily, PlatformMember, PropertyFilter, RecordCategory } from '@stamhoofd/structures';
import { ComponentOptions, ref } from 'vue';
import DataPermissionSettingsView from './DataPermissionSettingsView.vue';
import EditRecordCategoryView from './EditRecordCategoryView.vue';
import FinancialSupportSettingsView from './FinancialSupportSettingsView.vue';
import { RecordEditorSettings } from './RecordEditorSettings';
import InheritedRecordsConfigurationBox from './components/InheritedRecordsConfigurationBox.vue';
import RecordCategoryRow from './components/RecordCategoryRow.vue';

type PropertyName = 'emailAddress'|'phone'|'gender'|'birthDay'|'address'|'parents'|'emergencyContacts';

const props = defineProps<{
    recordsConfiguration: OrganizationRecordsConfiguration,
    inheritedRecordsConfiguration?: OrganizationRecordsConfiguration,
    saveHandler: (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => Promise<void>
}>();

enum Routes {
    NewRecordCategory = "newRecordCategory",
    EditRecordCategory = "editRecordCategory",
    DataPermissions = "dataPermissions",
    FinancialSupport = "financialSupport"
}
defineRoutes([
    {
        name: Routes.NewRecordCategory,
        url: 'vragenlijst/nieuw',
        component: EditRecordCategoryView as ComponentOptions,
        paramsToProps() {
            const category = RecordCategory.create({});
            const arr = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
            arr.addPut(category)

            return {
                categoryId: category.id,
                rootCategories: [...patched.value.recordCategories, category],
                settings,
                isNew: true,
                allowChildCategories: true,
                saveHandler: async (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                    addCategoriesPatch(arr.patch(patch))
                }
            }
        },
        present: 'popup'
    },
    {
        name: Routes.EditRecordCategory,
        url: 'vragenlijst/@categoryId',
        params: {
            categoryId: String
        },
        component: EditRecordCategoryView as ComponentOptions,
        paramsToProps(params) {
            const category = patched.value.recordCategories.find(c => c.id === params.categoryId);
            if (!category) {
                throw new Error('Category not found')
            }
            return {
                categoryId: category.id,
                rootCategories: patched.value.recordCategories,
                settings,
                isNew: false,
                allowChildCategories: true,
                saveHandler: async (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                    addCategoriesPatch(patch)
                }
            }
        },
        propsToParams(props) {
            if (!('category' in props) || !(props.category instanceof RecordCategory)) {
                throw new Error('Category is required')
            }
            return {
                params: {
                    categoryId: props.category.id
                }
            }
        },
        present: 'popup'
    },
    {
        name: Routes.DataPermissions,
        url: 'toestemming-gegevensverzameling',
        component: DataPermissionSettingsView as ComponentOptions,
        paramsToProps() {
            return {
                recordsConfiguration: patched.value,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
                    addPatch(patch)
                }
            }
        },
        present: 'popup'
    },
    {
        name: Routes.FinancialSupport,
        url: 'financiele-ondersteuning',
        component: FinancialSupportSettingsView as ComponentOptions,
        paramsToProps() {
            return {
                recordsConfiguration: patched.value,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
                    addPatch(patch)
                }
            }
        },
        present: 'popup'
    }
])

// Hooks
const errors = useErrors();
const saving = ref(false);
const pop = usePop();
const {patch, patched, addPatch, hasChanges} = usePatch(props.recordsConfiguration);
const $t = useTranslate();
const $navigate = useNavigate();
const organization = useOrganization()

// Data
const categories = useDraggableArray(
    () => patched.value.recordCategories, 
    (p) => {
        addPatch({recordCategories: p})
    }
);
const family = new PlatformFamily({
    platform: Platform.shared,
    contextOrganization: organization.value
})

const settings = new RecordEditorSettings({
    dataPermission: true,
    toggleDefaultEnabled: true,
    filterBuilder: (categories: RecordCategory[]) => {
        return memberWithRegistrationsBlobUIFilterBuilders[0];
    },
    exampleValue: new PlatformMember({
        member: MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'Voorbeeld',
                lastName: 'Lid',
                dataPermissions: BooleanStatus.create({value: true}),
                birthDay: new Date('2020-01-01'),
            }),
            users: [],
            registrations: []
        }),
        isNew: true,
        family
    }),
    patchExampleValue(value: PlatformMember, patch) {
        const cloned = value.clone()
        value.addDetailsPatch(MemberDetails.patch({
            recordAnswers: patch
        }))
        return cloned;
    },
})
family.members.push(settings.exampleValue)

function getFilterConfiguration(property: PropertyName): PropertyFilter|null {
    return props.inheritedRecordsConfiguration?.[property] ?? patched.value[property]
}

function addCategoriesPatch(p: PatchableArrayAutoEncoder<RecordCategory>) {
    addPatch({recordCategories: p})
}

async function editCategory(category: RecordCategory) {
    await $navigate(Routes.EditRecordCategory, {params: {categoryId: category.id}})
}

async function save() {
    if (saving.value) {
        return
    }
    saving.value = true;
    errors.errorBox = null;

    try {
        await props.saveHandler(patch.value);        
        await pop({force: true})
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
