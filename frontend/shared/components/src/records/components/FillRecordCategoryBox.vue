<template>
    <div class="container">
        <component :is="level === 1 ? 'h1' : 'h2'">
            {{ category.name }}
        </component>
        <p v-if="category.description" class="style-description-block pre-wrap" v-text="category.description" />

        <STErrorsDefault :error-box="errors.errorBox" />
            
        <RecordAnswerInput v-for="record of filteredRecords" :key="record.id" :record="record" :answers="answers" :validator="validator" :all-optional="isOptional" @patch="addPatch" />
        <div v-for="childCategory of childCategories" :key="childCategory.id" class="container">
            <hr>
            <h2>{{ childCategory.name }}</h2>
            <p v-if="childCategory.description" class="style-description pre-wrap" v-text="childCategory.description" />

            <RecordAnswerInput v-for="record of childCategory.filterRecords(props.value)" :key="record.id" :record="record" :answers="answers" :validator="validator" :all-optional="isOptional" @patch="addPatch" />
        </div>

        <p v-if="isOptional" class="style-description-small">
            Dit onderdeel is optioneel
        </p>

        <p v-if="!markReviewed && lastReviewed" class="style-description-small">
            Laatst nagekeken op {{ formatDate(lastReviewed) }}
        </p>
    </div>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { ObjectWithRecords, PatchAnswers, RecordCategory } from '@stamhoofd/structures';
import { computed } from "vue";
import { Validator } from '../../errors/Validator';
import { useErrors } from '../../errors/useErrors';
import RecordAnswerInput from '../../inputs/RecordAnswerInput.vue';

const props = withDefaults(
    defineProps<{
        category: RecordCategory,
        /**
         * Patched Value
         */
        value: T,
        markReviewed?: boolean,
        validator: Validator
        level?: number
    }>(), {
        markReviewed: false,
        level: 1
    }
)
const errors = useErrors({validator: props.validator})

const emit = defineEmits<{
    patch: [patch: PatchAnswers]
}>()

const addPatch = (patch: PatchAnswers) => {
    emit('patch', patch)
}

const answers = computed(() => {
    return props.value.getRecordAnswers()
})
const lastReviewed = computed(() => calculateLastReviewed())

const filteredRecords = computed(() => {
    return props.category.filterRecords(props.value)
});

const isOptional = computed(() => {
    return !!props.category.filter && (props.category.filter.requiredWhen === null || !props.value.doesMatchFilter(props.category.filter.requiredWhen))
});

const childCategories = computed(() => {
    return props.category.filterChildCategories(props.value)
});

function calculateLastReviewed() {
    let last: Date | null = null

    for (const record of filteredRecords.value) {
        const answer = answers.value.get(record.id)
        if (answer && answer.reviewedAt) {
            // Mark reviewed
            if (!last || answer.reviewedAt < last) {
                last = answer.reviewedAt
            }
        }
    }
    return last
}
</script>
