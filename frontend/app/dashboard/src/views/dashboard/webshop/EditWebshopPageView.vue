<template>
    <main class="webshop-view-page">
        <STErrorsDefault :error-box="errorBox" />
        <STInputBox title="Titel" error-fields="meta.title" :error-box="errorBox">
            <input
                v-model="title"
                class="input"
                type="text"
                placeholder="bv. Bestel je wafels"
                autocomplete=""
            >
        </STInputBox>

        <STInputBox title="Beschrijving" error-fields="meta.description" :error-box="errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Beschrijving die op jouw webshop staat"
                autocomplete=""
            />
        </STInputBox>


         <hr>
        <h2 class="style-with-button">
            <div>Omslagfoto</div>
            <div>
                <button v-if="coverPhoto" class="button text" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? 'Vervangen' : 'Foto uploaden'" :hs="hs" />
            </div>
        </h2>

        <img v-if="coverPhoto" :src="coverPhotoSrc" class="image">

       
    </main>
</template>

<script lang="ts">
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STListItem,TooltipDirective as Tooltip, STInputBox, STErrorsDefault, Validator, UploadButton } from "@stamhoofd/components";
import { EmergencyContact,Image,MemberWithRegistrations, Parent, ParentTypeHelper, PrivateWebshop, Record, RecordTypeHelper, RecordTypePriority, ResolutionRequest, Webshop, WebshopMetaData } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import EditMemberEmergencyContactView from './edit/EditMemberEmergencyContactView.vue';
import EditMemberGroupView from './edit/EditMemberGroupView.vue';
import EditMemberParentView from './edit/EditMemberParentView.vue';
import EditMemberView from './edit/EditMemberView.vue';
import MemberView from './MemberView.vue';
import RecordDescriptionView from './records/RecordDescriptionView.vue';

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault,
        UploadButton
    },
    directives: { Tooltip },
})
export default class EditWebshopPageView extends Mixins(NavigationMixin) {
    @Prop()
    webshop!: PrivateWebshop;

    errorBox: ErrorBox | null = null
    validator = new Validator()

    get title() {
        return this.webshop.meta.title
    }

    set title(title: string) {
        const patch = WebshopMetaData.patch({ title })
        this.$emit("patch", PrivateWebshop.patch({ meta: patch}) )
    }

    get description() {
        return this.webshop.meta.description
    }

    set description(description: string) {
        const patch = WebshopMetaData.patch({ description })
        this.$emit("patch", PrivateWebshop.patch({ meta: patch}) )
    }

    get coverPhoto() {
        return this.webshop.meta.coverPhoto
    }

    set coverPhoto(coverPhoto: Image | null) {
        const patch = WebshopMetaData.patch({ coverPhoto })
        this.$emit("patch", PrivateWebshop.patch({ meta: patch }) )
    }

     get hs() {
        return [
            ResolutionRequest.create({
                width: 1600
            }),
            ResolutionRequest.create({
                width: 800
            })
        ]
    }

    get coverPhotoSrc() {
        const image = this.coverPhoto
        if (!image) {
            return null
        }
        return image.getPathForSize(800, undefined)
    }

  
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.webshop-view-page {
    .image {
        height: 200px;
    }
}
</style>
