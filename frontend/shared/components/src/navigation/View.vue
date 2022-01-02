<template>
    <div class="st-modern-view" :style="{'--bottom-padding': bottomPadding+'px'}">
        <header>
            Titel {{ bottomPadding.toFixed(2) }} bottom padding, {{ viewportHeight.toFixed(2) }} viewportHeight

            <input>
        </header>
        <main ref="content">
            Dit is een scroll gebied: 
            <input>
            <p v-for="n in 100" :key="n">
                Dit is een test
            </p>
            <button @click="$event.target.focus()">
                Focus
            </button>
            Last line
        </main>
        <footer class="hide-on-keyboard">
            Footer
        </footer>
    </div>
</template>

<script lang="ts">
import { ModalStackComponent } from "@simonbackx/vue-app-navigation";
import { ToastBox } from '@stamhoofd/components';
import { Component, Vue } from "vue-property-decorator";


// kick off the polyfill!
@Component({
    components: {
        ModalStackComponent,
        ToastBox
    },
})
export default class View extends Vue {
    bottomPadding = 0
    viewportHeight = 0

    mounted() {

        // There is no way to correctly calculate 100vh in javascript, so we need to create the elements and measure it ourselves
        let el = document.createElement("div");
        document.body.appendChild(el);
        el.style.height = "100vh";
        el.style.width = "100vw";
        const vh = el.clientHeight;
        document.body.removeChild(el);

        console.log('vh', vh);
        
        this.viewportHeight = window.visualViewport.height

        this.bottomPadding = vh - this.viewportHeight

        window.visualViewport.addEventListener("resize", () => {
            //const vh = document.getElementById("app")!.clientHeight;
            this.viewportHeight = window.visualViewport.height
            this.bottomPadding = vh - this.viewportHeight
        })

        window.addEventListener("focus", () => {
            //const vh = document.getElementById("app")!.clientHeight;
            this.viewportHeight = window.visualViewport.height
            this.bottomPadding = vh - this.viewportHeight
        })

        window.addEventListener("blur", () => {
            //const vh = document.getElementById("app")!.clientHeight;
            this.viewportHeight = window.visualViewport.height
            this.bottomPadding = vh - this.viewportHeight
        })

        // on iOS, when the keyboard is visible, and when the user already scrolled to the bottom of the scroll views
        // the user can scroll further to scroll on the body, even if overflow is hidden. To prevent this
        // we correct the scroll position
        window.addEventListener("scroll", () => {
            // Disalbe scrolling the body
            requestAnimationFrame(() => {
                if (document.documentElement.scrollTop > 0) {
                    //document.documentElement.scrollTop = 0
                }
            });
        }, { passive: true });

        // This little hack prevents scrolling on the body element on iOS
        // We quickly add an element at the bottom of our scrolling view, so there is always room to scroll to the bottom
        // 
        const contentEl = (this.$refs["content"] as HTMLElement);
        contentEl.addEventListener("touchstart", () => {
            // Show bottom scroll if we are idle at the bottom

            if (contentEl.scrollTop == 0) {
                contentEl.style.paddingTop = "1px"
                contentEl.scrollTop = 1
            }

            if (contentEl.scrollTop == contentEl.scrollHeight - contentEl.clientHeight) {
                contentEl.style.paddingBottom = "1px"
            }
        }, { passive: true })

        window.addEventListener("touchend", () => {
            // Show bottom scroll if we are idle at the bottom

            contentEl.style.paddingTop = ""
            contentEl.style.paddingBottom = ""

            // Force hide keyboard
            window.scrollTo(0,0);
        }, { passive: true })
    }
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first

body, html {
    padding: 0;
    margin: 0;
    -webkit-overflow-scrolling: auto;

    // Be vary carefull to adjus this.
    // iOS safari is very sensitive in whether the navigation bar will hide on scroll
    @supports not (-webkit-touch-callout: none) {
        //overscroll-behavior: contain;
    }
}

#app {
    background: white;
    height: 200vh;
}

.st-modern-view{
    box-sizing: border-box;

    height: 100vh;
    border: 0px solid blue;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    transition: padding-bottom 0.2s;
    padding-bottom: calc(max(env(safe-area-inset-bottom), var(--keyboard-height, 0px)));


    > header, > footer {
        border: 2px solid green;
        flex-shrink: 0;

        // Prevent scrolling when touching the footer
        @supports not (overscroll-behavior: contain) {
            touch-action: none;
        }
    }

    > main {
        flex-grow: 1;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;

        // Prevent scrolling outer scroll area's
        overscroll-behavior: contain;
        position: relative;
    }

    > header {
        padding-top: env(safe-area-inset-top);
    }

    > footer {
        padding: 10px;
        background: white;
        transition: transform 0.2s;
        transform: translateY(
            calc(
                env(safe-area-inset-bottom) - max(var(--bottom-padding, 0px), env(safe-area-inset-bottom))
            )
        );

        
    }

    // Note: todo: this doesn't work on android yet: because when you dismiss the keyboard, the focus is kept
    &:focus-within {
        footer.hide-on-keyboard {
            //transform: translateY(100%);
        }
    }
    
}


html {
    -webkit-touch-callout:none;
    //user-select: none;
    -webkit-tap-highlight-color: rgba(0,0,0,0);
    -webkit-tap-highlight-color: transparent;
}
</style>
