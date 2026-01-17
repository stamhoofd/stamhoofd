<template>
    <STList>
        <STListItem element-name="label" :selectable="!dataPermissions.locked.value">
            <template #left>
                <Checkbox v-model="dataPermissions.enabled.value" v-tooltip="dataPermissions.locked.value ? $t('cc347bb2-99d1-4320-85d4-943117eb2271') : ''" :disabled="dataPermissions.locked.value" />
            </template>
            <p class="style-title-list">
                {{ $t('3936222c-5399-4d5e-9543-e483fa4f058a') }}
            </p>
        </STListItem>

        <STListItem element-name="label" :selectable="!financialSupport.locked.value" class="right-stack">
            <template #left>
                <Checkbox v-model="financialSupport.enabled.value" v-tooltip="dataPermissions.locked.value ? $t('cc347bb2-99d1-4320-85d4-943117eb2271') : ''" :disabled="financialSupport.locked.value" />
            </template>
            <p class="style-title-list">
                {{ financialSupportSettings.title }}
                <span v-tooltip="$t('83e663a6-e62d-4dac-a2df-d7a9a90774d2')" class="gray small icon privacy" />
            </p>
        </STListItem>

        <STListItem v-for="property of properties" :key="property.value.title" element-name="label" :selectable="!property.value.locked">
            <template #left>
                <Checkbox v-model="property.value.enabled" v-tooltip="property.value.locked ? $t('cc347bb2-99d1-4320-85d4-943117eb2271') : ''" :disabled="property.value.locked" />
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
                    v-if="property.value.configuration && property.value.parentConfiguration && propertyFilterToString(property.value.parentConfiguration, filterBuilder) !== propertyFilterToString(property.value.configuration, filterBuilder)" v-tooltip="$t('Aangepast vanaf standaardinstelling')"
                    class="icon dot primary small"
                />
            </p>
            <p v-if="property.value.description" class="style-description-small">
                {{ property.value.description }}
            </p>

            <p v-if="!groupLevel && property.value.configuration && property.value.configuration.isAlwaysEnabledAndRequired && property.value.options?.preventAlways" class="error-box">
                {{ property.value.options?.warning ?? $t('cfbb0a9e-e6ce-4e40-ae55-bd7388f98eb9') }}
            </p>

            <template v-if="property.value.enabled" #right>
                <button class="button gray icon settings" type="button" @click.stop="property.value.edit" />
            </template>
        </STListItem>

        <STListItem v-for="category of inheritedRecordsConfiguration?.recordCategories ?? []" :key="category.id" element-name="label" :selectable="!getRefForInheritedCategory(category.id).value.locked" class="right-stack">
            <template #left>
                <Checkbox v-model="getRefForInheritedCategory(category.id).value.enabled" v-tooltip="getRefForInheritedCategory(category.id).value.locked ? $t('cc347bb2-99d1-4320-85d4-943117eb2271') : ''" :disabled="getRefForInheritedCategory(category.id).value.locked" />
            </template>

            <p v-if="getRefForInheritedCategory(category.id).value.configuration" class="style-title-prefix-list">
                {{ propertyFilterToString(getRefForInheritedCategory(category.id).value.configuration!, filterBuilder) }}
            </p>
            <p class="style-title-list">
                {{ getRefForInheritedCategory(category.id).value.title }}
                <span v-if="getRefForInheritedCategory(category.id).value.requiresDataPermissions" v-tooltip="$t('83e663a6-e62d-4dac-a2df-d7a9a90774d2')" class="gray icon privacy small" />
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
                firstName: $t(`fbe32760-d352-4d3d-813c-acd50f3cba50`),
                lastName: $t(`946f5e2e-d92c-4bbd-b64f-115958a04d01`),
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
    buildPropertyRefs('gender', $t(`9e080d96-2c2b-47e3-b56c-d58d993974c9`)),
    buildPropertyRefs('birthDay', $t(`7d7b5a21-105a-41a1-b511-8639b59024a4`)),
    buildPropertyRefs(
        'nationalRegisterNumber', $t(`00881b27-7501-4c56-98de-55618be2bf11`), {
            description: $t('e4603a61-7e45-4ca4-99b2-4e4208f127d1'),
        },
    ),
    buildPropertyRefs('parents', $t(`fae120e5-80b0-4b67-a8b7-638b43362429`), {
        description: $t(`bd1d21bd-b58f-4d13-b7c7-510db5702441`),
    }),
    buildPropertyRefs('phone', $t('90d84282-3274-4d85-81cd-b2ae95429c34') + ' ' + $t(`347b9603-d66d-4587-9935-192eaeb0d3bd`), {
        description: $t(`f06acd8c-4cec-42ff-b4b4-5da57ef7db09`),
        warning: $t(`30047312-8c15-4988-8095-a0f605874c22`),
        preventAlways: true,
    }),
    buildPropertyRefs('emailAddress', $t(`0d2bf5c4-db71-465b-8795-9cf8cac63c75`), {
        description: $t(`86db1ded-a836-486d-9ee3-4efc5b24a08f`),
        warning: $t(`154a3457-6357-4a43-9465-a343d218a591`),
        preventAlways: true,
    }),
    buildPropertyRefs('address', $t(`bba50e14-c3a1-4b18-9102-14f323453ca0`), {
        description: $t(`52b884eb-4437-4ecb-94b8-6079730d45c4`),
        warning: $t(`d905b0d6-f472-4290-b9c2-3e566cdbaf33`),
        preventAlways: true,
    }),
    buildPropertyRefs('emergencyContacts', $t(`243b1b1d-feca-43ab-a240-24e5ba785983`), {
        description: $t(`8a1ef416-1a1d-4e12-8b47-29d9c86a1dfe`),
    }),
    buildPropertyRefs('uitpasNumber', $t(`87c1a48c-fef5-44c3-ae56-c83463fcfb84`), {
        warning: $t(`0fcd2a4c-1c44-46df-be27-c8800370769d`),
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
                    Toast.error($t(`521bbf47-fee2-4491-afd5-d263b0ebeda9`)).show();
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
        return Toast.info($t('Je kan deze standaardinstelling niet wijzigen')).show();
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
                    Toast.error($t(`1f1e0d12-3960-46f9-b1e7-d8b42a89e51f`)).show();
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
        title: category.value?.name ?? $t(`efd71f7c-05d3-4bdc-ae46-13024d6527f0`),
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
