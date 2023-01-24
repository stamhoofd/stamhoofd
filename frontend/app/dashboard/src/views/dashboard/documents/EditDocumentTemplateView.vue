<template>
    <SaveView :title="title" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p v-if="isNew" class="info-box">
            Momenteel is het enkel mogelijk om fiscale attesten voor kinderopvang te genereren. Lees alle informatie na via www.stamhoofd.be/docs/fiscaal-attest-kinderopvang/
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox v-if="isNew" title="Type document" error-fields="type" :error-box="errorBox">
            <Dropdown v-model="editingType">
                <option :value="null" disabled>
                    Maak een keuze
                </option>
                <option v-for="_type in availableTypes" :key="_type.value" :value="_type.value">
                    {{ _type.definition.name }}
                </option>
            </Dropdown>
        </STInputBox>
        <template v-if="editingType || !isNew">
            <!-- Depending on the selected definition, we'll display all the required fields here -->
            <div v-for="category of fieldCategories" :key="category.id" class="container">
                <hr>
                <h2>{{ category.name }}</h2>
                <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

                <RecordAnswerInput v-for="record of category.filterRecords(true)" :key="record.id" :record-settings="record" :record-answers="editingAnswers" :validator="validator" />
            </div>

            <!-- Display all the required linking -->
            <template v-if="patchedDocument.privateSettings.templateDefinition.linkedFields.length">
                <hr>
                <h2>Benodigde gegevens</h2>
                <p>Elk slim document bevat enkele invulvelden waarin automatisch bepaalde gegevens van leden ingevuld zullen worden. Aangezien je in Stamhoofd volledig zelf kan bepalen welke gegevens je van leden verzamelt, moet je hier aangeven met welke vragenlijst gegevens (= die je zelf hebt ingesteld bij Instellingen > Vragenlijsten) je die wilt koppelen. Ingebouwde gegevens (zoals de naam van een lid) hoef je niet te koppelen. Stamhoofd suggereert automatisch suggesties op basis van de naam, maar kan fout zijn. Kijk dus goed na.</p>
            
                <STInputBox v-for="field of patchedDocument.privateSettings.templateDefinition.linkedFields" :key="field.id" :title="field.name" :error-fields="field.id" :error-box="errorBox">
                    <Dropdown :value="getLinkedFieldLink(field)" @change="setLinkedFieldLink(field, $event)">
                        <option v-if="isLinkedFieldDefault(field)" :value="null">
                            Gebruik ingebouwde gegevens
                        </option>
                        <option :value="null" disabled>
                            Maak een keuze
                        </option>
                        <optgroup v-for="category in recordCategoriesFor(field)" :key="category.id" :label="category.name">
                            <option v-for="record in category.getAllRecords()" :key="record.id" :value="record.id">
                                {{ record.name }}
                            </option>
                        </optgroup>
                    </Dropdown>
                </STInputBox>
            </template>

            <hr>
            <h2>Inschrijvingsgroepen</h2>
            <p>Kies de inschrijvingsgroepen waarvoor je dit attest wil aanmaken.</p>
            
            <STList v-if="patchedDocument.privateSettings.groups.length">
                <STListItem v-for="group of patchedDocument.privateSettings.groups" :key="group.id">
                    <h2 class="style-list-title">
                        {{ getGroupName(group) }}
                    </h2>
                    <p class="style-description-small pre-wrap" v-text="getGroupDescription(group)" />

                    <button slot="right" class="button icon text trash" type="button" @click="removeGroup(group)" />
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
        </template>
    </SaveView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder,PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Dropdown, ErrorBox, NumberInput, RecordAnswerInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { DocumentPrivateSettings, DocumentSettings, DocumentTemplateDefinition, DocumentTemplateGroup, DocumentTemplatePrivate, RecordCategory, RecordSettings, RecordType } from "@stamhoofd/structures";
import { StringCompare } from "@stamhoofd/utility";
import { Component, Mixins, Prop, Watch } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import ChooseDocumentTemplateGroup from "./ChooseDocumentTemplateGroup.vue";

@Component({
    components: {
        STList,
        STListItem,
        SaveView,
        STInputBox,
        Dropdown,
        RecordAnswerInput,
        NumberInput,
        STErrorsDefault
    }
})
export default class EditDocumentTemplateView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        isNew!: boolean
    
    @Prop({ required: true })
        document!: DocumentTemplatePrivate

    type: string | null = null

    patchDocument = DocumentTemplatePrivate.patch({})
    validator = new Validator()
    errorBox: ErrorBox | null = null
    saving = false
    editingAnswers = this.document.settings.fieldAnswers.map(a => a.clone())
    get patchedDocument() {
        return this.document.patch(this.patchDocument)
    }

    get fieldCategories() {
        return this.patchedDocument.privateSettings.templateDefinition.fieldCategories
    }

    @Watch("editingAnswers")
    saveAnswers() {
        this.patchDocument = this.patchDocument.patch({
            settings: DocumentSettings.patch({
                fieldAnswers: this.editingAnswers as any
            })
        })
    }

    get editingType() {
        return this.type
    }

    set editingType(type: string | null) {
        this.type = type
        if (type) {
            const definition = this.availableTypes.find(t => t.value == type)?.definition
            if (definition) {
                this.patchDocument = this.patchDocument.patch({
                    privateSettings: DocumentPrivateSettings.patch({
                        templateDefinition: definition
                    }),
                    settings: DocumentSettings.patch({
                        maxAge: definition.defaultMaxAge
                    })
                })
                this.autoLink();
            }
        }
    }

    get maxAge() {
        return this.patchedDocument.settings.maxAge
    }

    set maxAge(age: number | null) {
        this.patchDocument = this.patchDocument.patch({
            settings: DocumentSettings.patch({
                maxAge: age
            })
        })
    }

    setLinkedFieldLink(linkedField: RecordSettings, recordId: string | null) {
        const linkedFields = new Map<string, string>(this.patchedDocument.settings.linkedFields)
        if (recordId) {
            linkedFields.set(linkedField.id, recordId)
        } else {
            linkedFields.delete(linkedField.id)
        }

        this.patchDocument = this.patchDocument.patch({
            settings: DocumentSettings.patch({
                linkedFields
            })
        })
    }

    getLinkedFieldLink(linkedField: RecordSettings) {
        return this.patchedDocument.settings.linkedFields.get(linkedField.id) ?? null
    }

    autoLink() {
        for (const field of this.patchedDocument.privateSettings.templateDefinition.linkedFields) {
            if (this.getLinkedFieldLink(field)) {
                // Already linked
                continue
            }
            if (this.isLinkedFieldDefault(field)) {
                // Already default
                continue
            }
            const categories = this.recordCategoriesFor(field)
            for (const category of categories) {
                const record = category.getAllRecords().find(r => {
                    // Return the first record which category name and record name all contain each word of the field label
                    const haystack = (category.name + " " + r.name + " " + r.description);
                    const split = field.name.trim().split(" ")
                    if (split.length === 0) {
                        return false;
                    }
                    for (const part of split) {
                        if (!StringCompare.contains(haystack, part)) {
                            return false
                        }
                    }
                    return true;
                })
                if (record) {
                    this.setLinkedFieldLink(field, record.id)
                }
            }
        }
    }

    get title() {
        return this.isNew ? "Nieuw document" : "Document bewerken"
    }

    isLinkedFieldDefault(field: RecordSettings) {
        return this.defaultData.includes(field.id)
    }

    get defaultData() {
        // The backend knows how to link these fields automatically
        return [
            "registration.price",
            "member.firstName",
            "member.lastName",
            "member.address",
            "member.birthDay",
        ];
    }

    get availableTypes() {
        return [
            {
                value: "fiscal",
                definition: DocumentTemplateDefinition.create({
                    name: "Fiscaal attest kinderopvang (281.86)",
                    defaultMaxAge: 14,
                    fieldCategories: [
                        RecordCategory.create({
                            name: "Certificeringsautoriteit",
                            description: "De instantie die de opvangsinstantie heeft vergund, erkend, gesubsidieerd, er een kwaliteitslabel heeft aan toegekend of die deze controleert of er toezicht op houdt of die is verbonden met de opvanginstantie in het geval van scholen of hun inrichtende machten.",
                            records: [
                                RecordSettings.create({
                                    id: "certification.name",
                                    name: "Naam",
                                    required: true,
                                    type: RecordType.Text
                                }),
                            ]
                        })
                    ],
                    groupFieldCategories: [
                        RecordCategory.create({
                            name: "Periode",
                            description: "Vul de exacte begin en einddatum van deze activiteit in. Voor de aangifte in 2023 mag je alleen activiteiten uit 2022 opnemen.",
                            records: [
                                RecordSettings.create({
                                    id: "registration.startDate",
                                    name: "Startdatum",
                                    required: true,
                                    type: RecordType.Date
                                }),
                                RecordSettings.create({
                                    id: "registration.endDate",
                                    name: "Einddatum",
                                    required: true,
                                    type: RecordType.Date
                                }),
                            ]
                        })
                    ],
                    linkedFields: [
                        RecordSettings.create({
                            id: "member.nationalRegistryNumber",
                            name: "Rijksregisternummer lid",
                            type: RecordType.Text
                        }),
                        RecordSettings.create({
                            id: "debtor.nationalRegistryNumber",
                            name: "Rijksregisternummer schuldenaar",
                            type: RecordType.Text
                        }),
                        RecordSettings.create({
                            id: "debtor.firstName",
                            name: "Voornaam schuldenaar",
                            type: RecordType.Text
                        }),
                        RecordSettings.create({
                            id: "debtor.lastName",
                            name: "Achternaam schuldenaar",
                            type: RecordType.Text
                        }),
                        RecordSettings.create({
                            id: "debtor.address",
                            name: "Adres schuldenaar",
                            type: RecordType.Address
                        }),
                        // Supported fields in Stamhoofd (todo: we'll catch this)
                        RecordSettings.create({
                            id: "member.firstName",
                            name: "Voornaam lid",
                            type: RecordType.Text
                        }),
                        RecordSettings.create({
                            id: "member.lastName",
                            name: "Achternaam lid",
                            type: RecordType.Text
                        }),
                    ]
                })
            }
        ]
    }

    recordCategoriesFor(field: RecordSettings) {
        const type = field.type
        return RecordCategory.flattenCategoriesWith(OrganizationManager.organization.meta.recordsConfiguration.recordCategories, (record) => record.type == type)
    }

    get hasChanges() {
        return false
    }

    addGroup() {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ChooseDocumentTemplateGroup, {
                        fieldCategories: this.patchedDocument.privateSettings.templateDefinition.groupFieldCategories,
                        addGroup: (group: DocumentTemplateGroup) => {
                            this.patchDocument = this.patchDocument.patch({
                                privateSettings: DocumentPrivateSettings.patch({
                                    groups: this.patchedDocument.privateSettings.groups.concat(group)
                                })
                            })
                        }
                    })
                })
            ],
            modalDisplayStyle: "sheet"
        })
    }

    getGroupName(group: DocumentTemplateGroup) {
        const groups = OrganizationManager.organization.groups
        const g = groups.find(g => g.id == group.groupId)
        return g?.settings?.name ?? "Onbekende groep"
    }

    getGroupDescription(group: DocumentTemplateGroup) {
        const groups = OrganizationManager.organization.groups
        const g = groups.find(g => g.id == group.groupId)
        const currentCycle = g?.cycle ?? 0
        const cycleOffset = group.cycle - currentCycle

        let period = cycleOffset + ' inschrijvingperiodes geleden'
        if (cycleOffset === 0) {
            period = 'Huidige inschrijvingperiode'
        } else if (cycleOffset === 1) {
            period = 'Vorige inschrijvingperiode'
        }

        // Append answers
        return period + (group.fieldAnswers.length ? ("\n" + group.fieldAnswers.map(a => a.descriptionValue).join("\n")): "")
    }

    removeGroup(group: DocumentTemplateGroup) {
        this.patchDocument = this.patchDocument.patch({
            privateSettings: DocumentPrivateSettings.patch({
                groups: this.patchedDocument.privateSettings.groups.filter(g => g !== group)
            })
        })
    }

    async validate() {
        // todo: validate information before continueing
    }

    beforeDestroy() {
        Request.cancelAll(this)
    }

    async save() {
        if (this.saving) {
            return
        }

        this.saving = true

        try {
            // Make sure answers are updated
            this.saveAnswers();
            
            if (!await this.validator.validate()) {
                this.saving = false
                return
            }

            await this.validate()

            const patch: PatchableArrayAutoEncoder<DocumentTemplatePrivate> = new PatchableArray() as PatchableArrayAutoEncoder<DocumentTemplatePrivate>

            if (this.isNew) {
                patch.addPut(this.patchedDocument)
            } else {
                this.patchDocument.id = this.patchedDocument.id
                patch.addPatch(this.patchDocument)
            }

            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "PATCH",
                path: "/organization/document-templates",
                body: patch,
                decoder: new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>),
                shouldRetry: false,
                owner: this
            })
            const updatedDocument = response.data[0]
            if (updatedDocument) {
                this.editingAnswers = this.document.settings.fieldAnswers.map(a => a.clone())
                this.patchDocument = DocumentTemplatePrivate.patch({})
                this.document.set(updatedDocument)
            }
            
            // TODO: open document
            this.dismiss({ force: true })
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }
}
</script>