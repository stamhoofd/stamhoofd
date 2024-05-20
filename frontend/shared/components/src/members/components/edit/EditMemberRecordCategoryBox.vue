<template>
    <FillRecordCategoryBox :category="category" :value="member" :validator="validator" :level="level" :all-optional="allOptional" :title-suffix="titleSuffix" @patch="addPatch" />
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

const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    category: RecordCategory,
    parentErrorBox?: ErrorBox | null
    level?: number
}>();

defineOptions({
    inheritAttrs: false
})

const allOptional = useIsAllOptional(computed(() => props.member));
const app = useAppContext()
const organization = useOrganization();

const owningOrganization = computed(() => {
    return props.member.organizations.find(o => o.meta.recordsConfiguration.recordCategories.find(c => c.id == props.category.id))
})
const titleSuffix = computed(() => {
    if (allOptional.value && app == 'registration') {
        return " (optioneel)"
    }
    if (app == 'registration') {
        return ""
    }

    // Platform admins can see who owns the record category
    if (owningOrganization.value && (!organization.value || owningOrganization.value.id !== organization.value.id)) {
        return owningOrganization.value.name
    }

    return ""
})

function addPatch(patch: PatchAnswers) {
    props.member.addDetailsPatch({
        recordAnswers: patch
    })
}
</script>
