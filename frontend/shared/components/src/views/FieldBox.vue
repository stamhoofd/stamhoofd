<template>
    <div class="container field-box">
        <h2 v-if="withTitle">
            {{ field.name || 'Maak een keuze' }}
        </h2>
        <STInputBox :title="withTitle ? undefined : (field.name || 'Maak een keuze')" :error-box="errorBox" :error-fields="'fieldAnswers.'+field.id" :class="{'no-padding': withTitle}">
            <input v-model="value" :placeholder="field.required ? field.placeholder : 'Optioneel' " class="input">
            <p v-if="field.description" class="style-description-small" v-text="field.description" />
        </STInputBox>
        <hr v-if="withTitle">
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STInputBox } from "@stamhoofd/components"
import { WebshopField, WebshopFieldAnswer } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STInputBox
    }
})
export default class FieldBox extends Mixins(NavigationMixin){
    @Prop({ default: true })
    withTitle: boolean

    @Prop({ required: true })
    field: WebshopField

    @Prop({ required: true })
    errorBox: ErrorBox

    @Prop({ required: true })
    answers: WebshopFieldAnswer[]

    get value() {
        return this.answers.find(a => a.field.id === this.field.id)?.answer ?? ""
    }

    set value(value: string) {
        const answer = this.answers.find(a => a.field.id === this.field.id)

        if (answer) {
            answer.answer = value
        } else {
            this.answers.push(WebshopFieldAnswer.create({
                field: this.field,
                answer: value
            }))
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.field-box {
    .style-description-small {
        padding-top: 5px;
        white-space: pre-wrap;
    }
}

</style>