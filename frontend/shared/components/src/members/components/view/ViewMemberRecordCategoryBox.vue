<template>
    <ViewRecordCategoryAnswersBox :value="member" :category="category" :is-admin="isAdmin">
        <template v-if="titleSuffix" #title-suffix>
            <span class="title-suffix hover-show">
                {{ titleSuffix }}
            </span>
        </template>
    </ViewRecordCategoryAnswersBox>
</template>

<script setup lang="ts">
import { PlatformMember, RecordCategory } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { useOrganization } from '../../../hooks';
import ViewRecordCategoryAnswersBox from '../../../records/components/ViewRecordCategoryAnswersBox.vue';

const props = defineProps<{
    category: RecordCategory;
    member: PlatformMember;
    isAdmin: boolean;
}>();

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

</script>
