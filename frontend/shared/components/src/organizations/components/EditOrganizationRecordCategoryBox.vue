<template>
    <FillRecordCategoryBox :category="category" :value="organization" :validator="validator" :level="level" :all-optional="allOptional" @patch="addPatch" />
</template>

<script setup lang="ts">
import { FillRecordCategoryBox } from '@stamhoofd/components';
import { Organization, PatchAnswers, RecordCategory } from '@stamhoofd/structures';
import { ref } from 'vue';
import { ErrorBox } from '../../errors/ErrorBox';
import { Validator } from '../../errors/Validator';

defineProps<{
    organization: Organization;
    validator: Validator;
    category: RecordCategory;
    parentErrorBox?: ErrorBox | null;
    level?: number;
    addPatch(patch: PatchAnswers): void;
}>();

defineOptions({
    inheritAttrs: false,
});

// todo
const allOptional = ref(true);
</script>
