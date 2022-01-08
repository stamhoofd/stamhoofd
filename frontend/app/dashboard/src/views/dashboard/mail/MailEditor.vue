<template>
    <div class="editor">
        <div ref="content" class="editor-container">
            <div class="editor-button-bar">
                <button class="button icon text" :class="{ 'is-active': editor.isActive('bold') }" type="button" @click="editor.chain().focus().toggleBold().run()" />
                              
                <hr>

                <button class="button icon hr" type="button" @click="editor.chain().focus().setHorizontalRule().run()" />
                <button class="button icon link" type="button" @click="editor.chain().focus().setHorizontalRule().run()" />

                <hr v-if="!!$slots.buttons">

                <slot name="buttons" />


                <hr>
                
                <button class="button icon undo" type="button" @click="editor.chain().focus().undo().run()" />
                <button class="button icon redo" type="button" @click="editor.chain().focus().redo().run()" />
            </div>

            <div v-if="false" class="editor-button-bar">
                <button class="button icon bold" :class="{ 'is-active': editor.isActive('bold') }" type="button" @click="editor.chain().focus().toggleBold().run()" />
                <button class="button icon italic" type="button" :class="{ 'is-active': editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()" />
                <button class="button icon underline" type="button" :class="{ 'is-active': editor.isActive('strike') }" @click="editor.chain().focus().toggleUnderline().run()" />
                
                <hr>

                <button class="button icon clear" type="button" @click="editor.chain().focus().unsetAllMarks().run()" />
                <button class="button icon paragraph" type="button" :class="{ 'is-active': editor.isActive('paragraph') }" @click="editor.chain().focus().setParagraph().run()" />
                <button class="button icon h1" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" />
                <button class="button icon h2" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" />
                <button class="button icon h3" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" />
                
                <hr>

                <button class="button icon ul" type="button" :class="{ 'is-active': editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()" />
                <button class="button icon ol" type="button" :class="{ 'is-active': editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()" />
            </div>
            <editor-content :editor="editor" class="editor-content" />
            <footer>
                <slot name="footer" />
            </footer>
        </div>
    </div>
</template>

<script lang="ts">
import StarterKit from '@tiptap/starter-kit'
import { Editor, EditorContent } from '@tiptap/vue-2'
import { Component, Prop, Vue } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
//import ReplacePlaceholderMark from "./ReplacePlaceholderMark";

@Component({
    components: {
        EditorContent,
    },
})
export default class MailEditor extends Vue {
    linkUrl = null
    linkMenuIsActive = false

    @Prop({ required: true })
    hasFirstName: boolean;
    
    editor = (() => {
        return new Editor({
            content: '<p>I’m running Tiptap with Vue.js. 🎉</p>',
            extensions: [
                StarterKit,
            ],
        })
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

</style>
