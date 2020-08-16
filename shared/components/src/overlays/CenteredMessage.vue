<template>
    <transition appear name="show">
        <div class="centered-message-container">
            <div class="centered-message">
                <Spinner v-if="type == 'loading'" class="center" />
                <img v-else-if="type == 'clock'" class="center" src="~@stamhoofd/assets/images/illustrations/clock.svg" />
                <img v-else-if="type == 'health'" class="center" src="~@stamhoofd/assets/images/illustrations/health-data.svg" />
                <img v-else-if="type == 'sync'" class="center" src="~@stamhoofd/assets/images/illustrations/sync.svg" />
                <span v-else-if="type != 'none'" :class="'center icon '+type" />
                <h1>{{ title }}</h1>
                <p>{{ description }}</p>

                <STErrorsDefault :error-box="errorBox" />

                <LoadingButton v-if="confirmButton" :loading="loading">
                    <button  class="button full" :class="{ destructive: confirmType == 'destructive', primary: confirmType != 'destructive' }" @click="confirm">
                        {{ confirmButton }}
                    </button>
                </LoadingButton>

                <button v-if="closeButton" class="button secundary full" @click="pop">
                    {{ closeButton }}
                </button>
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

import Spinner from "../Spinner.vue"
import STErrorsDefault from "../errors/STErrorsDefault.vue"
import LoadingButton from "../navigation/LoadingButton.vue"

import { ErrorBox } from '../errors/ErrorBox';

@Component({
    components: {
        Spinner,
        STErrorsDefault,
        LoadingButton
    }
})
export default class CenteredMessage extends Vue {
    @Prop({ default: "none" })
    type: string

    @Prop({ default: "" })  
    title: string

    @Prop({ default: "" })
    description: string

    @Prop({ default: null })
    closeButton: string | null

    @Prop({ default: "normal" })
    confirmType: string

    @Prop({ default: null })
    confirmButton: string | null

    @Prop({ default: null })
    confirmAction: (() => Promise<any>) | null

    loading = false
    errorBox: ErrorBox | null = null

    async confirm() {
        if (this.loading) {
            return;
        }
        if (this.confirmAction) {
            this.loading = true;
            try {
                await this.confirmAction()
            } catch (e) {
                this.errorBox = new ErrorBox(e)
                this.loading = false
                return;
            }
            this.errorBox = null
            this.loading = false
        }
        this.pop()
    }

    pop() {
        this.$parent.$emit("pop");
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

        if (key === "Escape" || key === "Esc" || key === 27) {
            if (!this.closeButton) {
                return;
            }

            this.pop();
            event.preventDefault();
            return;
        }

        if (!this.confirmButton && !this.closeButton) {
            return
        }

        if (this.confirmButton && this.confirmType == "destructive") {
            // No default action
            return;
        }


        if (key === "Enter") {
            if (this.confirmButton) {
                this.confirm()
            } else {
                this.pop();
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

    > *:first-child {
        margin-top: 10px;
    }
    > .center {
        display: block;
        margin: 0 auto;
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
