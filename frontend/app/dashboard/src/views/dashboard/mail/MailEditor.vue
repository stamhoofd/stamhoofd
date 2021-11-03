<template>
    <div class="editor">
        <editor-menu-bubble v-slot="{ commands, isActive, menu, getMarkAttrs }" class="menu-bubble" :editor="editor">
            <div :class="{ 'is-active': menu.isActive }" :style="`left: ${menu.left}px; bottom: ${menu.bottom}px;`">
                <form v-if="linkMenuIsActive" class="menububble__form" @submit.prevent="setLinkUrl(commands.link, linkUrl)">
                    <input ref="linkInput" v-model="linkUrl" class="menububble__input" type="text" placeholder="https://" @keydown.esc="hideLinkMenu">
                    <button type="button" class="icon trash" @click="setLinkUrl(commands.link, null)" />
                </form>

                <template v-else>
                    <button :class="{ 'is-active': isActive.bold() }" class="icon bold" @click="commands.bold" />
                    <button :class="{ 'is-active': isActive.italic() }" class="icon italic" @click="commands.italic" />
                    <button :class="{ 'is-active': isActive.underline() }" class="icon underline" @click="commands.underline" />
                    <button :class="{ 'is-active': isActive.link() }" class="icon link" @click="showLinkMenu(getMarkAttrs('link'))" />

                    <button :class="{ 'is-active': isActive.heading({ level: 1 }) }" @click="commands.heading({ level: 1 })">
                        H1
                    </button>
                    <button :class="{ 'is-active': isActive.heading({ level: 2 }) }" @click="commands.heading({ level: 2 })">
                        H2
                    </button>
                    <button :class="{ 'is-active': isActive.heading({ level: 3 }) }" @click="commands.heading({ level: 3 })">
                        H3
                    </button>
                    <button :class="{ 'is-active': isActive.bullet_list() }" class="icon ul" @click="commands.bullet_list" />
                    <button :class="{ 'is-active': isActive.ordered_list() }" class="icon ol" @click="commands.ordered_list" />
                </template>
            </div>
        </editor-menu-bubble>
        <editor-floating-menu v-slot="{ commands, isActive, menu }" :editor="editor">
            <div class="floating-menu" :class="{ 'is-active': menu.isActive }" :style="`top: ${menu.top}px`">
                <button :class="{ 'is-active': isActive.heading({ level: 1 }) }" @click="commands.heading({ level: 1 })">
                    H1
                </button>
                <button :class="{ 'is-active': isActive.heading({ level: 2 }) }" @click="commands.heading({ level: 2 })">
                    H2
                </button>
                <button :class="{ 'is-active': isActive.heading({ level: 3 }) }" @click="commands.heading({ level: 3 })">
                    H3
                </button>
                <button :class="{ 'is-active': isActive.bullet_list() }" class="icon ul" @click="commands.bullet_list" />
                <button :class="{ 'is-active': isActive.ordered_list() }" class="icon ol" @click="commands.ordered_list" />
            </div>
        </editor-floating-menu>
        <div ref="content" class="editor-container input">
            <editor-content :editor="editor" class="editor-content" />
            <footer>
                <slot name="footer" />
            </footer>
        </div>
    </div>
</template>

<script lang="ts">
import { Editor, EditorContent, EditorFloatingMenu, EditorMenuBubble } from "tiptap";
import {
    Bold,
    BulletList,
    HardBreak,
    Heading,
    History,
    Italic,
    Link,
    ListItem,
    OrderedList,
    Underline,
} from "tiptap-extensions";
import { Component, Prop, Vue } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import ReplacePlaceholderMark from "./ReplacePlaceholderMark";

@Component({
    components: { EditorContent, EditorMenuBubble, EditorFloatingMenu },
})
export default class MailEditor extends Vue {
    linkUrl = null
    linkMenuIsActive = false

    @Prop({ required: true })
    hasFirstName: boolean;
    
    editor = (() => {
        return new Editor({
            extensions: [
                new BulletList(),
                new HardBreak(),
                new Heading({ levels: [1, 2, 3, 4, 5] }),
                new ListItem(),
                new OrderedList(),
                new Link({ openOnClick: false }),
                new Bold(),
                new Italic(),
                new Underline(),
                new History(),
                new ReplacePlaceholderMark(),
            ],
            content: this.hasFirstName ? '<p>Dag <span data-replace-type="firstName"></span>,</p>' : '',
        });
    })();

    mounted() {
        if (OrganizationManager.organization.meta.color) {
            (this.$refs.content as HTMLElement).style.setProperty("--color-primary", OrganizationManager.organization.meta.color);
        }
    }

    beforeDestroy() {
        this.editor.destroy();
    }

    showLinkMenu(attrs) {
        this.linkUrl = attrs.href
        this.linkMenuIsActive = true
        this.$nextTick(() => {
            (this.$refs.linkInput as any).focus()
        })
    }

    hideLinkMenu() {
        this.linkUrl = null
        this.linkMenuIsActive = false
    }

    setLinkUrl(command, url: string | null) {
        if (url) {
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "http://"+url;
            }
        }
        
        command({ href: url })
        this.hideLinkMenu()
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.editor .ProseMirror {
    max-width: none;
    padding: 15px 15px;
    height: auto;
    min-height: $input-height * 2;
    line-height: normal;
    outline: none;
}

.editor .editor-container {
    padding: 0;
    height: auto;
    min-height: $input-height * 2;
    line-height: normal;
    outline: none;

    > footer {
        padding: 0 15px 15px 15px;
        --st-horizontal-padding: 15px;
        
        > div.disabled {
            user-select: none;
            cursor: not-allowed;
            color: $color-gray-dark;

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

.editor {
    position: relative;

    .floating-menu, .menu-bubble {
        font-size: 14px;

        button {
            position: relative;
            display: inline-block;
            width: 24px;
            height: 24px;
            text-align: center;
            line-height: 24px;
            vertical-align: middle;
            cursor: pointer;
            touch-action: manipulation;
            font-weight: bold;
            padding: 5px;
            box-sizing: content-box;

            &::after {
                position: absolute;
                content: '';
                left: 0;
                top: 0;
                right: 0;
                bottom: 0;
                z-index: -1;
                border-radius: $border-radius;
                background: $color-dark;
                transition: background-color 0.2s, transform 0.2s;
                transform: scale(0.9, 0.9);
            }

            &:hover {
                &::after {
                    background: $color-gray-dark;
                    transform: scale(1, 1);
                }
            }

            &.is-active {
                &::after {
                    background: $color-primary;
                    transform: scale(1, 1);
                }
            }

            &:active {
                &::after {
                    transform: scale(0.8, 0.8);
                }
            }
        }
    }

    .floating-menu {
        position: absolute;
        transform: translate(-15px, 0);
        z-index: 100;
        transition: transform 0.2s, opacity 0.2s, visibility 0.2s step-end;
        opacity: 0;
        padding: 8px 15px;
        right: 15px;
        pointer-events: none;

        background: $color-dark;
        border-radius: $border-radius;
        @extend .style-description;
        @extend .style-overlay-shadow;
        color: $color-white;

        &.is-active {
            pointer-events: initial;
            visibility: visible;
            transition: transform 0.2s 0.2s, opacity 0.2s 0.2s, visibility 0.2s step-start 0.2s;
            opacity: 1;
            
            transform: translate(0, 0);
        }
    }

    .menu-bubble {
        position: absolute;
        visibility: hidden;
        pointer-events: none;
        transform: translate(-50%, 5px);
        z-index: 100;

        background: $color-dark;
        padding: 8px 15px;
        border-radius: $border-radius;
        @extend .style-description;
        @extend .style-overlay-shadow;
        color: $color-white;
        transition: transform 0.2s, opacity 0.2s, visibility 0.2s step-end;
        opacity: 0;

        &.is-active {
            pointer-events: initial;
            visibility: visible;
            transition: transform 0.2s 0.2s, opacity 0.2s 0.2s, visibility 0.2s step-start 0.2s;
            opacity: 1;
            transform: translate(-50%, -5px);
        }
    }

    .editor-content {
        p {
            margin: 5px 0;
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

        h3 {
            @extend .style-title-small;
        }

        ol, ul {
            list-style-position: outside;
            padding-left: 30px;

        }

        .replace-placeholder {
            background: $color-gray-lighter;
            padding: 3px 5px;
            font-weight: 600;
            color: $color-gray;
            border-radius: $border-radius;
            white-space: nowrap;

            &.ProseMirror-selectednode {
                background: $color-primary;
                color: white;
            }
        }
    }
}
</style>
