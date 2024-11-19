<template>
    <div class="loading-box-container">
        <transition name="fade" :appear="true">
            <div v-if="!loading && $slots.default && isValidVnodes($slots.default())" key="a" class="loading-box-transition">
                <slot />
            </div>
            <LoadingBox v-else :view="view" :error-box="errorBox" class="loading-box-transition" />
        </transition>
    </div>
</template>

<script setup lang="ts">
import { Comment, Fragment, isVNode } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import LoadingBox from './LoadingBox.vue';

withDefaults(
    defineProps<{
        loading?: boolean;
        view?: boolean;
        errorBox?: ErrorBox | null;
    }>(),
    {
        loading: false,
        errorBox: null,
        view: false,
    },
);

// Helps detect empty nodes
function isValidVnodes(vnodes: any) {
    return vnodes.some((child: any) => {
        if (!isVNode(child)) return false;
        if (child.type === Comment) return false;
        if (child.type === Fragment && !isValidVnodes(child.children)) return false;
        return true;
    })
        ? true
        : false;
}

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles';

.loading-box-container {
    position: relative;
}

.loading-box-transition {
    opacity: 1;
    transition: opacity 0.2s;

    &.fade-leave-active {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        z-index: 100;
    }

    &.fade-enter-from {
        opacity: 1;
    }

    &.fade-leave-to {
        opacity: 0;
    }
}
</style>
