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
    </div>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { ObjectWithRecords, PermissionLevel, RecordCategory, RecordCheckboxAnswer } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../context';

const props = defineProps<{
    value: T;
    category: RecordCategory;
}>();

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

</script>
