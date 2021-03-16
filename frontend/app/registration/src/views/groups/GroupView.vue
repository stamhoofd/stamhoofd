<template>
    <div class="st-view group-view">
        <STNavigationBar :title="group.settings.name">
            <template slot="left">
                <BackButton v-if="canPop" @click="pop" />
            </template>
        </STNavigationBar>
        
        <main>
            <h1>{{ group.settings.name }}</h1>
            <figure v-if="coverPhotoSrc" class="cover-photo">
                <img :src="coverPhotoSrc">
            </figure>
            <p class="style-description" v-text="group.settings.description" />

            <p v-if="closed" class="error-box">
                De inschrijvingen zijn afgelopen
            </p>
        </main>

        <STToolbar v-if="!closed">
            <button slot="right" class="primary button" @click="chooseMembers">
                <span class="icon add" />
                <span>Inschrijven</span>
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Group } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from "../../classes/MemberManager";
import MemberBox from "../../components/MemberBox.vue"
import GroupMemberSelectionView from "./GroupMemberSelectionView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        MemberBox
    },
    filters: {
        price: Formatter.price
    }
})
export default class GroupView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    group!: Group

    MemberManager = MemberManager

    get members() {
        return this.MemberManager.members ?? []
    }

    get closed() {
        return this.group.closed
    }

    chooseMembers() {
        this.show(new ComponentWithProperties(GroupMemberSelectionView, { group: this.group }))
    }

    get coverPhotoSrc() {
        const image = this.group.settings.coverPhoto
        if (!image) {
            return null
        }
        return image.getPathForSize(1800, 750)
    }
    

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-view {
    .cover-photo {
        height: 0;
        position: relative;
        padding-bottom: 750/1800*100%;
        background: $color-gray;
        border-radius: $border-radius;
        margin-bottom: 20px;

        img {
            border-radius: $border-radius;
            height: 100%;
            width: 100%;
            object-fit: cover;
            position: absolute;
            left: 0;
            top: 0;
        }
    }
}
</style>