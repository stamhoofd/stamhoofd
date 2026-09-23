<template>
    <FillRecordCategoryBox :force-mark-reviewed="willMarkReviewed" :is-admin="isAdmin" :parent-error-box="parentErrorBox" :category="category" :value="member" :validator="validator" :level="level" :all-optional="allOptional" :title-suffix="titleSuffix" @patch="addPatch" />
</template>

<script setup lang="ts">
import type { PatchAnswers, PlatformMember, RecordCategory } from '@stamhoofd/structures';

import type { Validator } from '../../../errors/Validator';

import { computed } from 'vue';
import FillRecordCategoryBox from '../../../records/components/FillRecordCategoryBox.vue';
import { useIsAllOptional } from '../../hooks/useIsPropertyRequired';
import { useAppContext } from '../../../context/appContext';
import type { ErrorBox } from '../../../errors/ErrorBox';
import { useOrganization } from '#hooks/useOrganization.ts';
import { getRecordCategoryTitleSuffix } from './recordCategoryTitleSuffix';

const props = withDefaults(defineProps<{
    member: PlatformMember;
    validator: Validator;
    category: RecordCategory;
    parentErrorBox?: ErrorBox | null;
    isAdmin?: boolean | null;
    level?: number;
    willMarkReviewed?: boolean | null;
}>(), {
    level: 1,
    parentErrorBox: null,
    isAdmin: null,
    willMarkReviewed: null,
});

defineOptions({
    inheritAttrs: false,
});

const allOptional = useIsAllOptional(computed(() => props.member));
const app = useAppContext();
const organization = useOrganization();

const titleSuffix = computed(() => getRecordCategoryTitleSuffix({ member: props.member, category: props.category, app, organization: organization.value }));

function addPatch(patch: PatchAnswers) {
    props.member.addDetailsPatch({
        recordAnswers: patch,
    });
}
</script>
