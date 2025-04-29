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

        <RecordCategoryAnswersBox :value="value as ObjectWithRecords" :category="category" :compact="compact" :is-admin="isAdmin" />
    </div>
</template>

<script lang="ts" setup generic="T extends ObjectWithRecords">
import { ObjectWithRecords, RecordCategory } from '@stamhoofd/structures';
import RecordCategoryAnswersBox from './RecordCategoryAnswersBox.vue';

withDefaults(
    defineProps<{
        value: T;
        category: RecordCategory;
        compact?: boolean;
        isAdmin?: boolean | null;
    }>(),
    {
        compact: false,
        isAdmin: null,
    },
);

</script>
