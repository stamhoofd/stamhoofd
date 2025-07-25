<template>
    <div v-if="editor" class="wysiwyg-text-input">
        <editor-content :editor="editor" class="editor-content" />

        <div class="tools">
            <form v-if="showLinkEditor" class="editor-button-bar sticky link" autocomplete="off" novalidate data-submit-last-field @submit.prevent="saveLink()">
                <STList>
                    <STListItem class="no-padding right-stack">
                        <div class="list-input-box">
                            <span>{{ $t('d703d8bc-b08f-4b4d-9c26-f255edd70f56') }}:</span>

                            <input ref="linkInput" v-model="editLink" class="list-input" type="url" enterkeyhint="go" :placeholder="$t(`780fa99d-7109-4f57-934b-1f4c5643a794`)">
                        </div>
                        <template #right>
                            <button class="button text" type="submit" @mousedown.prevent>
                                {{ editLink.length === 0 ? "Sluiten" : "Opslaan" }}
                            </button>
                            <button v-if="editor.isActive('link')" class="button icon trash gray" type="button" :v-tooltip="$t('025d14dd-57d4-4ec4-aa85-ddf9ddf98b6f')" @mousedown.prevent @click.stop.prevent="clearLink()" />
                        </template>
                    </STListItem>
                </STList>
            </form>

            <div v-else class="small editor-button-bar sticky">
                <button class="button icon bold" :class="{ 'is-active': editor.isActive('bold') }" type="button" :v-tooltip="$t('f7057816-fb9f-42f9-b864-bec9756d07f7')" @click="editor.chain().focus().toggleBold().run()" />
                <button class="button icon italic" type="button" :class="{ 'is-active': editor.isActive('italic') }" :v-tooltip="$t('85ebbd8d-0585-4621-bed9-0d3cacb138a8')" @click="editor.chain().focus().toggleItalic().run()" />
                <button class="button icon underline" type="button" :class="{ 'is-active': editor.isActive('underline') }" :v-tooltip="$t('c69c6268-44cb-41a3-9a22-01c0828cb87a')" @click="editor.chain().focus().toggleUnderline().run()" />

                <hr v-if="!$isMobile"><button class="button icon text-style" type="button" :v-tooltip="$t('cbe7db4a-b65b-452b-a5d2-d369182fd28f')" @click="openTextStyles" />
                <button class="button icon hr" type="button" :v-tooltip="$t('6ec5c3ba-7b6d-4ceb-9950-e152bed49b0a')" @click="editor.chain().focus().setHorizontalRule().run()" @mousedown.stop />
                <button class="button icon link" type="button" :class="{ 'is-active': editor.isActive('link') }" :v-tooltip="$t('f501785a-7e57-4184-8cf0-a3413ad2f2a4')" @click.prevent.stop="openLinkEditor()" @mousedown.stop />
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';
import { RichText } from '@stamhoofd/structures';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { Editor, EditorContent } from '@tiptap/vue-3';

import { DataValidator } from '@stamhoofd/utility';
import { ColorHelper } from '../ColorHelper';
import TooltipDirective from '../directives/Tooltip';
import { WarningBox } from '../editor/EditorWarningBox';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import STButtonToolbar from '../navigation/STButtonToolbar.vue';
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

@Component({
    components: {
        EditorContent,
        STButtonToolbar,
        STList,
        STListItem,
    },
    directives: {
        Tooltip: TooltipDirective,
    },
    emits: ['update:modelValue'],
})
export default class WYSIWYGTextInput extends VueComponent {
    @Prop({ required: true })
    modelValue!: RichText;

    @Prop({ default: '' })
    placeholder!: string;

    @Prop({ default: 2 })
    headingStartLevel!: number;

    @Prop({ required: false, default: null })
    color!: string | null;

    @Prop({ default: '' })
    editorClass!: string;

    showLinkEditor = false;
    editLink = '';
    editor: Editor = null as any;
    showTextStyles = false;

    beforeMount() {
        this.editor = this.buildEditor();
    }

    mounted() {
        if (this.color) {
            const el = this.$el.querySelector('.editor-content') as HTMLElement;
            if (el) {
                ColorHelper.setColor(this.color, el);
            }
        }
    }

    @Watch('color')
    onColorChanged() {
        if (this.color) {
            const el = this.$el.querySelector('.editor-content') as HTMLElement;
            if (el) {
                ColorHelper.setColor(this.color, el);
            }
        }
    }

    beforeUnmount() {
        // This fixes a glitch that the editor content is wiped before the transition is finished
        const content = this.$el.innerHTML;
        this.$el.innerHTML = content;
        this.editor?.destroy();
    }

    buildEditor() {
        let content = this.modelValue.html;

        if (!content && this.modelValue.text) {
            // Special conversion operation
            const splitted = this.modelValue.text.split('\n');
            for (const split of splitted) (
                content += `<p>${escapeHtml(split)}</p>`
            );
        }
        return new Editor({
            content,
            extensions: [
                StarterKit.configure({
                    heading: {
                        levels: [this.headingStartLevel as any, this.headingStartLevel + 1 as any],
                    },
                }),
                Placeholder.configure({
                    placeholder: this.placeholder,
                }),
                WarningBox.configure({}),
                Typography.configure({}),
                Link.configure({
                    openOnClick: false,
                    protocols: ['mailto'],
                }),
                Underline,
            ],
            onSelectionUpdate: ({ editor }) => {
                if (this.showLinkEditor) {
                    if (editor.isActive('link')) {
                        this.editLink = editor.getAttributes('link')?.href ?? '';
                    }
                    else {
                        if (editor.state.selection.empty) {
                            this.showLinkEditor = false;
                        }
                    }
                }
            },
            onUpdate: ({ editor }) => {
                this.$emit('update:modelValue', RichText.create({ html: editor.getHTML(), text: editor.getText() }));
            },
            editorProps: {
                attributes: {
                    class: this.editorClass,
                },
            },
        });
    }

    openLinkEditor() {
        if (this.showLinkEditor) {
            this.editor!.chain().focus().run();
            this.$nextTick(() => {
                this.showLinkEditor = false;
            });
            return;
        }
        if (!this.editor!.isActive('link') && this.editor!.state.selection.empty) {
            new Toast($t(`930cb01b-7877-45e6-99dc-7cb148f13cc9`), 'info').show();
            return;
        }
        this.editLink = this.editor!.getAttributes('link')?.href ?? '';
        this.showLinkEditor = true;
        this.$nextTick(() => {
            (this.$refs.linkInput as HTMLInputElement).focus();
        });
    }

    openTextStyles(event) {
        // Get initial selection
        const m = this;
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: $t(`3337b645-929a-4c29-ba80-1898dead623d`),
                    icon: 'h1',
                    selected: this.editor.isActive('heading', { level: this.headingStartLevel }),
                    action: () => {
                        m.editor.chain().focus().toggleHeading({ level: this.headingStartLevel as any }).run();
                        return true;
                    },
                }),
                new ContextMenuItem({
                    name: $t(`73de3c97-dee4-4944-97ab-4ffd438ff9c4`),
                    icon: 'h2',
                    selected: this.editor.isActive('heading', { level: this.headingStartLevel + 1 }),
                    action: () => {
                        m.editor.chain().focus().toggleHeading({ level: this.headingStartLevel + 1 as any }).run();
                        return true;
                    },
                }),
                new ContextMenuItem({
                    name: $t(`4943ece9-450b-4913-a6d8-6834d011a1ee`),
                    icon: 'warning',
                    selected: this.editor.isActive('warningBox', { type: 'warning' }),
                    action: () => {
                        m.editor.chain().focus().toggleBox('warning').run();
                        return true;
                    },
                }),
                new ContextMenuItem({
                    name: $t(`0456ef2e-5e86-48fa-835c-fd8ec1921f5e`),
                    icon: 'info',
                    selected: this.editor.isActive('warningBox', { type: 'info' }),
                    action: () => {
                        m.editor.chain().focus().toggleBox('info').run();
                        return true;
                    },
                }),
            ],
            [
                new ContextMenuItem({
                    name: $t(`edf611b8-a969-4861-956f-522c47a948fb`),
                    icon: 'ul',
                    selected: this.editor.isActive('bulletList'),
                    action: () => {
                        m.editor.chain().focus().toggleBulletList().run();
                        return true;
                    },
                }),
                new ContextMenuItem({
                    name: $t(`ec732e97-237c-4271-a890-77f18e2b006f`),
                    icon: 'ol',
                    selected: this.editor.isActive('orderedList'),
                    action: () => {
                        m.editor.chain().focus().toggleOrderedList().run();
                        return true;
                    },
                }),
            ],
        ]);
        menu.show({ button: event.currentTarget, yPlacement: 'top' }).catch(console.error);
    }

    isValidHttpUrl(string: string) {
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

    saveLink() {
        let cleanedUrl = this.editLink.trim();

        if (cleanedUrl.length === 0) {
            this.clearLink();
            return;
        }

        if (!this.isValidHttpUrl(cleanedUrl)) {
            if (!cleanedUrl.startsWith('mailto:') && !cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://') && DataValidator.isEmailValid(cleanedUrl)) {
                cleanedUrl = 'mailto:' + cleanedUrl;
            }
            else if (this.isValidHttpUrl('http://' + cleanedUrl)) {
                cleanedUrl = 'http://' + cleanedUrl;
            }
        }

        if (!this.isValidHttpUrl(cleanedUrl)) {
            new Toast($t(`375a57e9-815f-42d0-88e0-1ce09df72c1b`), 'error red').show();
            return;
        }

        this.editor.chain().focus().extendMarkRange('link').setLink({ href: cleanedUrl }).focus().run();
        this.$nextTick(() => {
            this.showLinkEditor = false;
        });
    }

    clearLink() {
        this.editor.chain().focus().unsetLink().focus().run();
        this.$nextTick(() => {
            this.showLinkEditor = false;
        });
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.wysiwyg-text-input {
    @extend .style-input;
    @extend .style-input-box;

    .ProseMirror {
        max-width: none;
        padding: 12px 15px;
        height: auto;
        min-height: calc($input-height * 2);
        line-height: 1.4;
        outline: none;
        min-height: 100px;

        @extend .style-wysiwyg;
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
