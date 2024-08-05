<template>
    <dt>{{ label }}</dt>
    <dd  class="with-icons hover-box" :class="{button: $context.auth.hasFullAccess()}">
        <span v-copyable>
            <template v-if="Array.isArray(value)">
                <template v-for="(line, index) of value">
                    {{ line }}
                    <br v-if="index < value.length - 1">
                </template>
            </template>
            <template v-else>
                {{ value }}
            </template>
        </span>
        <Transition name="fade" mode="out-in">
            <Spinner v-if ="showLoader"/>
            <span v-else-if="$context.auth.hasFullAccess()"
                class="icon hover-show" :class="[icon, color]"
                @click="doDelete"/>
        </Transition>
    </dd>
</template>

<script setup lang="ts" generic="T extends string | string[]">
import { Spinner } from '@stamhoofd/components';
import { computed, ref } from 'vue';
const props = defineProps<{label: string, value: T, icon: string, color?: string, loading?: boolean, onDelete?: () => Promise<void>}>();
const emits = defineEmits<{(e: 'clickButton'): void}>();

const isLoading = ref(false);
const showLoader = computed(() => props.loading || isLoading.value);

function doDelete() {
    if(showLoader.value) return;
    emits('clickButton');
    const onDelete = props.onDelete;
    if(onDelete) {
        isLoading.value = true;
        onDelete().finally(() => isLoading.value = false);
    }
}
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease !important;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0 !important;
}
</style>
