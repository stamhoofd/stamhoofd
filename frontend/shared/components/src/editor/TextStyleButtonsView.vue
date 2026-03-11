<template>
    <div>
        <button class="button icon bold" :class="{ 'enabled': editor.isActive('bold') }" type="button" :v-tooltip="$t('f7057816-fb9f-42f9-b864-bec9756d07f7')" @click="editor.chain().focus().toggleBold().run()" />
        <button class="button icon italic" type="button" :class="{ 'enabled': editor.isActive('italic') }" :v-tooltip="$t('85ebbd8d-0585-4621-bed9-0d3cacb138a8')" @click="editor.chain().focus().toggleItalic().run()" />
        <button class="button icon underline" type="button" :class="{ 'enabled': editor.isActive('underline') }" :v-tooltip="$t('c69c6268-44cb-41a3-9a22-01c0828cb87a')" @click="editor.chain().focus().toggleUnderline().run()" />

        <hr v-if="!$isMobile"><button class="button icon h1" type="button" :class="{ 'enabled': editor.isActive('heading', { level: 1 }) }" :v-tooltip="$t('109b8d55-5b39-47da-92ad-fbdfa0f3d0b0')" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" />
        <button class="button icon h2" type="button" :class="{ 'enabled': editor.isActive('heading', { level: 2 }) }" :v-tooltip="$t('5d0d84fe-2ddb-4962-b104-337abbeeaa1f')" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" />
        <button class="button icon h3" type="button" :class="{ 'enabled': editor.isActive('heading', { level: 3 }) }" :v-tooltip="$t('002d6c62-a1d1-4efa-a230-b03456b2d872')" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" />
        <button class="button icon info-circle" type="button" :class="{ 'enabled': editor.isActive('descriptiveText') }" :v-tooltip="$t('58fa9950-5b41-421b-9f7f-24ea3fc021b5')" @click="editor.chain().focus().toggleDescriptiveText().run()" />

        <hr v-if="!$isMobile"><button class="button icon ul" type="button" :class="{ 'enabled': editor.isActive('bulletList') }" :v-tooltip="$t('277573b6-5edd-46bc-bd1b-c40f6935dd38')" @click="editor.chain().focus().toggleBulletList().run()" />
        <button class="button icon ol" type="button" :class="{ 'enabled': editor.isActive('orderedList') }" :v-tooltip="$t('8d17be46-de96-4e84-af15-6bd18e8b4b17')" @click="editor.chain().focus().toggleOrderedList().run()" />
    </div>
</template>

<script lang="ts" setup>
import { Editor } from '@tiptap/vue-3';

defineProps<{
    editor: Editor;
}>();
</script>
