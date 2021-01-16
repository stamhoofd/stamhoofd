<template>
    <transition appear name="show">
        <div class="centered-message-container">
            <div class="centered-message">
                <Spinner v-if="centeredMessage.type == 'loading'" class="center" />
                <img v-else-if="centeredMessage.type == 'clock'" class="center" src="~@stamhoofd/assets/images/illustrations/clock.svg">
                <img v-else-if="centeredMessage.type == 'health'" class="center" src="~@stamhoofd/assets/images/illustrations/health-data.svg">
                <img v-else-if="centeredMessage.type == 'sync'" class="center" src="~@stamhoofd/assets/images/illustrations/sync.svg">
                <span v-else-if="centeredMessage.type != 'none'" :class="'center icon '+centeredMessage.type" />
                <h1>{{ centeredMessage.title }}</h1>
                <p>{{ centeredMessage.description }}</p>

                <STErrorsDefault :error-box="errorBox" />

                <LoadingButton v-for="(button, index) in centeredMessage.buttons" :key="index" :loading="button.loading">
                    <button class="button full" :class="button.type" @click="onClickButton(button)">
                        <span v-if="button.icon" class="icon" :class="button.icon" />
                        <span>{{ button.text }}</span>
                    </button>
                </LoadingButton>
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop, Vue } from "vue-property-decorator";

import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from "../errors/STErrorsDefault.vue"
import LoadingButton from "../navigation/LoadingButton.vue"
import Spinner from "../Spinner.vue"
import { CenteredMessage, CenteredMessageButton } from './CenteredMessage';

@Component({
    components: {
        Spinner,
        STErrorsDefault,
        LoadingButton
    }
})
export default class CenteredMessageView extends Mixins(NavigationMixin) {
    @Prop({ required: true})
    centeredMessage: CenteredMessage

    isClosing = false
    errorBox: ErrorBox | null = null

    mounted() {
        this.centeredMessage.doHide = () => {
            this.close()
        }
    }

    async onClickButton(button: CenteredMessageButton) {
        if (button.loading) {
            return;
        }
        if (button.action) {
            button.loading = true;
            try {
                await button.action()
            } catch (e) {
                this.errorBox = new ErrorBox(e)
                button.loading = false
                return;
            }
            this.errorBox = null
            button.loading = false
        }
        this.close()
    }

    close() {
        this.isClosing = true
        this.pop({ force: true })
    }

    activated() {
        document.addEventListener("keydown", this.onKey);
    }

    deactivated() {
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        const key = event.key || event.keyCode;
        const closeButton = this.centeredMessage.buttons.find(b => b.type == "secundary")

        if (key === "Escape" || key === "Esc" || key === 27) {
            if (!closeButton) {
                return;
            }

            this.onClickButton(closeButton)
            event.preventDefault();
            return;
        }

        const confirmButton = this.centeredMessage.buttons.find(b => b.action !== null && b.type != "destructive")

        if (!confirmButton && !closeButton) {
            return
        }

        if (key === "Enter") {
            if (confirmButton) {
                this.onClickButton(confirmButton)
            } else {
                this.close();
            }
            event.preventDefault();
        }
    }

   

}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use '~@stamhoofd/scss/base/text-styles.scss';


.centered-message {
    position: fixed;
    z-index: 10000;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    @extend .style-overlay-shadow;
    border-radius: $border-radius;
    background: $color-white;
    max-width: calc(100vw - 30px);
    width: 350px;
    padding: 20px 20px;
    box-sizing: border-box;
    max-height: 100vh;
    overflow: auto;
    overflow-x: hidden;

    > *:first-child {
        margin-top: 10px;
    }
    > .center {
        display: block;
        margin: 0 auto;
    }

    > .loading-button {
        display: block;
    }

    > h1 {
        padding-bottom: 20px;
        padding-top: 20px;
        text-align: center;
        @extend .style-title-1;

        + p {
            @extend .style-description;
        }
    }

    > button, .loading-button {
        margin-top: 15px;
    }
}

.centered-message-container {
    position: fixed;
    z-index: 10000;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.3);
    opacity: 1;

    &.show-enter-active,
    &.show-leave-active {
        transition: opacity 0.35s;

        > .centered-message  {
            transition: transform 0.35s;
        }
    }
    &.show-enter, &.show-leave-to /* .fade-leave-active below version 2.1.8 */ {
        // Instant appearing context menu! (only leave animation)
        opacity: 0;

        > .centered-message  {
            transform: translate(-50%, 50vh);
        }
    }
}

</style>
