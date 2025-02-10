<template>
    <ViewRecordCategoryAnswersBox :value="organization" :category="category" />
</template>

<script setup lang="ts">
import { ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { Organization, RecordCategory } from '@stamhoofd/structures';

defineProps<{
    category: RecordCategory;
    organization: Organization;
}>();
</script>
