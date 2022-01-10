<template>
    <form class="editor-view st-view" @submit.prevent="$emit('save')">
        <STNavigationBar :title="title">
            <BackButton v-if="$parent.canPop" slot="left" @click="$parent.pop" />
            <template v-else-if="$isMobile" slot="left">
                <button v-if="$isAndroid" class="button navigation icon close" type="button" @click="$parent.pop" />
                <button v-else class="button text selected unbold" type="button" @click="$parent.pop">
                    {{ cancelText }}
                </button>
            </template>

            <LoadingButton v-if="$isMobile" slot="right" :loading="loading">
                <button class="button navigation highlight" :disabled="disabled" type="submit">
                    {{ saveText }}
                </button>
            </LoadingButton>
            <button v-else-if="$parent.canDismiss" slot="right" class="button navigation icon close" type="button" @click="$parent.dismiss" />
        </STNavigationBar>
        <main ref="main">
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
            <TextStyleButtonsView v-if="!$isMobile && showTextStyles" class="editor-button-bar sticky" :editor="editor" />

            <div v-if="editor.isActive('smartButton')" class="editor-button-bar hint sticky">
                {{ getSmartButton(editor.getAttributes('smartButton').id).hint }}
            </div>

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
                        <button v-if="editor.isActive('link')" slot="right" v-tooltip="'Link verwijderen'" class="button icon trash" type="button" @mousedown.prevent @click.prevent="clearLink()" />
                    </STListItem>
                </STList>
            </form>
        </main>
        <STToolbar v-if="!$isMobile">
            <template #right>
                <div class="editor-button-bar">
                    <button v-tooltip="'Toon/verberg tekst opties'" class="button icon text-style" :class="{ 'is-active': showTextStyles }" type="button" @click.prevent="editor.chain().focus().run(); showTextStyles = !showTextStyles" />
                    <hr>
                    <button v-if="smartVariables.length > 0" v-tooltip="'Magische tekstvervanging'" class="button icon wand" type="button" @click.prevent="showSmartVariableMenu" @mousedown.prevent />
                    <button v-tooltip="'Horizontale lijn'" class="button icon hr" type="button" @click="editor.chain().focus().setHorizontalRule().run()" @mousedown.prevent />
                    <button v-tooltip="'Link toevoegen'" class="button icon link" type="button" :class="{ 'is-active': editor.isActive('link') }" @click.prevent="openLinkEditor()" @mousedown.prevent />
                
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
            <template v-if="showTextStyles">
                <TextStyleButtonsView class="editor-button-bar mobile" :editor="editor" />
                <button class="button close icon" type="button" @click.prevent="showTextStyles = false" @mousedown.prevent />
            </template>
            <template v-else>
                <button v-tooltip="'Toon/verberg tekst opties'" class="button icon text-style" :class="{ 'is-active': showTextStyles }" type="button" @click.prevent="editor.chain().focus().run(); showTextStyles = !showTextStyles" />
                <button v-if="smartVariables.length > 0" v-tooltip="'Slimme tekstvervanging'" class="button icon wand" type="button" @click.prevent="showSmartVariableMenu" @mousedown.prevent />
                <button v-tooltip="'Horizontale lijn'" class="button icon hr" type="button" @click="editor.chain().focus().setHorizontalRule().run()" @mousedown.prevent />
                <button v-tooltip="'Link toevoegen'" class="button icon link" type="button" :class="{ 'is-active': editor.isActive('link') }" @click="openLinkEditor()" @mousedown.prevent />
                <slot name="buttons" />
            </template>
        </STButtonToolbar>
    </form>
</template>


<script lang="ts">
import { Content, JSONContent } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { Editor, EditorContent } from '@tiptap/vue-2'
import { Component,Prop,Vue, Watch } from "vue-property-decorator";

import { default as TooltipDirective } from "../directives/Tooltip";
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
import { EditorSmartButton, SmartButtonNode } from './EditorSmartButton';
import { EditorSmartVariable, SmartVariableNode } from './EditorSmartVariable';
import TextStyleButtonsView from './TextStyleButtonsView.vue';

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
        TextStyleButtonsView
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

    beforeDestroy() {
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

    buildEditor(content: Content = "") {
        return new Editor({
            content,
            extensions: [
                StarterKit,
                SmartVariableNode.configure({
                    smartVariables: this.smartVariables,
                }),
                SmartButtonNode.configure({
                    smartButtons: this.smartButtons,
                }),
                Link.configure({
                    openOnClick: false,
                }),
                Underline,
                DescriptiveText
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
        this.deleteInvalidButtons(content)

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
    deleteInvalidButtons(node: JSONContent) {
        if (node.type == "smartButton") {
            return !!this.smartButtons.find(smartButton => smartButton.id == node.attrs?.id)
        }
        if (node.content) {
            node.content = node.content.filter(childNode => {
                return this.deleteInvalidButtons(childNode,)
            })
        }
        return true
    }

    getSmartButton(id: string) {
        return this.smartButtons.find(button => button.id === id)
    }

    showSmartVariableMenu(event) {
        // Get initial selection
        const initialSelection = document.activeElement
        
        const m = this
        const menu = new ContextMenu([
            this.smartVariables.map(variable => {
                return new ContextMenuItem({
                    name: variable.name,
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
            }),
            this.smartButtons.map(variable => {
                return new ContextMenuItem({
                    name: variable.name,
                    action: () => {
                        m.editor.chain().focus().insertSmartButton(variable).run()

                        return true
                    }
                })
            })
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

        & > .ProseMirror {
            flex-grow: 1;

            @import './email.url.scss';

            span[data-type="smartVariable"] {
                background: $color-gray-3;
                padding: 3px 2px;
                margin: 0 -2px;
                //color: $color-gray-5;
                border-radius: $border-radius;
                white-space: nowrap;

                &:empty {
                    padding: 0;
                    margin: 0;
                    background: none;
                }

                &.ProseMirror-selectednode {
                    background: $color-primary;
                    color: $color-primary-contrast;
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

    .editor-button-bar {

        display: flex;
        flex-direction: row;
        align-items: center;

        &.hint {
            display: block;
            padding: 10px 15px;
            @extend .style-description;
        }

        &.link {
            --st-horizontal-padding: 15px;
            padding: 0 15px;
            display: block;
        }

        &.mobile {
            flex-wrap: wrap;
            flex-grow: 1;

            > .button {
                flex-grow: 1;
            }
        }

        &.sticky {
            position: sticky; 
            bottom: 0;
            border: $border-width solid $color-border;
            background: var(--color-current-background-shade);
            border-radius: $border-radius-modals;
            transition: transform 0.2s, opacity 0.2s, visibility 0.2s step-start;

            &.hidden {
                transform: translate(0, 100%);
                opacity: 0;
                //visibility: hidden;
                transition: transform 0.2s, opacity 0.2s, visibility 0.2s step-end;
            }

            > .button {
                padding: 10px 5px;
            }
        }

        > .button {
            padding: 5px 10px;
            margin: 0 auto;

            &.is-active {
                color: $color-primary;
            }

            &:after {
                left: 0;
                right: 0;
            }
        }

        > hr {
            width: $border-width;
            height: 15px;
            flex-shrink: 0;
            border: 0;
            outline: 0;
            margin: 0 15px;
            background: $color-border;
        }
    }
}
</style>