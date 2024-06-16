<template>
    <div class="container">
        <component :is="level === 1 ? 'h1' : 'h2'">
            {{ category.name }}
            <span v-if="titleSuffix" class="title-suffix">
                {{ titleSuffix }}
            </span>
        </component>
        <p v-if="category.description" class="style-description-block pre-wrap" v-text="category.description" />

        <STErrorsDefault :error-box="errors.errorBox" />
            
        <RecordAnswerInput v-for="record of filteredRecords" :key="record.id" :record="record" :answers="answers" :validator="validator" :all-optional="isOptional" :mark-reviewed="markReviewed" @patch="addPatch" />
        <div v-for="childCategory of childCategories" :key="childCategory.id" class="container">
            <hr>
            <h2>{{ childCategory.name }}</h2>
            <p v-if="childCategory.description" class="style-description pre-wrap" v-text="childCategory.description" />

            <RecordAnswerInput v-for="record of childCategory.filterRecords(props.value)" :key="record.id" :record="record" :answers="answers" :validator="validator" :all-optional="isOptional" :mark-reviewed="markReviewed" @patch="addPatch" />
        </div>


        <p v-if="!markReviewed && lastReviewed" class="style-description-small">
            Laatst nagekeken op {{ formatDate(lastReviewed) }}<template v-if="isLastReviewIncomplete">
                (onvolledig)
            </template>. <button v-if="canMarkReviewed" class="inline-link" type="button" @click="doMarkReviewed">
                Markeer als nagekeken
            </button>
        </p>
        <p v-if="!markReviewed && !lastReviewed" class="style-description-small">
            Nog nooit nagekeken. <button v-if="canMarkReviewed" class="inline-link" type="button" @click="doMarkReviewed">
                Markeer als nagekeken
            </button>
        </p>
    </div>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { PatchMap } from '@simonbackx/simple-encoding';
import { ObjectWithRecords, PatchAnswers, RecordCategory } from '@stamhoofd/structures';
import { computed, nextTick } from "vue";
import { useAppContext } from '../../context/appContext';
import { Validator } from '../../errors/Validator';
import { useErrors } from '../../errors/useErrors';
import { useValidation } from '../../errors/useValidation';
import RecordAnswerInput from '../../inputs/RecordAnswerInput.vue';

const props = withDefaults(
    defineProps<{
        category: RecordCategory,
        /**
         * Patched Value
         */
        value: T,
        validator: Validator
        level?: number,
        allOptional?: boolean,
        titleSuffix?: string
    }>(), {
        level: 1,
        allOptional: false,
        titleSuffix: ""
    }
)
const errors = useErrors({validator: props.validator})
const app = useAppContext()
const markReviewed = app !== 'dashboard' && app !== 'admin';

useValidation(props.validator, async () => {
    if (markReviewed) {
        doMarkReviewed();
        await nextTick()
    }
    return true;
});

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
const isLastReviewIncomplete = computed(() => calculateLastReviewIncomplete(lastReviewed.value))
const now = new Date()

const canMarkReviewed = computed(() => !lastReviewed.value || lastReviewed.value < now || isLastReviewIncomplete.value)

const filteredRecords = computed(() => {
    return props.category.filterRecords(props.value)
});

const deepFilteredRecords = computed(() => {
    return props.category.getAllFilteredRecords(props.value)
});

const isOptional = computed(() => {
    return props.allOptional || (!!props.category.filter && (props.category.filter.requiredWhen === null || !props.value.doesMatchFilter(props.category.filter.requiredWhen)))
});

const childCategories = computed(() => {
    return props.category.filterChildCategories(props.value)
});

function calculateLastReviewed() {
    let last: Date | null = null

    for (const record of deepFilteredRecords.value) {
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

function calculateLastReviewIncomplete(date: Date|null) {
    if (date === null) {
        return false
    }

    for (const record of deepFilteredRecords.value) {
        const answer = answers.value.get(record.id)
        if (!answer || !answer.reviewedAt || answer.reviewedAt < date) {
            return true;
        }
    }
    return false
}

function doMarkReviewed() {
    const patch = new PatchMap() as PatchAnswers
    
    for (const record of deepFilteredRecords.value) {
        const answer = answers.value.get(record.id)
        if (!answer) {
            continue
        }
        patch.set(record.id, answer.patch({
            reviewedAt: new Date()
        }))
    }

    addPatch(patch)
}
</script>
