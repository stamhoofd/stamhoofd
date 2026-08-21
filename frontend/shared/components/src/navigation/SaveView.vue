<template>
    <LoadingViewTransition :loading="loadingView" :error-box="errorBox">
        <form class="st-view" data-testid="save-view" v-bind="$attrs" novalidate @submit.prevent="$emit('save')">
            <STNavigationBar :title="title instanceof TranslatedString ? title.toString() : title" :disable-pop="true" :disable-dismiss="true">
                <template v-if="canPop || (!preferLargeButton && ($isMobile || $isIOS || $isAndroid))" #left>
                    <BackButton v-if="canPop" @click="pop()" />
                    <button v-else-if="$isAndroid || $isIOS" class="button icon close" type="button" @click="pop()" />
                    <button v-else class="button text selected unbold" type="button" @click="pop()">
                        {{ cancelText }}
                    </button>
                </template>

                <template #right>
                    <template v-if="!$isMobile && !$isIOS">
                        <slot name="buttons" />
                    </template>
                    <LoadingButton v-if="canDelete" :loading="deleting">
                        <button v-tooltip="$t('%CJ')" class="button icon trash" type="button" :disabled="deleting" @click="$emit('delete')" />
                    </LoadingButton>
                    <LoadingButton v-if="!preferLargeButton && ($isMobile || $isIOS || $isAndroid)" :loading="loading">
                        <button v-if="saveIconMobile" v-tooltip="saveText" :class="'button icon navigation highlight ' + saveIconMobile" :disabled="isSaveDisabled" type="submit" data-testid="save-button" />
                        <button v-else-if="$isIOS || $isAndroid" v-tooltip="saveText" :class="'button icon navigation highlight ' + (saveIcon ?? 'success')" :disabled="isSaveDisabled" type="submit" data-testid="save-button" />
                        <button v-else class="button navigation highlight" :disabled="isSaveDisabled" type="submit" data-testid="save-button">
                            {{ saveText }}
                        </button>
                    </LoadingButton>
                    <template v-else-if="canDismiss && !(!preferLargeButton && ($isMobile || $isIOS || $isAndroid))">
                        <button class="button icon close" type="button" data-testid="close-button" @click="dismiss()" />
                    </template>
                </template>
                <slot name="fixed" />
            </STNavigationBar>
            <main class="center" :class="mainClass">
                <slot />
            </main>
            <STToolbar v-if="preferLargeButton || (!$isMobile && !$isIOS && !$isAndroid)">
                <template #left>
                    <slot name="left" />
                </template>
                <template #right>
                    <div v-if="$slots.toolbar" class="editor-button-bar">
                        <slot name="toolbar" />
                    </div>
                    <button v-else-if="!$slots.toolbar && addExtraCancel && (canPop || canDismiss) && cancelText !== null" class="button secundary" type="button" @click="pop()">
                        {{ cancelText }}
                    </button>
                    <LoadingButton :loading="loading">
                        <ProgressOutline :progress="availabilityProgress" :radius="13" class="save-button-progress-outline" :class="saveButtonClass">
                            <button class="button" :class="saveButtonClass" :disabled="isSaveDisabled" type="submit" data-testid="save-button">
                                <span v-if="saveIcon" class="icon " :class="saveIcon" />
                                <span>{{ saveText }}</span>
                                <span v-if="saveIconRight" class="icon " :class="saveIconRight" />
                                <span v-if="saveBadge" class="bubble" v-text="saveBadge" />
                            </button>
                        </ProgressOutline>
                    </LoadingButton>
                </template>
            </STToolbar>
            <STButtonToolbar v-else-if="!!$slots.buttons || !!$slots.toolbar" class="sticky">
                <slot name="buttons" />
                <slot name="toolbar" />
            </STButtonToolbar>
        </form>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { useKeyDown } from '#hooks/useKeyDown.ts';
import { useCanDismiss, useCanPop, useDismiss, usePop } from '@simonbackx/vue-app-navigation';
import { TranslatedString } from '@stamhoofd/structures';
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue';
import LoadingViewTransition from '../containers/LoadingViewTransition.vue';
import { defineEditorContext } from '../inputs/hooks/useEditorContext';
import ProgressOutline from '../ProgressOutline.vue';
import BackButton from './BackButton.vue';
import LoadingButton from './LoadingButton.vue';
import STButtonToolbar from './STButtonToolbar.vue';
import STNavigationBar from './STNavigationBar.vue';
import STToolbar from './STToolbar.vue';
import type { SaveViewProps } from './SaveViewProps';
import { SaveViewDefaults } from './SaveViewProps';

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(
    defineProps<SaveViewProps>(),
    SaveViewDefaults,
);

const canDelete = computed(() => {
    // Check has delete listener
    return !!getCurrentInstance()?.vnode.props?.onDelete;
});

// Temporarily disable the save button when an availabilityDelay is set (e.g. for destructive actions)
const now = ref(Date.now());
const availableAt = ref<number | null>(null);
let animationFrame: number | null = null;

function tick() {
    now.value = Date.now();
    if (availableAt.value && availableAt.value > now.value) {
        animationFrame = requestAnimationFrame(tick);
    } else {
        animationFrame = null;
    }
}

function easeOut(t: number) {
    return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
}

watch(() => props.availabilityDelay, (delay) => {
    availableAt.value = delay ? Date.now() + delay : null;
    if (animationFrame === null) {
        tick();
    }
}, { immediate: true });

onBeforeUnmount(() => {
    if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
    }
});

const availabilityProgress = computed(() => {
    if (!availableAt.value || !props.availabilityDelay) {
        return 100;
    }
    return easeOut(1 - (availableAt.value - now.value) / props.availabilityDelay) * 100;
});

const isSaveDisabled = computed(() => props.disabled || availabilityProgress.value < 100);

const canDismiss = useCanDismiss();
const canPop = useCanPop();
const dismiss = useDismiss();
const pop = usePop();
const emit = defineEmits(['save', 'delete']);
defineEditorContext();

// CMD + S = Save
useKeyDown((key, modifiers) => {
    if (key === 's' && (modifiers.ctrl || modifiers.meta)) {
        if (!isSaveDisabled.value) {
            void emit('save');
        }
        return true;
    }
    return false;
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.save-button-progress-outline {
    &.primary, &.secundary {
        color: $color-gray-2;
    }

    &.destructive {
        color: $color-error;

        .progress-outline-svg > rect.bar {
            opacity: 0.4;
        }
    }
}
</style>
