<template>
    <div class="hover-box container">
        <hr>
        <h2>
            {{ category.name }}
            <span v-if="titleSuffix" class="title-suffix hover-show">
                {{ titleSuffix }}
            </span>
        </h2>
        <ViewRecordCategoryAnswersBox :value="member" :category="category" />
    </div>
</template>

<script setup lang="ts">
import { PlatformMember, RecordCategory } from '@stamhoofd/structures';
import ViewRecordCategoryAnswersBox from '../../../records/components/ViewRecordCategoryAnswersBox.vue';
import { useAppContext } from '../../../context/appContext';
import { useOrganization } from '../../../hooks';
import { computed } from 'vue';

const props = defineProps<{
    category: RecordCategory,
    member: PlatformMember
}>()

const app = useAppContext()
const organization = useOrganization();

const owningOrganization = computed(() => {
    return props.member.organizations.find(o => o.meta.recordsConfiguration.recordCategories.find(c => c.id == props.category.id))
})
const titleSuffix = computed(() => {
    if (app == 'registration') {
        return ""
    }

    // Platform admins can see who owns the record category
    if (owningOrganization.value && (!organization.value || owningOrganization.value.id !== organization.value.id)) {
        return owningOrganization.value.name
    }

    return ""
})

</script>
