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

        <STList>
            <STListItem v-for="property of properties" :key="property.value.title">
                <template #left>
                    <Checkbox v-model="property.value.enabled" />
                </template>
                <p class="style-title-list">
                    {{ property.value.title }}
                </p>
                <p v-if="property.value.configuration" class="style-description-small">
                    {{ propertyFilterToString(property.value.configuration, filterBuilder) }}
                </p>
                <template v-if="property.value.enabled" #right>
                    <button class="button gray icon settings" type="button" @click="property.value.edit" />
                </template>
            </STListItem>
        </STList>

        <hr>
        <h2>Vragenlijsten</h2>
        <p>
            Lees <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/vragenlijsten-instellen/'" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vragenlijst kan instellen.
        </p>

        <STList v-model="categories" :draggable="true">
            <template #item="{item: category}">
                <RecordCategoryRow :category="category" :categories="categories" :selectable="true" :settings="settings" @patch="addCategoriesPatch" @edit="editCategory"/>
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
import { CenteredMessage, ErrorBox, memberWithRegistrationsBlobUIFilterBuilders, propertyFilterToString, useDraggableArray, useErrors, useOrganization, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MemberDetails, MemberWithRegistrationsBlob, OrganizationRecordsConfiguration, Platform, PlatformFamily, PlatformMember, PropertyFilter, RecordCategory } from '@stamhoofd/structures';
import { ComponentOptions, computed, ref } from 'vue';
import EditRecordCategoryView from './EditRecordCategoryView.vue';
import { RecordEditorSettings } from './RecordEditorSettings';
import RecordCategoryRow from './components/RecordCategoryRow.vue';
type PropertyName = 'emailAddress'|'phone'|'gender'|'birthDay'|'address'|'parents'|'emergencyContacts';

const props = defineProps<{
    recordsConfiguration: OrganizationRecordsConfiguration,
    inheritedRecordsConfiguration?: OrganizationRecordsConfiguration,
    saveHandler: (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => Promise<void>
}>();

enum Routes {
    NewRecordCategory = "newRecordCategory",
    EditRecordCategory = "editRecordCategory"
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
const filterBuilder = memberWithRegistrationsBlobUIFilterBuilders[0]

const family = new PlatformFamily({
    platform: Platform.shared,
    contextOrganization: organization.value
})

const settings = new RecordEditorSettings({
    dataPermission: true,
    filterBuilder: (categories: RecordCategory[]) => {
        return memberWithRegistrationsBlobUIFilterBuilders[0];
    },
    exampleValue: new PlatformMember({
        member: MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'Voorbeeld',
                lastName: 'Lid',
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

const properties = [
    buildPropertyRefs('phone', $t('shared.inputs.mobile.label') + ' (van lid zelf)'),
    buildPropertyRefs('emailAddress', 'E-mailadres (van lid zelf)'),
    buildPropertyRefs('gender', 'Geslacht'),
    buildPropertyRefs('birthDay', 'Geboortedatum'),
    buildPropertyRefs('address', 'Adres'),
    buildPropertyRefs('parents', 'Ouders'),
    buildPropertyRefs('emergencyContacts', 'Noodcontactpersonen'),
]

// Methods
function getFilterConfiguration(property: PropertyName): PropertyFilter|null {
    return patched.value[property]
}

function setEnableFilterConfiguration(property: PropertyName, enable: boolean) {
    if (enable === !!getFilterConfiguration(property)) {
        return
    }
    if (enable) {
        addPatch({
            [property]: props.recordsConfiguration[property] ?? PropertyFilter.createDefault()
        })
    } else {
        addPatch({
            [property]: null
        })
    }
}

function editEnableFilterConfiguration(property: PropertyName, title: string) {
    // todo
}

function buildPropertyRefs(property: PropertyName, title: string) {
    const enabled = computed({
        get: () => !!getFilterConfiguration(property),
        set: (value: boolean) => setEnableFilterConfiguration(property, value)
    })
    const locked = computed(() => !!props.inheritedRecordsConfiguration?.[property])
    const configuration = computed(() => getFilterConfiguration(property))

    return ref({
        title,
        enabled,
        locked,
        configuration,
        edit: () => editEnableFilterConfiguration(property, title)
    })
}

// Methods
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
