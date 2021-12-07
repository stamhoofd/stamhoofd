<template>
    <transition appear name="show">
        <form class="centered-message-container" @submit.prevent>
            <div class="centered-message">
                <Spinner v-if="centeredMessage.type == 'loading'" class="center" />
                <img v-else-if="centeredMessage.type == 'clock'" class="center" src="~@stamhoofd/assets/images/illustrations/clock.svg">
                <img v-else-if="centeredMessage.type == 'health'" class="center" src="~@stamhoofd/assets/images/illustrations/health-data.svg">
                <img v-else-if="centeredMessage.type == 'sync'" class="center" src="~@stamhoofd/assets/images/illustrations/sync.svg">
                <span v-else-if="centeredMessage.type != 'none'" :class="'center icon '+centeredMessage.type" />
                <h1>
                    {{ centeredMessage.title }}
                </h1>
                <p>{{ centeredMessage.description }}</p>

                <STErrorsDefault :error-box="errorBox" />

                <LoadingButton v-for="(button, index) in centeredMessage.buttons" :key="index" :loading="button.loading">
                    <a v-if="button.href" ref="buttons" :href="button.href" class="button full" :class="button.type" @click="onClickButton(button)">
                        <span v-if="button.icon" class="icon" :class="button.icon" />
                        <span>{{ button.text }}</span>
                    </a>
                    <button v-else ref="buttons" class="button full" :class="button.type" :tabindex="0" type="button" @click="onClickButton(button)">
                        <span v-if="button.icon" class="icon" :class="button.icon" />
                        <span>{{ button.text }}</span>
                    </button>
                </LoadingButton>

                <div class="force-focus-cycle" tabindex="0" @focus="focusFirst" />
            </div>
        </form>
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

        if (document.activeElement && (document.activeElement as any).blur) {
            (document.activeElement as any).blur();
        }

        setTimeout(() => {
            const defaultButton = this.centeredMessage.buttons.findIndex(b => b.action !== null && b.type != "destructive")
            if (defaultButton > -1 && this.$refs.buttons) {
                const button = this.$refs.buttons[defaultButton] as HTMLButtonElement | undefined
                if (button) {
                    console.log("Focus on default button", button)
                    button.focus()

                    button.classList.add("focus-visible");

                    // And we'll remove it again on blur, once
                    button.addEventListener("blur", function () {
                        button.classList.remove("focus-visible");
                    }, { once: true });
                }
            }
        }, 200)

        
    }

    focusFirst() {
        if (this.$refs.buttons) {
            const button = this.$refs.buttons[0] as HTMLButtonElement | undefined
            if (button) {
                console.log("Focus on first button", button)
                button.focus()

                button.classList.add("focus-visible");

                // And we'll remove it again on blur, once
                button.addEventListener("blur", function () {
                    button.classList.remove("focus-visible");
                }, { once: true });
            }
        }
    }

    async onClickButton(button: CenteredMessageButton) {
        if (this.isClosing) {
            return
        }
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
        if (this.isClosing) {
            return
        }
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

            this.onClickButton(closeButton).catch(console.error)
            event.preventDefault();
            return;
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
    border-radius: $border-radius-modals;
    background: $color-white;
    max-width: calc(100vw - 30px);
    width: 350px;
    padding: 30px;
    box-sizing: border-box;
    max-height: 100vh;
    overflow: auto;
    overflow-x: hidden;

    @media (max-width: 500px) {
        padding: 20px;
    }

    > *:first-child {
        margin-top: 10px;
    }
    
    > img.center, > .icon.center {
        display: block;
        margin: 0 auto;
    }

    > .loading-button {
        display: block;
    }

    > h1 {
        padding-bottom: 25px;
        padding-top: 5px;
        text-align: center;
        @extend .style-title-1;

        + p {
            @extend .style-description;
        }
    }

    > button, .loading-button {
        margin-top: 10px;
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

    &.show-enter-active {
        transition: opacity 0.30s;

        > .centered-message  {
            transition: transform 0.30s cubic-bezier(0.0, 0.0, 0.2, 1);
        }
    }


    &.show-leave-active {
        transition: opacity 0.25s;

        > .centered-message  {
            transition: transform 0.25s cubic-bezier(0.4, 0.0, 1, 1);
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
