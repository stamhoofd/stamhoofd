<template>
    <div class="hover-box container">
        <hr>
        <h2>
            {{ category.name }}
        </h2>
        <ViewRecordCategoryAnswersBox :value="organization" :category="category" />
    </div>
</template>

<script setup lang="ts">
import { ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { BaseOrganization, RecordCategory } from '@stamhoofd/structures';

defineProps<{
    category: RecordCategory;
    organization: BaseOrganization;
}>();
</script>
