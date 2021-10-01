<template>
    <div>
        <Checkbox v-if="answer.settings.type == RecordType.Checkbox" v-model="answer.selected">
            {{ label }}
        </Checkbox>
        <STInputBox v-else-if="answer.settings.type == RecordType.MultipleChoice" class="max" :title="label">
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
        <STInputBox v-else-if="answer.settings.type == RecordType.ChooseOne" class="max" :title="label">
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
        <p v-else class="error-box">
            Niet ondersteund. Herlaad de app indien nodig en probeer opnieuw.
        </p>
    </div>
</template>


<script lang="ts">
import { Checkbox,ErrorBox, Radio,STInputBox, STList, STListItem, Validator } from "@stamhoofd/components"
import { RecordAnswer, RecordAnswerDecoder, RecordChoice, RecordMultipleChoiceAnswer, RecordSettings, RecordType } from "@stamhoofd/structures";
import { Component, Prop,Vue } from "vue-property-decorator";

@Component({
    components: {
        STInputBox,
        STListItem,
        STList,
        Checkbox,
        Radio
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

    errorBox: ErrorBox | null = null

    get RecordType() {
        return RecordType
    }

    get label() {
        return this.recordSettings.label || this.recordSettings.name
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

    get answer(): RecordAnswer {
        const answer = this.recordAnswers.find(a => a.settings.id === this.recordSettings.id)
        const type = RecordAnswerDecoder.getClassForType(this.recordSettings.type)
        if (answer !== undefined && answer instanceof type) {
            answer.settings = this.recordSettings
            return answer
        }

        console.log("Created new record answer")

        // Create a new one
        // todo: try to migrate old values if possible
        return type.create({
            settings: this.recordSettings
        })
    }

    set answer(answer: RecordAnswer) {
        console.log("Did set record answer")

        const index = this.recordAnswers.findIndex(a => a.settings.id === this.recordSettings.id)
        if (index != -1) {
            this.recordAnswers.splice(index, 1, answer)
        } else {
            this.recordAnswers.push(answer)
        }
    }

    async isValid(): Promise<boolean> {
        return Promise.resolve(true)
    }
}
</script>