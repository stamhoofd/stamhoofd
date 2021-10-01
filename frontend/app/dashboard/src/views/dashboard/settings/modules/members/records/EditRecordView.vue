<template>
    <div class="st-view record-edit-view">
        <STNavigationBar :title="title">
            <template slot="right">
                <button v-if="!isNew" class="button text" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                {{ title }}
            </h1>
        
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
                        >
                    </STInputBox>
                </div>

                <div />
            </div>

            <STInputBox title="Type" error-fields="type" :error-box="errorBox" class="max">
                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <Radio slot="left" v-model="type" :value="RecordType.Checkbox" />
                        <h3 class="style-title-list">
                            Aankruisvakje
                        </h3>
                        <p class="style-description-small">
                            Je kan nog een extra opmerking vragen indien aangevinkt
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <Radio slot="left" v-model="type" :value="RecordType.ChooseOne" />
                        Kies één uit lijst
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <Radio slot="left" v-model="type" :value="RecordType.MultipleChoice" />
                        Kies meerdere uit lijst
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <Radio slot="left" v-model="type" :value="RecordType.Text" />
                        Tekst op één lijn
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <Radio slot="left" v-model="type" :value="RecordType.Textarea" />
                        Meerdere lijnen tekst
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <Radio slot="left" v-model="type" :value="RecordType.Address" />
                        Adres
                    </STListItem>
                </STList>
            </STInputBox>

            <STInputBox v-if="type == RecordType.MultipleChoice || type == RecordType.ChooseOne" title="Keuzemogelijkheden" error-fields="choices" :error-box="errorBox" class="max">
                <template slot="right">
                    <button class="button text" @click="addChoice">
                        <span class="icon add" />
                        <span>Nieuw</span>
                    </button>
                </template>

                <STList v-if="patchedRecord.choices.length > 0">
                    <RecordChoiceRow v-for="choice in patchedRecord.choices" :key="choice.id" :choice="choice" :parent-record="patchedRecord" :selectable="true" @patch="addChoicesPatch" />
                </STList>
                
                <p v-else class="info-box">
                    Geen keuzemogelijkheden. Voeg een keuze toe via de <span class="icon add middle" />-knop.
                </p>
            </STInputBox>

            <hr>
            <h2 class="style-with-button">
                <div>Formulier</div>
                <div>
                    <button class="button text" @click="openPreview">
                        <span class="icon eye" />
                        <span>Voorbeeld</span>
                    </button>
                </div>
            </h2>
            <p>Het kenmerk dat je hebt toegevoegd moet natuurlijk op één of andere manier kunnen worden ingesteld. Hier bepaal je hoe dat formulier eruit ziet en welke beschrijving en tekst daarbij staat. Kijk zeker het voorbeeld na om te zien hoe iemand het kenmerk zal kunnen wijzigen of instellen.</p>

            <STInputBox :title="labelTitle" error-fields="label" :error-box="errorBox" class="max">
                <input
                    v-model="label"
                    class="input"
                    type="text"
                    :placeholder="name"
                    autocomplete=""
                >
            </STInputBox>
            <Checkbox v-model="required">
                {{ requiredText }}
            </Checkbox>

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

            <Checkbox v-if="type == RecordType.Checkbox" v-model="askComments">
                Voeg tekstvak toe indien aangevinkt
            </Checkbox>

            <STInputBox v-if="shouldAskInputPlaceholder" title="Tekst in leeg tekstvak" error-fields="label" :error-box="errorBox" class="max">
                <input
                    v-model="label"
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
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="cancel">
                    Annuleren
                </button>
                <button class="button primary" @click="save">
                    Opslaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,ErrorBox, Radio,Spinner,STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { RecordCategory, RecordChoice, RecordSettings, RecordType, Version } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditRecordChoiceView from './EditRecordChoiceView.vue';
import PreviewRecordView from './PreviewRecordView.vue';
import RecordChoiceRow from "./RecordChoiceRow.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Spinner,
        STList,
        STListItem,
        Radio,
        Checkbox,
        RecordChoiceRow
    },
})
export default class EditRecordView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    record!: RecordSettings

    @Prop({ required: false, default: null })
    parentCategory!: RecordCategory | null

    @Prop({ required: true })
    isNew!: boolean

    patchRecord: AutoEncoderPatchType<RecordSettings> = RecordSettings.patch({ id: this.record.id })

    @Prop({ required: true })
    saveHandler: (patch: PatchableArrayAutoEncoder<RecordSettings>) => void;

    get patchedRecord() {
        return this.record.patch(this.patchRecord)
    }

    get RecordType() {
        return RecordType
    }

    get title(): string {
        if (this.isNew) {
            return "Nieuw kenmerk"
        }
        return "Kenmerk bewerken"
    }

    get labelTitle(): string {
        if (this.type === RecordType.Checkbox) {
            return "Titel naast aankruisvakje"
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
            return "Beschrijving onder titel"
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
        this.patchRecord = this.patchRecord.patch({ type })
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
        }).setDisplayStyle("sheet"))
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
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

    isChanged() {
        return patchContainsChanges(this.patchRecord, this.record, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
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