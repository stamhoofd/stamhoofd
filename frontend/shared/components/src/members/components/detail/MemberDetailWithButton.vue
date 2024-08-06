<template>
    <dt v-if="label">{{ label }}</dt>
    <dd  class="with-icons hover-box" :class="{button: $context.auth.hasFullAccess(), 'no-label': label === undefined}">
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
                @click="clickHandler"/>
        </Transition>
    </dd>
</template>

<script setup lang="ts" generic="T extends string | string[]">
import { Spinner } from '@stamhoofd/components';
import { computed, ref } from 'vue';
const props = defineProps<{label?: string, value: T, icon: string, color?: string, loading?: boolean, onClick?: () => Promise<void>}>();
const emits = defineEmits<{(e: 'clickButton'): void}>();

const isLoading = ref(false);
const showLoader = computed(() => props.loading || isLoading.value);

function clickHandler() {
    if(showLoader.value) return;
    emits('clickButton');
    const onDelete = props.onClick;
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

.no-label {
    grid-column: span 2;
}
</style>
