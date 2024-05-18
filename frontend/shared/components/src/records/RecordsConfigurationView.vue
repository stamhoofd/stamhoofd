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
            <STListItem element-name="label" :selectable="!dataPermissions.locked.value">
                <template #left>
                    <Checkbox v-model="dataPermissions.enabled.value" v-tooltip="dataPermissions.locked.value ? 'Verplicht op een hoger niveau' : ''" :disabled="dataPermissions.locked.value" />
                </template>
                <p class="style-title-list">
                    Toestemming gegevensverzameling
                </p>
                <template v-if="!dataPermissions.locked.value && dataPermissions.enabled.value" #right>
                    <button class="button gray icon settings" type="button" @click.stop="dataPermissions.edit" />
                </template>
            </STListItem>

            <STListItem v-for="property of properties" :key="property.value.title" element-name="label" :selectable="!property.value.locked">
                <template #left>
                    <Checkbox v-model="property.value.enabled" v-tooltip="property.value.locked ? 'Verplicht op een hoger niveau' : ''" :disabled="property.value.locked" />
                </template>
                <p class="style-title-list">
                    {{ property.value.title }}
                </p>
                <p v-if="property.value.configuration" class="style-description-small">
                    {{ propertyFilterToString(property.value.configuration, filterBuilder) }}
                </p>
                <template v-if="!property.value.locked && property.value.enabled" #right>
                    <button class="button gray icon settings" type="button" @click.stop="property.value.edit" />
                </template>
            </STListItem>

            <STListItem v-for="category of inheritedRecordsConfiguration?.recordCategories ?? []" :key="category.id" element-name="label" :selectable="!getRefForInheritedCategory(category.id).value.locked" class="right-stack">
                <template #left>
                    <Checkbox v-model="getRefForInheritedCategory(category.id).value.enabled" v-tooltip="getRefForInheritedCategory(category.id).value.locked ? 'Verplicht op een hoger niveau' : ''" :disabled="getRefForInheritedCategory(category.id).value.locked" />
                </template>
                <p class="style-title-list">
                    {{ getRefForInheritedCategory(category.id).value.title }}
                </p>
                <p v-if="getRefForInheritedCategory(category.id).value.configuration" class="style-description-small">
                    {{ propertyFilterToString(getRefForInheritedCategory(category.id).value.configuration!, filterBuilder) }}
                </p>
                <template #right>
                    <button class="button gray icon eye" type="button" @click.stop="previewCategory(category)" />
                    <button v-if="!getRefForInheritedCategory(category.id).value.locked && getRefForInheritedCategory(category.id).value.enabled" class="button gray icon settings" type="button" @click.stop="getRefForInheritedCategory(category.id).value.edit" />
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
import { AutoEncoderPatchType, PatchMap, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, useNavigate, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, NavigationActions, PropertyFilterView, memberWithRegistrationsBlobUIFilterBuilders, propertyFilterToString, useDraggableArray, useErrors, useOrganization, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { DataPermissionsSettings, MemberDetails, MemberWithRegistrationsBlob, OrganizationRecordsConfiguration, PatchAnswers, Platform, PlatformFamily, PlatformMember, PropertyFilter, RecordCategory } from '@stamhoofd/structures';
import { ComponentOptions, computed, ref } from 'vue';
import EditRecordCategoryView from './EditRecordCategoryView.vue';
import FillRecordCategoryView from './FillRecordCategoryView.vue';
import { RecordEditorSettings } from './RecordEditorSettings';
import RecordCategoryRow from './components/RecordCategoryRow.vue';
import DataPermissionSettingsView from './DataPermissionSettingsView.vue';
type PropertyName = 'emailAddress'|'phone'|'gender'|'birthDay'|'address'|'parents'|'emergencyContacts';

const props = defineProps<{
    recordsConfiguration: OrganizationRecordsConfiguration,
    inheritedRecordsConfiguration?: OrganizationRecordsConfiguration,
    saveHandler: (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => Promise<void>
}>();

enum Routes {
    NewRecordCategory = "newRecordCategory",
    EditRecordCategory = "editRecordCategory",
    DataPermissions = "dataPermissions"
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
const present = usePresent();

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
    toggleDefaultEnabled: !props.inheritedRecordsConfiguration,
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

const dataPermissions = {
    locked: computed(() => !!props.inheritedRecordsConfiguration?.dataPermission),
    enabled: computed({
        get: () => !!props.inheritedRecordsConfiguration?.dataPermission || patched.value.dataPermission !== null,
        set: (value: boolean) => {
            if (value) {
                addPatch({
                    dataPermission: props.recordsConfiguration.dataPermission ?? DataPermissionsSettings.create({})
                });
            } else {
                addPatch({dataPermission: null});
            }
        }
    }),
    edit: async () => {
        await $navigate(Routes.DataPermissions)
    }
}

// Methods
function buildPropertyRefs(property: PropertyName, title: string) {
    const locked = computed(() => !!props.inheritedRecordsConfiguration?.[property])
    const enabled = computed({
        get: () => !!getFilterConfiguration(property),
        set: (value: boolean) => setEnableProperty(property, value)
    })
    const configuration = computed(() => getFilterConfiguration(property))

    return ref({
        title,
        enabled,
        locked,
        configuration,
        edit: () => editPropertyFilterConfiguration(property, title)
    })
}

function getFilterConfiguration(property: PropertyName): PropertyFilter|null {
    return props.inheritedRecordsConfiguration?.[property] ?? patched.value[property]
}

function setEnableProperty(property: PropertyName, enable: boolean) {
    if (props.inheritedRecordsConfiguration?.[property]) {
        return
    }
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

async function editPropertyFilterConfiguration(property: PropertyName, title: string) {
    await present({
        components: [
            new ComponentWithProperties(PropertyFilterView, {
                configuration: getFilterConfiguration(property) ?? PropertyFilter.createDefault(),
                title,
                builder: settings.filterBuilder([]),
                setConfiguration: (configuration: PropertyFilter) => {
                    addPatch({
                        [property]: configuration
                    })
                }
            })
        ],
        modalDisplayStyle: 'popup'
    })
}

// Inherited categories
const cachedInheritedCategories = new Map<string, ReturnType<typeof buildRefForInheritedCategory>>();
function getRefForInheritedCategory(categoryId: string) {
    if (!cachedInheritedCategories.has(categoryId)) {
        cachedInheritedCategories.set(categoryId, buildRefForInheritedCategory(categoryId))
    }
    return cachedInheritedCategories.get(categoryId)!
}

function buildRefForInheritedCategory(categoryId: string) {
    const category = computed(() => props.inheritedRecordsConfiguration?.recordCategories?.find(c => c.id === categoryId))
    
    const locked = computed(() => !category.value || category.value.defaultEnabled)
    const enabled = computed({
        get: () => locked.value || !!patched.value.inheritedRecordCategories.has(categoryId),
        set: (enable: boolean) => {
            if (enable === enabled.value) {
                return
            }
            const patchMap = new PatchMap() as PatchMap<string, PropertyFilter|null>;

            if (enable) {
                // Set
                patchMap.set(
                    categoryId, 
                    // Reuse saved one in case of accidental disable - enable
                    props.recordsConfiguration.inheritedRecordCategories.get(categoryId) ?? PropertyFilter.createDefault()
                )
            } else {
                // Remove
                patchMap.set(categoryId, null)
            }
            addPatch({
                inheritedRecordCategories: patchMap
            })
        }
    })
    const configuration = computed(() => patched.value.inheritedRecordCategories.get(categoryId) ?? category.value?.filter ?? null)

    return ref({
        title: category.value?.name ?? 'Naamloos',
        enabled,
        locked,
        configuration,
        edit: async () => {
            await editInheritedFilterConfiguration(categoryId)
        }
    })
}

async function editInheritedFilterConfiguration(categoryId: string) {
    const category = props.inheritedRecordsConfiguration?.recordCategories?.find(c => c.id === categoryId);
    if (!category) {
        return
    }

    await present({
        components: [
            new ComponentWithProperties(PropertyFilterView, {
                configuration: props.recordsConfiguration.inheritedRecordCategories.get(categoryId) ?? PropertyFilter.createDefault(),
                title: category.name,
                builder: settings.filterBuilder([]),
                setConfiguration: (configuration: PropertyFilter) => {
                    const patchMap = new PatchMap() as PatchMap<string, PropertyFilter|null>;
                    patchMap.set(
                        categoryId, 
                        configuration
                    )

                    addPatch({
                        inheritedRecordCategories: patchMap
                    })
                }
            })
        ],
        modalDisplayStyle: 'popup'
    })
}

function addCategoriesPatch(p: PatchableArrayAutoEncoder<RecordCategory>) {
    addPatch({recordCategories: p})
}

async function editCategory(category: RecordCategory) {
    await $navigate(Routes.EditRecordCategory, {params: {categoryId: category.id}})
}

async function previewCategory(category: RecordCategory) {
    await present({
        components: [
            new ComponentWithProperties(FillRecordCategoryView, {
                category,
                value: settings.exampleValue,
                markReviewed: false,
                patchHandler: (patch: PatchAnswers) => {
                    return settings.patchExampleValue(settings.exampleValue, patch)
                },
                saveHandler: async (_patch: PatchAnswers, navigate: NavigationActions) => {
                    await navigate.pop({force: true})
                }
            })
        ],
        modalDisplayStyle: 'popup'
    })
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
