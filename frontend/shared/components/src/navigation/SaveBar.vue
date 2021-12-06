<template>
    <STNavigationBar v-if="$isMobile" :title="$attrs['title']">
        <button slot="left" class="button text selected unbold" type="button" @click="$parent.pop">
            Annuleren
        </button>
        <LoadingButton slot="right" :loading="$attrs['loading']">
            <button class="button text selected hightlight" type="button" :disabled="$attrs['disabled']" @click="$emit('save')">
                Opslaan
            </button>
        </LoadingButton>
    </STNavigationBar>
    <STNavigationBar v-else :title="$attrs['title']">
        <BackButton v-if="$parent.canPop" slot="left" @click="$parent.pop" />
        <button v-else slot="right" class="button icon gray close" type="button" @click="$parent.pop" />
    </STNavigationBar>
</template>


<script lang="ts">
import { Component,Vue } from "vue-property-decorator";

import LoadingButton from "./LoadingButton.vue";
import STNavigationBar from "./STNavigationBar.vue";

@Component({
    components: {
        STNavigationBar,
        LoadingButton
    }
})
export default class SaveBar extends Vue {
}
</script>