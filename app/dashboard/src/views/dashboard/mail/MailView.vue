<template>
    <div class="st-view mail-view">
        <STNavigationBar title="Mail versturen">
            <template #right>
                <button class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">Mail versturen</span>
        </STNavigationTitle>

        <main>
            <STInputBox title="Versturen vanaf">
                <button slot="right" class="button text">
                    <span class="icon settings" />
                    <span>Wijzigen</span>
                </button>
                <select class="input">
                    <option>info@stamhoofd.be</option>
                </select>
            </STInputBox>

            <label class="style-label" for="mail-subject">Onderwerp</label>
            <input id="mail-subject" class="input" type="text" placeholder="Typ hier het onderwerp van je e-mail">

            <label class="style-label" for="mail-text">Bericht</label>
            <MailEditor />
        </main>

        <STToolbar>
            <template #left>
                {{
                    mailaddresses.length
                        ? mailaddresses.length > 1
                            ? mailaddresses.length + " ontvangers"
                            : "Eén ontvanger"
                        : "Geen ontvangers"
                }}
            </template>
            <template #right>
                <button class="button primary">
                    Versturen
                    <div class="dropdown" @click.stop="" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Member } from "@stamhoofd-frontend/models";
import { STNavigationTitle, STInputBox } from "@stamhoofd/components";
import { STToolbar } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { SegmentedControl } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        STToolbar,
        STInputBox,
        MailEditor: () => import(/* webpackChunkName: "MailEditor" */ './MailEditor.vue'),
    },
})
export default class MailView extends Mixins(NavigationMixin) {
    @Prop()
    members!: Member[];

    get mailaddresses(): string[] {
        return this.members.flatMap((member) => {
            return member.parents.flatMap((parent) => {
                if (parent.mail) {
                    return [parent.mail];
                }
                return [];
            });
        });
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.mail-view {
    > main {
        display: flex;
        flex-grow: 1;
        flex-direction: column;

        & > .editor {
            flex-grow: 1;
            display: flex;
            flex-direction: column;

            justify-content: stretch;
            align-items: stretch;
            padding-bottom: 20px;

            & > .editor-content {
                flex-grow: 1;
                display: flex;
                flex-direction: column;

                & > .ProseMirror {
                    flex-grow: 1;
                }
            }
        }
    }
}
</style>
