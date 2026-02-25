<template>
    <header class="st-navigation-bar-container" :class="{negative: !!($slots.default && isValidVnodes($slots.default())), scrolled}">
        <div v-if="!hasLeft && !hasRight && !popup" class="st-navigation-bar-background" :class="{ scrolled, large }">
            <InheritComponent name="tabbar-replacement" />
        </div>
        <div class="st-navigation-bar" :class="{ scrolled, large, 'show-title': showTitle, negative: !!($slots.default && isValidVnodes($slots.default()))}">
            <div class="header" :class="{ large, 'show-title': showTitle}" :style="{'grid-template-columns': templateColumns}">
                <div v-if="hasLeft || hasRight" class="left">
                    <BackButton v-if="canPop && !disablePop" @click="pop()" />
                    <button v-else-if="canDismiss && !disableDismiss && ($isAndroid)" class="button icon close" type="button" data-testid="close-button" @click="dismiss()" />
                    <slot name="left" />
                </div>

                <slot v-if="hasMiddle" name="middle">
                    <h1>
                        {{ title }}
                    </h1>
                </slot>

                <div v-if="hasLeft || hasRight" class="right">
                    <slot name="right" />
                    <button v-if="canDismiss && !disableDismiss && !$isAndroid" class="button icon close" type="button" data-testid="close-button" @click="dismiss()" />
                </div>
            </div>
            <div v-if="$slots.default && isValidVnodes($slots.default())" class="footer" :class="{ scrolled }">
                <slot />
            </div>
        </div>
    </header>
</template>

<script setup lang="ts">
import { useCanDismiss, useCanPop, useDismiss, usePop, usePopup, useUrl } from '@simonbackx/vue-app-navigation';
import { Comment, computed, Fragment, getCurrentInstance, isVNode, onActivated, onDeactivated, onMounted, ref, useSlots } from 'vue';

import InheritComponent from '../containers/InheritComponent.vue';
import { useIsAndroid, useIsIOS } from '../hooks';
import BackButton from './BackButton.vue';

const slots = useSlots();
const popup = usePopup();

const props = withDefaults(defineProps<{
    title?: string;
    addShadow?: boolean;
    showTitle?: boolean;
    large?: boolean;
    disableDismiss?: boolean;
    disablePop?: boolean;
    leftLogo?: boolean;
}>(), {
    addShadow: true,
    showTitle: false,
    large: false,
    disableDismiss: false,
    disablePop: false,
    leftLogo: false,
    title: '',
});

const scrolled = ref(false);
const scrollElement = ref<HTMLElement | null>(null);

const canDismiss = useCanDismiss();
const canPop = useCanPop();
const dismiss = useDismiss();
const pop = usePop();
const $url = useUrl();
const $isAndroid = useIsAndroid();
const $isIOS = useIsIOS();

const hasLeft = computed(() => {
    return (canPop.value && !props.disablePop) || (canDismiss.value && !props.disableDismiss && $isAndroid) || (!!slots['left'] && isValidVnodes(slots['left']()));
});

const hasRight = computed(() => {
    return ((canDismiss.value && !props.disableDismiss) && !$isAndroid) || !!slots['right'];
});

const hasMiddle = computed(() => {
    return !!slots['middle'] || props.title.length > 0;
});

const templateColumns = computed(() => {
    if (hasMiddle.value && (hasLeft.value || hasRight.value)) {
        if ($isAndroid && (canPop.value && (!props.disablePop || hasLeft.value))) {
            return 'auto 1fr auto';
        }
        return '1fr auto 1fr';
    }

    if (!hasMiddle.value) {
        if (props.leftLogo) {
            return '1fr auto';
        }
        return 'auto 1fr';
    }

    return '1fr';
});

// Helps detect empty nodes
function isValidVnodes(vnodes: any) {
    return vnodes.some((child: any) => {
        if (!isVNode(child)) return false;
        if (child.type === Comment) return false;
        if (child.type === Fragment && !isValidVnodes(child.children)) return false;
        return true;
    })
        ? true
        : false;
}

function getScrollElement(element: HTMLElement | null = null): HTMLElement {
    const instance = getCurrentInstance();
    const el = instance?.proxy?.$el as HTMLElement;
    return el?.nextElementSibling as HTMLElement;
}

function addListener() {
    if (scrollElement.value) {
        return;
    }
    scrollElement.value = getScrollElement();

    if (!scrollElement.value) {
        console.error('No scroll element found for STNavigationBar');
        return;
    }

    if (scrollElement.value === document.documentElement) {
        window.addEventListener('scroll', onScroll, { passive: true });
    }
    else {
        scrollElement.value.addEventListener('scroll', onScroll, { passive: true });
    }
}

function onScroll() {
    if (!scrollElement.value) {
        return;
    }
    const scroll = scrollElement.value.scrollTop;
    if (scroll > 25) {
        scrolled.value = true;
    }
    else if (scroll < 20) {
        scrolled.value = false;
    }
}

onMounted(() => {
    if (props.title) {
        $url.setTitle(props.title);
    }

    // fix for element not yet in dom
    addListener();
    onScroll();
});

onActivated(() => {
    if (props.title) {
        $url.setTitle(props.title);
    }

    // fix for element not yet in dom
    addListener();
    onScroll();
});

onDeactivated(() => {
    if (!scrollElement.value) {
        return;
    }
    if (scrollElement.value === document.documentElement) {
        window.removeEventListener('scroll', onScroll);
    }
    else {
        scrollElement.value.removeEventListener('scroll', onScroll);
    }
    scrollElement.value = null;
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.st-navigation-bar-container {
    position: relative;
    --st-hr-margin: 0px;
    overflow: visible;
    z-index: 200;

    &.transparent {
        > .st-navigation-bar {
            background: transparent;
        }
    }

    body.web-iOS &, body.native-iOS & {
        height: 0;

        & + main {
            // This correction increases the top padding of the scroll area, which corrects 'scroll to' behaviour for overlays
            -webkit-app-region: drag;

            --st-navigation-bar-correction: calc(70px + var(--st-safe-area-top, 0px));
        }
    }

    &.negative {
        height: 0;

        & + main {
            // Todo: height should be responsive
            // This correction increases the top padding of the scroll area, which corrects 'scroll to' behaviour for overlays
            --st-navigation-bar-correction: calc(109px + var(--st-safe-area-top, 0px));

            @media (min-width: 550px) {
                --st-navigation-bar-correction:  calc(109px + max(var(--st-safe-area-top, 0px), 5px));
            }
        }

        body.web-iOS &, body.native-iOS & {
            & + main {
                --st-navigation-bar-correction: calc(115px + var(--st-safe-area-top, 0px));

                @media (min-width: 550px) {
                --st-navigation-bar-correction:  calc(115px + max(var(--st-safe-area-top, 0px), 5px));
                }
            }
        }
    }

    &+ main {
        > h1:first-child, > *:first-child > h1:first-child {
            transition: opacity 0.4s;
        }
    }

    &.scrolled {
        &+ main {
            > h1:first-child, > *:first-child > h1:first-child {
                opacity: 0;
            }
        }
    }
}

.st-navigation-bar-background {
    position: absolute;
    display: grid;
    padding: var(--st-safe-area-top, 0px) var(--navigation-bar-horizontal-padding, var(--st-horizontal-padding, 40px)) 0 var(--navigation-bar-horizontal-padding, var(--st-horizontal-padding, 40px));
    box-sizing: border-box;
    width: 100%;
    height: 64px;
    opacity: 1;
    transition: opacity 0.2s;
    z-index: 201;

    &.large {
        height: 80px;
    }

    body.native-iOS &, body.web-iOS & {
        height: 70px; // 44px - 2 x border width thin
    }

    &.scrolled {
        opacity: 0;
        pointer-events: none;
    }
}

.st-navigation-bar {
    margin: 0;
    padding: var(--st-safe-area-top, 0px) max(var(--navigation-bar-horizontal-padding, var(--st-horizontal-padding, 40px)), var(--st-safe-area-right, 0px)) 0 max(var(--navigation-bar-horizontal-padding, var(--st-horizontal-padding, 40px)), var(--st-safe-area-left, 0px));
    word-break: normal;
    background: transparent;
    z-index: 200;
    position: relative;
    margin-top: -1px;

    &::before {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        content: '';
        background: transparent;
        border-bottom: $border-width-thin solid transparent;
        transition: opacity 0.3s, transform 0.3s;
        //transform: translateY(-50px);
        z-index: -1;
        opacity: 0;

        background: $color-background-shade;
        pointer-events: none;
        border-bottom-color: $color-border-shade;

        &.large {
            box-shadow: 0px 2px 5px $color-shadow;
            border-bottom-color: transparent;
        }

        body.native-android &, body.web-android & {
            //box-shadow: 0px 2px 5px $color-shadow;
            border-bottom: none;
        }

        body.web-iOS &, body.native-iOS & {
            background: linear-gradient($color-background, rgba(var(--rgb-background, 255), var(--rgb-background, 255), var(--rgb-background, 255), 0) 100%);
            //mask: linear-gradient(rgba(0, 0, 0, 1), rgba(0, 0, 0, 0) 100%);
            border-bottom: none;
            bottom: -120px;
        }
    }

    &.negative {
        &::before {
            body.web-iOS &, body.native-iOS & {
                background: linear-gradient($color-background, rgba(var(--rgb-background, 255), var(--rgb-background, 255), var(--rgb-background, 255), 0.5) 100%);
                backdrop-filter: blur(5px);
                bottom: 0px;
            }
        }
    }

    &.scrolled {
        &::before {
            opacity: 1;
            transform: translateY(0px);
        }

        > .header > h1 {
            opacity: 1;
            //transition: opacity 0.2s 0.2s; // Delay when expanding
        }
    }

    @media (min-width: 550px) {
        padding-top: max(var(--st-safe-area-top, 0px), 5px);
    }

    .footer {
        transition: opacity 0.3s, transform 0.3s;
        opacity: 0;
        //transform: translateY(-50px);
        pointer-events: none;

        &.scrolled {
            opacity: 1;
            transform: translateY(0px);
            pointer-events: all;
        }
    }

    > .header {
        height: 64px;
        -webkit-app-region: drag;

        body.native-iOS &, body.web-iOS & {
            height: 70px;
        }

        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;

        > div {
            display: flex;
            flex-direction: row;
            align-items: center;

            &.left{
                padding-right: 15px;

                &:empty, &.empty {
                    min-width: 0;
                    + h1 {
                        margin-left: -10px;
                    }
                    padding-right: 0px;;
                }

                display: flex;
                flex-direction: row;

                align-items: center;
                justify-content: flex-start;

                gap: 25px;

                body.web-iOS &, body.native-iOS & {
                    gap: 10px;
                }

                body.web-android &, body.native-android & {
                    &:has(.icon.arrow-back) + h1 {
                        text-align: left;
                    }
                }

            }

            &.right {
                padding-left: 15px;
                &:empty, &.empty {
                    min-width: 0;
                    padding-left: 0px;;
                }

                justify-content: flex-end;

                display: flex;
                flex-direction: row;

                align-items: center;
                justify-content: flex-end;
                gap: 24px;

                body.web-iOS &, body.native-iOS & {
                    gap: 12px;
                }
            }
        }

        > h1 {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.2s;
            @extend .style-navigation-bar-title;

            text-align: center;
        }

        &.show-title {
            > h1 {
                opacity: 1;
            }
        }

        &.large > .header {
            height: 80px;
            margin-bottom: 0px;
        }

    }

    &.large {
        padding: var(--st-safe-area-top, 0px) 20px 0 20px;

        @media (max-width: 450px) {
            padding: var(--st-safe-area-top, 0px) 15px 0 15px;
        }
    }

    // Other helper styles (need to revalidate)
    .input {
        width: 220px;
        display: inline-block;
        flex-shrink: 10000000;

        @media (max-width: 500px) {
            width: 100%;
            min-width: 150px;
        }
    }

    select.input {
        width: auto;
    }
}
</style>
