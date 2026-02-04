import { markRaw, Ref, Slot } from 'vue';

export class CategorizedViewCategory {
    el: Ref<HTMLElement | null>;
    title: Ref<string>;
    icon: Ref<string>;
    hasError?: Ref<boolean>;
    summarySlot: null | Slot<any>;
    constructor(data: {
        el: Ref<HTMLElement | null>;
        title: Ref<string>;
        icon: Ref<string>;
        hasError?: Ref<boolean>;
        summarySlot?: Slot<any> | undefined | null;
    }) {
        this.el = data.el;
        this.title = data.title;
        this.icon = data.icon;
        this.hasError = data.hasError;
        this.summarySlot = data.summarySlot ?? null;

        markRaw(this);
    }
}
