<template>
    <LoadingViewTransition :loading="loadingView" :error-box="errorBox">
        <form class="st-view" data-testid="save-view" v-bind="$attrs" @submit.prevent="$emit('save')">
            <STNavigationBar :title="title instanceof TranslatedString ? title.toString() : title" :disable-pop="true" :disable-dismiss="true">
                <template v-if="canPop || (!preferLargeButton && ($isMobile || $isIOS || $isAndroid))" #left>
                    <BackButton v-if="canPop" @click="pop()" />
                    <button v-else-if="$isAndroid" class="button icon close" type="button" @click="pop()" />
                    <button v-else class="button text selected unbold" type="button" @click="pop()">
                        {{ cancelText }}
                    </button>
                </template>

                <template #right>
                    <template v-if="!$isMobile && !$isIOS">
                        <slot name="buttons" />
                    </template>
                    <LoadingButton v-if="canDelete" :loading="deleting">
                        <button v-tooltip="$t('ea84aed8-48ce-4a43-b391-0a4a16782909')" class="button icon trash" type="button" :disabled="deleting" @click="$emit('delete')" />
                    </LoadingButton>
                    <LoadingButton v-if="!preferLargeButton && ($isMobile || $isIOS || $isAndroid)" :loading="loading">
                        <button v-if="saveIconMobile" v-tooltip="saveText" :class="'button icon navigation ' + saveIconMobile" :disabled="disabled" type="submit" data-testid="save-button" />
                        <button v-else class="button navigation highlight" :disabled="disabled" type="submit" data-testid="save-button">
                            {{ saveText }}
                        </button>
                    </LoadingButton>
                    <template v-else-if="canDismiss && !(!preferLargeButton && ($isMobile || $isIOS || $isAndroid))">
                        <button v-if="!$isIOS" class="button icon close" type="button" data-testid="close-button" @click="dismiss()" />
                        <button v-else class="button text selected unbold" type="button" data-testid="close-button" @click="dismiss()">
                            {{ cancelText }}
                        </button>
                    </template>
                </template>
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
                        <button class="button" :class="saveButtonClass" :disabled="disabled" type="submit" data-testid="save-button">
                            <span v-if="saveIcon" class="icon " :class="saveIcon" />
                            <span>{{ saveText }}</span>
                            <span v-if="saveIconRight" class="icon " :class="saveIconRight" />
                            <span v-if="saveBadge" class="bubble" v-text="saveBadge" />
                        </button>
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
import { useCanDismiss, useCanPop, useDismiss, usePop } from '@simonbackx/vue-app-navigation';
import { computed, getCurrentInstance } from 'vue';
import LoadingViewTransition from '../containers/LoadingViewTransition.vue';
import { useKeyDown } from '../hooks';
import { defineEditorContext } from '../inputs/hooks/useEditorContext';
import BackButton from './BackButton.vue';
import LoadingButton from './LoadingButton.vue';
import STButtonToolbar from './STButtonToolbar.vue';
import STNavigationBar from './STNavigationBar.vue';
import STToolbar from './STToolbar.vue';
import { SaveViewDefaults, SaveViewProps } from './SaveViewProps';
import { TranslatedString } from '@stamhoofd/structures';

defineOptions({
    inheritAttrs: false,
});

withDefaults(
    defineProps<SaveViewProps>(),
    SaveViewDefaults,
);

const canDelete = computed(() => {
    // Check has delete listener
    return !!getCurrentInstance()?.vnode.props?.onDelete;
});

const canDismiss = useCanDismiss();
const canPop = useCanPop();
const dismiss = useDismiss();
const pop = usePop();
const emit = defineEmits(['save', 'delete']);
defineEditorContext();

// CMD + S = Save
useKeyDown((key, modifiers) => {
    if (key === 's' && (modifiers.ctrl || modifiers.meta)) {
        void emit('save');
        return true;
    }
    return false;
});
</script>
