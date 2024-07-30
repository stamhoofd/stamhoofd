<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p>
            Lees <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/vragenlijsten-instellen/'" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vraag kan instellen.
        </p>
        
        <STErrorsDefault :error-box="errorBox" />

        <div class="split-inputs">
            <div>
                <STInputBox title="Naam (kort)" error-fields="name" :error-box="errorBox">
                    <input
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        placeholder="bv. Toestemming publicatie foto’s"
                        autocomplete=""
                        enterkeyhint="next"
                    >
                </STInputBox>
            </div>

            <div>
                <STInputBox title="Type" error-fields="type" :error-box="errorBox">
                    <Dropdown v-model="type">
                        <optgroup v-for="group in availableTypes" :key="group.name" :label="group.name">
                            <option v-for="_type in group.values" :key="_type.value" :value="_type.value">
                                {{ _type.name }}
                            </option>
                        </optgroup>
                    </Dropdown>
                </STInputBox>
            </div>
        </div>

        <Checkbox v-model="required">
            {{ requiredText }}
        </Checkbox>
        <Checkbox v-if="type == RecordType.Checkbox" v-model="askComments">
            Voeg tekstvak toe indien aangevinkt
        </Checkbox>
        
        <div v-if="type == RecordType.MultipleChoice || type == RecordType.ChooseOne" class="container">
            <hr>
            <h2 class="style-with-button with-list">
                <div>Keuzeopties</div>
                <div>
                    <button class="button text" type="button" @click="addChoice">
                        <span class="icon add" />
                        <span>Nieuw</span>
                    </button>
                </div>
            </h2>
            
            <STList v-if="patchedRecord.choices.length > 0" v-model="choices" :draggable="true">
                <template #item="{item: choice}">
                    <RecordChoiceRow :choice="choice" :parent-record="patchedRecord" :selectable="true" @patch="addChoicesPatch" />
                </template>
            </STList>
                
            <p v-else class="info-box">
                <span>Geen keuzemogelijkheden. Voeg een keuze toe via de <span class="icon add middle" />-knop.</span>
            </p>
        </div>

        <hr>
        <h2 class="style-with-button">
            <div>Beschrijving</div>
            <div>
                <button class="button text" type="button" @click="openPreview">
                    <span class="icon eye" />
                    <span>Voorbeeld</span>
                </button>
            </div>
        </h2>
        <p>Bepaal hoe men deze vraag kan beantwoorden door extra verduidelijking te voorzien.</p>

        <STInputBox :title="labelTitle" error-fields="label" :error-box="errorBox" class="max">
            <input
                v-model="label"
                class="input"
                type="text"
                :placeholder="name"
                autocomplete=""
                enterkeyhint="next"
            >
        </STInputBox>

        <STInputBox :title="descriptionTitle" error-fields="description" :error-box="errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Optioneel"
                autocomplete=""
            />
        </STInputBox>
        <p class="style-description-small">
            Gebruik deze tekst voor een langere uitleg bij het instellen van dit kenmerk, enkel indien dat echt nodig is.
        </p>

        <STInputBox v-if="shouldAskInputPlaceholder" title="Tekst in leeg tekstvak" error-fields="label" :error-box="errorBox" class="max">
            <input
                v-model="inputPlaceholder"
                class="input"
                type="text"
                placeholder="bv. 'Vul hier jouw naam in'"
                autocomplete=""
            >
        </STInputBox>
        <p class="style-description-small">
            Het is netter als je een tekst in lege tekstvakken instelt. Je kan van deze plaats gebruik maken om een voorbeeld te geven, om het duidelijker te maken (zoals we zelf doen hierboven).
        </p>

        <STInputBox v-if="shouldAskCommentsDescription" title="Tekst onder tekstvak" error-fields="label" :error-box="errorBox" class="max">
            <textarea
                v-model="commentsDescription"
                class="input"
                type="text"
                placeholder="Optioneel"
                autocomplete=""
            />
        </STInputBox>
        <p v-if="shouldAskCommentsDescription" class="style-description-small">
            Laat hier eventueel extra instructies achter onder het tekstveld, als het aankruisvakje is aangevinkt.
        </p>

        <template v-if="canAddWarning">
            <hr>
            <h2>Waarschuwing</h2>
            <p>Soms wil je dat iets opvalt voor beheerders, dat kan je bereiken met waarschuwingen. Die zijn zichtbaar voor beheerders als dit kenmerk een bepaalde waarde heeft.</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="warningInverted" :value="null" name="warningInverted" />
                    </template>
                    <h3 class="style-title-list">
                        Geen waarschuwing
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="warningInverted" :value="false" name="warningInverted" />
                    </template>
                    <h3 class="style-title-list">
                        {{ warningNonInvertedText }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="warningInverted" :value="true" name="warningInverted" />
                    </template>
                    <h3 class="style-title-list">
                        {{ warningInvertedText }}
                    </h3>
                </STListItem>
            </STList>

            <STInputBox v-if="warningText !== null" title="Waarschuwingstekst" error-fields="label" :error-box="errorBox" class="max">
                <input
                    v-model="warningText"
                    class="input"
                    type="text"
                    placeholder="bv. 'Geen toestemming om foto's te maken'"
                    autocomplete=""
                >
            </STInputBox>

            <STInputBox v-if="warningType" class="max" title="Type">
                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Info" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            Informatief
                        </h3>
                        <p class="style-description-small">
                            Grijze achtergrond. Voor minder belangrijke zaken
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Warning" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            Waarschuwing
                        </h3>
                        <p class="style-description-small">
                            Gele achtergrond
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="warningType" :value="RecordWarningType.Error" name="warningType" />
                        </template>
                        <h3 class="style-title-list">
                            Foutmelding
                        </h3>
                        <p class="style-description-small">
                            Voor zaken die echt heel belangrijk zijn. Probeer dit weinig te gebruiken, zet niet alles op 'foutmelding', anders valt het niet meer op.
                        </p>
                    </STListItem>
                </STList>
            </STInputBox>
        </template>

        <template v-if="settings.dataPermission">
            <hr>
            <h2>Toestemming gegevensverzameling</h2>
            <p>
                Verzamel je gevoelige informatie? Dan moet je daar in de meeste gevallen toestemming voor vragen volgens de GDPR-wetgeving. We raden je aan om altijd toestemming te vragen zodra je ook maar een beetje twijfelt. In onze gids geven we enkele voorbeelden, lees die zeker na. <a :href="'https://'+$t('shared.domains.marketing')+'/docs/toestemming-gegevens-verzamelen'" class="inline-link" target="_blank" rel="noopener">
                    Lees onze gids
                </a>
            </p>

            <Checkbox v-model="sensitive">
                Ik heb toestemming nodig om deze informatie te verzamelen, of de antwoorden zijn (of bevatten mogelijks) gevoelige informatie
            </Checkbox>
        </template>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Kenmerk verwijderen
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { CenteredMessage, Checkbox, Dropdown, ErrorBox, Radio, STErrorsDefault, STInputBox, STList, STListItem, SaveView, Validator } from "@stamhoofd/components";
import { ObjectWithRecords, RecordCategory, RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType, Version } from "@stamhoofd/structures";

import EditRecordChoiceView from './EditRecordChoiceView.vue';
import { RecordEditorSettings } from './RecordEditorSettings';
import PreviewRecordView from './components/PreviewRecordView.vue';
import RecordChoiceRow from "./components/RecordChoiceRow.vue";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        Radio,
        Checkbox,
        Dropdown,
        RecordChoiceRow
    },
})
export default class EditRecordView<T extends ObjectWithRecords> extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        record!: RecordSettings

    @Prop({ required: false, default: null })
        category!: RecordCategory | null

    @Prop({ required: true })
        isNew!: boolean

    patchRecord: AutoEncoderPatchType<RecordSettings> = RecordSettings.patch({ id: this.record.id })

    @Prop({ required: true })
        saveHandler!: (patch: PatchableArrayAutoEncoder<RecordSettings>) => void;

    @Prop({ required: true })
        settings!: RecordEditorSettings<T>

    get patchedRecord() {
        return this.record.patch(this.patchRecord)
    }

    get RecordType() {
        return RecordType
    }

    get availableTypes() {
        return [
            {
                name: "Tekst",
                values: [
                    {
                        value: RecordType.Text,
                        name: "Tekstveld (één lijn)"
                    },
                    {
                        value: RecordType.Textarea,
                        name: "Tekstveld (meerdere lijnen)"
                    },
                    {
                        value: RecordType.Address,
                        name: "Adres"
                    },
                    {
                        value: RecordType.Email,
                        name: "E-mailadres"
                    },
                    {
                        value: RecordType.Phone,
                        name: "Telefoonnummer"
                    },
                    {
                        value: RecordType.Date,
                        name: "Datum"
                    }
                ]
            },
            {
                name: "Aankruisen",
                values: [
                    {
                        value: RecordType.Checkbox,
                        name: "Aankruisvakje"
                    },
                    {
                        value: RecordType.ChooseOne,
                        name: "Keuzemenu (kies één)"
                    },
                    {
                        value: RecordType.MultipleChoice,
                        name: "Keuzemenu (kies meerdere)"
                    }
                ]
            }
        ]
    }

    get RecordWarningType() {
        return RecordWarningType
    }

    get canAddWarning() {
        return this.patchedRecord.type === RecordType.Checkbox || this.patchedRecord.type === RecordType.Text || this.patchedRecord.type === RecordType.Textarea
    }

    get warningNonInvertedText() {
        if (this.patchedRecord.type === RecordType.Checkbox) {
            return "Waarschuwing als aangevinkt"
        }
        return "Waarschuwing als ingevuld"
    }

    get warningInvertedText() {
        if (this.patchedRecord.type === RecordType.Checkbox) {
            return "Waarschuwing als niet aangevinkt"
        }
        return "Waarschuwing als niet ingevuld"
    }

    get title(): string {
        if (this.isNew) {
            return "Nieuwe vraag"
        }
        return "Vraag bewerken"
    }

    get labelTitle(): string {
        if (this.type === RecordType.Checkbox) {
            return "Tekst naast aankruisvakje"
        }
        if (this.type === RecordType.MultipleChoice) {
            return "Titel boven keuzemenu"
        }
        if (this.type === RecordType.ChooseOne) {
            return "Titel boven keuzemenu"
        }
        return "Titel boven tekstvak"
    }

    get descriptionTitle(): string {
        if (this.type === RecordType.Checkbox) {
            return "Beschrijving naast aankruisvakje"
        }
        if (this.type === RecordType.MultipleChoice) {
            return "Beschrijving onder keuzemenu"
        }
        if (this.type === RecordType.ChooseOne) {
            return "Beschrijving onder keuzemenu"
        }
        return "Beschrijving onder tekstvak"
    }

    get name() {
        return this.patchedRecord.name
    }

    set name(name: string) {
        this.patchRecord = this.patchRecord.patch({ name })
    }

    get label() {
        return this.patchedRecord.label
    }

    set label(label: string) {
        this.patchRecord = this.patchRecord.patch({ label })
    }

    get required() {
        return this.patchedRecord.required
    }

    set required(required: boolean) {
        this.patchRecord = this.patchRecord.patch({ required })
    }

    get choices() {
        return this.patchedRecord.choices
    }

    set choices(choices: RecordChoice[]) {
        this.patchRecord = this.patchRecord.patch({ choices: choices as any })
    }

    get inputPlaceholder() {
        return this.patchedRecord.inputPlaceholder
    }

    set inputPlaceholder(inputPlaceholder: string) {
        this.patchRecord = this.patchRecord.patch({ inputPlaceholder })
    }

    get askComments() {
        return this.patchedRecord.askComments
    }

    set askComments(askComments: boolean) {
        this.patchRecord = this.patchRecord.patch({ askComments })
    }

    get shouldAskInput(): boolean {
        if (this.type === RecordType.Checkbox) {
            return this.askComments
        }
        if (this.type === RecordType.MultipleChoice) {
            return false
        }
        if (this.type === RecordType.ChooseOne) {
            return false
        }
        return true
    }

    get shouldAskInputPlaceholder(): boolean {
        if (!this.shouldAskInput) {
            return false
        }
        if (this.type === RecordType.Address) {
            return false
        }
        return true
    }

    get shouldAskCommentsDescription(): boolean {
        if (this.type === RecordType.Checkbox) {
            return this.askComments
        }
        return false
    }

    get requiredText() {
        if (this.type === RecordType.Checkbox) {
            return "Verplicht aankruisen"
        }
        if (this.type === RecordType.MultipleChoice) {
            return "Verplicht om minstens één keuze te selecteren"
        }
        if (this.type === RecordType.ChooseOne) {
            return "Verplicht om een keuze te selecteren"
        }
        return "Verplicht in te vullen"
    }

    get type() {
        return this.patchedRecord.type
    }

    set type(type: RecordType) {
        this.patchRecord = this.patchRecord.patch({ 
            type,
            // Set required if not checkbox or multiple choice, and if the type changed
            required: (type !== RecordType.MultipleChoice && type !== RecordType.Checkbox) && this.record.type !== type ? true : 
                ((type === RecordType.Checkbox || type === RecordType.MultipleChoice) && this.record.type !== type ? false: undefined)
        })

        if (type === RecordType.MultipleChoice || type === RecordType.ChooseOne) {
            if ( this.patchedRecord.choices.length === 0) {
                if (this.record.choices.length > 0) {
                    // Revert to original choices
                    this.patchRecord = this.patchRecord.patch({ choices: this.record.choices as any })
                } else {
                    this.patchRecord = this.patchRecord.patch({
                        choices: [
                            RecordChoice.create({ name: "Keuze 1" }),
                            RecordChoice.create({ name: "Keuze 2" }),
                        ] as any
                    })
                }
            }
        } else {
            // Delete choices
            this.patchRecord = this.patchRecord.patch({ choices: [] as any })
        }
    }

    get description() {
        return this.patchedRecord.description
    }

    set description(description: string) {
        this.patchRecord = this.patchRecord.patch({ description })
    }

    get commentsDescription() {
        return this.patchedRecord.commentsDescription
    }

    set commentsDescription(commentsDescription: string) {
        this.patchRecord = this.patchRecord.patch({ commentsDescription })
    }

    get warningInverted() {
        return this.patchedRecord.warning?.inverted ?? null
    }

    set warningInverted(inverted: boolean | null) {
        if (inverted === null) {
            this.patchRecord = this.patchRecord.patch({ 
                warning: null
            })
            return
        }
        if (this.warningInverted === null) {
            this.patchRecord = this.patchRecord.patch({ 
                warning: RecordWarning.create({
                    inverted
                })
            })
        } else {
            this.patchRecord = this.patchRecord.patch({ 
                warning: RecordWarning.patch({
                    inverted
                })
            })
        }
    }

    get warningText() {
        return this.patchedRecord.warning?.text ?? null
    }

    set warningText(text: string | null) {
        if (text === null) {
            this.patchRecord = this.patchRecord.patch({ 
                warning: null
            })
            return
        }
        if (this.warningText === null) {
            this.patchRecord = this.patchRecord.patch({ 
                warning: RecordWarning.create({
                    text
                })
            })
        } else {
            this.patchRecord = this.patchRecord.patch({ 
                warning: RecordWarning.patch({
                    text
                })
            })
        }
    }

    get warningType() {
        return this.patchedRecord.warning?.type ?? null
    }

    set warningType(type: RecordWarningType | null) {
        if (type === null) {
            this.patchRecord = this.patchRecord.patch({ 
                warning: null
            })
            return
        }
        if (this.warningType === null) {
            this.patchRecord = this.patchRecord.patch({ 
                warning: RecordWarning.create({
                    type
                })
            })
        } else {
            this.patchRecord = this.patchRecord.patch({ 
                warning: RecordWarning.patch({
                    type
                })
            })
        }
    }

    get sensitive() {
        return this.patchedRecord.sensitive
    }

    set sensitive(sensitive: boolean) {
        // Always require encryption for sensitive information
        this.patchRecord = this.patchRecord.patch({ sensitive })
    }

    addPatch(patch: AutoEncoderPatchType<RecordSettings>) {
        this.patchRecord = this.patchRecord.patch(patch)
    }

    addChoicesPatch(patch: PatchableArrayAutoEncoder<RecordChoice>) {
        const p = RecordSettings.patch({
            choices: patch
        })
        this.addPatch(p)
    }

    addChoice() {
        const choice = RecordChoice.create({})

        this.present(new ComponentWithProperties(EditRecordChoiceView, {
            choice,
            isNew: true,
            parentRecord: this.patchedRecord,
            saveHandler: (patch: PatchableArrayAutoEncoder<RecordChoice>) => {
                this.addChoicesPatch(patch)
            }
        }).setDisplayStyle("popup"))
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }

        if (this.name.length < 2) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: 'Vul een naam in',
                field: 'name'
            }))
            return;
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray()

        if (this.isNew) {
            arrayPatch.addPut(this.patchedRecord)
        } else {
            arrayPatch.addPatch(this.patchRecord)
        }

        this.saveHandler(arrayPatch)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je dit kenmerk wilt verwijderen?", "Verwijderen", "Alle hieraan verbonden informatie gaat dan ook mogelijks verloren.")) {
            return
        }

        if (this.isNew) {
            // do nothing
            this.pop({ force: true })
            return
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray()
        arrayPatch.addDelete(this.record.id)

        this.saveHandler(arrayPatch)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    get hasChanges() {
        return patchContainsChanges(this.patchRecord, this.record, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    openPreview() {
        this.present(new ComponentWithProperties(PreviewRecordView, {
            record: this.patchedRecord
        }).setDisplayStyle("popup"))
    }
}
</script>
