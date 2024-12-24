<template>
    <div>
        <ViewOrganizationRecordCategoryBox v-for="category of recordCategories" :key="category.id" :organization="organization" :category="category" />
    </div>
</template>

<script setup lang="ts">
import { usePlatform } from '@stamhoofd/components';
import { BaseOrganization } from '@stamhoofd/structures';
import { computed } from 'vue';
import ViewOrganizationRecordCategoryBox from './ViewOrganizationRecordCategoryBox.vue';

defineOptions({
    inheritAttrs: false,
});

defineProps<{
    organization: BaseOrganization;
}>();

const platform = usePlatform();

const recordCategories = computed(() => {
    return platform.value.config.organizationLvlRecordsConfiguration.recordCategories;
});

</script>
