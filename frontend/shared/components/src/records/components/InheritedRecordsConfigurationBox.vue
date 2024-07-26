<template>
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

        <STListItem element-name="label" :selectable="!financialSupport.locked.value">
            <template #left>
                <Checkbox v-model="financialSupport.enabled.value" v-tooltip="dataPermissions.locked.value ? 'Verplicht op een hoger niveau' : ''" :disabled="financialSupport.locked.value" />
            </template>
            <p class="style-title-list">
                Financiële ondersteuning
            </p>
            <template v-if="!financialSupport.locked.value && financialSupport.enabled.value" #right>
                <button class="button gray icon settings" type="button" @click.stop="financialSupport.edit" />
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
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { NavigationActions, PropertyFilterView, memberWithRegistrationsBlobUIFilterBuilders, propertyFilterToString, useEmitPatch, useOrganization } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { BooleanStatus, DataPermissionsSettings, FinancialSupportSettings, MemberDetails, MemberWithRegistrationsBlob, OrganizationRecordsConfiguration, PatchAnswers, Platform, PlatformFamily, PlatformMember, PropertyFilter, RecordCategory } from '@stamhoofd/structures';
import { ComponentOptions, computed, ref, watchEffect } from 'vue';
import DataPermissionSettingsView from '../DataPermissionSettingsView.vue';
import FillRecordCategoryView from '../FillRecordCategoryView.vue';
import FinancialSupportSettingsView from '../FinancialSupportSettingsView.vue';
import { RecordEditorSettings } from '../RecordEditorSettings';
type PropertyName = 'emailAddress'|'phone'|'gender'|'birthDay'|'address'|'parents'|'emergencyContacts';

const props = withDefaults(
    defineProps<{
        recordsConfiguration: OrganizationRecordsConfiguration,
        inheritedRecordsConfiguration?: OrganizationRecordsConfiguration|null
    }>(),
    {
        inheritedRecordsConfiguration: null
    }
);

const emit = defineEmits(['patch:recordsConfiguration'])
const {patched, addPatch} = useEmitPatch<OrganizationRecordsConfiguration>(props, emit, 'recordsConfiguration');
const $t = useTranslate();
const $navigate = useNavigate();
const organization = useOrganization()
const present = usePresent();
const filterBuilder = memberWithRegistrationsBlobUIFilterBuilders[0]

enum Routes {
    DataPermissions = "dataPermissions",
    FinancialSupport = "financialSupport"
}
defineRoutes([
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

const properties = [
    buildPropertyRefs('phone', $t('shared.inputs.mobile.label') + ' (van lid zelf)'),
    buildPropertyRefs('emailAddress', 'E-mailadres (van lid zelf)'),
    buildPropertyRefs('gender', 'Geslacht'),
    buildPropertyRefs('birthDay', 'Geboortedatum'),
    buildPropertyRefs('address', 'Adres'),
    buildPropertyRefs('parents', 'Ouders'),
    buildPropertyRefs('emergencyContacts', 'Noodcontactpersonen'),
]

watchEffect(() => {
    // Clear locked properties
    for (const property of properties) {
        if (property.value.locked && patched.value[property.value.name]) {
            addPatch({[property.value.name]: null})
        }
    }
})

const dataPermissions = {
    locked: computed(() => !!props.inheritedRecordsConfiguration?.dataPermission && !patched.value.dataPermission),
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

const financialSupport = {
    locked: computed(() => !!props.inheritedRecordsConfiguration?.financialSupport && !patched.value.financialSupport),
    enabled: computed({
        get: () => !!props.inheritedRecordsConfiguration?.financialSupport || patched.value.financialSupport !== null,
        set: (value: boolean) => {
            if (value) {
                addPatch({
                    financialSupport: props.recordsConfiguration.financialSupport ?? FinancialSupportSettings.create({})
                });
            } else {
                addPatch({financialSupport: null});
            }
        }
    }),
    edit: async () => {
        await $navigate(Routes.FinancialSupport)
    }
}

// Methods
function buildPropertyRefs(property: PropertyName, title: string) {
    const locked = computed(() => !!props.inheritedRecordsConfiguration?.[property] && !patched.value[property])
    const enabled = computed({
        get: () => !!getFilterConfiguration(property),
        set: (value: boolean) => setEnableProperty(property, value)
    })
    const configuration = computed(() => getFilterConfiguration(property))

    return ref({
        name: property,
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
</script>
