<template>
    <LoadingView v-if="showLoading" />
    <div v-else class="st-view check-update-view">
        <STNavigationBar :title="title" />

        <main class="flex">
            <h1 v-if="status.options.customText">
                {{ status.options.customText }}
            </h1>
            <h1 v-else-if="status.status === 'checking'">
                Controleren op updates...
            </h1>
            <h1 v-else-if="status.status === 'downloading'">
                Nieuwe functionaliteiten in elkaar timmeren...
            </h1>
            <h1 v-else-if="status.status === 'installing'">
                Nieuwe functionaliteiten klaarzetten...
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
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { LoadingView, Spinner, STNavigationBar } from '@stamhoofd/components';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { UpdateStatus } from "./UpdateStatus";

@Component({
    components: {
        Spinner,
        STNavigationBar,
        LoadingView
    }
})
export default class CheckUpdateView extends Mixins(NavigationMixin) {
    @Prop({required: true})
        status: UpdateStatus

    spinnerLeft = true;
    interval: NodeJS.Timeout|null = null;
    textInterval: NodeJS.Timeout|null = null;

    texts = ['Je kan zelf ook ideeën insturen via onze feedback tool en daar op ideeën stemmen', 'Wist je dat je ons naast onze documentatiepagina\'s ook altijd via e-mail kan bereiken via een link onderaan de documentatie?', 'Is er iets dat niet goed werkt? Dan horen we dat altijd graag!', 'We werken voortdurend aan nieuwe functionaliteiten.']
    visibleText = 0;

    get nextTextIndex() {
        return (this.visibleText + 1) % this.texts.length
    }

    get title() {
        return 'Update'
    }

    get showLoading() {
        return this.status.status === 'checking' && this.status.options.visibleCheck !== 'text'
    }

    mounted() {
        this.status.setDoHide(() => {
            this.dismiss({force: true, animated: false})
        })

        this.interval = setInterval(() => {
            this.spinnerLeft = !this.spinnerLeft;
        }, 800)

        this.textInterval = setInterval(() => {
            this.visibleText = (this.visibleText + 1) % this.texts.length
        }, 3500)
    }

    beforeDestroy() {
        if (this.interval) {
            clearInterval(this.interval)
        }
        if (this.textInterval) {
            clearInterval(this.textInterval)
        }
    }

    get statusX() {
        if (this.status.progress !== null) {
            return '0';
        }
        if (this.spinnerLeft) {
            return '-30%';
        }
        return '100%';
    }

    get width() {
        if (this.status.progress !== null) {
            return this.status.progress * 100 + '%'
        }
        return '30%'
    }

    get transform() {
        return 'translateX('+this.statusX+')'
    }
}
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