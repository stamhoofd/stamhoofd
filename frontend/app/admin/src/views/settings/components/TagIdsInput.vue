<template>
    <STList>
        <STListItem v-for="tag of tags" :key="tag.id" :selectable="true" element-name="label">
            <template #left>
                <Checkbox :model-value="getTagValue(tag.id)" @update:model-value="setTagValue(tag.id, $event)" />
            </template>
            <h3 class="style-title-list">
                {{ tag.name }}
            </h3>
        </STListItem>
    </STList>
</template>

<script setup lang="ts">
import { usePlatform } from '@stamhoofd/components';
import { computed } from 'vue';

const model = defineModel<string[]>({required: true})
const platform = usePlatform();

const tags = computed(() => platform.value.config.tags)

function getTagValue(tag: string) {
    return model.value.includes(tag);
}

function setTagValue(tag: string, value: boolean) {
    if (value) {
        model.value = [...model.value.filter(t => t !== tag), tag];
    } else {
        model.value = model.value.filter(t => t !== tag);
    }
}
</script>
