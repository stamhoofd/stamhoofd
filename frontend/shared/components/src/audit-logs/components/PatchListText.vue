<!-- eslint-disable vue/multiline-html-element-content-newline -->
<template>
    <p v-for="(item, index) of items" :key="index" class="style-description-small style-capitalize-first-letter">
        <RenderTextComponent :text="getRenderText(item)" />
    </p>
</template>

<script setup lang="ts">
import { AuditLogPatchItem, AuditLogPatchItemType, AuditLogReplacementType } from '@stamhoofd/structures';
import { h } from 'vue';
import { Renderable, renderAny, RenderTextComponent } from './RenderTextComponent';

defineProps<{
    items: AuditLogPatchItem[];
}>();

class TextWithClass implements Renderable {
    children: unknown;
    className: string;

    constructor(children: unknown, className: string) {
        this.children = children;
        this.className = className;
    }

    setup() {
        const renderChildren = renderAny(this.children);
        return () => h('span', {
            class: this.className,
        }, renderChildren());
    }
}

function getRenderText(item: AuditLogPatchItem): any[] {
    const text: any[] = [
        item.key,
    ];

    if (item.type === AuditLogPatchItemType.Added) {
        text.push(' ' + $t(`%uf`));
    }

    if (item.type === AuditLogPatchItemType.Removed) {
        text.push(' ' + $t(`%ug`));
    }

    if (item.type === AuditLogPatchItemType.Changed) {
        text.push(' ' + $t(`%uh`));
    }

    if (item.type === AuditLogPatchItemType.Reordered) {
        text.push(' ' + $t(`%ui`));
    }

    if ((item.oldValue && (item.oldValue.toString() || item.oldValue.type !== AuditLogReplacementType.Uuid)) || (item.value && (item.value.toString() || item.value.type !== AuditLogReplacementType.Uuid))) {
        text.push(': ');

        const hasOld = item.oldValue && (item.oldValue.type || item.oldValue.value);
        const hasValue = item.value && (item.value.type || item.value.value);

        if (hasOld) {
            text.push(new TextWithClass(item.oldValue, 'style-value-old'));
        }

        if (hasOld && hasValue) {
            text.push(' → ');
        }

        if (hasValue) {
            text.push(new TextWithClass(item.value, 'style-value-new'));
        }
    }
    else {
        if (!item.type) {
            text.push(' ' + $t(`%uh`));
        }
    }

    return text;
}

</script>
