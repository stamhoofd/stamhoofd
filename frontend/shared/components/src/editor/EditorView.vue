<template>
    <form class="editor-view st-view" @submit.prevent="$emit('save')">
        <STNavigationBar :title="title" :disable-dismiss="true" :disable-pop="true">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
                <template v-else-if="$isMobile || $isIOS || $isAndroid">
                    <button v-if="$isAndroid" class="button navigation icon close" type="button" @click="pop()" />
                    <button v-else class="button text selected unbold" type="button" @click="pop()">
                        {{ cancelText }}
                    </button>
                </template>
            </template>

            <template v-if="$isMobile || $isIOS || $isAndroid" #right>
                <LoadingButton :loading="loading">
                    <button class="button navigation highlight" :disabled="disabled" type="submit">
                        {{ saveText }}
                    </button>
                </LoadingButton>
            </template>
            <template v-else-if="canDismiss" #right>
                <button class="button navigation icon close" type="button" @click="dismiss()" />
            </template>
        </STNavigationBar>
        <main ref="main" class="flex">
            <slot />

            <STList>
                <!-- Place for e.g. To, From, Subject ... -->
                <slot name="list" />
            </STList>

            <hr class="mail-hr">

            <div class="editor-container">
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
                            <span>Link:</span>

                            <input ref="linkInput" v-model="editLink" class="list-input" type="url" placeholder="https://" enterkeyhint="go">
                        </div>
                        <template #right>
                            <button class="button text" type="submit" @mousedown.prevent>
                                {{ editLink.length === 0 ? "Sluiten" : "Opslaan" }}
                            </button>
                            <button v-if="editor.isActive('link')" v-tooltip="'Link verwijderen'" class="button icon trash gray" type="button" @mousedown.prevent @click.stop.prevent="clearLink()" />
                        </template>
                    </STListItem>
                </STList>
            </form>
        </main>
        <STToolbar v-if="!$isMobile && !$isIOS && !$isAndroid">
            <template #right>
                <div class="editor-button-bar">
                    <button v-tooltip="'Toon/verberg tekst opties'" class="button icon text-style" :class="{ 'is-active': showTextStyles }" type="button" @mousedown.prevent @click.prevent="showTextStyles = !showTextStyles" />
                    <hr>
                    <button v-if="smartVariables.length > 0" v-tooltip="'Magische tekstvervanging'" class="button icon wand" type="button" @click.prevent="showSmartVariableMenu" @mousedown.prevent />
                    <button v-tooltip="'Horizontale lijn'" class="button icon hr" type="button" @click="editor.chain().focus().setHorizontalRule().run()" @mousedown.prevent />
                    <button v-tooltip="'Link toevoegen'" class="button icon link" type="button" :class="{ 'is-active': editor.isActive('link') }" @click.prevent="openLinkEditor()" @mousedown.prevent />
                    <UploadButton :resolutions="imageResolutions" @update:model-value="insertImage" @mousedown.native.prevent>
                        <div v-tooltip="'Afbeelding toevoegen'" class="button icon image" type="button" />
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
        <STButtonToolbar v-else-if="!showLinkEditor" class="sticky" @mousedown.prevent>
            <button v-tooltip="'Toon/verberg tekst opties'" class="button icon text-style" type="button" @click.prevent="openTextStyles($event)" @mousedown.prevent />
            <button v-if="smartVariables.length > 0" v-tooltip="'Slimme tekstvervanging'" class="button icon wand" type="button" @click.prevent="showSmartVariableMenu" @mousedown.prevent />
            <button v-tooltip="'Horizontale lijn'" class="button icon hr" type="button" @click="editor.chain().focus().setHorizontalRule().run()" @mousedown.prevent />
            <button v-tooltip="'Link toevoegen'" class="button icon link" type="button" :class="{ 'is-active': editor.isActive('link') }" @click="openLinkEditor()" @mousedown.prevent />
            <UploadButton :resolutions="imageResolutions" @update:model-value="insertImage" @mousedown.prevent>
                <div v-tooltip="'Afbeelding toevoegen'" class="button icon image" type="button" />
            </UploadButton>
            <slot name="buttons" />
        </STButtonToolbar>
    </form>
</template>

<script lang="ts" setup>
import { EditorSmartButton, EditorSmartVariable, Image, Replacement, ResolutionRequest } from '@stamhoofd/structures';
import { Content, JSONContent } from '@tiptap/core';
import { Image as ImageExtension } from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { Editor, EditorContent } from '@tiptap/vue-3';

import { useCanDismiss, useCanPop, useDismiss, usePop } from '@simonbackx/vue-app-navigation';
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';
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
import { DataValidator } from '@stamhoofd/utility';

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
            ...this.parent?.(),
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
        cancelText?: string;
        replacements?: Replacement[];
    }>(),
    {
        loading: false,
        disabled: false,
        title: '',
        saveText: 'Opslaan',
        saveIcon: null,
        cancelText: 'Annuleren',
        replacements: () => [],
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
const pop = usePop();
const dismiss = useDismiss();
const editor = ref(buildEditor());

function buildEditor(content: Content = '') {
    return new Editor({
        content,
        extensions: [
            StarterKit,
            Typography.configure({}),
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
            Link.configure({
                openOnClick: false,
                protocols: ['mailto'],
            }),
            Underline,
            DescriptiveText,
            CustomImage,
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

const linkInput = useTemplateRef('linkInput');

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
        new Toast('Selecteer eerst tekst die je klikbaar wilt maken', 'info').show();
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
        Toast.error('Ongeldige URL').show();
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
    new Toast('Beperk het gebruik van afbeeldingen in e-mails. Afbeeldingen worden bestraft door spamfilters, en e-mails komen daardoor vaker bij spam terecht.', 'info').show();
}
//
async function openTextStyles(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Vet',
                icon: 'bold',
                selected: editor.value.isActive('bold'),
                action: () => {
                    editor.value.chain().focus().toggleBold().run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: 'Cursief',
                icon: 'italic',
                selected: editor.value.isActive('italic'),
                action: () => {
                    editor.value.chain().focus().toggleItalic().run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: 'Onderstrepen',
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
                name: 'Titel',
                icon: 'h1',
                selected: editor.value.isActive('heading', { level: 1 }),
                action: () => {
                    editor.value.chain().focus().toggleHeading({ level: 1 }).run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: 'Koptekst',
                icon: 'h2',
                selected: editor.value.isActive('heading', { level: 2 }),
                action: () => {
                    editor.value.chain().focus().toggleHeading({ level: 2 }).run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: 'Subkop',
                icon: 'h3',
                selected: editor.value.isActive('heading', { level: 3 }),
                action: () => {
                    editor.value.chain().focus().toggleHeading({ level: 3 }).run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: 'Licht gekleurd',
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
                name: 'Opsomming met bolletjes',
                icon: 'ul',
                selected: editor.value.isActive('bulletList'),
                action: () => {
                    editor.value.chain().focus().toggleBulletList().run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: 'Opsomming met nummers',
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

        $element: ".ProseMirror";

        @import './email.url.scss';

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
                    height: 1px;
                    background: $color-border;
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
