<template>
    <STList>
        <STListItem v-if="nullable" :selectable="true" element-name="label">
            <template #left>
                <Checkbox v-model="allGroups" />
            </template>
            <h3 class="style-title-list">
                {{ $t('shared.allAgeGroups') }}
            </h3>
        </STListItem>

        <template v-if="model !== null">
            <STListItem v-for="group of defaultAgeGroups" :key="group.id" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :model-value="getGroupValue(group.id)" @update:model-value="setGroupValue(group.id, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ group.name }}
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

const defaultAgeGroups = computed(() => platform.value.config.defaultAgeGroups)
const lastCachedValue = ref<string[]|null>(null);

watchEffect(() => {
    if (model.value !== null) {
        lastCachedValue.value = model.value;
    }
})

const allGroups = computed({
    get: () => model.value === null,
    set: (allGroups) => {
        if (allGroups) {
            model.value = null;
        } else {
            model.value = (lastCachedValue.value ?? []).slice()
        }
    }
})

function getGroupValue(group: string) {
    return model.value?.includes(group) ?? false;
}

function setGroupValue(group: string, value: boolean) {
    if (model.value === null) {
        return;
    }
    if (value) {
        model.value = [...model.value.filter(t => t !== group), group];
    } else {
        model.value = model.value.filter(t => t !== group);
    }
}
</script>
