<template>
    <div class="wysiwyg-text-input">
        <editor-content :editor="editor" class="editor-content" />

        <div class="tools" @mousedown.prevent>
            <form v-if="showLinkEditor" class="editor-button-bar sticky link" autocomplete="off" novalidate data-submit-last-field @submit.prevent="saveLink()">
                <STList>
                    <STListItem class="no-padding right-stack">
                        <div class="list-input-box">
                            <span>Link:</span>

                            <input ref="linkInput" v-model="editLink" class="list-input" type="url" placeholder="https://" enterkeyhint="go">
                        </div>
                        <button slot="right" class="button text" type="submit" @mousedown.prevent>
                            {{ editLink.length == 0 ? "Sluiten" : "Opslaan" }}
                        </button>
                        <button v-if="editor.isActive('link')" slot="right" v-tooltip="'Link verwijderen'" class="button icon trash gray" type="button" @mousedown.prevent @click.prevent="clearLink()" />
                    </STListItem>
                </STList>
            </form>

            <div v-else class="small editor-button-bar sticky">
                <button v-tooltip="'Vet gedrukte tekst'" class="button icon bold" :class="{ 'is-active': editor.isActive('bold') }" type="button" @click="editor.chain().focus().toggleBold().run()" />
                <button v-tooltip="'Schuine tekst'" class="button icon italic" type="button" :class="{ 'is-active': editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()" />
                <button v-tooltip="'Onderlijn tekst'" class="button icon underline" type="button" :class="{ 'is-active': editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()" />

                <hr v-if="!$isMobile">
                
                <button v-tooltip="'Titel'" class="button icon text-style" type="button" @click="openTextStyles" />
                <button v-tooltip="'Horizontale lijn'" class="button icon hr" type="button" @click="editor.chain().focus().setHorizontalRule().run()" @mousedown.prevent />
                <button v-tooltip="'Link toevoegen'" class="button icon link" type="button" :class="{ 'is-active': editor.isActive('link') }" @click.prevent="openLinkEditor()" @mousedown.prevent />
            </div>
        </div>
    </div>
</template>


<script lang="ts">
import { RichText } from "@stamhoofd/structures";
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';
import Typography from "@tiptap/extension-typography";
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { Editor, EditorContent } from '@tiptap/vue-2';
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

import { ColorHelper } from "../ColorHelper";
import TooltipDirective from "../directives/Tooltip";
import {WarningBox} from "../editor/EditorWarningBox";
import STList from "../layout/STList.vue";
import STListItem from "../layout/STListItem.vue";
import STButtonToolbar from "../navigation/STButtonToolbar.vue";
import { ContextMenu, ContextMenuItem } from "../overlays/ContextMenu";
import { Toast } from "../overlays/Toast";

function escapeHtml(unsafe: string ): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

@Component({
    components: {
        EditorContent,
        STButtonToolbar,
        STList,
        STListItem
    },
    directives: {
        Tooltip: TooltipDirective
    }
})
export default class WYSIWYGTextInput extends Vue {
    @Prop({ required: true })
        value!: RichText

    @Prop({ default: 2 })
        headingStartLevel!: number

    @Prop({ required: false, default: null })
        color!: string | null

    showLinkEditor = false
    editLink = ""
    editor = this.buildEditor()
    showTextStyles = false

    mounted() {
        if (this.color) {
            const el = (this.$el as HTMLElement).querySelector('.editor-content') as HTMLElement;
            if (el) {
                ColorHelper.setColor(this.color, el)
            }
        }
    }

    @Watch("color")
    onColorChanged() {
        if (this.color) {
            const el = (this.$el as HTMLElement).querySelector('.editor-content') as HTMLElement;
            if (el) {
                ColorHelper.setColor(this.color, el)
            }
        }
    }

    beforeDestroy() {
        this.editor.destroy()
    }

    buildEditor() {
        let content = this.value.html;

        if (!content && this.value.text) {
            // Special conversion operation
            const splitted = this.value.text.split("\n")
            for (const split of splitted) (
                content += `<p>${escapeHtml(split)}</p>`
            )
        }
        return new Editor({
            content,
            extensions: [
                StarterKit.configure({
                    heading:{
                        levels: [this.headingStartLevel as any, this.headingStartLevel + 1 as any],
                    }
                }),
                WarningBox.configure({}),
                Typography.configure({}),
                Link.configure({
                    openOnClick: false,
                }),
                Underline
            ],
            onSelectionUpdate: ({editor}) => {
                if (this.showLinkEditor){
                    if (editor.isActive("link")) {
                        this.editLink = editor.getAttributes('link')?.href ?? ""
                    } else {
                        if (editor.state.selection.empty) {
                            this.showLinkEditor = false
                        }
                    }
                }
            },
            onUpdate: ({ editor }) => {
                this.$emit("input", RichText.create({ html: editor.getHTML(), text: editor.getText() }))
            },
        })
    }

    openLinkEditor() {
        if (this.showLinkEditor) {
            this.editor.chain().focus().run()
            this.$nextTick(() => {
                this.showLinkEditor = false
            })
            return
        }
        if (!this.editor.isActive("link") && this.editor.state.selection.empty) {
            new Toast("Selecteer eerst tekst die je klikbaar wilt maken", "info").show()
            return
        }
        this.editLink = this.editor.getAttributes('link')?.href ?? ""
        this.showLinkEditor = true;
        this.$nextTick(() => {
            (this.$refs.linkInput as HTMLInputElement).focus()
        })
    }

    openTextStyles(event) {
        // Get initial selection        
        const m = this
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: "Titel",
                    icon: "h1",
                    selected: this.editor.isActive("heading", { level: this.headingStartLevel }),
                    action: () => {
                        m.editor.chain().focus().toggleHeading({ level: this.headingStartLevel as any }).run()
                        return true
                    }
                }),
                new ContextMenuItem({
                    name: "Koptekst",
                    icon: "h2",
                    selected: this.editor.isActive("heading", { level: this.headingStartLevel + 1 }),
                    action: () => {
                        m.editor.chain().focus().toggleHeading({ level: this.headingStartLevel + 1 as any }).run()
                        return true
                    }
                }),
                new ContextMenuItem({
                    name: "Waarschuwing",
                    icon: "warning",
                    selected: this.editor.isActive("warningBox", { type: 'warning' }),
                    action: () => {
                        m.editor.chain().focus().toggleBox('warning').run()
                        return true
                    }
                }),
                new ContextMenuItem({
                    name: "Info",
                    icon: "info",
                    selected: this.editor.isActive("warningBox", { type: 'info' }),
                    action: () => {
                        m.editor.chain().focus().toggleBox('info').run()
                        return true
                    }
                })
            ],
            [
                new ContextMenuItem({
                    name: "Opsomming met bolletjes",
                    icon: "ul",
                    selected: this.editor.isActive("bulletList"),
                    action: () => {
                        m.editor.chain().focus().toggleBulletList().run()
                        return true
                    }
                }),
                new ContextMenuItem({
                    name: "Opsomming met nummers",
                    icon: "ol",
                    selected: this.editor.isActive("orderedList"),
                    action: () => {
                        m.editor.chain().focus().toggleOrderedList().run()
                        return true
                    }
                }),
            ]
        ])
        menu.show({ button: event.currentTarget, yPlacement: "top" }).catch(console.error)
    }

    isValidHttpUrl(string: string) {
        let url;
        
        try {
            url = new URL(string);
        } catch (_) {
            return false;  
        }

        return url.protocol === "http:" || url.protocol === "https:";
    }

    saveLink() {
        let cleanedUrl = this.editLink.trim()

        if (cleanedUrl.length == 0) {
            this.clearLink()
            return
        }

        if (!cleanedUrl.startsWith("http://") && !cleanedUrl.startsWith("https://")) {
            cleanedUrl = "http://" + cleanedUrl
        }

        if (!this.isValidHttpUrl(cleanedUrl)) {
            new Toast("Ongeldige URL", "error red").show()
            return
        }

        this.editor.chain().focus().setLink({ href: cleanedUrl }).focus().run()
        this.$nextTick(() => {
            this.showLinkEditor = false
        })
    }

    clearLink() {
        this.editor.chain().focus().unsetLink().focus().run()
        this.$nextTick(() => {
            this.showLinkEditor = false
        })
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

    .tools {
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s, transform 0.2s;
        transform: translateY(10px);
        padding: 0 15px 12px 15px;
        position: sticky;
        bottom: -15px; // compensate main padding
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