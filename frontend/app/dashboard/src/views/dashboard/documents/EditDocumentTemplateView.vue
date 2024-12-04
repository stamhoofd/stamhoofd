<template>
    <SaveView :title="title" :loading="saving" :disabled="!isComplete" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox v-if="isNew" title="Type document" error-fields="type" :error-box="errors.errorBox">
            <LoadingButton :loading="loadingHtml || loadingXml">
                <Dropdown v-model="editingType">
                    <option :value="null" disabled>
                        Maak een keuze
                    </option>
                    <option v-for="_type in availableTypes" :key="_type.value ?? _type.definition.name" :value="_type.value">
                        {{ _type.definition.name }}
                    </option>
                </Dropdown>
            </LoadingButton>
        </STInputBox>

        <template v-if="editingType || !isNew">
            <STInputBox title="Naam" error-fields="name" :error-box="errors.errorBox">
                <input
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Naam document"
                >
            </STInputBox>

            <!-- Depending on the selected definition, we'll display all the required fields here -->
            <div v-for="category of fieldCategories.filter(c => c.filterRecords(patchedDocument).filter(record => isDocumentFieldEditable(record)).length > 0)" :key="category.id" class="container">
                <hr>
                <h2>{{ category.name }}</h2>
                <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

                <RecordAnswerInput
                    v-for="record of category.filterRecords(patchedDocument).filter(record => isDocumentFieldEditable(record))"
                    :key="record.id"
                    :record="record"
                    :answers="recordAnswers"
                    :validator="errors.validator"
                    :mark-reviewed="true"
                    @patch="patchAnswers"
                />
            </div>

            <!-- Display all the required linking -->
            <div v-for="category of documentFieldCategories" :key="category.id" class="container">
                <hr>
                <h2>Koppelen: {{ category.name }}</h2>
                <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

                <p class="info-box">
                    {{ $t('39d0d9ca-2f37-40b6-84a4-51fb29b4cce6') }}
                </p>

                <MultiSelectInput v-for="field of category.getAllRecords().filter(r => isDocumentFieldEditable(r))" :key="field.id" class="max" :title="field.name" :error-fields="field.id" :error-box="errors.errorBox" :model-value="getLinkedFields(field)" :choices="getLinkedFieldsChoices(field)" placeholder="Niet gekoppeld" @update:model-value="setLinkedFields(field, $event)" />
            </div>

            <hr>
            <h2>Inschrijvingen</h2>
            <p>Kies voor welke inschrijvingen je dit document wilt aanmaken. Er wordt altijd één document aangemaakt per inschrijving.</p>

            <STList v-if="patchedDocument.privateSettings.groups.length">
                <STListItem v-for="group of patchedDocument.privateSettings.groups" :key="group.group.id" :selectable="true" @click="updateGroupAnswers(group)">
                    <h2 class="style-list-title">
                        {{ group.group.name }}
                    </h2>
                    <p class="style-description-small pre-wrap" v-text="group.group.description" />

                    <template #right>
                        <button class="button icon text trash" type="button" @click="removeGroup(group)" />
                    </template>
                </STListItem>
            </STList>
            <p>
                <button type="button" class="button text" @click="addGroup">
                    <span class="icon add" />
                    <span>Inschrijvingen toevoegen</span>
                </button>
            </p>

            <template v-if="patchedDocument.privateSettings.templateDefinition.allowChangingMaxAge">
                <hr>
                <h2>Leeftijdsbeperking</h2>
                <STInputBox title="Maximum leeftijd" error-fields="maxAge" :error-box="errors.errorBox">
                    <NumberInput v-model="maxAge" placeholder="Geen" :required="false" suffix="jaar" />
                </STInputBox>
            </template>

            <template v-if="patchedDocument.privateSettings.templateDefinition.allowChangingMinPrice">
                <hr>
                <h2>Bedrag</h2>
                <Checkbox v-model="nonZeroPriceOnly">
                    Enkel aanmaken indien inschrijvingsbedrag groter is dan 0 euro
                </Checkbox>
            </template>

            <template v-if="patchedDocument.privateSettings.templateDefinition.allowChangingMinPricePaid">
                <hr>
                <h2>Betaald</h2>
                <Checkbox v-model="paidOnly">
                    Enkel aanmaken indien inschrijving betaald is
                </Checkbox>
            </template>

            <template v-if="auth.hasPlatformFullAccess()">
                <hr>
                <h2>Geavanceerd</h2>

                <STList>
                    <CheckboxListItem v-model="useCustomHtml" label="Eigen HTML gebruiken voor document" description="Personaliseer het document door het wat aan te passen indien je zelf ervaring hebt met HTML. Test het resultaat wel goed uit.">
                        <div v-if="useCustomHtml" class="style-button-bar">
                            <button class="button text" type="button" @click="downloadHtml">
                                <span class="icon download" />
                                <span>
                                    Download huidige HTML
                                </span>
                            </button>

                            <label class="button text">
                                <span class="icon sync" />
                                <span>
                                    Vervangen
                                </span>

                                <input type="file" multiple="true" style="display: none;" accept=".html, text/html" @change="(event) => changedFile(event as any)">
                            </label>
                        </div>
                    </CheckboxListItem>
                </STList>
            </template>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoder, Decoder, PatchableArray, PatchableArrayAutoEncoder, PatchMap } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, CheckboxListItem, Dropdown, ErrorBox, FillRecordCategoryView, LoadingButton, MultiSelectInput, NavigationActions, NumberInput, RecordAnswerInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, useAuth, useContext, useErrors, usePatch, useRequiredOrganization } from '@stamhoofd/components';
import { AppManager, useRequestOwner } from '@stamhoofd/networking';
import { Country, DocumentPrivateSettings, DocumentSettings, DocumentTemplateDefinition, DocumentTemplateGroup, DocumentTemplatePrivate, PatchAnswers, RecordAddressAnswer, RecordAnswer, RecordAnswerDecoder, RecordCategory, RecordSettings, RecordTextAnswer, RecordType } from '@stamhoofd/structures';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { computed, onMounted, ref } from 'vue';

import ChooseDocumentTemplateGroup from './ChooseDocumentTemplateGroup.vue';
import { fiscal } from './definitions/fiscal';
import { participation } from './definitions/participation';

const props = withDefaults(defineProps<{
    isNew: boolean;
    document: DocumentTemplatePrivate;
    callback?: ((template: DocumentTemplatePrivate) => void) | null;
}>(), {
    callback: null,
});

const errors = useErrors();
const { patch: patchDocument, patched: patchedDocument, addPatch, hasChanges } = usePatch(props.document);
const saving = ref(false);
const loadingHtml = ref(false);
const loadingXml = ref(false);
const fieldCategories = computed(() => RecordCategory.flattenCategories(patchedDocument.value.privateSettings.templateDefinition.fieldCategories, patchedDocument.value));
const documentFieldCategories = computed(() => patchedDocument.value.privateSettings.templateDefinition.documentFieldCategories.filter(c => c.getAllRecords().filter(r => isDocumentFieldEditable(r)).length > 0));
const auth = useAuth();

function isDocumentFieldEditable(field: RecordSettings) {
    const supportedFields = getDefaultSupportedIds();
    return !supportedFields.includes(field.id);
}

const recordAnswers = computed(() => {
    return patchedDocument.value.getRecordAnswers();
});

const requestOwner = useRequestOwner();
const organization = useRequiredOrganization();
const present = usePresent();
const dismiss = useDismiss();
const context = useContext();
const useCustomHtml = computed({
    get: () => !!patchedDocument.value.privateSettings.customHtml,
    set: (customHtml) => {
        addPatch({
            privateSettings: DocumentPrivateSettings.patch({
                customHtml,
            }),
        });

        if (!customHtml) {
            // Force update of html etc
            editingType.value = patchedDocument.value?.privateSettings?.templateDefinition?.type ?? null;
        }
    },
});

onMounted(() => {
    // temporary!
    if (!props.isNew && !AppManager.shared.isNative && !useCustomHtml.value) {
        // Force update of html etc
        editingType.value = patchedDocument.value?.privateSettings?.templateDefinition?.type ?? null;
    }
});

function patchAnswers(patch: PatchAnswers | Map<string, RecordAnswer>) {
    const fieldAnswers = patch instanceof PatchMap ? patch : new PatchMap([...patch]);

    addPatch({
        settings: DocumentSettings.patch({
            fieldAnswers,
        }),
    });
}

const patchHandler = (patch: PatchAnswers): DocumentTemplatePrivate => {
    addPatch({
        settings: DocumentSettings.patch({
            fieldAnswers: patch as any,
        }),
    });
    return patchedDocument.value;
};

const isComplete = computed(() => !!patchedDocument.value.html && (!!patchedDocument.value.privateSettings.templateDefinition.xmlExport || !patchedDocument.value.privateSettings.templateDefinition.xmlExportDescription));

const editingType = computed({
    get: () => patchedDocument.value?.privateSettings?.templateDefinition?.type ?? null,
    set: (value: string | null) => {
        if (value) {
            const definition = availableTypes.value.find(t => t.value === value)?.definition;
            if (definition) {
                addPatch({
                    privateSettings: DocumentPrivateSettings.patch({
                        templateDefinition: definition,
                    }),
                    settings: DocumentSettings.patch({
                        name: patchedDocument.value.settings.name || definition.name,
                        maxAge: patchedDocument.value.settings.maxAge !== null && definition.allowChangingMaxAge ? patchedDocument.value.settings.maxAge : definition.defaultMaxAge,
                        minPrice: patchedDocument.value.settings.minPrice !== null && definition.allowChangingMinPrice ? patchedDocument.value.settings.minPrice : definition.defaultMinPrice,
                        minPricePaid: patchedDocument.value.settings.minPricePaid !== null && definition.allowChangingMinPricePaid ? patchedDocument.value.settings.minPricePaid : definition.defaultMinPricePaid,
                    }),
                });
                autoLink();
                loadHtml(value).catch((e) => {
                    console.error(e);

                    new Toast('Er ging iets mis bij het laden van dit document type. Controleer jouw internetverbinding en probeer de pagina opnieuw te laden.', 'error red').setHide(null).show();
                });

                if (definition.xmlExportDescription) {
                    loadXML(value).catch((e) => {
                        console.error(e);

                        new Toast('Er ging iets mis bij het laden van dit document type. Controleer jouw internetverbinding en probeer de pagina opnieuw te laden.', 'error red').setHide(null).show();
                    });
                }
            }
        }
    },
});

const maxAge = computed({
    get: () => patchedDocument.value.settings.maxAge,
    set: (age: number | null) => {
        addPatch({
            settings: DocumentSettings.patch({
                maxAge: age,
            }),
        });
    },
});

const minPrice = computed({
    get: () => patchedDocument.value.settings.minPrice,
    set: (minPrice: number | null) => {
        addPatch({
            settings: DocumentSettings.patch({
                minPrice,
            }),
        });
    },
});

const minPricePaid = computed({
    get: () => patchedDocument.value.settings.minPricePaid,
    set: (minPricePaid: number | null) => {
        addPatch({
            settings: DocumentSettings.patch({
                minPricePaid,
            }),
        });
    },
});

const nonZeroPriceOnly = computed({
    get: () => minPrice.value === 1,
    set: (paidOnly: boolean) => {
        minPrice.value = paidOnly ? 1 : 0;
    },
});

const paidOnly = computed({
    get: () => minPricePaid.value === 1,
    set: (paidOnly: boolean) => {
        minPricePaid.value = paidOnly ? 1 : 0;
    },
});

function setLinkedFields(linkedField: RecordSettings, recordIds: string[]) {
    const linkedFields = new PatchMap<string, string[]>(patchedDocument.value.settings.linkedFields);
    if (recordIds) {
        linkedFields.set(linkedField.id, recordIds);
    }
    else {
        linkedFields.delete(linkedField.id);
    }

    addPatch({
        settings: DocumentSettings.patch({
            linkedFields,
        }),
    });
}

function getLinkedFieldsChoices(field: RecordSettings) {
    const categories = recordCategoriesFor(field);
    const choices: { value: string; label: string; categories?: string[] }[] = [];

    // Default values

    // Registration
    if (field.type === RecordType.Price) {
        choices.push({
            value: 'registration.price',
            label: 'Te betalen bedrag',
            categories: ['Inschrijving'],
        });
        choices.push({
            value: 'registration.pricePaid',
            label: 'Betaald bedrag',
            categories: ['Inschrijving'],
        });
    }

    // todo: filter by type
    if (field.type === RecordType.Text) {
        choices.push({
            value: 'member.firstName',
            label: 'Voornaam',
            categories: ['Lid'],
        });
        choices.push({
            value: 'member.lastName',
            label: 'Achternaam',
            categories: ['Lid'],
        });
        choices.push({
            value: 'member.nationalRegisterNumber',
            label: 'Rijksregisternummer',
            categories: ['Lid'],
        });
    }
    if (field.type === RecordType.Address) {
        choices.push({
            value: 'member.address',
            label: 'Adres',
            categories: ['Lid'],
        });
    }
    if (field.type === RecordType.Date) {
        choices.push({
            value: 'member.birthDay',
            label: 'Geboortedatum',
            categories: ['Lid'],
        });
    }

    if (field.type === RecordType.Email) {
        choices.push({
            value: 'member.email',
            label: 'E-mailadres',
            categories: ['Lid'],
        });
    }

    // Parents
    if (field.type === RecordType.Text) {
        choices.push({
            value: 'parents[0].firstName',
            label: 'Voornaam',
            categories: ['Ouder 1'],
        });
        choices.push({
            value: 'parents[0].lastName',
            label: 'Achternaam',
            categories: ['Ouder 1'],
        });
        choices.push({
            value: 'parents[0].nationalRegisterNumber',
            label: 'Rijksregisternummer',
            categories: ['Ouder 1'],
        });
    }
    if (field.type === RecordType.Address) {
        choices.push({
            value: 'parents[0].address',
            label: 'Adres',
            categories: ['Ouder 1'],
        });
    }
    if (field.type === RecordType.Email) {
        choices.push({
            value: 'parents[0].email',
            label: 'E-mailadres',
            categories: ['Ouder 1'],
        });
    }

    if (field.type === RecordType.Text) {
        choices.push({
            value: 'parents[1].firstName',
            label: 'Voornaam',
            categories: ['Ouder 2'],
        });
        choices.push({
            value: 'parents[1].lastName',
            label: 'Achternaam',
            categories: ['Ouder 2'],
        });
        choices.push({
            value: 'parents[1].nationalRegisterNumber',
            label: 'Rijksregisternummer',
            categories: ['Ouder 2'],
        });
    }

    if (field.type === RecordType.Address) {
        choices.push({
            value: 'parents[1].address',
            label: 'Adres',
            categories: ['Ouder 2'],
        });
    }

    if (field.type === RecordType.Email) {
        choices.push({
            value: 'parents[1].email',
            label: 'E-mailadres',
            categories: ['Ouder 2'],
        });
    }

    for (const category of categories) {
        for (const record of category.records) {
            if (record.type === field.type) {
                choices.push({
                    value: record.id,
                    label: record.name,
                    categories: [category.name],
                });
            }
        }

        for (const childCat of category.childCategories) {
            for (const record of childCat.records) {
                if (record.type === field.type) {
                    choices.push({
                        value: record.id,
                        label: record.name,
                        categories: [category.name, childCat.name],
                    });
                }
            }
        }
    }
    return choices;
}

function getDefaultSupportedIds() {
    return [
        'organization.name',
        'organization.companyNumber',
        'organization.address',
        'registration.price',
        'registration.pricePaid',
        'member.firstName',
        'member.lastName',
        'member.address',
        'member.email',
        'member.birthDay',
        'member.nationalRegisterNumber',
        'debtor.firstName',
        'debtor.lastName',
        'debtor.address',
        'debtor.email',
        'debtor.nationalRegisterNumber',
        'parents[0].firstName',
        'parents[0].lastName',
        'parents[0].address',
        'parents[0].email',
        'parents[0].nationalRegisterNumber',
        'parents[1].firstName',
        'parents[1].lastName',
        'parents[1].address',
        'parents[1].email',
        'parents[1].nationalRegisterNumber',
    ];
}

function getAutoLinkingSuggestions(id: string) {
    // Force a mapping of certain fields to multiple or other fields
    const map: Record<string, string[]> = {

    };
    if (map[id]) {
        return map[id];
    }
    return [id];
}

function getLinkedFields(linkedField: RecordSettings) {
    return patchedDocument.value.settings.linkedFields.get(linkedField.id) ?? [];
}

function autoLink() {
    const linkedInside: Set<string> = new Set();
    const globalData = getDefaultGlobalData();
    for (const field of patchedDocument.value.privateSettings.templateDefinition.fieldCategories.flatMap(c => c.getAllRecords())) {
        if (recordAnswers.value.has(field.id) && !linkedInside.has(field.id)) {
            continue;
        }
        const d = globalData[field.id];
        if (d && d instanceof RecordAnswerDecoder.getClassForType(field.type)) {
            // add answer
            d.settings = field;
            linkedInside.add(field.id);

            patchAnswers(new PatchMap([[field.id, d]]));
        }
    }

    const supportedFields = getDefaultSupportedIds();

    for (const category of patchedDocument.value.privateSettings.templateDefinition.documentFieldCategories) {
        for (const field of category.getAllRecords()) {
            // Check supported
            if (supportedFields.includes(field.id)) {
                continue;
            }

            const existing = getLinkedFields(field);
            if (existing.length && !linkedInside.has(field.id)) {
                // Already linked
                continue;
            }
            const choices = getLinkedFieldsChoices(field);

            for (const choice of choices) {
                // Return the first record which category name and record name all contain each word of the field label
                const haystack = (choice.categories ?? []).join(' ') + ' ' + choice.label;
                const split = (category.name.trim() + ' ' + field.name.trim()).split(' ');
                if (split.length === 0) {
                    continue;
                }
                let found = true;
                for (const part of split) {
                    if (!StringCompare.contains(haystack, part)) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    setLinkedFields(field, [...getLinkedFields(field), choice.value]);
                    linkedInside.add(field.id);
                }
            }
            const suggestions = getAutoLinkingSuggestions(field.id);

            for (const id of suggestions) {
                for (const choice of choices) {
                    if (choice.value === id) {
                        setLinkedFields(field, [...getLinkedFields(field), choice.value]);
                        linkedInside.add(field.id);
                        break;
                    }
                }
            }
        }
    }
}

const title = props.isNew ? 'Nieuw document' : 'Document bewerken';

const name = computed({
    get: () => patchedDocument.value.settings.name,
    set: (name: string) => {
        addPatch({
            settings: DocumentSettings.patch({
                name,
            }),
        });
    },
});

function getDefaultGlobalData(): Record<string, RecordAnswer> {
    return {
        'organization.name': RecordTextAnswer.create({
            settings: RecordSettings.create({}), // settings will be overwritten
            value: organization.value.name,
        }),
        'organization.companyNumber': RecordTextAnswer.create({
            settings: RecordSettings.create({}), // settings will be overwritten
            value: organization.value.meta.companies[0]?.companyNumber ?? '',
        }),
        'organization.address': RecordAddressAnswer.create({
            settings: RecordSettings.create({}), // settings will be overwritten
            address: organization.value.address,
        }),
    };
}

async function loadHtml(type: string) {
    loadingHtml.value = true;

    console.log('loadHtml', type);
    const imported = ((await import(`./templates/${type}.html?raw`)).default);
    if (typeof imported !== 'string') {
        throw new Error('Imported attest html is not a string');
    }
    addPatch({
        html: imported,
    });
    loadingHtml.value = false;
}

async function loadXML(type: string) {
    loadingXml.value = true;
    const imported = ((await import(`./templates/${type}.xml?raw`)).default);
    if (typeof imported !== 'string') {
        throw new Error('Imported attest xml is not a string');
    }

    addPatch({
        privateSettings: DocumentPrivateSettings.patch({
            templateDefinition: DocumentTemplateDefinition.patch({
                xmlExport: imported,
            }),
        }),
    });

    loadingXml.value = false;
}

const isBelgium = computed(() => organization.value.address.country === Country.Belgium);

const availableTypes = computed(() => {
    if (isBelgium.value) {
        return [
            {
                value: fiscal.type,
                definition: fiscal,
            },
            {
                value: participation.type,
                definition: participation,
            },
        ];
    }
    return [
        {
            value: participation.type,
            definition: participation,
        },
    ];
});

function recordCategoriesFor(field: RecordSettings) {
    const type = field.type;
    return RecordCategory.filterRecordsWith(organization.value.meta.recordsConfiguration.recordCategories, record => record.type === type);
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

async function gotoGroupRecordCategory(group: DocumentTemplateGroup, actions: NavigationActions, index: number) {
    // Check already added this group
    if (patchedDocument.value.privateSettings.groups.find(g => g.group.id === group.group.id)) {
        throw new SimpleError({
            code: 'already_added',
            message: 'Deze inschrijvingen werden al toegevoegd',
        });
    }

    if (index >= patchedDocument.value.privateSettings.templateDefinition.groupFieldCategories.length) {
        addPatch({
            privateSettings: DocumentPrivateSettings.patch({
                groups: patchedDocument.value.privateSettings.groups.concat(group),
            }),
        });
        await actions.dismiss({ force: true }).catch(console.error);
        return;
    }
    const category = patchedDocument.value.privateSettings.templateDefinition.groupFieldCategories[index];
    await actions.show({
        components: [
            new ComponentWithProperties(FillRecordCategoryView, {
                category,
                value: group,
                forceMarkReviewed: true,
                saveHandler: (fieldAnswers: PatchAnswers, actions: NavigationActions) => {
                    const g = group.patch({
                        fieldAnswers,
                    });
                    gotoGroupRecordCategory(g, actions, index + 1).catch(console.error);
                },
                patchHandler: (fieldAnswers: PatchAnswers) => {
                    return group.patch({
                        fieldAnswers,
                    });
                },
            }),
        ],
    });
}

async function addGroup() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ChooseDocumentTemplateGroup, {
                    fieldCategories: patchedDocument.value.privateSettings.templateDefinition.groupFieldCategories,
                    addGroup: async (group: DocumentTemplateGroup, actions: NavigationActions) => {
                        await gotoGroupRecordCategory(group, actions, 0);
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function updateGroupAnswers(group: DocumentTemplateGroup) {
    const c = gotoRecordCategory(group, 0);
    if (!c) {
        return;
    }
    return present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: c,
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

function gotoRecordCategory(group: DocumentTemplateGroup, index: number) {
    if (index >= patchedDocument.value.privateSettings.templateDefinition.groupFieldCategories.length) {
        const groups = patchedDocument.value.privateSettings.groups.filter(g => g.group.id !== group.group.id);
        groups.push(group);

        addPatch({
            privateSettings: DocumentPrivateSettings.patch({
                groups,
            }),
        });

        return;
    }

    const category = patchedDocument.value.privateSettings.templateDefinition.groupFieldCategories[index];
    return new ComponentWithProperties(FillRecordCategoryView, {
        category,
        forceMarkReviewed: true,
        value: group,
        patchHandler: (fieldAnswers: PatchAnswers) => {
            return group.patch({
                fieldAnswers,
            });
        },
        saveHandler: (fieldAnswers: PatchAnswers, actions: NavigationActions) => {
            const g = group.patch({
                fieldAnswers,
            });
            const c = gotoRecordCategory(g, index + 1);
            if (!c) {
                actions.dismiss({ force: true }).catch(console.error);
                return;
            }
            actions.show(c).catch(console.error);
        },
    });
}

function removeGroup(group: DocumentTemplateGroup) {
    addPatch({
        privateSettings: DocumentPrivateSettings.patch({
            groups: patchedDocument.value.privateSettings.groups.filter(g => g !== group),
        }),
    });
}

function validate() {
    const errors = new SimpleErrors();

    if (patchedDocument.value.settings.name.length === 0) {
        errors.addError(new SimpleError({
            code: 'invalid_field',
            field: 'name',
            message: 'Vul een naam in voor het document',
        }));
    }

    errors.throwIfNotEmpty();
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;
    errors.errorBox = null;

    try {
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }

        validate();
        const patch: PatchableArrayAutoEncoder<DocumentTemplatePrivate> = new PatchableArray() as PatchableArrayAutoEncoder<DocumentTemplatePrivate>;

        if (props.isNew) {
            patch.addPut(patchedDocument.value);
        }
        else {
            patchDocument.value.id = patchedDocument.value.id;
            patch.addPatch(patchDocument.value);
        }

        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization/document-templates',
            body: patch,
            decoder: new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>),
            shouldRetry: false,
            timeout: 5 * 60 * 1000,
            owner: requestOwner,
        });
        const updatedDocument = response.data[0];
        if (updatedDocument) {
            patchDocument.value = DocumentTemplatePrivate.patch({});
            props.document.set(updatedDocument);
        }

        // TODO: open document
        dismiss({ force: true }).catch(console.error);
        if (props.callback) {
            props.callback(props.document);
        }
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

function cloneMap<K, T extends AutoEncoder>(map: Map<K, T>): Map<K, T> {
    return new Map([...map.entries()]
        .map(([key, value]) => [key, value.clone()]));
}

defineExpose({
    shouldNavigateAway,
});

async function downloadHtml() {
    const saveAs = (await import('file-saver')).default.saveAs;
    const blob = new Blob([patchedDocument.value.html], { type: 'pplication/octet-stream' });
    saveAs(blob, Formatter.fileSlug(editingType.value ?? 'unknown') + '.html');
}

async function changedFile(event: InputEvent & { target: HTMLInputElement & { files: FileList } }) {
    if (!event.target.files || event.target.files.length === 0) {
        return;
    }

    if (event.target.files.length > 1) {
        const error = 'Je kan maar één HTML-bestand toevoegen.';
        Toast.error(error).setHide(20 * 1000).show();
        return;
    }

    for (const file of event.target.files as FileList) {
        if (file.size > 1 * 1024 * 1024) {
            const error = 'HTML-bestanden groter dan 1MB kunnen niet worden gebruikt.';
            Toast.error(error).setHide(20 * 1000).show();
            continue;
        }

        const htmlContents = await file.text();
        addPatch({
            html: htmlContents,
        });

        Toast.success('HTML-bestand succesvol geüpload').setHide(10 * 1000).show();
    }

    // Clear selection
    (event.target as any).value = null;
}
</script>
