<template>
    <div class="container field-box">
        <hr v-if="withTitle"><h2 v-if="withTitle">
            {{ field.name || 'Maak een keuze' }}
        </h2>
        <STInputBox :title="withTitle ? undefined : (field.name || $t(`569d1c4a-9389-47dd-9acb-930419271276`))" :error-box="errorBox" :error-fields="'fieldAnswers.'+field.id" :class="{'no-padding': withTitle}">
            <input v-model="value" :placeholder="field.required ? (field.placeholder || field.name) : $t(`9e0461d2-7439-4588-837c-750de6946287`) " class="input"><p v-if="field.description" class="style-description-small" v-text="field.description" />
        </STInputBox>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { ErrorBox, STInputBox } from '@stamhoofd/components';
import { WebshopField, WebshopFieldAnswer } from '@stamhoofd/structures';

@Component({
    components: {
        STInputBox,
    },
})
export default class FieldBox extends Mixins(NavigationMixin) {
    @Prop({ default: true })
    withTitle: boolean;

    @Prop({ required: true })
    field: WebshopField;

    @Prop({ required: true })
    errorBox: ErrorBox;

    @Prop({ required: true })
    answers: WebshopFieldAnswer[];

    get value() {
        return this.answers.find(a => a.field.id === this.field.id)?.answer ?? '';
    }

    set value(value: string) {
        const answer = this.answers.find(a => a.field.id === this.field.id);

        if (answer) {
            answer.answer = value;
        }
        else {
            this.answers.push(WebshopFieldAnswer.create({
                field: this.field,
                answer: value,
            }));
        }
    }
}
</script>

<style lang="scss">
.field-box {
    .style-description-small {
        padding-top: 5px;
        white-space: pre-wrap;
    }
}

</style>
