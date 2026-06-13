<!-- eslint-disable vue/multiline-html-element-content-newline -->
<template>
    <p v-for="(item, index) of items" :key="index" class="style-description-small style-capitalize-first-letter">
        <RenderTextComponent :text="getRenderText(item)" :custom-renderers="customRenderers" />
    </p>
</template>

<script setup lang="ts">
import type { AuditLogPatchItem} from '@stamhoofd/structures';
import { AuditLogPatchItemType, AuditLogReplacementType } from '@stamhoofd/structures';
import { h } from 'vue';
import type { AuditLogCustomRenderers, Renderable} from './RenderTextComponent';
import { renderAny, RenderTextComponent } from './RenderTextComponent';

const props = defineProps<{
    items: AuditLogPatchItem[];
    customRenderers?: AuditLogCustomRenderers;
}>();

class TextWithClass implements Renderable {
    children: unknown;
    className: string;
    customRenderers?: AuditLogCustomRenderers;

    constructor(children: unknown, className: string, customRenderers?: AuditLogCustomRenderers) {
        this.children = children;
        this.className = className;
        this.customRenderers = customRenderers;
    }

    setup() {
        const renderChildren = renderAny(this.children, this.customRenderers);
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
            text.push(new TextWithClass(item.oldValue, 'style-value-old', props.customRenderers));
        }

        if (hasOld && hasValue) {
            text.push(' → ');
        }

        if (hasValue) {
            text.push(new TextWithClass(item.value, 'style-value-new', props.customRenderers));
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
