<template>
    <SaveView :title="title" :loading="saving" :disabled="!isComplete" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox v-if="isNew" error-fields="type" :error-box="errors.errorBox" :title="$t(`50807c89-d15f-4a2e-b8c7-95932d5aa5c8`)">
            <LoadingButton :loading="loadingHtml || loadingXml">
                <Dropdown v-model="editingType" error-fields="type">
                    <option :value="null" disabled>
                        {{ $t('569d1c4a-9389-47dd-9acb-930419271276') }}
                    </option>
                    <option v-for="_type in availableTypes" :key="_type.value ?? _type.definition.name" :value="_type.value">
                        {{ _type.definition.name }}
                    </option>
                </Dropdown>
            </LoadingButton>
        </STInputBox>

        <STInputBox :title="$t('Kalenderjaar')" error-fields="year" :error-box="errors.errorBox">
            <NumberInput v-model="year" :title="$t('Kalenderjaar')" :validator="errors.validator" :min="0" :stepper="!hasGroups" :disabled="hasGroups" />
        </STInputBox>
        <p v-if="hasGroups" class="style-description-small">
            {{ $t('Je kan het kalenderjaar niet wijzigen nadat je inschrijvingen geselecteerd hebt.') }}
        </p>

        <template v-if="(editingType || !isNew)">
            <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
                <input v-model="name" class="input" type="text" :placeholder="$t(`2fe38a3a-0041-4724-869e-4a5b55634380`)">
            </STInputBox>

            <div v-for="category of fieldCategories.filter(c => c.filterRecords(patchedDocument).filter(record => isDocumentFieldEditable(record)).length > 0)" :key="category.id" class="container">
                <hr><h2>{{ category.name }}</h2>
                <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

                <RecordAnswerInput v-for="record of category.filterRecords(patchedDocument).filter(record => isDocumentFieldEditable(record))" :key="record.id" :record="record" :answers="recordAnswers" :validator="errors.validator" :mark-reviewed="true" @patch="patchAnswers" />
            </div>

            <div v-for="category of documentFieldCategories" :key="category.id" class="container">
                <hr><h2>{{ $t('0f3c0101-6c9a-43e2-8b9f-6f65585ce05e') }} {{ category.name }}</h2>
                <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

                <p class="info-box">
                    {{ $t('39d0d9ca-2f37-40b6-84a4-51fb29b4cce6') }}
                </p>

                <MultiSelectInput v-for="field of category.getAllRecords().filter(r => isDocumentFieldEditable(r))" :key="field.id" class="max" :title="field.name" :error-fields="field.id" :error-box="errors.errorBox" :model-value="getLinkedFields(field)" :choices="getLinkedFieldsChoices(field)" :placeholder="$t(`358e6e0b-9736-4cc8-9f96-99583880d15c`)" @update:model-value="setLinkedFields(field, $event)" />
            </div>

            <hr><h2>{{ $t('95ac7564-3fdd-4427-be59-51fd02606b76') }}</h2>
            <p>{{ $t('1fd616a7-b465-480a-9777-dc036e7b2a08') }}</p>

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
                    <span>{{ $t('d40bb85c-53b9-4b93-be82-9fa7e2f6a11c') }}</span>
                </button>
            </p>

            <template v-if="patchedDocument.privateSettings.templateDefinition.allowChangingMaxAge">
                <hr><h2>{{ $t('260a3c1e-5e4f-464e-b380-ea6f4022bc91') }}</h2>
                <STInputBox error-fields="maxAge" :error-box="errors.errorBox" :title="$t(`8c4df8c5-1ed9-402b-aedd-f4bcd940ca34`)">
                    <NumberInput v-model="maxAge" :required="false" suffix="jaar" :placeholder="$t(`45ff02db-f404-4d91-853f-738d55c40cb6`)" />
                </STInputBox>
            </template>

            <template v-if="patchedDocument.privateSettings.templateDefinition.allowChangingMinPrice">
                <hr><h2>{{ $t('a023893e-ab2c-4215-9981-76ec16336911') }}</h2>
                <Checkbox v-model="nonZeroPriceOnly">
                    {{ $t('30c6addd-ebd7-470e-8f9b-e115d5e86820') }}
                </Checkbox>
            </template>

            <template v-if="patchedDocument.privateSettings.templateDefinition.allowChangingMinPricePaid">
                <hr><h2>{{ $t('1c1933f1-fee4-4e7d-9c89-57593fd5bed3') }}</h2>
                <Checkbox v-model="paidOnly">
                    {{ $t('a7ea9da5-e3d3-4253-b7f5-b90fbdeb83dc') }}
                </Checkbox>
            </template>

            <template v-if="auth.hasPlatformFullAccess()">
                <hr><h2>{{ $t('6a11d3a7-6348-4aca-893e-0f026e5eb8b0') }}</h2>

                <STList>
                    <CheckboxListItem v-model="useCustomHtml" :label="$t(`e5f05c4e-be30-4a28-85a3-939038fb12a7`)" :description="$t(`db4e01e7-911a-4b58-b242-068f887851f7`)">
                        <div v-if="useCustomHtml" class="style-button-bar">
                            <button class="button text" type="button" @click="downloadHtml">
                                <span class="icon download" />
                                <span>
                                    {{ $t('51190e58-cb85-4d12-b276-937d5514ccfd') }}
                                </span>
                            </button>

                            <label class="button text">
                                <span class="icon sync" />
                                <span>
                                    {{ $t('b7c71a71-9523-4748-a6cd-80b9314b05b2') }}
                                </span>

                                <input type="file" multiple="true" style="display: none;" accept=".html, text/html" @change="(event) => changedFile(event as any)"></label>
                        </div>
                    </CheckboxListItem>
                </STList>
            </template>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder, PatchMap } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, CheckboxListItem, Dropdown, ErrorBox, FillRecordCategoryView, LoadingButton, MultiSelectInput, NavigationActions, NumberInput, RecordAnswerInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, useAuth, useContext, useDocumentTemplatesObjectFetcher, useErrors, usePatch, useRequiredOrganization } from '@stamhoofd/components';
import { AppManager, useRequestOwner } from '@stamhoofd/networking';
import { CountFilteredRequest, Country, DocumentPrivateSettings, DocumentSettings, DocumentTemplateDefinition, DocumentTemplateGroup, DocumentTemplatePrivate, PatchAnswers, RecordAddressAnswer, RecordAnswer, RecordAnswerDecoder, RecordCategory, RecordChoice, RecordChooseOneAnswer, RecordSettings, RecordTextAnswer, RecordType, TranslatedString } from '@stamhoofd/structures';
import { FiscalDocumentHelper, Formatter, StringCompare } from '@stamhoofd/utility';
import { computed, onMounted, ref, watch } from 'vue';

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
const fiscalDocumentHelper = new FiscalDocumentHelper();

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

const hasGroups = computed(() => (patchedDocument.value?.privateSettings?.groups?.length ?? 0) > 0);

const year = computed({
    get: () => patchedDocument.value?.year,
    set: (value: number) => {
        addPatch({
            year: value,
        });
    },
});

const fetcher = useDocumentTemplatesObjectFetcher();
const yearsWithFiscalDocumentsCache = ref(new Set<number>());

async function doesYearAlreadyHaveFiscalDocument(year: number) {
    if (yearsWithFiscalDocumentsCache.value.has(year)) {
        return true;
    }

    const count = await fetcher.fetchCount(
        new CountFilteredRequest({
            filter: {
                $and: [
                    { year },
                    { type: fiscal.type },
                    { id: {
                        $not: patchedDocument.value.id,
                    },
                    },
                ],
            },
        }),
    );

    if (count > 0) {
        yearsWithFiscalDocumentsCache.value.add(year);
        return true;
    }

    return false;
}

function validateYearSync(value: number = year.value): SimpleError | null {
    const isFiscal = editingType.value === fiscal.type;

    if (isFiscal) {
        if (value === fiscalDocumentHelper.year && !fiscalDocumentHelper.canCreateFiscalDocumentForCurrentYear) {
            return new SimpleError({
                code: 'invalid_year',
                field: 'year',
                message: $t('Je kan pas vanaf november een fiscaal attest maken voor het huidige jaar.'),
            });
        }

        if (value > fiscalDocumentHelper.year) {
            return new SimpleError({
                code: 'invalid_year',
                field: 'year',
                message: $t('Je kan geen fiscaal attest maken voor een kalenderjaar dat nog niet is gestart.'),
            });
        }

        /**
         * Throw an error if the fiscal year (= year after calendar year) is over for the calendar year.
         * Example 1:
         * current year = 2025
         * value = 2024
         * fiscal year = 2025 -> no error (because fiscal year is not over)
         *
         * Example 2:
         * current year = 2025
         * value = 2023
         * fiscal year = 2024 -> error (because fiscal year is over)
         */
        const fiscalYear = value + 1;
        if (fiscalYear < fiscalDocumentHelper.year) {
            return new SimpleError({
                code: 'invalid_year',
                field: 'year',
                message: $t('Je kan geen fiscaal attest meer aanmaken voor dit kalenderjaar, omdat het bijhorende aanslagjaar in de personenbelasting al is afgesloten.'),
            });
        }
    }

    return null;
}

async function validateYearAsync(value: number = year.value): Promise<SimpleError | null> {
    // first check synchronous error
    const error = validateYearSync(value);
    if (error) {
        return error;
    }

    const isFiscal = editingType.value === fiscal.type;

    if (isFiscal) {
        if (await doesYearAlreadyHaveFiscalDocument(value)) {
            return new SimpleError({
                code: 'double_fiscal_document',
                field: 'year',
                message: $t('Je kan maximaal 1 fiscaal attest per kalenderjaar maken. Er is al een fiscaal attest voor dit jaar.'),
            });
        }
    }

    return null;
}

watch(() => [year.value, editingType.value] as [number, string | null], async ([value]) => {
    const yearError = await validateYearAsync(value);
    if (yearError) {
        errors.errorBox = new ErrorBox(yearError);
    }
    else {
        errors.errorBox = null;
    }
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
    get: () => minPrice.value === 1_00,
    set: (paidOnly: boolean) => {
        minPrice.value = paidOnly ? 1_00 : 0;
    },
});

const paidOnly = computed({
    get: () => minPricePaid.value === 1_00,
    set: (paidOnly: boolean) => {
        minPricePaid.value = paidOnly ? 1_00 : 0;
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
                    label: record.name.toString(),
                    categories: [category.name.toString()],
                });
            }
        }

        for (const childCat of category.childCategories) {
            for (const record of childCat.records) {
                if (record.type === field.type) {
                    choices.push({
                        value: record.id,
                        label: record.name.toString(),
                        categories: [category.name.toString(), childCat.name.toString()],
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
        'organization.companyAddress',
        'organization.companyName',
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
        if (isDocumentFieldEditable(field)) {
            if (recordAnswers.value.has(field.id) && !linkedInside.has(field.id)) {
                continue;
            }
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
    const b: Record<string, RecordAnswer> = {
        'organization.name': RecordTextAnswer.create({
            settings: RecordSettings.create({}), // settings will be overwritten
            value: organization.value.name,
        }),
        'organization.companyName': RecordTextAnswer.create({
            settings: RecordSettings.create({}),
            value: organization.value.meta.companies[0]?.name || organization.value.name,
        }),
        'organization.companyNumber': RecordTextAnswer.create({
            settings: RecordSettings.create({}), // settings will be overwritten
            value: organization.value.meta.companies[0]?.companyNumber ?? '',
        }),
        'organization.address': RecordAddressAnswer.create({
            settings: RecordSettings.create({}), // settings will be overwritten
            address: organization.value.address,
        }),
        'organization.companyAddress': RecordAddressAnswer.create({
            settings: RecordSettings.create({}), // settings will be overwritten
            address: organization.value.meta.companies[0]?.address ?? organization.value.address,
        }),
    };

    if (STAMHOOFD.translationNamespace === 'keeo') {
        b['certification.type'] = RecordChooseOneAnswer.create({
            settings: RecordSettings.create({}), // settings will be overwritten
            selectedChoice: RecordChoice.create({
                id: 'authorities',
                name: TranslatedString.create('Gemeenten, gemeenschappen of gewesten'),
                description: TranslatedString.create('is vergund, erkend, gesubsidieerd of gecontroleerd door de lokale openbare besturen of openbare besturen van de gemeenschappen of gewesten'),
            }),
        });
    }

    return b;
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
            }),
        ],
    });
}

async function addGroup() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ChooseDocumentTemplateGroup, {
                    year: year.value,
                    documentType: editingType.value,
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

async function validate() {
    const errors = new SimpleErrors();

    const yearError = await validateYearAsync();
    if (yearError) {
        errors.addError(yearError);
    }

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
        await validate();

        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }

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

defineExpose({
    shouldNavigateAway,
});

async function downloadHtml() {
    const blob = new Blob([patchedDocument.value.html], { type: 'text/html' });
    await AppManager.shared.downloadFile(blob, Formatter.fileSlug(editingType.value ?? 'unknown') + '.html');
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
