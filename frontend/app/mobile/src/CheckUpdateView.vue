<template>
    <LoadingViewTransition>
        <div v-if="!showLoading" class="st-view check-update-view">
            <STNavigationBar :title="title" :disable-dismiss="true" :disable-pop="true" />

            <main class="flex">
                <h1 v-if="status.options.customText">
                    {{ status.options.customText }}
                </h1>
                <h1 v-else-if="status.status === 'checking'">
                    {{ $t('%Wx') }}
                </h1>
                <h1 v-else-if="status.status === 'downloading'">
                    {{ $t('%Wy') }}
                </h1>
                <h1 v-else-if="status.status === 'installing'">
                    {{ $t('%Wz') }}
                </h1>

                <div class="comment-box">
                    <p v-for="(text, index) in texts" :key="index" class="style-description" :class="{down: index === nextTextIndex, up: index !== visibleText && index !== nextTextIndex}">
                        {{ text }}
                    </p>
                </div>

                <div class="progress" :class="{ hide: status.progress !== null && status.progress >= 1 }">
                    <div class="progress-transform-box" :style="{transform: transform }">
                        <div :style="{ width: width}" />
                    </div>
                </div>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import type { UpdateOptions } from '@stamhoofd/networking/AppManager';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
    status: {
        progress: number | null;
        shouldBeVisible: boolean;
        status: 'checking' | 'downloading' | 'installing';
        options: UpdateOptions;
        setDoHide: (doHide: () => void) => void;
    };
}>();

const dismiss = useDismiss();
const spinnerLeft = ref(true);
const texts = ['Wist je dat je ons naast onze documentatiepagina\'s ook altijd via e-mail kan bereiken via een link onderaan de documentatie?', 'Is er iets dat niet goed werkt? Dan horen we dat altijd graag!', 'We werken voortdurend aan nieuwe functionaliteiten.'];
const visibleText = ref(0);
let interval: ReturnType<typeof setInterval> | null = null;
let textInterval: ReturnType<typeof setInterval> | null = null;

const nextTextIndex = computed(() => (visibleText.value + 1) % texts.length);
const title = 'Update';
const showLoading = computed(() => props.status.status === 'checking' && props.status.options.visibleCheck !== 'text');
const statusX = computed(() => props.status.progress !== null ? '0' : spinnerLeft.value ? '-30%' : '100%');
const width = computed(() => props.status.progress !== null ? props.status.progress * 100 + '%' : '30%');
const transform = computed(() => 'translateX(' + statusX.value + ')');

onMounted(() => {
    console.log('Mounted CheckUpdateView');
    if (!props.status.shouldBeVisible) {
        console.log('Update should not be visible: dismiss on mount');
        dismiss({ force: true, animated: false }).catch(console.error);
    }
    props.status.setDoHide(() => {
        dismiss({ force: true, animated: false }).catch(console.error);
    });

    interval = setInterval(() => {
        spinnerLeft.value = !spinnerLeft.value;
    }, 800);
    textInterval = setInterval(() => {
        visibleText.value = (visibleText.value + 1) % texts.length;
    }, 3500);
});

onBeforeUnmount(() => {
    if (interval) {
        clearInterval(interval);
    }
    if (textInterval) {
        clearInterval(textInterval);
    }
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.check-update-view {
    .comment-box {
        position: relative;

        > p {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            transition: transform 0.3s, opacity 0.2s;

            &.up {
                opacity: 0;
                transform: translateX(-50%);
            }

            &.down {
                opacity: 0;
                transform: translateX(50%);
            }
        }
    }

    .progress {
        margin-top: auto;
        position: relative;
        height: 3px;
        pointer-events: none;
        background: $color-border;
        border-radius: 1.5px;
        overflow: hidden;
        width: 100%;
        opacity: 1;
        transition: opacity 0.3s;

        &.hide {
            transition: opacity 0.2s 0.3s;
            opacity: 0;
        }

        > .progress-transform-box {
            position: absolute;
            left: 0;
            top: 0;
            height: 100%;
            width: 100%;
            transform: translateX(0);
            transition: transform 0.5s;

            > div {
                position: absolute;
                left: 0;
                top: 0;
                height: 100%;
                background: $color-primary;
                border-top-right-radius: 2px;
                border-bottom-right-radius: 2px;

                width: 0;
                opacity: 1;
                transition: width 0.3s;
            }
        }
    }

}
</style>
