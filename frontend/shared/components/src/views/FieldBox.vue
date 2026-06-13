<template>
    <div class="container field-box">
        <hr v-if="withTitle"><h2 v-if="withTitle">
            {{ field.name || 'Maak een keuze' }}
        </h2>
        <STInputBox :title="withTitle ? undefined : (field.name || $t(`%1Fq`))" :error-box="errorBox" :error-fields="'fieldAnswers.'+field.id" :class="{'no-padding': withTitle}">
            <input v-model="value" :placeholder="field.required ? (field.placeholder || field.name) : $t(`%14p`) " class="input"><p v-if="field.description" class="style-description-small" v-text="field.description" />
        </STInputBox>
    </div>
</template>

<script lang="ts" setup>
import type { ErrorBox } from '#errors/ErrorBox.ts';
import STInputBox from '#inputs/STInputBox.vue';
import type { WebshopField } from '@stamhoofd/structures';
import { WebshopFieldAnswer } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    withTitle?: boolean;
    field: WebshopField;
    errorBox: ErrorBox | null;
    answers: WebshopFieldAnswer[];
}>(), {
    withTitle: true,
});

const value = computed({
    get: () => props.answers.find(a => a.field.id === props.field.id)?.answer ?? '',
    set: (value: string) => {
        const answer = props.answers.find(a => a.field.id === props.field.id);
        if (answer) {
            answer.answer = value;
        } else {
            props.answers.push(WebshopFieldAnswer.create({
                field: props.field,
                answer: value,
            }));
        }
    },
});
</script>

<style lang="scss">
.field-box {
    .style-description-small {
        padding-top: 5px;
        white-space: pre-wrap;
    }
}

</style>
