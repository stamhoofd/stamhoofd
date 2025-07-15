<template>
    <FillRecordCategoryBox :force-mark-reviewed="willMarkReviewed" :is-admin="isAdmin" :parent-error-box="parentErrorBox" :category="category" :value="member" :validator="validator" :level="level" :all-optional="allOptional" :title-suffix="titleSuffix" @patch="addPatch" />
</template>

<script setup lang="ts">
import { PatchAnswers, PlatformMember, RecordCategory } from '@stamhoofd/structures';

import { Validator } from '../../../errors/Validator';

import { computed } from 'vue';
import FillRecordCategoryBox from '../../../records/components/FillRecordCategoryBox.vue';
import { useIsAllOptional } from '../../hooks/useIsPropertyRequired';
import { useAppContext } from '../../../context/appContext';
import { ErrorBox } from '../../../errors/ErrorBox';
import { useOrganization } from '../../../hooks';

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

const owningOrganization = computed(() => {
    return props.member.organizations.find(o => o.meta.recordsConfiguration.recordCategories.find(c => c.id === props.category.id));
});
const titleSuffix = computed(() => {
    if (app === 'registration') {
        return '';
    }

    // Platform admins can see who owns the record category
    if (owningOrganization.value && (!organization.value || owningOrganization.value.id !== organization.value.id)) {
        return owningOrganization.value.name;
    }

    return '';
});

function addPatch(patch: PatchAnswers) {
    props.member.addDetailsPatch({
        recordAnswers: patch,
    });
}
</script>
