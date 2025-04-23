<template>
    <div>
        <button class="button icon bold" :class="{ 'is-active': editor.isActive('bold') }" type="button" :v-tooltip="$t('Vet gedrukte tekst')" @click="editor.chain().focus().toggleBold().run()" />
        <button class="button icon italic" type="button" :class="{ 'is-active': editor.isActive('italic') }" :v-tooltip="$t('Schuine tekst')" @click="editor.chain().focus().toggleItalic().run()" />
        <button class="button icon underline" type="button" :class="{ 'is-active': editor.isActive('underline') }" :v-tooltip="$t('Onderlijn tekst')" @click="editor.chain().focus().toggleUnderline().run()" />

        <hr v-if="!$isMobile"><button class="button icon h1" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }" :v-tooltip="$t('Titel')" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" />
        <button class="button icon h2" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }" :v-tooltip="$t('Koptekst')" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" />
        <button class="button icon h3" type="button" :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }" :v-tooltip="$t('Subkop')" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" />
        <button class="button icon info-circle" type="button" :class="{ 'is-active': editor.isActive('descriptiveText') }" :v-tooltip="$t('Informatieve tekst')" @click="editor.chain().focus().toggleDescriptiveText().run()" />

        <hr v-if="!$isMobile"><button class="button icon ul" type="button" :class="{ 'is-active': editor.isActive('bulletList') }" :v-tooltip="$t('Opsomming met bolletjes')" @click="editor.chain().focus().toggleBulletList().run()" />
        <button class="button icon ol" type="button" :class="{ 'is-active': editor.isActive('orderedList') }" :v-tooltip="$t('Opsomming met nummers')" @click="editor.chain().focus().toggleOrderedList().run()" />
    </div>
</template>

<script lang="ts">
import { Editor } from '@tiptap/vue-3';
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

import { default as TooltipDirective } from '../directives/Tooltip';

@Component({
    directives: {
        tooltip: TooltipDirective,
    },
})
export default class TextStyleButtonsView extends VueComponent {
    @Prop({ required: true })
    editor: Editor;
}
</script>
