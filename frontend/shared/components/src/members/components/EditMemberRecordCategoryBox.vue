<template>
    <FillRecordCategoryBox :category="category" :value="member" :validator="validator" :level="level" :all-optional="allOptional" @patch="addPatch" />
</template>

<script setup lang="ts">
import { PatchAnswers, PlatformMember, RecordCategory } from '@stamhoofd/structures';

import { Validator } from '../../errors/Validator';

import { computed } from 'vue';
import FillRecordCategoryBox from '../../records/components/FillRecordCategoryBox.vue';
import { useIsAllOptional } from '../hooks/useIsPropertyRequired';

const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    category: RecordCategory,
    level?: number
}>();

const allOptional = useIsAllOptional(computed(() => props.member));

function addPatch(patch: PatchAnswers) {
    props.member.addDetailsPatch({
        recordAnswers: patch
    })
}
</script>
