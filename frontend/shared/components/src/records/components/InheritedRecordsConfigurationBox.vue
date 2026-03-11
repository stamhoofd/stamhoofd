<template>
    <STList>
        <STListItem element-name="label" :selectable="!dataPermissions.locked.value">
            <template #left>
                <Checkbox v-model="dataPermissions.enabled.value" v-tooltip="dataPermissions.locked.value ? $t('%jE') : ''" :disabled="dataPermissions.locked.value" />
            </template>
            <p class="style-title-list">
                {{ $t('%vY') }}
            </p>
        </STListItem>

        <STListItem element-name="label" :selectable="!financialSupport.locked.value" class="right-stack">
            <template #left>
                <Checkbox v-model="financialSupport.enabled.value" v-tooltip="dataPermissions.locked.value ? $t('%jE') : ''" :disabled="financialSupport.locked.value" />
            </template>
            <p class="style-title-list">
                {{ financialSupportSettings.title }}
                <span v-tooltip="$t('%jF')" class="gray small icon privacy" />
            </p>
        </STListItem>

        <STListItem v-for="property of properties" :key="property.value.title" element-name="label" :selectable="!property.value.locked">
            <template #left>
                <Checkbox v-model="property.value.enabled" v-tooltip="property.value.locked ? $t('%jE') : ''" :disabled="property.value.locked" />
            </template>

            <p v-if="property.value.configuration" class="style-title-prefix-list">
                {{ propertyFilterToString(property.value.configuration, filterBuilder) }}

                <template v-if="property.value.parentConfiguration && propertyFilterToString(property.value.parentConfiguration, filterBuilder) !== propertyFilterToString(property.value.configuration, filterBuilder)">
                    (aangepast vanaf standaardinstelling)
                </template>
            </p>

            <p class="style-title-list">
                {{ property.value.title }}

                <span
                    v-if="property.value.configuration && property.value.parentConfiguration && propertyFilterToString(property.value.parentConfiguration, filterBuilder) !== propertyFilterToString(property.value.configuration, filterBuilder)" v-tooltip="$t('%1It')"
                    class="icon dot primary small"
                />
            </p>
            <p v-if="property.value.description" class="style-description-small">
                {{ property.value.description }}
            </p>

            <p v-if="!groupLevel && property.value.configuration && property.value.configuration.isAlwaysEnabledAndRequired && property.value.options?.preventAlways" class="error-box">
                {{ property.value.options?.warning ?? $t('%jG') }}
            </p>

            <template v-if="property.value.enabled" #right>
                <button class="button gray icon settings" type="button" @click.stop="property.value.edit" />
            </template>
        </STListItem>

        <STListItem v-for="category of inheritedRecordsConfiguration?.recordCategories ?? []" :key="category.id" element-name="label" :selectable="!getRefForInheritedCategory(category.id).value.locked" class="right-stack">
            <template #left>
                <Checkbox v-model="getRefForInheritedCategory(category.id).value.enabled" v-tooltip="getRefForInheritedCategory(category.id).value.locked ? $t('%jE') : ''" :disabled="getRefForInheritedCategory(category.id).value.locked" />
            </template>

            <p v-if="getRefForInheritedCategory(category.id).value.configuration" class="style-title-prefix-list">
                {{ propertyFilterToString(getRefForInheritedCategory(category.id).value.configuration!, filterBuilder) }}
            </p>
            <p class="style-title-list">
                {{ getRefForInheritedCategory(category.id).value.title }}
                <span v-if="getRefForInheritedCategory(category.id).value.requiresDataPermissions" v-tooltip="$t('%jF')" class="gray icon privacy small" />
            </p>
            <template #right>
                <button class="button gray icon eye" type="button" @click.stop="previewCategory(category)" />
                <button v-if="!getRefForInheritedCategory(category.id).value.locked && getRefForInheritedCategory(category.id).value.enabled" class="button gray icon settings" type="button" @click.stop="getRefForInheritedCategory(category.id).value.edit" />
            </template>
        </STListItem>
    </STList>
</template>

<script setup lang="ts">
import { PatchMap } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { NavigationActions, PropertyFilterView, Toast, propertyFilterToString, useEmitPatch, useFinancialSupportSettings, useOrganization } from '@stamhoofd/components';
import { BooleanStatus, MemberDetails, MemberPropertyWithFilter, MemberWithRegistrationsBlob, Organization, OrganizationRecordsConfiguration, PatchAnswers, Platform, PlatformFamily, PlatformMember, PropertyFilter, RecordCategory } from '@stamhoofd/structures';
import { computed, ref, watchEffect } from 'vue';
import { getMemberFilterBuildersForInheritedRecords } from '../../filters/filter-builders/members';
import FillRecordCategoryView from '../FillRecordCategoryView.vue';
import { RecordEditorSettings, RecordEditorType } from '../RecordEditorSettings';

const props = withDefaults(
    defineProps<{
        recordsConfiguration: OrganizationRecordsConfiguration;
        inheritedRecordsConfiguration?: OrganizationRecordsConfiguration | null;
        overrideOrganization?: Organization | null;
        groupLevel?: boolean;
    }>(),
    {
        inheritedRecordsConfiguration: null,
        overrideOrganization: null,
        groupLevel: false,
    },
);

const emit = defineEmits(['patch:recordsConfiguration']);
const { patched, addPatch } = useEmitPatch<OrganizationRecordsConfiguration>(props, emit, 'recordsConfiguration');

const baseOrg = useOrganization();
const organization = computed(() => props.overrideOrganization ?? baseOrg.value);
const present = usePresent();
const filterBuilders = getMemberFilterBuildersForInheritedRecords();
const filterBuilder = filterBuilders[0];
const { financialSupportSettings } = useFinancialSupportSettings();

const family = new PlatformFamily({
    platform: Platform.shared,
    contextOrganization: organization.value,
});

const settings = new RecordEditorSettings({
    type: RecordEditorType.PlatformMember,
    dataPermission: true,
    toggleDefaultEnabled: !props.inheritedRecordsConfiguration,
    filterBuilder: (categories: RecordCategory[]) => {
        return filterBuilder;
    },
    exampleValue: new PlatformMember({
        member: MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: $t(`%ID`),
                lastName: $t(`%ym`),
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
family.members.push(settings.exampleValue);

const properties = [
    buildPropertyRefs('gender', $t(`%1d`)),
    buildPropertyRefs('birthDay', $t(`%17w`)),
    buildPropertyRefs(
        'nationalRegisterNumber', $t(`%wK`), {
            description: $t('%17a'),
        },
    ),
    buildPropertyRefs('parents', $t(`%11P`), {
        description: $t(`%11Q`),
    }),
    buildPropertyRefs('phone', $t('%2k') + ' ' + $t(`%11R`), {
        description: $t(`%11S`),
        warning: $t(`%11T`),
        preventAlways: true,
    }),
    buildPropertyRefs('emailAddress', $t(`%11U`), {
        description: $t(`%11V`),
        warning: $t(`%11W`),
        preventAlways: true,
    }),
    buildPropertyRefs('address', $t(`%11X`), {
        description: $t(`%11Y`),
        warning: $t(`%11Z`),
        preventAlways: true,
    }),
    buildPropertyRefs('emergencyContacts', $t(`%11a`), {
        description: $t(`%11b`),
    }),
    buildPropertyRefs('uitpasNumber', $t(`%wF`), {
        warning: $t(`%11c`),
        preventAlways: true,
    }),
];

const dataPermissions = {
    locked: computed(() => !!props.inheritedRecordsConfiguration?.dataPermission && !patched.value.dataPermission),
    enabled: computed({
        get: () => !!props.inheritedRecordsConfiguration?.dataPermission || patched.value.dataPermission,
        set: (value: boolean) => {
            addPatch({
                dataPermission: value,
            });
        },
    }),
};

const financialSupport = {
    locked: computed(() => !!props.inheritedRecordsConfiguration?.financialSupport && !patched.value.financialSupport),
    enabled: computed({
        get: () => !!props.inheritedRecordsConfiguration?.financialSupport || patched.value.financialSupport,
        set: (value: boolean) => {
            if (value) {
                if (!dataPermissions.enabled.value) {
                    Toast.error($t(`%11d`)).show();
                    return;
                }
                addPatch({
                    financialSupport: true,
                });
            }
            else {
                addPatch({
                    financialSupport: false,
                });
            }
        },
    }),
};

// Methods
function buildPropertyRefs(property: MemberPropertyWithFilter, title: string, options?: { warning?: string; description?: string; preventAlways?: boolean }) {
    const locked = computed(() => !!props.inheritedRecordsConfiguration?.[property]);
    const enabled = computed({
        get: () => !!getFilterConfiguration(property),
        set: (value: boolean) => {
            if (value) {
                // Show dialog
                editPropertyFilterConfiguration(property, title, options).catch(console.error);
            }
            else {
                setEnableProperty(property, value);
            }
        },
    });
    const configuration = computed(() => getFilterConfiguration(property));

    return ref({
        name: property,
        title,
        description: options?.description,
        options,
        enabled,
        locked,
        configuration,
        parentConfiguration: computed(() => props.inheritedRecordsConfiguration?.[property]),
        edit: () => editPropertyFilterConfiguration(property, title, options),
    });
}

function getFilterConfiguration(property: MemberPropertyWithFilter): PropertyFilter | null {
    if (props.inheritedRecordsConfiguration?.[property] && patched.value[property]) {
        // Merge
        return props.inheritedRecordsConfiguration?.[property].merge(patched.value[property]);
    }
    return props.inheritedRecordsConfiguration?.[property] ?? patched.value[property];
}

function setEnableProperty(property: MemberPropertyWithFilter, enable: boolean) {
    if (props.inheritedRecordsConfiguration?.[property]) {
        return;
    }
    if (enable === !!getFilterConfiguration(property)) {
        return;
    }
    if (enable) {
        addPatch({
            [property]: props.recordsConfiguration[property] ?? PropertyFilter.createDefault(),
        });
    }
    else {
        addPatch({
            [property]: null,
        });
    }
}

async function editPropertyFilterConfiguration(property: MemberPropertyWithFilter, title: string, options?: { warning?: string; description?: string }) {
    if (props.inheritedRecordsConfiguration?.[property] && props.inheritedRecordsConfiguration?.[property].isAlwaysEnabledAndRequired) {
        return Toast.info($t('%1Iu')).show();
    }

    await present({
        components: [
            new ComponentWithProperties(PropertyFilterView, {
                parentConfiguration: props.inheritedRecordsConfiguration?.[property],
                configuration: patched.value[property] ?? (props.inheritedRecordsConfiguration?.[property] ? null : PropertyFilter.createDefault()), // do not use inherits when editing a configuration
                title,
                options,
                builder: settings.filterBuilder([]),
                setConfiguration: (configuration: PropertyFilter | null) => {
                    addPatch({
                        [property]: configuration,
                    });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

// Inherited categories
const cachedInheritedCategories = new Map<string, ReturnType<typeof buildRefForInheritedCategory>>();
function getRefForInheritedCategory(categoryId: string) {
    if (!cachedInheritedCategories.has(categoryId)) {
        cachedInheritedCategories.set(categoryId, buildRefForInheritedCategory(categoryId));
    }
    return cachedInheritedCategories.get(categoryId)!;
}

function buildRefForInheritedCategory(categoryId: string) {
    const category = computed(() => props.inheritedRecordsConfiguration?.recordCategories?.find(c => c.id === categoryId));

    const requiresDataPermissions = computed(() => !!category.value?.containsSensitiveData);

    const locked = computed(() => !category.value || category.value.defaultEnabled);
    const enabled = computed({
        get: () => locked.value || !!patched.value.inheritedRecordCategories.has(categoryId),
        set: (enable: boolean) => {
            if (enable === enabled.value) {
                return;
            }
            const patchMap = new PatchMap() as PatchMap<string, PropertyFilter | null>;

            if (enable) {
                if (requiresDataPermissions.value && !dataPermissions.enabled.value) {
                    Toast.error($t(`%10m`)).show();
                    return;
                }

                // Set
                patchMap.set(
                    categoryId,
                    // Reuse saved one in case of accidental disable - enable
                    props.recordsConfiguration.inheritedRecordCategories.get(categoryId) ?? PropertyFilter.createDefault(),
                );
            }
            else {
                // Remove
                patchMap.set(categoryId, null);
            }
            addPatch({
                inheritedRecordCategories: patchMap,
            });
        },
    });
    const configuration = computed(() => enabled.value ? (patched.value.inheritedRecordCategories.get(categoryId) ?? category.value?.filter ?? PropertyFilter.createDefault()) : null);

    return ref({
        title: category.value?.name ?? $t(`%CL`),
        enabled,
        locked,
        configuration,
        requiresDataPermissions,
        edit: async () => {
            await editInheritedFilterConfiguration(categoryId);
        },
    });
}

async function editInheritedFilterConfiguration(categoryId: string) {
    const category = props.inheritedRecordsConfiguration?.recordCategories?.find(c => c.id === categoryId);
    if (!category) {
        return;
    }

    await present({
        components: [
            new ComponentWithProperties(PropertyFilterView, {
                configuration: props.recordsConfiguration.inheritedRecordCategories.get(categoryId) ?? PropertyFilter.createDefault(),
                title: category.name,
                builder: settings.filterBuilder([]),
                setConfiguration: (configuration: PropertyFilter) => {
                    const patchMap = new PatchMap() as PatchMap<string, PropertyFilter | null>;
                    patchMap.set(
                        categoryId,
                        configuration,
                    );

                    addPatch({
                        inheritedRecordCategories: patchMap,
                    });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function previewCategory(category: RecordCategory) {
    await present({
        components: [
            new ComponentWithProperties(FillRecordCategoryView, {
                category: category.patch({
                    // Disable filter on category level for the preview, since these cannot work
                    filter: null,
                    defaultEnabled: true,
                }),
                value: settings.exampleValue,
                forceMarkReviewed: true,
                saveHandler: async (_patch: PatchAnswers, navigate: NavigationActions) => {
                    await navigate.pop({ force: true });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
