<template>
    <div ref="root" class="container categorized-box">
        <p v-if="false" class="style-title-prefix">
            <IconContainer :icon="icon" />
        </p>
        <h2 class="larger">
            {{ title }}
        </h2>
        <slot />
    </div>
    <p v-if="description" class="style-description-small" v-text="description" />
</template>

<script lang="ts" setup>
import { getExposeProxy } from '@simonbackx/vue-app-navigation';
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, onUpdated, ref, Ref, unref, useSlots, useTemplateRef } from 'vue';
import CategorizedView from './CategorizedView.vue';
import { CategorizedViewCategory } from './CategorizedViewCategory';
import IconContainer from '../../icons/IconContainer.vue';

const props = withDefaults(defineProps<{
    title: string;
    icon: string;
    description?: string | null;
}>(), {
    description: null,
});

const instance = getCurrentInstance();

const view = computed<null | InstanceType<typeof CategorizedView>>(() => {
    let parent = instance?.parent;

    while (parent) {
        if (parent.type === CategorizedView) {
            return getExposeProxy(parent) as any as InstanceType<typeof CategorizedView>;
        }
        parent = parent.parent;
    }

    return null;
}) as Ref<null | InstanceType<typeof CategorizedView>>;

const slots = useSlots();
const rootElement = useTemplateRef('root');
const hasError = ref(false);

onUpdated(() => {
    const el = rootElement.value;
    if (el) {
        if (el.querySelector('.error-box')) {
            hasError.value = true;
        }
        else {
            hasError.value = false;
        }
    }
});

let destruct: (() => void) | undefined;

onMounted(() => {
    const parent = view.value;
    if (parent) {
        destruct?.();
        destruct = parent.addCategory(
            new CategorizedViewCategory({
                el: computed(() => unref(rootElement)),
                title: computed(() => props.title),
                icon: computed(() => props.icon),
                hasError,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                summarySlot: (...args) => slots['summary']?.(...args) ?? [],
            }),
        );
    }
});

onBeforeUnmount(() => {
    destruct?.();
    destruct = undefined;
});

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.categorized-box {

    background: $color-background;
    --color-current-background: #{$color-background};
    --color-current-background-shade: #{$color-background-shade};
    --color-current-background-shade-darker: #{$color-background-shade-darker-darker};

    border-radius: $border-radius-modals;
    border: $border-width solid $color-border;
    padding: 45px 40px;
    --st-horizontal-padding: 40px;
    margin-bottom: 10px;
    margin-top: 5px;
    overflow: hidden;

    box-shadow:
        inset 0px 0.5px 1.4px 0.1px rgba(0, 0, 0, 0.02),
        0px 0px 0px 1px rgba(0, 0, 0, 0.02), // Smoothen border
        0px 0.7px 0.7px 0px rgba(0, 0, 0, 0.015),
        0px 1.4px 1.4px 0px rgba(0, 0, 0, 0.015 - 0.015/4),
        0px 2.8px 2.8px 0px rgba(0, 0, 0, 0.015- 0.015/4- 0.015/4),
         0 2px 2px 1px rgba(0, 0, 0, 0.03), 0 0px 20px 0 rgba(0, 0, 0, 0.02);

    > .style-title-prefix {
        margin-bottom: 12px;
    }
}
</style>
