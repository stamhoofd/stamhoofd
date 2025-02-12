<template>
    <STList v-if="!compact" class="info">
        <STListItem v-for="{record, answer, recordCheckboxAnswer} of recordsWithAnswers" :key="record.id">
            <h3 class="style-definition-label">
                {{ record.name }}
            </h3>
            <p v-if="!answer" class="style-definition-text">
                /
            </p>
            <template v-else-if="recordCheckboxAnswer">
                <p class="style-definition-text">
                    <span v-if="recordCheckboxAnswer.selected" class="icon success primary" />
                    <span v-else class="icon canceled gray" />
                    <span v-if="recordCheckboxAnswer.comments" v-copyable class="pre-wrap style-copyable" v-text="recordCheckboxAnswer.comments" />
                </p>
            </template>
            <p v-else v-copyable class="style-definition-text pre-wrap style-copyable" v-text="answer.stringValue" />
        </STListItem>

        <STListItem v-for="cc of childCategories" :key="cc.id">
            <h3 class="style-definition-label">
                {{ cc.name }}
            </h3>
            <RecordCategoryAnswersBox :value="value" :category="cc" :compact="true" />
        </STListItem>
    </STList>

    <template v-else-if="isAllCheckboxAnswers">
        <template v-for="{record, recordCheckboxAnswer} of recordsWithAnswers.filter(({recordCheckboxAnswer}) => recordCheckboxAnswer?.selected)" :key="record.id">
            <p class="style-definition-text">
                {{ record.name }}
            </p>
            <p v-if="recordCheckboxAnswer?.comments" v-copyable class="style-description-small pre-wrap" v-text="recordCheckboxAnswer.comments" />
        </template>
        <p v-if="recordsWithAnswers.filter(({recordCheckboxAnswer}) => recordCheckboxAnswer?.selected).length === 0" class="style-description">
            Geen
        </p>
    </template>

    <dl v-else class="details-grid">
        <template v-for="{record, answer, recordCheckboxAnswer} of recordsWithAnswers" :key="record.id">
            <dt class="center">
                {{ record.name }}
            </dt>
            <dd v-if="!answer">
                /
            </dd>
            <template v-else-if="recordCheckboxAnswer">
                <dd>
                    <span v-if="recordCheckboxAnswer.selected" class="icon success primary" />
                    <span v-else class="icon canceled gray" />
                </dd>
                <dd v-if="recordCheckboxAnswer.comments" :key="'dd-description-'+record.id" v-copyable class="description pre-wrap style-copyable" v-text="recordCheckboxAnswer.comments" />
            </template>
            <dd v-else v-copyable class="pre-wrap style-copyable" v-text="answer.stringValue" />
        </template>
    </dl>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { ObjectWithRecords, PermissionLevel, RecordCategory, RecordCheckboxAnswer } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../context';

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

const isAllCheckboxAnswers = computed(() => {
    return recordsWithAnswers.value.every(({ recordCheckboxAnswer }) => recordCheckboxAnswer);
});

</script>
