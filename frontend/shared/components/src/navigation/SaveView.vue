<template>
    <LoadingViewTransition :loading="loadingView" :error-box="errorBox">
        <form class="st-view" data-testid="save-view" @submit.prevent="$emit('save')">
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
import { TranslatedString } from '@stamhoofd/structures';
import { computed, getCurrentInstance } from 'vue';
import LoadingViewTransition from '../containers/LoadingViewTransition.vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useKeyDown } from '../hooks';
import { defineEditorContext } from '../inputs/hooks/useEditorContext';
import BackButton from './BackButton.vue';
import LoadingButton from './LoadingButton.vue';
import STButtonToolbar from './STButtonToolbar.vue';
import STNavigationBar from './STNavigationBar.vue';
import STToolbar from './STToolbar.vue';

withDefaults(
    defineProps<{
        loading?: boolean;
        loadingView?: boolean;
        errorBox?: ErrorBox | null;
        deleting?: boolean;
        disabled?: boolean;
        title?: string | TranslatedString;
        saveText?: string;
        saveIcon?: string | null;
        saveButtonClass?: string | null;
        saveIconRight?: string | null;
        saveIconMobile?: string | null;
        saveBadge?: string | number | null;
        cancelText?: string | null;
        preferLargeButton?: boolean;
        addExtraCancel?: boolean;
        mainClass?: string;
    }>(), {
        loading: false,
        loadingView: false,
        errorBox: null,
        deleting: false,
        disabled: false,
        title: '',
        saveText: () => $t(`bc6b2553-c28b-4e3b-aba3-4fdc2c23db6e`),
        saveIcon: null,
        saveButtonClass: 'primary',
        saveIconRight: null,
        saveIconMobile: null,
        saveBadge: null,
        cancelText: () => $t(`80651252-e037-46b2-8272-a1a030c54653`),
        preferLargeButton: false,
        addExtraCancel: false,
        mainClass: '',
    },
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
