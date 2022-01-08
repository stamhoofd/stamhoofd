<template>
    <div>
        <button class="button icon bold" :class="{ 'is-active': editor.isActive('bold') }" type="button" @click="editor.chain().focus().toggleBold().run()" />
        <button class="button icon italic" type="button" :class="{ 'is-active': editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()" />
        <button class="button icon underline" type="button" :class="{ 'is-active': editor.isActive('strike') }" @click="editor.chain().focus().toggleUnderline().run()" />
                    
        <hr>

        <button class="button icon h1" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" />
        <button class="button icon h2" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" />
        <button class="button icon h3" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" />
                    
        <hr>

        <button class="button icon ul" type="button" :class="{ 'is-active': editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()" />
        <button class="button icon ol" type="button" :class="{ 'is-active': editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()" />
    </div>
</template>


<script lang="ts">
import { Editor } from '@tiptap/vue-2'
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({})
export default class TextStyleButtonsView extends Vue {
    @Prop({ required: true })
    editor: Editor;

}
</script>