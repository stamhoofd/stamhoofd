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
            <TextStyleButtonsView v-if="!$isMobile" class="editor-button-bar sticky" :class="{ hidden: !showTextStyles }" :editor="editor" />

            <div v-if="editor.isActive('smartButton')" class="editor-button-bar sticky">
                Deze slimme knop doet iets als gebruikers erop klikken.
            </div>
        </main>
        <STToolbar v-if="!$isMobile">
            <template #right>
                <div class="editor-button-bar">
                    <button v-tooltip="'Toon/verberg tekst opties'" class="button icon text-style" :class="{ 'is-active': showTextStyles }" type="button" @click.prevent="editor.chain().focus().run(); showTextStyles = !showTextStyles" />
                    <hr>
                    <button v-if="smartVariables.length > 0" v-tooltip="'Magische tekstvervanging'" class="button icon wand" type="button" @click.prevent="showSmartVariableMenu" @mousedown.prevent />
                    <button v-tooltip="'Horizontale lijn'" class="button icon hr" type="button" @click="editor.chain().focus().setHorizontalRule().run()" />
                    <button v-tooltip="'Link toevoegen'" class="button icon link" type="button" @click="editor.chain().focus().setHorizontalRule().run()" />
                
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
        <STButtonToolbar v-else class="sticky" @mousedown.prevent>
            <template v-if="showTextStyles">
                <TextStyleButtonsView class="editor-button-bar" :editor="editor" />
                <button class="button close icon" type="button" @click.prevent="showTextStyles = false" @mousedown.prevent />
            </template>
            <template v-else>
                <button v-tooltip="'Toon/verberg tekst opties'" class="button icon text-style" :class="{ 'is-active': showTextStyles }" type="button" @click.prevent="editor.chain().focus().run(); showTextStyles = !showTextStyles" />
                <hr>
                <button v-if="smartVariables.length > 0" v-tooltip="'Slimme tekstvervanging'" class="button icon wand" type="button" @click.prevent="showSmartVariableMenu" @mousedown.prevent />
                <button v-tooltip="'Horizontale lijn'" class="button icon hr" type="button" @click="editor.chain().focus().setHorizontalRule().run()" />
                <button v-tooltip="'Link toevoegen'" class="button icon link" type="button" @click="editor.chain().focus().setHorizontalRule().run()" />
                <slot name="buttons" />
            </template>
        </STButtonToolbar>
    </form>
</template>


<script lang="ts">
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import { Editor, EditorContent } from '@tiptap/vue-2'
import { Component,Prop,Vue, Watch } from "vue-property-decorator";

import { default as TooltipDirective } from "../directives/Tooltip";
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { ViewportHelper } from '../ViewportHelper';
import BackButton from "./BackButton.vue";
import { EditorSmartButton, SmartButtonNode } from './EditorSmartButton';
import { EditorSmartVariable, SmartVariableNode } from './EditorSmartVariable';
import LoadingButton from "./LoadingButton.vue";
import STButtonToolbar from "./STButtonToolbar.vue";
import STNavigationBar from "./STNavigationBar.vue";
import STToolbar from "./STToolbar.vue";
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

    editor = this.buildEditor()

    beforeDestroy() {
        this.editor.destroy()
    }

    buildEditor(content = "") {
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
            ],
            // Listen for selection changes and make sure the selected range stays above the keyboard (and scroll if needed)
            /*onSelectionUpdate: ({ editor }) => {
                console.log("Selection change")
                // The selection has changed.
                const selection = window.getSelection()
                if (selection) {
   
                    const range = selection.getRangeAt(0).cloneRange() // Clone is needed, else it wont work for an unknown reason
                    if (range) {
                        const rect = range.getBoundingClientRect()
                        const scrollElement = this.$refs.main as HTMLElement
                        const scrollElementRect = scrollElement.getBoundingClientRect()
                        console.log("rect", rect)
                        console.log("scrollElementRect", scrollElementRect)
                        if (rect.bottom > scrollElementRect.bottom) {
                            const scroll = rect.bottom - scrollElementRect.bottom
                            const endPosition = scrollElement.scrollTop + scroll

                            console.log("Scroll to position", endPosition)
                            console.log("Scroll offset", scroll)

                            const exponential = function(x: number): number {
                                return x === 1 ? 1 : 1 - Math.pow(1.5, -20 * x);
                            }
                            ViewportHelper.scrollTo(scrollElement, endPosition, 300, exponential)
                        }
                    }
                }
            },*/
        })
    }

    @Watch('smartVariables')
    onSmartVariablesChanged() {
        console.log("Reload editor!!")
        const content = this.editor.getHTML()
        this.editor.destroy()
        this.editor = this.buildEditor(content)
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
        }

        p {
            margin: 0;
            padding: 0;
            line-height: 1.4;
        }

        strong {
            font-weight: bold;
        }

        em {
            font-style: italic;
        }

        h1 {
            @extend .style-title-1;
            margin: 0;
            padding: 0;
        }

        h2 {
            @extend .style-title-2;
            margin: 0;
            padding: 0;
        }

        h3 {
            @extend .style-title-3;
            margin: 0;
            padding: 0;
        }

        ol, ul {
            list-style-position: outside;
            padding-left: 30px;

        }

        hr {
            @extend .style-hr;
        }

        .button {
            touch-action: inherit;
            user-select: auto;
            cursor: default;

            &:active {
                transform: none;
            }
        }

        span[data-type="smartVariable"] {
            background: $color-gray-3;
            padding: 3px 2px;
            margin: 0 -2px;
            color: $color-gray-5;
            border-radius: $border-radius;
            white-space: nowrap;

            &.ProseMirror-selectednode {
                background: $color-primary;
                color: $color-primary-contrast;
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
                visibility: hidden;
                transition: transform 0.2s, opacity 0.2s, visibility 0.2s step-end;
            }

            > .button {
                padding: 10px 5px;
            }
        }

        > .button {
            padding: 5px;
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