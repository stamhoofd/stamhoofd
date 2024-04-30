<template>
    <div>
        <button v-tooltip="'Vet gedrukte tekst'" class="button icon bold" :class="{ 'is-active': editor.isActive('bold') }" type="button" @click="editor.chain().focus().toggleBold().run()" />
        <button v-tooltip="'Schuine tekst'" class="button icon italic" type="button" :class="{ 'is-active': editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()" />
        <button v-tooltip="'Onderlijn tekst'" class="button icon underline" type="button" :class="{ 'is-active': editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()" />
                    
        <hr v-if="!$isMobile">

        <button v-tooltip="'Titel'" class="button icon h1" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" />
        <button v-tooltip="'Koptekst'" class="button icon h2" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" />
        <button v-tooltip="'Subkop'" class="button icon h3" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" />
        <button v-tooltip="'Informatieve tekst'" class="button icon info-circle" type="button" :class="{ 'is-active': editor.isActive('descriptiveText') }" @click="editor.chain().focus().toggleDescriptiveText().run()" />
                    
        <hr v-if="!$isMobile">

        <button v-tooltip="'Opsomming met bolletjes'" class="button icon ul" type="button" :class="{ 'is-active': editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()" />
        <button v-tooltip="'Opsomming met nummers'" class="button icon ol" type="button" :class="{ 'is-active': editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()" />
    </div>
</template>


<script lang="ts">
import { Editor } from '@tiptap/vue-3'
import { Component, Prop, Vue } from "vue-property-decorator";

import { default as TooltipDirective } from '../directives/Tooltip';

@Component({
    directives: {
        tooltip: TooltipDirective
    }
})
export default class TextStyleButtonsView extends Vue {
    @Prop({ required: true })
    editor: Editor;

}
</script>