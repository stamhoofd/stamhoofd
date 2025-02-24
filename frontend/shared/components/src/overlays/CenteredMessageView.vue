<template>
    <form class="centered-message-container" @submit.prevent @mousedown="onClickOutside" @touchdown="onClickOutside">
        <div class="centered-message" @mousedown.stop="" @touchdown.stop="">
            <div class="header">
                <Spinner v-if="centeredMessage.type === 'loading'" class="" />
                <img v-else-if="centeredMessage.type === 'clock'" class="center" src="@stamhoofd/assets/images/illustrations/clock.svg">
                <img v-else-if="centeredMessage.type === 'health'" class="center" src="@stamhoofd/assets/images/illustrations/health-data.svg">
                <img v-else-if="centeredMessage.type === 'sync'" class="center" src="@stamhoofd/assets/images/illustrations/sync.svg">
                <span v-else-if="centeredMessage.type !== 'none'" :class="'center icon '+centeredMessage.type" />
            </div>

            <h1>
                {{ centeredMessage.title }}
            </h1>
            <p>{{ centeredMessage.description }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <div class="buttons">
                <LoadingButton v-for="(button, index) in centeredMessage.buttons" :key="index" :loading="button.loading">
                    <a v-if="button.href" ref="buttons" :href="button.href" class="button full" :class="button.type" @click="onClickButton(button)">
                        <span v-if="button.icon" class="icon" :class="button.icon" />
                        <span>{{ button.text }}</span>
                    </a>
                    <button v-else ref="buttons" class="button full" :class="button.type" type="button" :tabindex="0" @click="onClickButton(button)">
                        <span v-if="button.icon" class="icon" :class="button.icon" />
                        <span>{{ button.text }}</span>
                    </button>
                </LoadingButton>
            </div>
        </div>
    </form>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';

import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from "../errors/STErrorsDefault.vue"
import LoadingButton from "../navigation/LoadingButton.vue"
import Spinner from "../Spinner.vue"
import { CenteredMessage, CenteredMessageButton } from './CenteredMessage';
import { onActivated, onDeactivated, onMounted, ref, useTemplateRef } from 'vue';
import { useErrors } from '../errors/useErrors';

const props = defineProps<{
    centeredMessage: CenteredMessage
}>()
const isClosing = ref(false);
const errors = useErrors();
const pop = usePop();
const buttonsRef = useTemplateRef<HTMLButtonElement[] | HTMLButtonElement | null>('buttons')

onMounted(() => {
    props.centeredMessage.doHide = () => {
        close()
    }

    if (document.activeElement && (document.activeElement as any).blur) {
        (document.activeElement as any).blur();
    }
    setTimeout(() => {
        focusNextButton()
    }, 200)
})

function onClickOutside() {
    // If this is a touch device, do nothing
    if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || ((navigator as any).msMaxTouchPoints > 0)) {
        return
    }
    dismiss();
}

async function onClickButton(button: CenteredMessageButton) {
    if (isClosing.value) {
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
            errors.errorBox = new ErrorBox(e)
            button.loading = false
            return;
        }
        errors.errorBox = null
        button.loading = false
    }
    close()
}

function dismiss() {
    const closeButton = props.centeredMessage.buttons.find(b => b.type === "secundary")
    if (!closeButton) {
        return;
    }

    onClickButton(closeButton).catch(console.error)
}

function close() {
    if (isClosing.value) {
        return
    }
    isClosing.value = true
    pop({ force: true })
}

onActivated(() => {
    document.addEventListener("keydown", onKey);
})

onDeactivated(() => {
    document.removeEventListener("keydown", onKey);
})

function getButtons() {
    let buttons = buttonsRef.value

    console.log('getButtons', buttons)

    if (!buttons) {
        return [];
    }

    if (!Array.isArray(buttons)) {
        buttons = [buttons]
    }
    return buttons;
}

function focusNextButton() {
    console.log('focusNextButton')
    let buttons = getButtons()
    if (buttons.length === 0) {
        console.log('no buttons')
        return
    }

    // Find first focused button and select the next one or first one if it is the last one
    const focusedButton = buttons.findIndex((b: any) => b === document.activeElement)
    
    let button = buttons[0];
    if (focusedButton !== -1) {
        if (focusedButton > 0) {
            button = buttons[focusedButton - 1];
        } else {
            button = buttons[buttons.length - 1];
        }
    }

    // Fix unreliable focus visible
    button.classList.add("focus-visible");

    // And we'll remove it again on blur, once
    button.addEventListener("blur", function () {
        button.classList.remove("focus-visible");
    }, { once: true });
    
    button.focus()
}

function onKey(event: KeyboardEvent) {
    if (event.defaultPrevented || event.repeat) {
        return;
    }

    const key = event.key || event.keyCode;
    const closeButton = props.centeredMessage.buttons.find(b => b.type === "secundary")

    if (key === "Tab") {
        focusNextButton();
        event.preventDefault();
        return;
    }

    if (key === "Escape" || key === "Esc" || key === 27) {
        if (!closeButton) {
            return;
        }

        onClickButton(closeButton).catch(console.error)
        event.preventDefault();
        return;
    }

    if (key === "Enter" || key === 13) {
        const focusedButton = getButtons().find((b: any) => b === document.activeElement)
        if (focusedButton) {
            // Browser default
            return;
        }
        // Do we have a default action?
        const defaultButton = props.centeredMessage.buttons.find(b => b.action !== null && b.type !== "destructive")
        if (defaultButton) {
            onClickButton(defaultButton).catch(console.error)
            event.preventDefault();
            return;
        }
    }
}

// 
// @Component({
//     components: {
//         Spinner,
//         STErrorsDefault,
//         LoadingButton
//     }
// })
// export default class CenteredMessageView extends Mixins(NavigationMixin) {
//     @Prop({ required: true})
//     centeredMessage: CenteredMessage
// 
//     isClosing = false
//     errorBox: ErrorBox | null = null
// 
//     mounted() {
//         this.centeredMessage.doHide = () => {
//             this.close()
//         }
// 
//         if (document.activeElement && (document.activeElement as any).blur) {
//             (document.activeElement as any).blur();
//         }
//         setTimeout(() => {
//             this.focusNextButton()
//         }, 200)
//     }
// 
//     onClickOutside() {
//         // If this is a touch device, do nothing
//         if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || ((navigator as any).msMaxTouchPoints > 0)) {
//             return
//         }
//         this.dismiss();
//     }
// 
//     async onClickButton(button: CenteredMessageButton) {
//         if (this.isClosing) {
//             return
//         }
//         if (button.loading) {
//             return;
//         }
//         if (button.action) {
//             button.loading = true;
//             try {
//                 await button.action()
//             } catch (e) {
//                 this.errorBox = new ErrorBox(e)
//                 button.loading = false
//                 return;
//             }
//             this.errorBox = null
//             button.loading = false
//         }
//         this.close()
//     }
// 
//     dismiss() {
//         const closeButton = this.centeredMessage.buttons.find(b => b.type === "secundary")
//         if (!closeButton) {
//             return;
//         }
// 
//         this.onClickButton(closeButton).catch(console.error)
//     }
// 
//     close() {
//         if (this.isClosing) {
//             return
//         }
//         this.isClosing = true
//         this.pop({ force: true })
//     }
// 
//     activated() {
//         document.addEventListener("keydown", this.onKey);
//     }
// 
//     deactivated() {
//         document.removeEventListener("keydown", this.onKey);
//     }
// 
//     getButtons() {
//         let buttons = this.$refs.buttons as any
// 
//         if (!buttons) {
//             return [];
//         }
// 
//         if (buttons.length === undefined) {
//             buttons = [buttons]
//         }
//         return buttons;
//     }
// 
//     focusNextButton() {
//         console.log('focusNextButton')
//         let buttons = this.getButtons()
//         if (buttons.length === 0) {
//             console.log('no buttons')
//             return
//         }
// 
//         // Find first focused button and select the next one or first one if it is the last one
//         const focusedButton = buttons.findIndex((b: any) => b === document.activeElement)
//         
//         let button = buttons[0];
//         if (focusedButton !== -1) {
//             if (focusedButton >= buttons.length - 2) {
//                 button = buttons[0];
//             } else {
//                 button = buttons[focusedButton+1]
//             }
//         }
// 
//         // Fix unreliable focus visible
//         button.classList.add("focus-visible");
// 
//         // And we'll remove it again on blur, once
//         button.addEventListener("blur", function () {
//             button.classList.remove("focus-visible");
//         }, { once: true });
//         
//         button.focus()
//     }
// 
//     onKey(event) {
//         if (event.defaultPrevented || event.repeat) {
//             return;
//         }
// 
//         const key = event.key || event.keyCode;
//         const closeButton = this.centeredMessage.buttons.find(b => b.type === "secundary")
// 
//         if (key === "Tab") {
//             this.focusNextButton();
//             event.preventDefault();
//             return;
//         }
// 
//         if (key === "Escape" || key === "Esc" || key === 27) {
//             if (!closeButton) {
//                 return;
//             }
// 
//             this.onClickButton(closeButton).catch(console.error)
//             event.preventDefault();
//             return;
//         }
// 
//         if (key === "Enter" || key === 13) {
//             const focusedButton = this.getButtons().find((b: any) => b === document.activeElement)
//             if (focusedButton) {
//                 // Browser default
//                 return;
//             }
//             // Do we have a default action?
//             const defaultButton = this.centeredMessage.buttons.find(b => b.action !== null && b.type !== "destructive")
//             if (defaultButton) {
//                 this.onClickButton(defaultButton).catch(console.error)
//                 event.preventDefault();
//                 return;
//             }
//         }
//     }
// }
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.centered-message {
    position: fixed;
    z-index: 10000;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    @extend .style-overlay-shadow;
    border-radius: $border-radius-modals;
    background: $color-background;
    max-width: calc(100vw - 30px);
    width: 350px;
    
    box-sizing: border-box;
    max-height: 100vh;
    overflow: auto;
    overflow-x: hidden;

    @media (max-width: 551px) {
        padding: 20px;

        .buttons {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding-top: 20px;
        }
    }

    @media (min-width: 550px) {
        width: 550px;
        padding: 30px 40px;

        .buttons {
            border-top: $border-width-thin solid $color-border-shade;
            padding: 15px 40px 15px 40px;
            margin: 25px -40px -30px -40px;
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-start;
            flex-direction: row-reverse;
            gap: 10px;
        }
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
        padding-bottom: 10px;
        text-align: left;
        @extend .style-title-2;

        + p {
            @extend .style-description;
        }
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

    @media (prefers-color-scheme: dark) {
        background: rgba(8, 8, 8, 0.7);
    }

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

    &.show-enter-from, &.show-leave-to /* .fade-leave-active below version 2.1.8 */ {
        // Instant appearing context menu! (only leave animation)
        opacity: 0;

        > .centered-message  {
            @media (not (prefers-reduced-motion)) {
                transform: translate(-50%, 50vh);
            }

        }
    }
}

</style>
