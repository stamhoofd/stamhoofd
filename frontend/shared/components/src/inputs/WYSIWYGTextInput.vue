<template>
    <div v-if="editor" ref="rootEl" class="wysiwyg-text-input">
        <editor-content :editor="editor" class="editor-content" />

        <div class="tools">
            <form v-if="showLinkEditor" class="editor-button-bar sticky link" autocomplete="off" novalidate data-submit-last-field @submit.prevent="saveLink()">
                <STList>
                    <STListItem class="no-padding right-stack">
                        <div class="list-input-box">
                            <span>{{ $t('%2H') }}:</span>

                            <input ref="linkInput" v-model="editLink" class="list-input" type="url" enterkeyhint="go" :placeholder="$t(`%1J`)">
                        </div>
                        <template #right>
                            <button class="button text" type="submit" @mousedown.prevent>
                                {{ editLink.length === 0 ? "Sluiten" : "Opslaan" }}
                            </button>
                            <button v-if="editor.isActive('link')" class="button icon trash gray" type="button" v-tooltip="$t('%a8')" @mousedown.prevent @click.stop.prevent="clearLink()" />
                        </template>
                    </STListItem>
                </STList>
            </form>

            <div v-else class="small editor-button-bar sticky">
                <button class="button icon bold" :class="{ 'is-active': editor.isActive('bold') }" type="button" v-tooltip="$t('%aG')" @click="editor.chain().focus().toggleBold().run()" />
                <button class="button icon italic" type="button" :class="{ 'is-active': editor.isActive('italic') }" v-tooltip="$t('%aH')" @click="editor.chain().focus().toggleItalic().run()" />
                <button class="button icon underline" type="button" :class="{ 'is-active': editor.isActive('underline') }" v-tooltip="$t('%aI')" @click="editor.chain().focus().toggleUnderline().run()" />

                <hr v-if="!$isMobile"><button class="button icon text-style" type="button" v-tooltip="$t('%vC')" @click="openTextStyles" />
                <button class="button icon hr" type="button" v-tooltip="$t('%aB')" @click="editor.chain().focus().setHorizontalRule().run()" @mousedown.stop />
                <button class="button icon link" type="button" :class="{ 'is-active': editor.isActive('link') }" v-tooltip="$t('%aC')" @click.prevent.stop="openLinkEditor()" @mousedown.stop />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { RichText } from '@stamhoofd/structures';
import { DataValidator } from '@stamhoofd/utility';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import StarterKit from '@tiptap/starter-kit';
import { Editor, EditorContent } from '@tiptap/vue-3';
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { Ref } from 'vue';

import { ColorHelper } from '../ColorHelper';
import { WarningBox } from '../editor/EditorWarningBox';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { Toast } from '../overlays/Toast';

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const model = defineModel<RichText>({ required: true });

const props = withDefaults(defineProps<{
    placeholder?: string;
    headingStartLevel?: number;
    color?: string | null;
    editorClass?: string;
}>(), {
    placeholder: '',
    headingStartLevel: 2,
    color: null,
    editorClass: '',
});

const showLinkEditor = ref(false);
const editLink = ref('');
const editor = ref<Editor>(buildEditor()) as Ref<Editor>;

const rootEl = useTemplateRef<HTMLElement>('rootEl');
const linkInput = useTemplateRef<HTMLInputElement>('linkInput');

onMounted(() => {
    if (props.color) {
        const el = rootEl.value?.querySelector('.editor-content') as HTMLElement | null;
        if (el) {
            ColorHelper.setColor(props.color, el);
        }
    }
});

watch(() => props.color, () => {
    if (props.color) {
        const el = rootEl.value?.querySelector('.editor-content') as HTMLElement | null;
        if (el) {
            ColorHelper.setColor(props.color, el);
        }
    }
});

onBeforeUnmount(() => {
    // This fixes a glitch that the editor content is wiped before the transition is finished
    if (rootEl.value) {
        const content = rootEl.value.innerHTML;
        rootEl.value.innerHTML = content;
    }
    editor.value?.destroy();
});

function buildEditor() {
    let content = model.value.html;

    if (!content && model.value.text) {
        // Special conversion operation
        const splitted = model.value.text.split('\n');
        for (const split of splitted) (
            content += `<p>${escapeHtml(split)}</p>`
        );
    }
    return new Editor({
        content,
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [props.headingStartLevel as any, props.headingStartLevel + 1 as any],
                },
                link: {
                    openOnClick: false,
                    protocols: ['mailto'],
                },
            }),
            Placeholder.configure({
                placeholder: props.placeholder,
            }),
            WarningBox.configure({}),
            Typography.configure({}),
        ],
        onSelectionUpdate: ({ editor: e }) => {
            if (showLinkEditor.value) {
                if (e.isActive('link')) {
                    editLink.value = e.getAttributes('link')?.href ?? '';
                } else {
                    if (e.state.selection.empty) {
                        showLinkEditor.value = false;
                    }
                }
            }
        },
        onUpdate: ({ editor: e }) => {
            model.value = RichText.create({ html: e.getHTML(), text: e.getText() });
        },
        editorProps: {
            attributes: {
                class: props.editorClass,
            },
        },
    });
}

function openLinkEditor() {
    if (showLinkEditor.value) {
        editor.value!.chain().focus().run();
        nextTick(() => {
            showLinkEditor.value = false;
        }).catch(console.error);
        return;
    }
    if (!editor.value!.isActive('link') && editor.value!.state.selection.empty) {
        new Toast($t(`%v8`), 'info').show();
        return;
    }
    editLink.value = editor.value!.getAttributes('link')?.href ?? '';
    showLinkEditor.value = true;
    nextTick(() => {
        linkInput.value?.focus();
    }).catch(console.error);
}

function openTextStyles(event: Event) {
    if (!(event.currentTarget instanceof HTMLElement)) {
        return;
    }

    // Get initial selection
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`%vC`),
                icon: 'h1',
                selected: editor.value.isActive('heading', { level: props.headingStartLevel }),
                action: () => {
                    editor.value.chain().focus().toggleHeading({ level: props.headingStartLevel as any }).run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`%aJ`),
                icon: 'h2',
                selected: editor.value.isActive('heading', { level: props.headingStartLevel + 1 }),
                action: () => {
                    editor.value.chain().focus().toggleHeading({ level: props.headingStartLevel + 1 as any }).run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`%zJ`),
                icon: 'warning',
                selected: editor.value.isActive('warningBox', { type: 'warning' }),
                action: () => {
                    editor.value.chain().focus().toggleBox('warning').run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`%J`),
                icon: 'info',
                selected: editor.value.isActive('warningBox', { type: 'info' }),
                action: () => {
                    editor.value.chain().focus().toggleBox('info').run();
                    return true;
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: $t(`%aL`),
                icon: 'ul',
                selected: editor.value.isActive('bulletList'),
                action: () => {
                    editor.value.chain().focus().toggleBulletList().run();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`%vF`),
                icon: 'ol',
                selected: editor.value.isActive('orderedList'),
                action: () => {
                    editor.value.chain().focus().toggleOrderedList().run();
                    return true;
                },
            }),
        ],
    ]);
    menu.show({ button: event.currentTarget, yPlacement: 'top' }).catch(console.error);
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
    } catch (_) {
        return false;
    }

    return url.protocol === 'http:' || url.protocol === 'https:';
}

function saveLink() {
    let cleanedUrl = editLink.value.trim();

    if (cleanedUrl.length === 0) {
        clearLink();
        return;
    }

    if (!isValidHttpUrl(cleanedUrl)) {
        if (!cleanedUrl.startsWith('mailto:') && !cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://') && DataValidator.isEmailValid(cleanedUrl)) {
            cleanedUrl = 'mailto:' + cleanedUrl;
        } else if (isValidHttpUrl('http://' + cleanedUrl)) {
            cleanedUrl = 'http://' + cleanedUrl;
        }
    }

    if (!isValidHttpUrl(cleanedUrl)) {
        new Toast($t(`%zK`), 'error red').show();
        return;
    }

    editor.value.chain().focus().extendMarkRange('link').setLink({ href: cleanedUrl }).focus().run();
    nextTick(() => {
        showLinkEditor.value = false;
    }).catch(console.error);
}

function clearLink() {
    editor.value.chain().focus().unsetLink().focus().run();
    nextTick(() => {
        showLinkEditor.value = false;
    }).catch(console.error);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.wysiwyg-text-input {
    @extend %style-input;
    @extend %style-input-box;

    .ProseMirror {
        max-width: none;
        padding: 12px 15px;
        height: auto;
        min-height: calc($input-height * 2);
        line-height: 1.4;
        outline: none;
        min-height: 100px;

        @extend %style-wysiwyg;
    }

    .tiptap p.is-editor-empty:first-child::before {
        color: $color-gray-5;
        content: attr(data-placeholder);
        float: left;
        height: 0;
        pointer-events: none;
    }

    .tools {
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s, transform 0.2s;
        transform: translateY(10px);
        padding: 0 15px 12px 15px;
        position: sticky;
        bottom: -15px; // compensate main padding

        &:focus-within {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0px);
        }
    }

    &:focus-within {
        .tools {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0px);
        }
    }

}
</style>
