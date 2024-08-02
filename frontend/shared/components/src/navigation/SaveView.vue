<template>
    <form class="st-view" @submit.prevent="$emit('save')">
        <STNavigationBar :title="title" :disable-pop="true" :disable-dismiss="true">
            <template v-if="canPop || ($isMobile || $isIOS || $isAndroid)" #left>
                <BackButton v-if="canPop" @click="pop" />
                <button v-else-if="$isAndroid" class="button navigation icon close" type="button" @click="pop" />
                <button v-else class="button text selected unbold" type="button" @click="pop">
                    {{ cancelText }}
                </button>
            </template>

            <template #right>
                <template v-if="!$isMobile && !$isIOS">
                    <slot name="buttons" />
                </template>
                <LoadingButton v-if="canDelete" :loading="deleting">
                    <button class="button icon trash navigation" type="button" :disabled="deleting" @click="$emit('delete')" />
                </LoadingButton>
                <LoadingButton v-if="!preferLargeButton && ($isMobile || $isIOS || $isAndroid)" :loading="loading">
                    <button class="button navigation highlight" :disabled="disabled" type="submit">
                        {{ saveText }}
                    </button>
                </LoadingButton>
                <button v-else-if="canDismiss && !$isAndroid && !$isMobile && !$isIOS" class="button navigation icon close" type="button" @click="dismiss" />
            </template>
        </STNavigationBar>
        <main class="center">
            <slot />
        </main>
        <STToolbar v-if="preferLargeButton || (!$isMobile && !$isIOS && !$isAndroid)">
            <template #left>
                <slot name="left" />
            </template>
            <template #right>
                <slot name="toolbar" />
                <button v-if="!$slots.toolbar && addExtraCancel && (canPop || canDismiss) && cancelText !== null" class="button secundary" type="button" @click="pop">
                    {{ cancelText }}
                </button>
                <LoadingButton :loading="loading">
                    <button class="button primary" :disabled="disabled" type="submit">
                        <span v-if="saveIcon" class="icon " :class="saveIcon" />
                        <span>{{ saveText }}</span>
                        <span v-if="saveIconRight" class="icon " :class="saveIconRight" />
                        <span v-if="saveBadge" v-text="saveBadge" class="bubble" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
        <STButtonToolbar v-else-if="!!$slots.buttons || !!$slots.toolbar" class="sticky">
            <slot name="buttons" />
            <slot name="toolbar" />
        </STButtonToolbar>
    </form>
</template>


<script lang="ts">
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import BackButton from "./BackButton.vue";
import LoadingButton from "./LoadingButton.vue";
import STButtonToolbar from "./STButtonToolbar.vue";
import STNavigationBar from "./STNavigationBar.vue";
import STToolbar from "./STToolbar.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        LoadingButton,
        BackButton,
        STButtonToolbar
    },
    emit: ["save", "delete"]
})
export default class SaveView extends Mixins(NavigationMixin) {
    @Prop({ default: false })
        loading!: boolean;

    @Prop({ default: false })
        deleting!: boolean;

    @Prop({ default: false })
        disabled!: boolean;

    @Prop({ default: "" })
        title!: string;

    @Prop({ default: "Opslaan" })
        saveText!: string;

    @Prop({ default: null })
        saveIcon!: string | null;

    @Prop({ default: null })
        saveIconRight!: string | null;

    @Prop({ default: null })
        saveBadge!: string | null;

    @Prop({ default: "Annuleren" })
        cancelText!: string | null;

    @Prop({ default: false })
        preferLargeButton!: boolean; // Always use large buttons at the bottom on mobile

    @Prop({ default: false })
        addExtraCancel!: boolean; // Add a large cancel button at the bottom

    get canDelete() {
        // Check has delete listener
        return !!this.$attrs && !!this.$attrs.onDelete
    }
}
</script>
