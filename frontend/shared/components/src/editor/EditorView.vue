<template>
    <form class="editor-view st-view" @submit.prevent="$emit('save')">
        <STNavigationBar :title="title">
            <BackButton v-if="$parent.canPop" slot="left" @click="$parent.pop" />
            <template v-else-if="$isMobile || $isIOS || $isAndroid" slot="left">
                <button v-if="$isAndroid" class="button navigation icon close" type="button" @click="$parent.pop" />
                <button v-else class="button text selected unbold" type="button" @click="$parent.pop">
                    {{ cancelText }}
                </button>
            </template>

            <template v-if="$isMobile || $isIOS || $isAndroid" #right><LoadingButton :loading="loading">
                <button class="button navigation highlight" :disabled="disabled" type="submit">
                    {{ saveText }}
                </button>
            </LoadingButton></template>
            <template v-else-if="$parent.canDismiss" #right><button class="button navigation icon close" type="button" @click="$parent.dismiss" /></template>
        </STNavigationBar>
        <main ref="main" class="flex">
            <slot />

            <STList>
                <!-- Place for e.g. To, From, Subject ... -->
                <slot name="list" />
            </STList>

            <hr class="mail-hr">

            <div class="editor-container">
                <editor-content :editor="editor" class="editor-content" />
                <footer>
                    <slot name="footer" />
                </footer>
            </div>
            <TextStyleButtonsView v-if="!$isMobile && showTextStyles && !showLinkEditor" class="editor-button-bar sticky" :editor="editor" />

            <div v-if="!$isMobile && !showTextStyles && !showLinkEditor && editor.isActive('smartButton')" class="editor-button-bar hint sticky">
                {{ getSmartButton(editor.getAttributes('smartButton').id).hint }}
            </div>

            <div v-if="!$isMobile && !showTextStyles && !showLinkEditor && editor.isActive('smartVariable') && getSmartVariable(editor.getAttributes('smartVariable').id).hint" class="editor-button-bar hint sticky">
                {{ getSmartVariable(editor.getAttributes('smartVariable').id).hint }}
            </div>

            <div v-if="!$isMobile && !showTextStyles && !showLinkEditor && editor.isActive('smartVariableBlock') && getSmartVariable(editor.getAttributes('smartVariableBlock').id).hint" class="editor-button-bar hint sticky">
                {{ getSmartVariable(editor.getAttributes('smartVariableBlock').id).hint }}
            </div>

            <form v-if="showLinkEditor" class="editor-button-bar sticky link" autocomplete="off" novalidate data-submit-last-field @submit.prevent="saveLink()">
                <STList>
                    <STListItem class="no-padding right-stack">
                        <div class="list-input-box">
                            <span>Link:</span>

                            <input ref="linkInput" v-model="editLink" class="list-input" type="url" placeholder="https://" enterkeyhint="go">
                        </div>
                        <template #right><button class="button text" type="submit" @mousedown.prevent>
                            {{ editLink.length == 0 ? "Sluiten" : "Opslaan" }}
                        </button></template>
                        <template v-if="editor.isActive('link')" #right><button v-tooltip="'Link verwijderen'" class="button icon trash gray" type="button" @mousedown.prevent @click.stop.prevent="clearLink()" /></template>
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
                    <UploadButton :resolutions="imageResolutions" @input="insertImage" @mousedown.native.prevent>
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
            <UploadButton :resolutions="imageResolutions" @input="insertImage" @mousedown.native.prevent>
                <div v-tooltip="'Afbeelding toevoegen'" class="button icon image" type="button" />
            </UploadButton>
            <slot name="buttons" />
        </STButtonToolbar>
    </form>
</template>


<script lang="ts">
import { Image, ResolutionRequest } from "@stamhoofd/structures"
import { Content, JSONContent } from '@tiptap/core'
import { Image as ImageExtension } from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Typography from "@tiptap/extension-typography";
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { Component,Prop,Vue, Watch } from "vue-property-decorator";

import { default as TooltipDirective } from "../directives/Tooltip";
import UploadButton from "../inputs/UploadButton.vue"
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import BackButton from "../navigation/BackButton.vue";
import LoadingButton from "../navigation/LoadingButton.vue";
import STButtonToolbar from "../navigation/STButtonToolbar.vue";
import STNavigationBar from "../navigation/STNavigationBar.vue";
import STToolbar from "../navigation/STToolbar.vue";
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { Toast } from '../overlays/Toast';
import { DescriptiveText } from "./EditorDescriptiveText";
import { EditorSmartButton, SmartButtonInlineNode,SmartButtonNode } from './EditorSmartButton';
import { EditorSmartVariable, SmartVariableNode, SmartVariableNodeBlock } from './EditorSmartVariable';
import TextStyleButtonsView from './TextStyleButtonsView.vue';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        customImage: {
            /**
             * Add an image
             */
            setImage: (options: { src: string, alt?: string, title?: string, width?: number, height?: number }) => ReturnType,
        }
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
        }
    },
})

@Component({
    components: {
        STNavigationBar,
        STList,
        STListItem,
        STToolbar,
        LoadingButton,
        BackButton,
        STButtonToolbar,
        EditorContent,
        TextStyleButtonsView,
        UploadButton
    },
    directives: {
        Tooltip: TooltipDirective
    }
})
export default class EditorView extends Vue {
    @Prop({ default: false })
        loading!: boolean;

    @Prop({ default: false })
        disabled!: boolean;

    @Prop({ default: "" })
        title!: string;

    @Prop({ default: "Opslaan" })
        saveText!: string;

    @Prop({ default: null })
        saveIcon!: string | null;

    @Prop({ default: "Annuleren" })
        cancelText!: string;

    @Prop({ default: () => [] })
        smartVariables!: EditorSmartVariable[];

    @Prop({ default: () => [] })
        smartButtons!: EditorSmartButton[];

    // Handling

    showTextStyles = false
    editLink = ""
    showLinkEditor = false

    editor = this.buildEditor()

    beforeUnmount() {
        this.editor.destroy()
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

    get imageResolutions(): ResolutionRequest[] {
        return [
            ResolutionRequest.create({
                width: 600
            })
        ]
    }

    insertImage(image: Image | null) {
        if (image === null) {
            return
        }
        const resolution = image.resolutions[0]
        if (!resolution) {
            return
        }
        this.editor.chain().focus().setImage({ src: resolution.file.getPublicPath(), alt: image.source.name ?? undefined, width: resolution.width, height: resolution.height }).run()
        new Toast("Beperk het gebruik van afbeeldingen in e-mails. Afbeeldingen worden bestraft door spamfilters, en e-mails komen daardoor vaker bij spam terecht.", "info").show()

    }

    openTextStyles(event) {
        // Get initial selection        
        const m = this
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: "Vet",
                    icon: "bold",
                    selected: this.editor.isActive("bold"),
                    action: () => {
                        m.editor.chain().focus().toggleBold().run()
                        return true
                    }
                }),
                new ContextMenuItem({
                    name: "Cursief",
                    icon: "italic",
                    selected: this.editor.isActive("italic"),
                    action: () => {
                        m.editor.chain().focus().toggleItalic().run()
                        return true
                    }
                }),
                new ContextMenuItem({
                    name: "Onderstrepen",
                    icon: "underline",
                    selected: this.editor.isActive("underline"),
                    action: () => {
                        m.editor.chain().focus().toggleUnderline().run()
                        return true
                    }
                }),
            ],
            [
                new ContextMenuItem({
                    name: "Titel",
                    icon: "h1",
                    selected: this.editor.isActive("heading", { level: 1 }),
                    action: () => {
                        m.editor.chain().focus().toggleHeading({ level: 1 }).run()
                        return true
                    }
                }),
                new ContextMenuItem({
                    name: "Koptekst",
                    icon: "h2",
                    selected: this.editor.isActive("heading", { level: 2 }),
                    action: () => {
                        m.editor.chain().focus().toggleHeading({ level: 2 }).run()
                        return true
                    }
                }),
                new ContextMenuItem({
                    name: "Subkop",
                    icon: "h3",
                    selected: this.editor.isActive("heading", { level: 3 }),
                    action: () => {
                        m.editor.chain().focus().toggleHeading({ level: 3 }).run()
                        return true
                    }
                }),
                new ContextMenuItem({
                    name: "Licht gekleurd",
                    icon: "info-circle",
                    selected: this.editor.isActive("descriptiveText"),
                    action: () => {
                        m.editor.chain().focus().toggleDescriptiveText().run()
                        return true
                    }
                }),
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

    buildEditor(content: Content = "") {
        return new Editor({
            content,
            extensions: [
                StarterKit,
                Typography.configure({}),
                SmartVariableNode.configure({
                    smartVariables: this.smartVariables.filter(s => s.html === undefined),
                }),
                SmartVariableNodeBlock.configure({
                    smartVariables: this.smartVariables.filter(s => s.html !== undefined),
                }),
                SmartButtonNode.configure({
                    smartButtons: this.smartButtons,
                }),
                SmartButtonInlineNode.configure({
                    smartButtons: this.smartButtons,
                }),
                Link.configure({
                    openOnClick: false,
                }),
                Underline,
                DescriptiveText,
                CustomImage
            ],
            onSelectionUpdate: ({editor}) => {
                if (this.showLinkEditor){
                    if (editor.isActive("link")) {
                        this.editLink = editor.getAttributes('link')?.href ?? ""
                    } else {
                        if (this.editor.state.selection.empty) {
                            this.showLinkEditor = false
                        }
                    }
                }
            }
        })
    }

    @Watch('smartVariables')
    onSmartVariablesChanged(newSmartVariables: EditorSmartVariable[], oldSmartVariables: EditorSmartVariable[]) {
        const content = this.editor.getJSON()

        // Loop all nodes with type smartButton or smartText and remove them if needed (when they are not in the smartVariables + list warning)
        //this.checkNode(content, newSmartVariables, oldSmartVariables)
        this.warnInvalidNodes(content, newSmartVariables, oldSmartVariables)
        this.deleteInvalidNodes(content)

        // console.log(content)
        this.editor.destroy()
        this.editor = this.buildEditor(content)
    }

    /**
     * Return true if node needs to be kept
     */
    warnInvalidNodes(node: JSONContent, newSmartVariables: EditorSmartVariable[], oldSmartVariables: EditorSmartVariable[]) {
        if (node.type == "smartVariable") {
            if (!newSmartVariables.find(smartVariable => smartVariable.id == node.attrs?.id)) {
                // If did found in old?
                const old = oldSmartVariables.find(smartVariable => smartVariable.id == node.attrs?.id)
                if (old && old.deleteMessage) {
                    new Toast(old.deleteMessage, "warning yellow").setHide(30*1000).show()
                }
            }
        }

        if (node.content) {
            for (const childNode of node.content)
                this.warnInvalidNodes(childNode, newSmartVariables, oldSmartVariables)
        }
    }

    /**
     * Return true if node needs to be kept
     */
    deleteInvalidNodes(node: JSONContent) {
        if (node.type == "smartButton" || node.type == "smartButtonInline") {
            return !!this.smartButtons.find(smartButton => smartButton.id == node.attrs?.id)
        }
        if (node.type == "smartVariable") {
            return !!this.smartVariables.find(v => v.id == node.attrs?.id)
        }
        if (node.content) {
            node.content = node.content.filter(childNode => {
                return this.deleteInvalidNodes(childNode)
            })
        }
        return true
    }

    getSmartButton(id: string) {
        return this.smartButtons.find(button => button.id === id)
    }

    getSmartVariable(id: string) {
        return this.smartVariables.find(button => button.id === id)
    }

    showSmartVariableMenu(event) {
        // Get initial selection
        const initialSelection = document.activeElement
        
        const m = this
        const menu = new ContextMenu([
            ...(this.smartVariables.length > 0 ? [
                this.smartVariables.map(variable => {
                    return new ContextMenuItem({
                        name: variable.name,
                        description: variable.description ? variable.description : undefined,
                        action: () => {
                            if (initialSelection && initialSelection.tagName === 'INPUT') {
                                // Allow replacements in input fields
                                const input = initialSelection as HTMLInputElement

                                if (input.selectionStart !== null && input.selectionEnd !== null) {
                                    input.setRangeText(`{{${variable.id}}}`, input.selectionStart, input.selectionEnd, 'end');
                                    input.focus()
                                }
                            } else {
                                m.editor.chain().focus().insertSmartVariable(variable).run()
                            }

                            return true
                        }
                    })
                })
            ] : []),
            ...(this.smartButtons.length > 0 ? [
                this.smartButtons.map(variable => {
                    return new ContextMenuItem({
                        name: variable.name,
                        action: () => {
                            m.editor.chain().focus().insertSmartButton(variable).run()

                            return true
                        }
                    })
                })
            ]: [])
        ])
        menu.show({ button: event.currentTarget, yPlacement: "top" }).catch(console.error)
    }

}
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

                &.primary {
                    background-color: var(--editor-primary-color, #{$color-primary});
                    color: var(--editor-primary-color-contrast, #{$color-primary-contrast});
                }
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