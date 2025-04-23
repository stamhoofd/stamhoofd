<template>
    <STList>
        <STListItem v-if="nullable" :selectable="true" element-name="label">
            <template #left>
                <Checkbox v-model="allGroups" />
            </template>
            <h3 class="style-title-list">
                {{ nullableLabel }}
            </h3>
        </STListItem>

        <template v-if="model !== null">
            <STListItem v-for="item of items" :key="item.value" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :model-value="getGroupValue(item.value)" @update:model-value="setGroupValue(item.value, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ item.name }}
                </h3>
                <p v-if="item.description" class="style-description-small" v-text="item.description" />
            </STListItem>
        </template>
    </STList>
</template>

<script setup lang="ts" generic="T extends string|number, Nullable extends true|false = false">
import { computed, ref, watchEffect } from 'vue';

const props = withDefaults(
    defineProps<{
        nullable?: Nullable;
        nullableLabel?: string;
        items: { name: string; value: T; description?: string }[];
    }>(), {
        nullable: false as any,
        nullableLabel: $t(`Alles`),
    },
);

type Arr = Nullable extends true ? (T[] | null) : T[];
const model = defineModel<Arr>({ required: true });
const lastCachedValue = ref<Arr>((props.nullable ? null : []) as Arr);

watchEffect(() => {
    if (model.value !== null) {
        lastCachedValue.value = model.value;
    }
});

const allGroups = computed({
    get: () => model.value === null,
    set: (allGroups) => {
        if (allGroups) {
            model.value = null as Arr;
        }
        else {
            model.value = (lastCachedValue.value ?? []).slice();
        }
    },
});

function getGroupValue(group: T) {
    return model.value?.includes(group) ?? false;
}

function setGroupValue(group: T, value: boolean) {
    if (model.value === null) {
        return;
    }
    if (value) {
        model.value = [...model.value.filter(t => t !== group), group] as Arr;
    }
    else {
        model.value = model.value.filter(t => t !== group) as Arr;
    }
}
</script>
