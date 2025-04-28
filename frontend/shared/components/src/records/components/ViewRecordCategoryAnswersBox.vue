<template>
    <div class="container">
        <hr>
        <h2 class="style-with-button">
            <div>
                {{ category.name }}
                <slot name="title-suffix" />
            </div>
            <div>
                <slot name="buttons" />
            </div>
        </h2>

        <RecordCategoryAnswersBox :value="value as ObjectWithRecords" :category="category" :compact="compact" />
    </div>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { ObjectWithRecords, PermissionLevel, RecordCategory, RecordCheckboxAnswer } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../context';
import RecordCategoryAnswersBox from './RecordCategoryAnswersBox.vue';

const props = withDefaults(
    defineProps<{
        value: T;
        category: RecordCategory;
        compact?: boolean;
    }>(),
    {
        compact: false,
    },
);

const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';
const filterOptions = isAdmin
    ? undefined
    : {
            level: PermissionLevel.Read,
        };

const answers = computed(() => {
    return props.value.getRecordAnswers();
});

const recordsWithAnswers = computed(() => {
    const records = props.category.filterRecords(props.value, filterOptions);

    return records.map((record) => {
        const answer = answers.value.get(record.id);
        return {
            record,
            answer,
            recordCheckboxAnswer: answer instanceof RecordCheckboxAnswer ? answer : null,
        };
    });
});

const childCategories = computed(() => {
    return props.category.filterChildCategories(props.value, filterOptions);
});

</script>
