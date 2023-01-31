<template>
    <div>
        <Checkbox v-if="answer.settings.type == RecordType.Checkbox" v-model="answer.selected">
            <h3 class="style-title-list">
                {{ label }}
            </h3>
            <p v-if="answer.settings.description" class="style-description-small">
                {{ answer.settings.description }}
            </p>
        </Checkbox>
        <STInputBox v-else-if="answer.settings.type == RecordType.MultipleChoice" class="max" :title="label" error-fields="input" :error-box="errorBox">
            <STList>
                <STListItem v-for="choice in recordSettings.choices" :key="choice.id" :selectable="true" element-name="label">
                    <Checkbox slot="left" :checked="getChoiceSelected(choice)" @change="setChoiceSelected(choice, $event)" />
                    <h3 class="style-title-list">
                        {{ choice.name }}
                    </h3>
                    <p v-if="choice.description" class="style-description-small">
                        {{ choice.description }}
                    </p>
                </STListItem>
            </STList>
        </STInputBox>
        <STInputBox v-else-if="answer.settings.type == RecordType.ChooseOne" class="max" :title="label" error-fields="input" :error-box="errorBox">
            <STList>
                <STListItem v-for="choice in recordSettings.choices" :key="choice.id" :selectable="true" element-name="label">
                    <Radio slot="left" v-model="answer.selectedChoice" :name="'record-answer-'+answer.id" :value="choice" />
                    <h3 class="style-title-list">
                        {{ choice.name }}
                    </h3>
                    <p v-if="choice.description" class="style-description-small">
                        {{ choice.description }}
                    </p>
                </STListItem>
            </STList>
        </STInputBox>
        <STInputBox v-else-if="answer.settings.type == RecordType.Text" :title="label" error-fields="input" :error-box="errorBox">
            <input v-model="answer.value" :placeholder="inputPlaceholder" class="input">
        </STInputBox>
        <STInputBox v-else-if="answer.settings.type == RecordType.Textarea" :title="label" class="max" error-fields="input" :error-box="errorBox">
            <textarea v-model="answer.value" :placeholder="inputPlaceholder" class="input" />
        </STInputBox>
        <AddressInput v-else-if="answer.settings.type == RecordType.Address" v-model="answer.address" :title="label" :required="required" :validator="validator" :nullable="true" />
        <PhoneInput v-else-if="answer.settings.type == RecordType.Phone" v-model="answer.value" :placeholder="inputPlaceholder" :title="label" :required="required" :validator="validator" :nullable="true" />
        <EmailInput v-else-if="answer.settings.type == RecordType.Email" v-model="answer.value" :placeholder="inputPlaceholder" :title="label" :required="required" :validator="validator" :nullable="true" />
        <STInputBox v-else-if="answer.settings.type == RecordType.Date" :title="label" error-fields="input" :error-box="errorBox">
            <DateSelection v-model="answer.dateValue" :required="required" :validator="validator" :placeholder="inputPlaceholder" />
        </STInputBox>
        <STInputBox v-else-if="answer.settings.type == RecordType.Price" :title="label" error-fields="input" :error-box="errorBox">
            <PriceInput v-model="answer.value" :required="required" :validator="validator" :placeholder="inputPlaceholder" />
        </STInputBox>
        <ImageInput v-else-if="answer.settings.type == RecordType.Image" v-model="answer.image" :title="label" :required="required" :validator="validator" :resolutions="recordSettings.resolutions" :placeholder="inputPlaceholder" />
        
        <p v-else class="error-box">
            Niet ondersteund. Herlaad de app indien nodig en probeer opnieuw.
        </p>

        <!-- Comments if checkbox is selected -->
        <div v-if="answer.settings.type == RecordType.Checkbox && answer.selected && answer.settings.askComments" class="textarea-container">
            <textarea v-model="answer.comments" class="input small" :placeholder="inputPlaceholder" />
            <p v-if="answer.settings.commentsDescription" class="info-box">
                {{ answer.settings.commentsDescription }}
            </p>
        </div>

        <!-- Unhandled errors -->
        <STErrorsDefault :error-box="errorBox" />

        <!-- Footer description -->
        <p v-if="answer.settings.type != RecordType.Checkbox && answer.settings.description" class="style-description-small">
            {{ answer.settings.description }}
        </p>
    </div>
</template>


<script lang="ts">
import { AddressInput,Checkbox,DateSelection, EmailInput, ErrorBox, ImageInput, PhoneInput,PriceInput, Radio,STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components"
import { RecordAnswer, RecordAnswerDecoder, RecordChoice, RecordMultipleChoiceAnswer, RecordSettings, RecordType } from "@stamhoofd/structures";
import { Component, Prop,Vue } from "vue-property-decorator";

@Component({
    components: {
        STInputBox,
        STListItem,
        STList,
        Checkbox,
        Radio,
        AddressInput,
        STErrorsDefault,
        EmailInput,
        PhoneInput,
        DateSelection,
        PriceInput,
        ImageInput
    }
})
export default class RecordAnswerInput extends Vue {
    @Prop({ required: true }) 
        recordSettings: RecordSettings

    /**
     * We'll update the record answers in this array
     */
    @Prop({ required: true }) 
        recordAnswers: RecordAnswer[]

    @Prop({ default: null }) 
        validator: Validator | null

    @Prop({ default: false }) 
        allOptional: boolean

    errorBox: ErrorBox | null = null

    get RecordType() {
        return RecordType
    }

    get label() {
        return this.recordSettings.label || this.recordSettings.name
    }

    get required() {
        return !this.allOptional && this.recordSettings.required
    }

    getChoiceSelected(choice: RecordChoice): boolean {
        return !!(this.answer as RecordMultipleChoiceAnswer).selectedChoices.find(c => c.id === choice.id)
    }

    setChoiceSelected(choice: RecordChoice, selected: boolean) {
        if (selected === this.getChoiceSelected(choice)) {
            return
        }
        if (selected) {
            (this.answer as RecordMultipleChoiceAnswer).selectedChoices.push(choice)
        } else {
            const index = (this.answer as RecordMultipleChoiceAnswer).selectedChoices.findIndex(c => c.id === choice.id)
            if (index != -1) {
                (this.answer as RecordMultipleChoiceAnswer).selectedChoices.splice(index, 1)
            }
        }
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.isValid()
            })
        }

        // Make sure the answer (updated one) is inside the recordAnswers, and is made reactive
        this.answer = (this.answer as any)
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    get inputPlaceholder() {
        if (!this.required) {
            if (this.answer.settings.inputPlaceholder.length > 0) {
                return "Optioneel. "+this.answer.settings.inputPlaceholder
            }
            return "Optioneel"
        }
        return this.answer.settings.inputPlaceholder || this.answer.settings.name
    }

    get answer(): RecordAnswer {
        const answer = this.recordAnswers.find(a => a.settings.id === this.recordSettings.id)
        const type = RecordAnswerDecoder.getClassForType(this.recordSettings.type)
        if (answer !== undefined && answer instanceof type) {
            if (answer.settings !== this.recordSettings) {
                answer.settings = this.recordSettings
            }
            return answer
        }

        // Create a new one
        // TODO: try to migrate old values if possible
        const a = type.create({
            settings: this.recordSettings
        })

        // This is required, because in very rare situations, the answer that was set on mount could have been removed from the array
        this.answer = a
        return a
    }

    set answer(answer: RecordAnswer) {
        const index = this.recordAnswers.findIndex(a => a.settings.id === this.recordSettings.id)
        if (index != -1) {
            const old = this.recordAnswers[index]
            if (old === answer) {
                return
            }
            this.recordAnswers.splice(index, 1, answer)
        } else {
            this.recordAnswers.push(answer)
        }
    }

    async isValid(): Promise<boolean> {
        if (this.allOptional) {
            return Promise.resolve(true)
        }
        try {
            this.answer.validate()
        } catch (e) {
            this.errorBox = new ErrorBox(e)
            return false
        }
        this.errorBox = null
        return Promise.resolve(true)
    }
}
</script>