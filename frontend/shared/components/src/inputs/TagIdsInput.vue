<template>
    <STList>
        <STListItem v-if="nullable" :selectable="true" element-name="label">
            <template #left>
                <Checkbox v-model="allTags" />
            </template>
            <h3 class="style-title-list">
                {{ $t('shared.allOrganizations') }}
            </h3>
        </STListItem>

        <template v-if="model !== null">
            <STListItem v-for="tag of tags" :key="tag.id" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :model-value="getTagValue(tag.id)" @update:model-value="setTagValue(tag.id, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ tag.name }}
                </h3>
            </STListItem>
        </template>
    </STList>
</template>

<script setup lang="ts">
import { usePlatform } from '@stamhoofd/components';
import { computed, ref, watchEffect } from 'vue';

withDefaults(
    defineProps<{
        nullable?: boolean
    }>(), {
        nullable: false
    }
)

const model = defineModel<string[]|null>({required: true})
const platform = usePlatform();

const tags = computed(() => platform.value.config.tags)
const lastCachedValue = ref<string[]|null>(null);

watchEffect(() => {
    if (model.value !== null) {
        lastCachedValue.value = model.value;
    }
})

const allTags = computed({
    get: () => model.value === null,
    set: (allTags) => {
        if (allTags) {
            model.value = null;
        } else {
            model.value = (lastCachedValue.value ?? []).slice()
        }
    }
})

function getTagValue(tag: string) {
    return model.value?.includes(tag) ?? false;
}

function setTagValue(tag: string, value: boolean) {
    if (model.value === null) {
        return;
    }
    if (value) {
        model.value = [...model.value.filter(t => t !== tag), tag];
    } else {
        model.value = model.value.filter(t => t !== tag);
    }
}
</script>
