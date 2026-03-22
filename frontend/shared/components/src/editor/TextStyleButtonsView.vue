<template>
    <div>
        <button class="button icon bold" :class="{ 'enabled': editor.isActive('bold') }" type="button" :v-tooltip="$t('%aG')" @click="editor.chain().focus().toggleBold().run()" />
        <button class="button icon italic" type="button" :class="{ 'enabled': editor.isActive('italic') }" :v-tooltip="$t('%aH')" @click="editor.chain().focus().toggleItalic().run()" />
        <button class="button icon underline" type="button" :class="{ 'enabled': editor.isActive('underline') }" :v-tooltip="$t('%aI')" @click="editor.chain().focus().toggleUnderline().run()" />

        <hr v-if="!$isMobile"><button class="button icon h1" type="button" :class="{ 'enabled': editor.isActive('heading', { level: 1 }) }" :v-tooltip="$t('%vC')" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" />
        <button class="button icon h2" type="button" :class="{ 'enabled': editor.isActive('heading', { level: 2 }) }" :v-tooltip="$t('%aJ')" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" />
        <button class="button icon h3" type="button" :class="{ 'enabled': editor.isActive('heading', { level: 3 }) }" :v-tooltip="$t('%vD')" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" />
        <button class="button icon info-circle" type="button" :class="{ 'enabled': editor.isActive('descriptiveText') }" :v-tooltip="$t('%aK')" @click="editor.chain().focus().toggleDescriptiveText().run()" />

        <hr v-if="!$isMobile"><button class="button icon ul" type="button" :class="{ 'enabled': editor.isActive('bulletList') }" :v-tooltip="$t('%aL')" @click="editor.chain().focus().toggleBulletList().run()" />
        <button class="button icon ol" type="button" :class="{ 'enabled': editor.isActive('orderedList') }" :v-tooltip="$t('%vF')" @click="editor.chain().focus().toggleOrderedList().run()" />
    </div>
</template>

<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3';

defineProps<{
    editor: Editor;
}>();
</script>
