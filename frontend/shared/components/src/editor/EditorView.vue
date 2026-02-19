<template>
    <form class="editor-view st-view" @submit.prevent="$emit('save')">
        <STNavigationBar :title="title" :disable-dismiss="true" :disable-pop="true">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
                <template v-else-if="$isMobile || $isIOS || $isAndroid">
                    <button v-if="$isAndroid || $isIOS" class="button icon close" type="button" @click="pop()" />
                    <button v-else class="button text selected unbold" type="button" @click="pop()">
                        {{ cancelText }}
                    </button>
                </template>
            </template>

            <template v-if="$isMobile || $isIOS || $isAndroid" #right>
                <LoadingButton :loading="loading">
                    <button v-if="saveIconMobile" v-tooltip="saveText" :class="'button icon navigation highlight ' + saveIconMobile" :disabled="disabled" type="submit" />
                    <button v-else-if="$isIOS" v-tooltip="saveText" :class="'button icon navigation highlight ' + (saveIcon ?? 'success')" :disabled="disabled" type="submit" data-testid="save-button" />
                    <button v-else class="button navigation highlight" :disabled="disabled" type="submit">
                        {{ saveText }}
                    </button>
                </LoadingButton>
            </template>
            <template v-else-if="canDismiss" #right>
                <button class="button icon close" type="button" @click="dismiss()" />
            </template>
        </STNavigationBar>
        <main ref="main" class="flex">
            <slot />

            <STList>
                <slot name="list" />
            </STList>

            <hr class="mail-hr"><div class="editor-container">
                <editor-content v-color="primaryColor" :editor="editor" class="editor-content" />
                <footer>
                    <slot name="footer" />
                </footer>
            </div>
            <TextStyleButtonsView v-if="!$isMobile && showTextStyles && !showLinkEditor" class="editor-button-bar sticky" :editor="editor" />

            <div v-if="!$isMobile && !showTextStyles && !showLinkEditor && editor.isActive('smartButton') && getSmartButton(editor.getAttributes('smartButton').id)" class="editor-button-bar hint sticky">
                {{ getSmartButton(editor.getAttributes('smartButton').id)!.hint }}
            </div>

            <div v-if="!$isMobile && !showTextStyles && !showLinkEditor && editor.isActive('smartVariable') && getSmartVariable(editor.getAttributes('smartVariable').id)?.hint" class="editor-button-bar hint sticky">
                {{ getSmartVariable(editor.getAttributes('smartVariable').id)!.hint }}
            </div>

            <div v-if="!$isMobile && !showTextStyles && !showLinkEditor && editor.isActive('smartVariableBlock') && getSmartVariable(editor.getAttributes('smartVariableBlock').id)?.hint" class="editor-button-bar hint sticky">
                {{ getSmartVariable(editor.getAttributes('smartVariableBlock').id)!.hint }}
            </div>

            <form v-if="showLinkEditor" class="editor-button-bar sticky link" autocomplete="off" novalidate data-submit-last-field @submit.prevent="saveLink()">
                <STList>
                    <STListItem class="no-padding right-stack">
                        <div class="list-input-box">
                            <span>{{ $t('10b83895-551f-4892-9b58-b7b62db58726') }}</span>

                            <input ref="linkInput" v-model="editLink" class="list-input" type="url" enterkeyhint="go" :placeholder="$t(`780fa99d-7109-4f57-934b-1f4c5643a794`)">
                        </div>
                        <template #right>
                            <button class="button text" type="submit" @mousedown.prevent>
                                {{ editLink.length === 0 ? "Sluiten" : "Opslaan" }}
                            </button>
                            <button v-if="editor.isActive('link')" class="button icon trash gray" type="button" :v-tooltip="$t('025d14dd-57d4-4ec4-aa85-ddf9ddf98b6f')" @mousedown.stop @click.stop.prevent="clearLink()" />
                        </template>
                    </STListItem>
                </STList>
            </form>
        </main>
        <STToolbar v-if="!$isMobile && !$isIOS && !$isAndroid">
            <template #right>
                <div class="editor-button-bar">
                    <button class="button icon text-style" :class="{ 'enabled': showTextStyles }" type="button" :v-tooltip="$t('24c13e07-66e8-421d-9dde-c69758395be8')" @mousedown.stop @click.prevent="showTextStyles = !showTextStyles" />
                    <hr><button v-if="smartVariables.length > 0" class="button icon wand" type="button" :v-tooltip="$t('52395130-fb1f-4508-951a-067dd6324575')" @click.prevent="showSmartVariableMenu" @mousedown.stop />
                    <button class="button icon hr" type="button" :v-tooltip="$t('6ec5c3ba-7b6d-4ceb-9950-e152bed49b0a')" @click="editor.chain().focus().setHorizontalRule().run()" @mousedown.stop />
                    <button class="button icon link" type="button" :class="{ 'enabled': editor.isActive('link') }" :v-tooltip="$t('f501785a-7e57-4184-8cf0-a3413ad2f2a4')" @click.prevent="openLinkEditor()" @mousedown.stop />
                    <UploadButton :resolutions="imageResolutions" @update:model-value="insertImage" @mousedown.native.stop>
                        <div class="button icon image" type="button" :v-tooltip="$t('91b1faf7-de10-46f3-9338-5930134da354')" />
                    </UploadButton>
                    <slot name="buttons" />
                </div>

                <LoadingButton :loading="loading">
                    <button class="button primary" :disabled="disabled" type="submit">
                        <span v-if="saveIcon" class="icon " :class="saveIcon" />
                        <span>{{ saveText }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
        <STButtonToolbar v-else-if="!showLinkEditor" class="sticky" @mousedown.stop>
            <button class="button icon text-style" type="button" :v-tooltip="$t('24c13e07-66e8-421d-9dde-c69758395be8')" @click.prevent="openTextStyles($event)" @mousedown.stop />
            <button v-if="smartVariables.length > 0" class="button icon wand" type="button" :v-tooltip="$t('130a074e-ce12-4bf1-9898-c49a3c00006e')" @click.prevent="showSmartVariableMenu" @mousedown.stop />
            <button class="button icon hr" type="button" :v-tooltip="$t('6ec5c3ba-7b6d-4ceb-9950-e152bed49b0a')" @click="editor.chain().focus().setHorizontalRule().run()" @mousedown.stop />
            <button class="button icon link" type="button" :class="{ 'enabled': editor.isActive('link') }" :v-tooltip="$t('f501785a-7e57-4184-8cf0-a3413ad2f2a4')" @click="openLinkEditor()" @mousedown.stop />
            <UploadButton :resolutions="imageResolutions" @update:model-value="insertImage" @mousedown.prevent>
                <div class="button icon image" type="button" :v-tooltip="$t('91b1faf7-de10-46f3-9338-5930134da354')" />
            </UploadButton>
            <slot name="buttons" />
        </STButtonToolbar>
    </form>
</template>

<script lang="ts" setup>
import { EditorSmartButton, EditorSmartVariable, Image, Replacement, ResolutionRequest } from '@stamhoofd/structures';
import { Content, JSONContent } from '@tiptap/core';
import { Image as ImageExtension } from '@tiptap/extension-image';
import Typography from '@tiptap/extension-typography';
import StarterKit from '@tiptap/starter-kit';
import { Editor, EditorContent } from '@tiptap/vue-3';
import { Focus } from '@tiptap/extensions';
import { useCanPop, useCanDismiss, useDismiss, usePop } from '@simonbackx/vue-app-navigation';
import { DataValidator } from '@stamhoofd/utility';
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue';
import UploadButton from '../inputs/UploadButton.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import BackButton from '../navigation/BackButton.vue';
import LoadingButton from '../navigation/LoadingButton.vue';
import STButtonToolbar from '../navigation/STButtonToolbar.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import STToolbar from '../navigation/STToolbar.vue';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { Toast } from '../overlays/Toast';
import { DescriptiveText } from './EditorDescriptiveText';
import { SmartButtonInlineNode, SmartButtonNode } from './EditorSmartButton';
import { SmartVariableNode, SmartVariableNodeBlock } from './EditorSmartVariable';
import TextStyleButtonsView from './TextStyleButtonsView.vue';
import { EmailBlock } from './EditorEmailBlock';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        customImage: {
            /**
             * Add an image
             */
            setImage: (options: { src: string; alt?: string; title?: string; width?: number; height?: number }) => ReturnType;
        };
    }
}

const CustomImage = ImageExtension.extend({
    name: 'customImage',
    addAttributes() {
        return {
            ...(this as any).parent?.(),
            width: {
                default: null,
            },
            height: {
                default: null,
            },
        };
    },
});

const props = withDefaults(
    defineProps<{
        loading?: boolean;
        disabled?: boolean;
        title?: string;
        saveText?: string;
        saveIcon?: string | null;
        saveIconMobile?: string | null;
        cancelText?: string;
        replacements?: Replacement[];
        emailBlock?: boolean;
    }>(),
    {
        loading: false,
        disabled: false,
        title: '',
        saveText: () => $t(`14abcd1e-7e65-4e84-be4c-ab2e162ae44d`),
        saveIcon: null,
        saveIconMobile: null,
        cancelText: () => $t(`4e1dc79e-b09c-41ec-aa8d-a2d052761bfe`),
        replacements: () => [],
        emailBlock: false,
    },
);

function smartVariablesFor(replacements: Replacement[]) {
    return EditorSmartVariable.forReplacements(replacements);
}

function smartButtonsFor(replacements: Replacement[]) {
    return EditorSmartButton.forReplacements(replacements);
}

const smartVariables = computed(() => {
    return smartVariablesFor(props.replacements);
});
const smartButtons = computed(() => {
    return smartButtonsFor(props.replacements);
});
const showTextStyles = ref(false);
const editLink = ref('');
const showLinkEditor = ref(false);
const canPop = useCanPop();
const canDismiss = useCanDismiss();
const pop = usePop();
const dismiss = useDismiss();
const editor = shallowRef(buildEditor());

function buildEditor(content: Content = '') {
    return new Editor({
        content,
        extensions: [
            StarterKit.configure({
                link: {
                    openOnClick: false,
                    protocols: ['mailto'],
                },
                trailingNode: {
                    notAfter: ['emailBlock'],
                },
            }),
            Typography.configure({}),
            Focus.configure({
                className: 'has-focus',
                mode: 'all',
            }),
            SmartVariableNode.configure({
                smartVariables: smartVariables.value.filter(s => !s.html),
            }),
            SmartVariableNodeBlock.configure({
                smartVariables: smartVariables.value.filter(s => !!s.html),
            }),
            SmartButtonNode.configure({
                smartButtons: smartButtons.value,
            }),
            SmartButtonInlineNode.configure({
                smartButtons: smartButtons.value,
            }),
            DescriptiveText,
            CustomImage,
            EmailBlock,
        ],
        onSelectionUpdate: ({ editor }) => {
            if (showLinkEditor.value) {
                if (editor.isActive('link')) {
                    editLink.value = editor.getAttributes('link')?.href ?? '';
                }
                else {
                    if (editor.state.selection.empty) {
                        showLinkEditor.value = false;
                    }
                }
            }
        },
    });
}

const linkInput = useTemplateRef<HTMLInputElement>('linkInput');

onBeforeUnmount(() => {
    editor.value.destroy();
});

async function openLinkEditor() {
    if (showLinkEditor.value) {
        editor.value.chain().focus().run();
        await nextTick(() => {
            showLinkEditor.value = false;
        });
        return;
    }
    if (!editor.value.isActive('link') && editor.value.state.selection.empty) {
        new Toast($t(`1a4e5a36-80ae-4858-a16b-a430c806ee8f`), 'info').show();
        return;
    }
    editLink.value = editor.value.getAttributes('link')?.href ?? '';
    showLinkEditor.value = true;
    await nextTick(() => {
        linkInput.value?.focus();
    });
}

function isValidHttpUrl(string: string) {
    if (string.startsWith('mailto:')) {
        // Strip mailto and validate email address
        string = string.substring(7);
        if (DataValidator.isEmailValid(string)) {
            return true;
        }
        return false;
    }

    let url;

    try {
        url = new URL(string);
    }
    catch (_) {
        return false;
    }

    return url.protocol === 'http:' || url.protocol === 'https:';
}

async function saveLink() {
    let cleanedUrl = editLink.value.trim();

    if (cleanedUrl.length === 0) {
        await clearLink();
        return;
    }

    if (!isValidHttpUrl(cleanedUrl)) {
        if (!cleanedUrl.startsWith('mailto:') && !cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://') && DataValidator.isEmailValid(cleanedUrl)) {
            cleanedUrl = 'mailto:' + cleanedUrl;
        }
        else if (isValidHttpUrl('http://' + cleanedUrl)) {
            cleanedUrl = 'http://' + cleanedUrl;
        }
    }

    if (!isValidHttpUrl(cleanedUrl)) {
        Toast.error($t(`f60878fd-f28a-4585-a2d6-3e90437ae8c1`)).show();
        return;
    }

    editor.value.chain().focus().extendMarkRange('link').setLink({ href: cleanedUrl }).focus().run();
    await nextTick(() => {
        showLinkEditor.value = false;
    });
}

async function clearLink() {
    editor.value.chain().focus().unsetLink().focus().run();
    await nextTick(() => {
        showLinkEditor.value = false;
    });
}
//
const imageResolutions = [
    ResolutionRequest.create({
        width: 600,
    }),
];

const primaryColor = computed(() => {
    return props.replacements.find(v => v.token === 'primaryColor')?.value || '#0053ff';
});

//
function insertImage(image: Image | null) {
    if (image === null) {
        return;
    }
    const resolution = image.resolutions[0];
    if (!resolution) {
        return;
    }
    editor.value.chain().focus().setImage({ src: resolution.file.getPublicPath(), alt: image.source.name ?? undefined, width: resolution.width, height: resolution.height }).run();
    new Toast($t('5d8131bf-38a0-4c8c-b266-e30caa7aa270'), 'info').show();
}
//
async function openTextStyles(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`8f419200-148a-4f76-8292-def02fffb0be`),
                icon: 'bold',
                selected: editor.value.isActive('bold'),
                action: () => {
                    editor.value.chain().focus().toggleBold().run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`20a9c3b3-a4df-431e-a4e0-dd22a2ddf51f`),
                icon: 'italic',
                selected: editor.value.isActive('italic'),
                action: () => {
                    editor.value.chain().focus().toggleItalic().run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`fd97c699-c6c7-4861-a22e-317a51f87ed0`),
                icon: 'underline',
                selected: editor.value.isActive('underline'),
                action: () => {
                    editor.value.chain().focus().toggleUnderline().run();
                    return true;
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: $t(`109b8d55-5b39-47da-92ad-fbdfa0f3d0b0`),
                icon: 'h1',
                selected: editor.value.isActive('heading', { level: 1 }),
                action: () => {
                    editor.value.chain().focus().toggleHeading({ level: 1 }).run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`fc5107e1-3576-4a8a-b35c-26918f0d8052`),
                icon: 'h2',
                selected: editor.value.isActive('heading', { level: 2 }),
                action: () => {
                    editor.value.chain().focus().toggleHeading({ level: 2 }).run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`002d6c62-a1d1-4efa-a230-b03456b2d872`),
                icon: 'h3',
                selected: editor.value.isActive('heading', { level: 3 }),
                action: () => {
                    editor.value.chain().focus().toggleHeading({ level: 3 }).run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`2a2b03b6-f858-48c0-963e-b1dfdb107f25`),
                icon: 'info-circle',
                selected: editor.value.isActive('descriptiveText'),
                action: () => {
                    editor.value.chain().focus().toggleDescriptiveText().run();
                    return true;
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: $t(`9f87bc88-6829-46dc-8bf3-333437e7bee3`),
                icon: 'ul',
                selected: editor.value.isActive('bulletList'),
                action: () => {
                    editor.value.chain().focus().toggleBulletList().run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`8d17be46-de96-4e84-af15-6bd18e8b4b17`),
                icon: 'ol',
                selected: editor.value.isActive('orderedList'),
                action: () => {
                    editor.value.chain().focus().toggleOrderedList().run();
                    return true;
                },
            }),
        ],
    ]);
    menu.show({ button: event.currentTarget as any, yPlacement: 'top' }).catch(console.error);
}

watch(() => props.replacements, (newReplacements, oldReplacements) => {
    if (JSON.stringify(newReplacements) === JSON.stringify(oldReplacements)) {
        return;
    }

    const content = editor.value.getJSON();

    // Loop all nodes with type smartButton or smartText and remove them if needed (when they are not in the smartVariables + list warning)
    warnInvalidNodes(content, smartVariablesFor(newReplacements), smartVariablesFor(oldReplacements));
    deleteInvalidNodes(content);

    editor.value.destroy();
    editor.value = buildEditor(content);
});

function warnInvalidNodes(node: JSONContent, newSmartVariables: EditorSmartVariable[], oldSmartVariables: EditorSmartVariable[]) {
    if (node.type === 'smartVariable') {
        if (!newSmartVariables.find(smartVariable => smartVariable.id === node.attrs?.id)) {
            // If did found in old?
            const old = oldSmartVariables.find(smartVariable => smartVariable.id === node.attrs?.id);
            if (old && old.deleteMessage) {
                new Toast(old.deleteMessage, 'warning yellow').setHide(30 * 1000).show();
            }
        }
    }

    if (node.content) {
        for (const childNode of node.content) {
            warnInvalidNodes(childNode, newSmartVariables, oldSmartVariables);
        }
    }
}
//
/**
 * Return true if node needs to be kept
 */
function deleteInvalidNodes(node: JSONContent) {
    if (node.type === 'smartButton' || node.type === 'smartButtonInline') {
        return !!smartButtons.value.find(smartButton => smartButton.id === node.attrs?.id);
    }
    if (node.type === 'smartVariable') {
        return !!smartVariables.value.find(v => v.id === node.attrs?.id);
    }
    if (node.content) {
        node.content = node.content.filter((childNode) => {
            return deleteInvalidNodes(childNode);
        });
    }
    return true;
}

function getSmartButton(id: string) {
    return smartButtons.value.find(button => button.id === id);
}

function getSmartVariable(id: string) {
    return smartVariables.value.find(button => button.id === id);
}

async function showSmartVariableMenu(event: MouseEvent) {
    // Get initial selection
    const initialSelection = document.activeElement;

    const menu = new ContextMenu([
        ...(smartVariables.value.length > 0
            ? [
                    smartVariables.value.map((variable) => {
                        return new ContextMenuItem({
                            name: variable.name,
                            description: variable.description ? variable.description : undefined,
                            action: () => {
                                if (initialSelection && initialSelection.tagName === 'INPUT') {
                                    // Allow replacements in input fields
                                    const input = initialSelection as HTMLInputElement;

                                    if (input.selectionStart !== null && input.selectionEnd !== null) {
                                        input.setRangeText(`{{${variable.id}}}`, input.selectionStart, input.selectionEnd, 'end');
                                        input.focus();
                                    }
                                }
                                else {
                                    editor.value.chain().focus().insertSmartVariable(variable).run();
                                }

                                return true;
                            },
                        });
                    }),
                ]
            : []),
        ...(smartButtons.value.length > 0
            ? [
                    smartButtons.value.map((variable) => {
                        return new ContextMenuItem({
                            name: variable.name,
                            action: () => {
                                editor.value.chain().focus().insertSmartButton(variable).run();

                                return true;
                            },
                        });
                    }),
                ]
            : []),
        ...(props.emailBlock
            ? [
                    [new ContextMenuItem({
                        icon: 'email',
                        name: $t('a13326af-afab-4159-a730-d41f9bcbaff3'),
                        description: $t('e3cca88f-3001-49fa-af16-2a7144b07216'),
                        action: () => {
                            editor.value.chain().focus().toggleEmailBlock().run();

                            return true;
                        },
                    }),
                    ],
                ]
            : []),
    ]);
    menu.show({ button: event.currentTarget as any, yPlacement: 'top' }).catch(console.error);
}

defineExpose({
    editor,
});

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';
@use './email.mixin.scss' as EmailMixin;

.editor-view {
    > main {

        .mail-hr {
            margin: 0;
            margin-right: calc(-1 * var(--st-horizontal-padding, 40px));
        }
    }

    .editor-container {
        flex-grow: 1;
        display: flex;
        flex-direction: column;

        justify-content: stretch;
        align-items: stretch;
        min-height: 200px;

        margin: 0 calc(-1 * var(--st-horizontal-padding, 0px));
        position: relative;

        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        font-weight: normal;

        padding: 0;
        height: auto;
        min-height: calc($input-height * 2);
        line-height: normal;
        outline: none;

        user-select: auto;
        user-select: contain;
        -webkit-user-select: text;
        -webkit-user-select: auto;
        -webkit-touch-callout: default;

        > footer {
            padding: 0 var(--st-horizontal-padding, 15px) 15px var(--st-horizontal-padding, 15px);

            > div.disabled {
                user-select: none;
                cursor: not-allowed;
                color: $color-gray-4;

                .button {
                    pointer-events: none
                }

                > hr {
                    @extend .style-hr;
                }

                .button-description {
                    margin: 10px 0;
                }

                strong {
                    font-weight: bold;
                }

                em {
                    font-style: italic;
                }
            }

            > hr {
                @extend .style-hr;
                margin-bottom: 10px;
            }
        }
    }

    .editor-content {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        @include EmailMixin.email-content('.ProseMirror');

        & > .ProseMirror {
            flex-grow: 1;

            span[data-type="smartVariable"] {
                padding: 3px 2px;
                margin: 0 -2px;
                //color: $color-gray-5;
                white-space: nowrap;

                &:empty {
                    padding: 0;
                    margin: 0;
                    background: none;
                }

                &.ProseMirror-selectednode {
                    color: $color-primary-contrast;
                }

                position: relative;

                &:after {
                    content: "";
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: $color-gray-3;
                    border-radius: $border-radius;
                    pointer-events: none;
                    z-index: -1;
                }

                &.ProseMirror-selectednode {
                    &:after {
                        background: $color-primary;
                    }
                }
            }

            span[data-type="smartButtonInline"] {
                text-decoration: underline;
            }

            div[data-type="smartVariableBlock"] {
                padding: 0 15px;
                margin: 0 -15px;

                &.ProseMirror-selectednode {
                    box-shadow: 0 0 0 2px $color-primary;
                    border-radius: $border-radius;
                }
            }

            .button {
                cursor: default !important;

            }

            img {
                max-width: 100%;
                height: auto;
                margin: 0;

                &.ProseMirror-selectednode {
                    box-shadow: 0 0 0 2px $color-primary;
                    border-radius: $border-radius;
                }
            }

            hr {
                // Override selection area
                padding: 20px 0;
                margin: 0;
                background: none;
                display: block;

                &:after {
                    content: "";
                    display: block;
                    height: 2px;
                    background: $color-border;
                    border-radius: 1px;
                    width: 100%;
                }

                &.ProseMirror-selectednode {
                    &:after {
                        background: $color-primary;
                        box-shadow: 0 0 0 1px $color-primary;
                        border-radius: 4px;
                    }
                }
            }

            .email-only {
                display: block;
                padding: 2px var(--st-horizontal-padding, 15px) 5px var(--st-horizontal-padding, 15px);
                margin: 1px calc(-1 * var(--st-horizontal-padding, 15px));
                position: relative;
                background: $color-background;
                border-top: 2px dashed $color-border;
                border-bottom: 2px dashed $color-border;
                transition: border-color 0.3s, background-color 0.3s;

                &:last-child {
                    border-bottom-color: transparent;
                }

                &:has(> .content > hr:first-child) {
                    margin-top: 20px;

                    > .content > hr:first-child {
                        padding-top: 10px;
                    }
                }

                > .label {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    max-width: 100%;
                    font-size: 13px;
                    font-weight: $font-weight-semibold;
                    background: $color-gray-3;
                    padding: 7px;
                    text-align: center;
                    opacity: 1;

                    display: flex;
                    color: $color-dark;
                    gap: 4px;
                    border-radius: $border-radius;
                    transition: opacity 0.3s, background-color 0.3s;
                    pointer-events: none;
                    user-select: none;
                }

                &.has-focus {
                    background: $color-background-shade;
                    border-bottom-color: transparent;
                    border-top-color: transparent;

                    > .label {
                        opacity: 0.8;
                        background-color: transparent;
                    }

                    @media (max-width: 400px) {
                        > .label > span:last-child {
                            display: none;
                        }
                    }
                }
            }
        }

    }

    .ProseMirror {
        max-width: none;
        padding: 15px var(--st-horizontal-padding, 15px);
        height: auto;
        min-height: calc($input-height * 2);
        line-height: normal;
        outline: none;
    }
}
</style>
