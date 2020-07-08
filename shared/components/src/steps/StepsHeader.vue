<template>
    <header :data-scrolled="scrolled">
        <div>
            <div class="left">
                <slot name="left" />
            </div>
            <div class="center">
                <slot name="center" />
            </div>
            <div class="right">
                <slot name="right" />
            </div>
            <div class="progress" :style="{ width: progress * 100 + '%' }" :class="{ hide: progress >= 1 }" />
        </div>
    </header>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component
export default class StepsHeader extends Vue {
    scrolled = false;

    @Prop()
    progress!: number;

    deactivated() {
        console.log("Header deactivated");
        // Vue somehow does the binding under the hood. Couldn't find any documentation..?
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("scroll", this.onScroll);
    }

    activated() {
        console.log("Header activated");

        // Vue somehow does the binding under the hood. Couldn't find any documentation..?
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.addEventListener("scroll", this.onScroll, { passive: true });
    }

    onScroll() {
        const scroll = window.scrollY;
        if (scroll > 10) {
            this.scrolled = true;
        } else if (scroll < 5) {
            this.scrolled = false;
        }
    }
}
</script>
