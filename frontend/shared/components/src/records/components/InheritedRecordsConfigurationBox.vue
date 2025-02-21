<template>
    <STList>
        <STListItem element-name="label" :selectable="!dataPermissions.locked.value">
            <template #left>
                <Checkbox v-model="dataPermissions.enabled.value" v-tooltip="dataPermissions.locked.value ? 'Verplicht op een hoger niveau' : ''" :disabled="dataPermissions.locked.value" />
            </template>
            <p class="style-title-list">
                Toestemming gegevensverzameling
            </p>
        </STListItem>

        <STListItem element-name="label" :selectable="!financialSupport.locked.value" class="right-stack">
            <template #left>
                <Checkbox v-model="financialSupport.enabled.value" v-tooltip="dataPermissions.locked.value ? 'Verplicht op een hoger niveau' : ''" :disabled="financialSupport.locked.value" />
            </template>
            <p class="style-title-list">
                {{ financialSupportSettings.title }}
            </p>
            <template #right>
                <span v-tooltip="'Vereist toestemming voor gegevensverzameling'" class="gray icon privacy" />
            </template>
        </STListItem>

        <STListItem v-for="property of properties" :key="property.value.title" element-name="label" :selectable="!property.value.locked">
            <template #left>
                <Checkbox v-model="property.value.enabled" v-tooltip="property.value.locked ? 'Verplicht op een hoger niveau' : ''" :disabled="property.value.locked" />
            </template>

            <p v-if="property.value.configuration" class="style-title-prefix-list">
                {{ propertyFilterToString(property.value.configuration, filterBuilder) }}
            </p>

            <p class="style-title-list">
                {{ property.value.title }}
            </p>
            <p v-if="property.value.description" class="style-description-small">
                {{ property.value.description }}
            </p>

            <p v-if="!groupLevel && property.value.configuration && property.value.configuration.isAlwaysEnabledAndRequired && property.value.options?.preventAlways" class="error-box">
                {{ property.value.options?.warning ?? 'Dit werd onjuist ingesteld' }}
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
                <span v-if="getRefForInheritedCategory(category.id).value.requiresDataPermissions" v-tooltip="'Vereist toestemming voor gegevensverzameling'" class="gray icon privacy" />
                <button class="button gray icon eye" type="button" @click.stop="previewCategory(category)" />
                <button v-if="!getRefForInheritedCategory(category.id).value.locked && getRefForInheritedCategory(category.id).value.enabled" class="button gray icon settings" type="button" @click.stop="getRefForInheritedCategory(category.id).value.edit" />
            </template>
        </STListItem>
    </STList>
</template>

<script setup lang="ts">
import { PatchMap } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { NavigationActions, PropertyFilterView, Toast, memberWithRegistrationsBlobUIFilterBuilders, propertyFilterToString, useEmitPatch, useFinancialSupportSettings, useOrganization } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { BooleanStatus, MemberDetails, MemberProperty, MemberWithRegistrationsBlob, Organization, OrganizationRecordsConfiguration, PatchAnswers, Platform, PlatformFamily, PlatformMember, PropertyFilter, RecordCategory } from '@stamhoofd/structures';
import { computed, ref, watchEffect } from 'vue';
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
const $t = useTranslate();
const baseOrg = useOrganization();
const organization = computed(() => props.overrideOrganization ?? baseOrg.value);
const present = usePresent();
const filterBuilder = memberWithRegistrationsBlobUIFilterBuilders[0];
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
        return memberWithRegistrationsBlobUIFilterBuilders[0];
    },
    exampleValue: new PlatformMember({
        member: MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'Voorbeeld',
                lastName: 'Lid',
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
    buildPropertyRefs('gender', 'Gender'),
    buildPropertyRefs('birthDay', 'Geboortedatum'),
    buildPropertyRefs('nationalRegisterNumber', 'Rijksregisternummer'),
    buildPropertyRefs('parents', 'Oudergegevens', {
        description: 'Naam, adres, e-mailadres en telefoonnummer van één of meerdere (plus)ouders',
    }),
    buildPropertyRefs('phone', $t('90d84282-3274-4d85-81cd-b2ae95429c34') + ' (van lid zelf)', {
        description: 'Het GSM-nummer van de ouders wordt al verzameld via de oudergegevens. Activeer dit enkel voor leden die ook echt een eigen GSM-nummer kunnen hebben, en maak het enkel verplicht als je zeker weet dat iedereen een GSM-nummer heeft.',
        warning: 'Maak dit niet verplicht voor alle leden, anders moeten minderjarige leden ook verplicht een eigen GSM-nummer invullen, wat ze vaak niet hebben. Denk goed na over wat je instelt.',
        preventAlways: true,
    }),
    buildPropertyRefs('emailAddress', 'E-mailadres (van lid zelf)', {
        description: 'Het e-mailadres van de ouders wordt al verzameld via de oudergegevens. Activeer dit enkel voor leden die ook echt een eigen e-mailadres kunnen hebben, en maak het enkel verplicht als je zeker weet dat iedereen een e-mailadres heeft.',
        warning: 'Maak dit niet verplicht voor alle leden, anders moeten erg jonge leden ook verplicht een eigen e-mailadres invullen, wat ze vaak niet hebben. Denk goed na over wat je instelt.',
        preventAlways: true,
    }),
    buildPropertyRefs('address', 'Adres (van lid zelf)', {
        description: 'Het adres van elke ouder wordt al verzameld via de oudergegevens. We raden af om dit te activeren voor minderjarige leden. Bij ouders kan er namelijk per ouder een apart adres ingesteld worden, wat beter geschikt is. Enkel voor volwassen leden is dit beter aangewezen.',
        warning: 'We raden heel sterk af om dit in te schakelen voor minderjarige leden. Gebruik een leeftijdsfilter om dit enkel in te schakelen voor volwassen leden.',
        preventAlways: true,
    }),
    buildPropertyRefs('emergencyContacts', 'Extra noodcontactpersonen', {
        description: 'Naam, relatie en telefoonnummer van één of meerdere noodcontactpersonen (als uitbreiding op ouders, niet de ouders zelf)',
    }),
    buildPropertyRefs('uitpasNumber', 'UiTPAS-nummer'),
];

watchEffect(() => {
    // Clear locked properties
    for (const property of properties) {
        if (property.value.locked && patched.value[property.value.name]) {
            addPatch({ [property.value.name]: null });
        }
    }
});

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
                    Toast.error('De financiële status van een lid is gevoelige informatie en vereist toestemming voor gegevensverzameling').show();
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
function buildPropertyRefs(property: MemberProperty, title: string, options?: { warning?: string; description?: string; preventAlways?: boolean }) {
    const locked = computed(() => !!props.inheritedRecordsConfiguration?.[property] && !patched.value[property]);
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
        edit: () => editPropertyFilterConfiguration(property, title, options),
    });
}

function getFilterConfiguration(property: MemberProperty): PropertyFilter | null | boolean {
    return props.inheritedRecordsConfiguration?.[property] ?? patched.value[property];
}

function setEnableProperty(property: MemberProperty, enable: boolean) {
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

async function editPropertyFilterConfiguration(property: MemberProperty, title: string, options?: { warning?: string; description?: string }) {
    await present({
        components: [
            new ComponentWithProperties(PropertyFilterView, {
                configuration: getFilterConfiguration(property) ?? PropertyFilter.createDefault(),
                title,
                options,
                builder: settings.filterBuilder([]),
                setConfiguration: (configuration: PropertyFilter) => {
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
                    Toast.error('Deze vragenlijst bevat gegevens waar je toestemming voor moet vragen. Schakel de toestemming voor gegevevensverzameling in om deze vragenlijst te activeren.').show();
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
    const configuration = computed(() => patched.value.inheritedRecordCategories.get(categoryId) ?? category.value?.filter ?? null);

    return ref({
        title: category.value?.name ?? 'Naamloos',
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
