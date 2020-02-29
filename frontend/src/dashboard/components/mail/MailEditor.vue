<template>
    <div class="editor">
        <editor-menu-bubble class="menu-bubble" :editor="editor" v-slot="{ commands, isActive, menu }">
            <div :class="{ 'is-active': menu.isActive }" :style="`left: ${menu.left}px; bottom: ${menu.bottom}px;`">
                <button :class="{ 'is-active': isActive.bold() }" @click="commands.bold">
                    Bold
                </button>
                <button :class="{ 'is-active': isActive.italic() }" @click="commands.italic">
                    Italic
                </button>
                <button :class="{ 'is-active': isActive.underline() }" @click="commands.underline">
                    Underline
                </button>
            </div>
        </editor-menu-bubble>
        <editor-content :editor="editor" class="editor-content" />
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";
import { Editor, EditorContent, EditorMenuBubble, EditorFloatingMenu } from "tiptap";
import {
    Blockquote,
    BulletList,
    CodeBlock,
    HardBreak,
    Heading,
    ListItem,
    OrderedList,
    Bold,
    Code,
    Italic,
    Link,
    Strike,
    Underline,
    History
} from "tiptap-extensions";

@Component({
    components: { EditorContent, EditorMenuBubble, EditorFloatingMenu }
})
export default class MailEditor extends Vue {
    editor: Editor | null = null;

    mounted() {
        this.editor = new Editor({
            extensions: [
                new Blockquote(),
                new BulletList(),
                new CodeBlock(),
                new HardBreak(),
                new Heading({ levels: [1, 2, 3] }),
                new ListItem(),
                new OrderedList(),
                new Link(),
                new Bold(),
                new Code(),
                new Italic(),
                new Strike(),
                new Underline(),
                new History()
            ],
            content: "<p>Typ hier je bericht</p>"
        });
    }

    beforeDestroy() {
        this.editor.destroy();
    }
}
</script>

<style lang="scss">
@use '~scss/base/text-styles.scss';

.editor {
    position: relative;
    .menu-bubble {
        position: absolute;
        visibility: hidden;
        transform: translate(-50%, 5px);
        z-index: 100;

        background: $color-dark;
        padding: 8px 0;
        border-radius: $border-radius;
        @extend .style-description;
        @extend .style-overlay-shadow;
        color: $color-white;
        //transition: transform 0.2s, opacity 0.2s, visibility 0.2s step-end;
        opacity: 0;

        &.is-active {
            visibility: visible;
            //transition: transform 0.2s, opacity 0.2s, visibility 0.2s step-start;
            opacity: 1;
            transform: translate(-50%, -5px);
        }
    }

    .floating-menu {
        position: absolute;
        visibility: hidden;
        transform: translate(-20px, 0);
        z-index: 101;
        background: $color-white;

        padding: 4px 0;
        border-radius: $border-radius;
        @extend .style-description;
        color: $color-dark;
        //transition: transform 0.2s, opacity 0.2s, visibility 0.2s step-end;
        opacity: 0;

        &.is-active {
            visibility: visible;
            //transition: transform 0.2s, opacity 0.2s, visibility 0.2s step-start;
            opacity: 1;
            transform: translate(10px, -5px);
        }
    }

    .ProseMirror {
        p {
            margin: 20px 0;
        }
        strong {
            font-weight: bold;
        }
        em {
            font-style: italic;
        }
        h1 {
            @extend .style-title-1;
        }
        h2 {
            @extend .style-title-2;
        }
    }
}
</style>
