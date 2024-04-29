<template>
    <div class="container">
        <h2 class="style-with-button">
            <div>Sponsors</div>
            <div>
                <button type="button" class="button icon add" @click="addSponsor" />
            </div>
        </h2>

        <p>Het is mogelijk om het logo van sponsors op je tickets te plaatsen.</p>

        <STList v-model="draggableSponsors" :draggable="true">
            <STListItem v-for="sponsor in sponsors" :key="sponsor.id" :selectable="true" @click="editSponsor(sponsor)">
                <h3 class="style-title-list">
                    {{ sponsor.name || 'Naamloos' }}
                </h3>
                <p v-if="sponsor.onTickets" class="style-description-small">
                    Op tickets
                </p>

                <template #right>
                    <span class="button icon drag gray" @click.stop @contextmenu.stop />
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STErrorsDefault, STInputBox, STList, STListItem, UploadButton, ViewportHelper } from "@stamhoofd/components";
import { Sponsor, SponsorConfig } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import EditSponsorView from "./EditSponsorView.vue";

@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        UploadButton,
        STList,
        STListItem
    }
})
export default class EditSponsorsBox extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        config: SponsorConfig|null

    patchConfig(patch: AutoEncoderPatchType<SponsorConfig>|null) {
        if (patch && !this.config) {
            this.$emit("patch", SponsorConfig.create({}).patch(patch))
            return;
        }
        this.$emit("patch", patch)
    }

    get sponsors() {
        return this.config?.sponsors ?? []
    }

    addSponsor() {
        const sponsor = Sponsor.create({})
        const patch = SponsorConfig.patch({})
        patch.sponsors.addPut(sponsor)

        this.present({
            components: [
                new ComponentWithProperties(EditSponsorView, {
                    sponsor,
                    isNew: true,
                    saveHandler: (p: AutoEncoderPatchType<Sponsor>) => {
                        p.id = sponsor.id
                        patch.sponsors.addPatch(p)
                        this.patchConfig(patch)
                    }
                })
            ],
            modalDisplayStyle: "sheet"
        })
    }

    editSponsor(sponsor: Sponsor) {
        this.present({
            components: [
                new ComponentWithProperties(EditSponsorView, {
                    sponsor,
                    isNew: false,
                    saveHandler: (p: AutoEncoderPatchType<Sponsor>) => {
                        const patch = SponsorConfig.patch({})
                        p.id = sponsor.id
                        patch.sponsors.addPatch(p)
                        this.patchConfig(patch)
                    },
                    deleteHandler: () => {
                        const patch = SponsorConfig.patch({})
                        patch.sponsors.addDelete(sponsor.id)
                        this.patchConfig(patch)
                    },
                })
            ],
            modalDisplayStyle: "sheet"
        })
    }

    get draggableSponsors() {
        return this.sponsors;
    }

    set draggableSponsors(sponsors: Sponsor[]) {
        if (sponsors.length != this.sponsors.length) {
            return;
        }

        const patch = SponsorConfig.patch({
            sponsors: sponsors as any
        })
        this.patchConfig(patch)
    }
}
</script>