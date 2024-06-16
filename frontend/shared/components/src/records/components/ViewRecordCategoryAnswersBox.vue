<template>
    <dl class="details-grid hover">
        <template v-for="{record, answer, recordCheckboxAnswer} of recordsWithAnswers" :key="record.id">
            <dt class="center">
                {{ record.name }}
            </dt>
            <dd v-if="!answer">
                /
            </dd>
            <template v-else-if="recordCheckboxAnswer">
                <dd class="center icons">
                    <span v-if="recordCheckboxAnswer.selected" class="icon success primary" />
                    <span v-else class="icon canceled gray" />
                </dd>
                <dd v-if="recordCheckboxAnswer.comments" :key="'dd-description-'+record.id" class="description pre-wrap" v-text="recordCheckboxAnswer.comments" />
            </template>
            <dd v-else v-copyable>
                {{ answer.stringValue }}
            </dd>
        </template>
    </dl>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { ObjectWithRecords, RecordCategory, RecordCheckboxAnswer } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    value: T,
    category: RecordCategory,
}>()

const answers = computed(() => {
    return props.value.getRecordAnswers()
})

const recordsWithAnswers = computed(() => {
    const records = props.category.filterRecords(props.value);

    return records.map(record => {
        const answer = answers.value.get(record.id)
        return {
            record,
            answer,
            recordCheckboxAnswer: answer instanceof RecordCheckboxAnswer ? answer : null
        }
    })
})

</script>
