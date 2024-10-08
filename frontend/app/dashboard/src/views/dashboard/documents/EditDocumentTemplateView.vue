<template>
    <SaveView :title="title" :loading="saving" :disabled="!isComplete" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox v-if="isNew" title="Type document" error-fields="type" :error-box="errorBox">
            <LoadingButton :loading="loadingHtml || loadingXml">
                <Dropdown v-model="editingType">
                    <option :value="null" disabled>
                        Maak een keuze
                    </option>
                    <option v-for="_type in availableTypes" :key="_type.value" :value="_type.value">
                        {{ _type.definition.name }}
                    </option>
                </Dropdown>
            </LoadingButton>
        </STInputBox>
        <template v-if="editingType || !isNew">
            <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                <input
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Naam document"
                >
            </STInputBox>

            <!-- Depending on the selected definition, we'll display all the required fields here -->
            <div v-for="category of fieldCategories" :key="category.id" class="container">
                <hr>
                <h2>{{ category.name }}</h2>
                <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

                <RecordAnswerInput
                    v-for="record of category.filterRecords(patchedDocument)"
                    :key="record.id"
                    :record="record"
                    :answers="patchedDocument.getRecordAnswers()"
                    :validator="validator"
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

                <MultiSelectInput v-for="field of category.getAllRecords()" :key="field.id" class="max" :title="field.name" :error-fields="field.id" :error-box="errorBox" :model-value="getLinkedFields(field)" :choices="getLinkedFieldsChoices(field)" placeholder="Niet gekoppeld" @update:model-value="setLinkedFields(field, $event)" />
            </div>

            <hr>
            <h2>Inschrijvingsgroepen</h2>
            <p>Kies de inschrijvingsgroepen waarvoor je dit attest wil aanmaken.</p>

            <STList v-if="patchedDocument.privateSettings.groups.length">
                <STListItem v-for="group of patchedDocument.privateSettings.groups" :key="group.id" :selectable="true" @click="updateGroupAnswers(group)">
                    <h2 class="style-list-title">
                        {{ getGroupName(group) }}
                    </h2>
                    <p class="style-description-small pre-wrap" v-text="getGroupDescription(group)" />

                    <template #right>
                        <button class="button icon text trash" type="button" @click="removeGroup(group)" />
                    </template>
                </STListItem>
            </STList>
            <p>
                <button type="button" class="button text" @click="addGroup">
                    <span class="icon add" />
                    <span>Inschrijvingsgroep toevoegen</span>
                </button>
            </p>

            <hr>
            <h2>Leeftijdsbeperking</h2>
            <STInputBox title="Maximum leeftijd" error-fields="maxAge" :error-box="errorBox">
                <NumberInput v-model="maxAge" placeholder="Geen" :required="false" suffix="jaar" />
            </STInputBox>

            <hr>
            <h2>Bedrag</h2>
            <Checkbox v-model="paidOnly">
                Enkel aanmaken indien gekoppelde prijs groter is dan 0 euro
            </Checkbox>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop, Watch } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, Checkbox, Dropdown, ErrorBox, FillRecordCategoryView, LoadingButton, MultiSelectInput, NumberInput, RecordAnswerInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from '@stamhoofd/components';
import { AppManager } from '@stamhoofd/networking';
import { Country, DocumentPrivateSettings, DocumentSettings, DocumentTemplateDefinition, DocumentTemplateGroup, DocumentTemplatePrivate, PatchAnswers, RecordAddressAnswer, RecordAnswer, RecordAnswerDecoder, RecordCategory, RecordSettings, RecordTextAnswer, RecordType, Version } from '@stamhoofd/structures';
import { StringCompare } from '@stamhoofd/utility';

import ChooseDocumentTemplateGroup from './ChooseDocumentTemplateGroup.vue';
import { fiscal } from './definitions/fiscal';
import { participation } from './definitions/participation';

@Component({
    components: {
        STList,
        STListItem,
        SaveView,
        STInputBox,
        Dropdown,
        RecordAnswerInput,
        NumberInput,
        STErrorsDefault,
        MultiSelectInput,
        LoadingButton,
        Checkbox,
    },
})
export default class EditDocumentTemplateView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    isNew!: boolean;

    @Prop({ required: true })
    document!: DocumentTemplatePrivate;

    @Prop({ required: false, default: null })
    callback!: ((template: DocumentTemplatePrivate) => void) | null;

    type: string | null = null;

    patchDocument = DocumentTemplatePrivate.patch({});
    validator = new Validator();
    errorBox: ErrorBox | null = null;
    saving = false;
    editingAnswers = this.document.settings.fieldAnswers.map(a => a.clone());

    loadingHtml = false;
    loadingXml = false;

    get patchedDocument() {
        return this.document.patch(this.patchDocument);
    }

    get fieldCategories() {
        return RecordCategory.flattenCategories(this.patchedDocument.privateSettings.templateDefinition.fieldCategories, this.patchedDocument);
    }

    get documentFieldCategories() {
        return this.patchedDocument.privateSettings.templateDefinition.documentFieldCategories;
    }

    mounted() {
        // temporary!
        if (!this.isNew && !AppManager.shared.isNative) {
            // Force update of html etc
            this.editingType = this.patchedDocument?.privateSettings?.templateDefinition?.type ?? null;
        }
    }

    @Watch('editingAnswers')
    saveAnswers() {
        this.patchDocument = this.patchDocument.patch({
            settings: DocumentSettings.patch({
                fieldAnswers: this.editingAnswers as any,
            }),
        });
    }

    patchAnswers(patch: PatchAnswers) {
        this.patchDocument = this.patchDocument.patch({
            settings: DocumentSettings.patch({
                fieldAnswers: patch,
            }),
        });
    }

    get isComplete() {
        return !!this.patchedDocument.html && (!!this.patchedDocument.privateSettings.templateDefinition.xmlExport || !this.patchedDocument.privateSettings.templateDefinition.xmlExportDescription);
    }

    get editingType() {
        return this.type;
    }

    set editingType(type: string | null) {
        this.type = type;
        if (type) {
            const definition = this.availableTypes.find(t => t.value === type)?.definition;
            if (definition) {
                console.log('set definition', definition);
                this.patchDocument = this.patchDocument.patch({
                    privateSettings: DocumentPrivateSettings.patch({
                        templateDefinition: definition,
                    }),
                    settings: DocumentSettings.patch({
                        name: this.patchedDocument.settings.name || definition.name,
                        maxAge: this.patchedDocument.settings.maxAge ?? definition.defaultMaxAge,
                        minPrice: this.patchedDocument.settings.minPrice ?? definition.defaultMinPrice,
                    }),
                });
                this.autoLink();
                this.loadHtml(type).catch((e) => {
                    console.error(e);

                    new Toast('Er ging iets mis bij het laden van dit document type. Controleer jouw internetverbinding en probeer de pagina opnieuw te laden.', 'error red').setHide(null).show();
                });

                if (definition.xmlExportDescription) {
                    this.loadXML(type).catch((e) => {
                        console.error(e);

                        new Toast('Er ging iets mis bij het laden van dit document type. Controleer jouw internetverbinding en probeer de pagina opnieuw te laden.', 'error red').setHide(null).show();
                    });
                }
            }
        }
    }

    get maxAge() {
        return this.patchedDocument.settings.maxAge;
    }

    set maxAge(age: number | null) {
        this.patchDocument = this.patchDocument.patch({
            settings: DocumentSettings.patch({
                maxAge: age,
            }),
        });
    }

    get minPrice() {
        return this.patchedDocument.settings.minPrice;
    }

    set minPrice(minPrice: number | null) {
        this.patchDocument = this.patchDocument.patch({
            settings: DocumentSettings.patch({
                minPrice,
            }),
        });
    }

    get paidOnly() {
        return this.minPrice === 1;
    }

    set paidOnly(paidOnly: boolean) {
        this.minPrice = paidOnly ? 1 : 0;
    }

    setLinkedFields(linkedField: RecordSettings, recordIds: string[]) {
        const linkedFields = new Map<string, string[]>(this.patchedDocument.settings.linkedFields);
        if (recordIds) {
            linkedFields.set(linkedField.id, recordIds);
        }
        else {
            linkedFields.delete(linkedField.id);
        }

        this.patchDocument = this.patchDocument.patch({
            settings: DocumentSettings.patch({
                linkedFields,
            }),
        });
    }

    getLinkedFieldsChoices(field: RecordSettings) {
        const categories = this.recordCategoriesFor(field);
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

    getAutoLinkingSuggestions(id: string) {
        // Force a mapping of certain fields to multiple or other fields
        const map = {
            'member.address': [
                'member.address',
                'parents[0].address',
                'parents[1].address',
            ],
            'member.email': [
                'member.email',
                'parents[0].email',
                'parents[1].email',
            ],
            'debtor.firstName': [
                'parents[0].firstName',
                'parents[1].firstName',
            ],
            'debtor.lastName': [
                'parents[0].lastName',
                'parents[1].lastName',
            ],
            'debtor.address': [
                'parents[0].address',
                'parents[1].address',
            ],
        };
        if (map[id]) {
            return map[id];
        }
        return [id];
    }

    getLinkedFields(linkedField: RecordSettings) {
        return this.patchedDocument.settings.linkedFields.get(linkedField.id) ?? [];
    }

    autoLink() {
        const linkedInside: Set<string> = new Set();
        const globalData = this.getDefaultGlobalData();
        for (const field of this.patchedDocument.privateSettings.templateDefinition.fieldCategories.flatMap(c => c.getAllRecords())) {
            if (this.editingAnswers.find(a => a.settings.id === field.id) && !linkedInside.has(field.id)) {
                continue;
            }
            const d = globalData[field.id];
            if (d && d instanceof RecordAnswerDecoder.getClassForType(field.type)) {
                // add answer
                d.settings = field;
                this.editingAnswers.push(d);
                linkedInside.add(field.id);
            }
        }

        for (const category of this.patchedDocument.privateSettings.templateDefinition.documentFieldCategories) {
            for (const field of category.getAllRecords()) {
                const existing = this.getLinkedFields(field);
                if (existing.length && !linkedInside.has(field.id)) {
                    // Already linked
                    continue;
                }
                const choices = this.getLinkedFieldsChoices(field);

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
                        this.setLinkedFields(field, [...this.getLinkedFields(field), choice.value]);
                        linkedInside.add(field.id);
                    }
                }
                const suggestions = this.getAutoLinkingSuggestions(field.id);

                for (const id of suggestions) {
                    for (const choice of choices) {
                        if (choice.value === id) {
                            this.setLinkedFields(field, [...this.getLinkedFields(field), choice.value]);
                            linkedInside.add(field.id);
                            break;
                        }
                    }
                }
            }
        }
    }

    get title() {
        return this.isNew ? 'Nieuw document' : 'Document bewerken';
    }

    get name() {
        return this.patchedDocument.settings.name;
    }

    set name(name: string) {
        this.patchDocument = this.patchDocument.patch({
            settings: DocumentSettings.patch({
                name,
            }),
        });
    }

    isLinkedFieldDefault(field: RecordSettings) {
        return this.defaultData.includes(field.id);
    }

    get defaultData() {
        // The backend knows how to link these fields automatically
        return [
            'registration.price',
            'member.firstName',
            'member.lastName',
            'member.address',
            'member.birthDay',
        ];
    }

    get organization() {
        return this.$organization;
    }

    getDefaultGlobalData() {
        return {
            'organization.name': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: this.organization.name,
            }),
            'organization.companyNumber': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: this.organization.meta.companyNumber,
            }),
            'organization.address': RecordAddressAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                address: this.organization.address,
            }),
        };
    }

    async loadHtml(type: string) {
        this.loadingHtml = true;

        console.log('loadHtml', type);
        const imported = ((await import(/* webpackChunkName: "attest-html" */ './templates/' + type + '.html?raw')).default);
        if (typeof imported !== 'string') {
            throw new Error('Imported attest html is not a string');
        }
        this.patchDocument = this.patchDocument.patch({
            html: imported,
        });
        this.loadingHtml = false;
    }

    async loadXML(type: string) {
        this.loadingXml = true;
        const imported = ((await import(/* webpackChunkName: "attest-html" */ './templates/' + type + '.xml?raw')).default);
        if (typeof imported !== 'string') {
            throw new Error('Imported attest xml is not a string');
        }
        this.patchDocument = this.patchDocument.patch({
            privateSettings: DocumentPrivateSettings.patch({
                templateDefinition: DocumentTemplateDefinition.patch({
                    xmlExport: imported,
                }),
            }),
        });
        this.loadingXml = false;
    }

    get isBelgium() {
        return this.organization.address.country === Country.Belgium;
    }

    get availableTypes() {
        if (this.isBelgium) {
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
    }

    recordCategoriesFor(field: RecordSettings) {
        const type = field.type;
        return RecordCategory.filterRecordsWith(this.$organization.meta.recordsConfiguration.recordCategories, record => record.type === type);
    }

    get hasChanges() {
        return patchContainsChanges(this.patchDocument, this.document, { version: Version });
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
    }

    gotoGroupRecordCategory(group: DocumentTemplateGroup, component: NavigationMixin, index: number) {
        if (index >= this.patchedDocument.privateSettings.templateDefinition.groupFieldCategories.length) {
            this.patchDocument = this.patchDocument.patch({
                privateSettings: DocumentPrivateSettings.patch({
                    groups: this.patchedDocument.privateSettings.groups.concat(group),
                }),
            });
            component.dismiss({ force: true });
            return;
        }
        const category = this.patchedDocument.privateSettings.templateDefinition.groupFieldCategories[index];
        component.show({
            components: [
                new ComponentWithProperties(FillRecordCategoryView, {
                    category,
                    answers: group.fieldAnswers,
                    markReviewed: true,
                    dataPermission: true,
                    hasNextStep: index < this.patchedDocument.privateSettings.templateDefinition.groupFieldCategories.length - 1,
                    filterDefinitions: [],
                    saveHandler: (fieldAnswers: RecordAnswer[], component: NavigationMixin) => {
                        const g = group.patch({
                            fieldAnswers: fieldAnswers as any,
                        });
                        this.gotoGroupRecordCategory(g, component, index + 1);
                    },
                    filterValueForAnswers: (fieldAnswers: RecordAnswer[]) => {
                        return group.patch({
                            fieldAnswers: fieldAnswers as any,
                        });
                    },
                }),
            ],
        });
    }

    addGroup() {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ChooseDocumentTemplateGroup, {
                        fieldCategories: this.patchedDocument.privateSettings.templateDefinition.groupFieldCategories,
                        addGroup: (group: DocumentTemplateGroup, component: NavigationMixin) => {
                            this.gotoGroupRecordCategory(group, component, 0);
                        },
                    }),
                }),
            ],
            modalDisplayStyle: 'sheet',
        });
    }

    getGroupName(group: DocumentTemplateGroup) {
        const groups = this.$organization.groups;
        const g = groups.find(g => g.id === group.groupId);
        return g?.settings?.name ?? 'Onbekende groep';
    }

    getGroupDescription(group: DocumentTemplateGroup) {
        const groups = this.$organization.groups;
        const g = groups.find(g => g.id === group.groupId);
        const currentCycle = g?.cycle ?? 0;
        const cycleOffset = currentCycle - group.cycle;

        let period = cycleOffset + ' inschrijvingsperiodes geleden';
        if (cycleOffset === 0) {
            period = 'Huidige inschrijvingsperiode';
        }
        else if (cycleOffset === 1) {
            period = 'Vorige inschrijvingsperiode';
        }

        // Append answers
        return period + (group.fieldAnswers.length ? ('\n' + group.fieldAnswers.map(a => a.descriptionValue).join('\n')) : '');
    }

    updateGroupAnswers(group: DocumentTemplateGroup) {
        const c = this.gotoRecordCategory(group, 0);
        if (!c) {
            return;
        }
        return this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: c,
                }),
            ],
            modalDisplayStyle: 'sheet',
        });
    }

    gotoRecordCategory(group: DocumentTemplateGroup, index: number) {
        if (index >= this.patchedDocument.privateSettings.templateDefinition.groupFieldCategories.length) {
            const groups = this.patchedDocument.privateSettings.groups.filter(g => g.groupId !== group.groupId);
            groups.push(group);

            this.patchDocument = this.patchDocument.patch({
                privateSettings: DocumentPrivateSettings.patch({
                    groups,
                }),
            });
            return;
        }

        const category = this.patchedDocument.privateSettings.templateDefinition.groupFieldCategories[index];
        return new ComponentWithProperties(FillRecordCategoryView, {
            category,
            answers: group.fieldAnswers,
            dataPermission: true,
            hasNextStep: index < this.patchedDocument.privateSettings.templateDefinition.groupFieldCategories.length - 1,
            filterDefinitions: [],
            saveHandler: (fieldAnswers: RecordAnswer[], component: NavigationMixin) => {
                const g = group.patch({
                    fieldAnswers: fieldAnswers as any,
                });
                const c = this.gotoRecordCategory(g, index + 1);
                if (!c) {
                    component.dismiss({ force: true });
                    return;
                }
                component.show(c);
            },
            filterValueForAnswers: (fieldAnswers: RecordAnswer[]) => {
                return group.patch({
                    fieldAnswers: fieldAnswers as any,
                });
            },
        });
    }

    removeGroup(group: DocumentTemplateGroup) {
        this.patchDocument = this.patchDocument.patch({
            privateSettings: DocumentPrivateSettings.patch({
                groups: this.patchedDocument.privateSettings.groups.filter(g => g !== group),
            }),
        });
    }

    validate() {
        const errors = new SimpleErrors();

        if (this.patchedDocument.settings.name.length === 0) {
            errors.addError(new SimpleError({
                code: 'invalid_field',
                field: 'name',
                message: 'Vul een naam in voor het document',
            }));
        }

        errors.throwIfNotEmpty();
    }

    beforeUnmount() {
        Request.cancelAll(this);
    }

    async save() {
        if (this.saving) {
            return;
        }

        this.saving = true;
        this.errorBox = null;

        try {
            // Make sure answers are updated
            this.saveAnswers();

            if (!await this.validator.validate()) {
                this.saving = false;
                return;
            }

            this.validate();
            const patch: PatchableArrayAutoEncoder<DocumentTemplatePrivate> = new PatchableArray() as PatchableArrayAutoEncoder<DocumentTemplatePrivate>;

            if (this.isNew) {
                patch.addPut(this.patchedDocument);
            }
            else {
                this.patchDocument.id = this.patchedDocument.id;
                patch.addPatch(this.patchDocument);
            }

            const response = await this.$context.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/document-templates',
                body: patch,
                decoder: new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>),
                shouldRetry: false,
                timeout: 5 * 60 * 1000,
                owner: this,
            });
            const updatedDocument = response.data[0];
            if (updatedDocument) {
                this.editingAnswers = this.document.settings.fieldAnswers.map(a => a.clone());
                this.patchDocument = DocumentTemplatePrivate.patch({});
                this.document.set(updatedDocument);
            }

            // TODO: open document
            this.dismiss({ force: true });
            if (this.callback) {
                this.callback(this.document);
            }
        }
        catch (e) {
            console.error(e);
            this.errorBox = new ErrorBox(e);
        }

        this.saving = false;
    }
}
</script>
