<template>
    <div>
        <ViewOrganizationRecordCategoryBox v-for="category of recordCategories" :key="category.id" :organization="organization" :category="category" />
    </div>
</template>

<script setup lang="ts">
import { usePlatform } from '@stamhoofd/components';
import { Organization } from '@stamhoofd/structures';
import { computed } from 'vue';
import ViewOrganizationRecordCategoryBox from './ViewOrganizationRecordCategoryBox.vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    organization: Organization;
}>();

const platform = usePlatform();

const recordCategories = computed(() => {
    return platform.value.config.organizationLevelRecordsConfiguration.getEnabledCategories(props.organization);
});

</script>
