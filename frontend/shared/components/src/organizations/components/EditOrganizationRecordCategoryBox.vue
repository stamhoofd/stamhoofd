<template>
    <FillRecordCategoryBox :category="category" :value="organization" :validator="validator" :level="level" :all-optional="allOptional" :title-suffix="titleSuffix" @patch="addPatch" />
</template>

<script setup lang="ts">
import { FillRecordCategoryBox } from '@stamhoofd/components';
import { Organization, PatchAnswers, RecordCategory } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { ErrorBox } from '../../errors/ErrorBox';
import { Validator } from '../../errors/Validator';
import { useOrganization } from '../../hooks';

const props = defineProps<{
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

const currentOrganization = useOrganization();

// todo
const allOptional = ref(true);

const titleSuffix = computed(() => {
    // Platform admins can see who owns the record category
    if (props.organization && (!currentOrganization.value || currentOrganization.value.id !== props.organization.id)) {
        return props.organization.name;
    }

    return '';
});
</script>
