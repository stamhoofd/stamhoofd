<template>
    <header :data-scrolled="scrolled">
        <div>
            <div class="left">
                <slot name="left"></slot>
            </div>
            <div class="center">
                <slot name="center"></slot>
            </div>
            <div class="right">
                <slot name="right"></slot>
            </div>
            <div class="progress" :style="{ width: progress * 100 + '%' }" :class="{ hide: progress >= 1 }"></div>
        </div>
    </header>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component
export default class Header extends Vue {
    scrolled: boolean = false;

    @Prop()
    progress!: number;

    mounted() {
        document.addEventListener("scroll", this.onScroll, { passive: true });
    }

    onScroll() {
        let scroll = window.scrollY;
        if (scroll > 10) {
            this.scrolled = true;
        } else if (scroll < 5) {
            this.scrolled = false;
        }
    }
}
</script>
