<template>
    <FillRecordCategoryBox :category="category" :value="organization" :validator="validator" :level="level" :all-optional="app === 'admin'" @patch="addPatch" />
</template>

<script setup lang="ts">
import { FillRecordCategoryBox, useAppContext } from '@stamhoofd/components';
import { Organization, PatchAnswers, RecordCategory } from '@stamhoofd/structures';
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

const app = useAppContext();
</script>
