<template>
    <div class="st-view mail-view">
        <STNavigationBar title="Mail versturen">
            <template #right>
                <button class="button icon gray clock">
                    Geschiedenis
                </button>
                <button class="button icon close" @click="pop" />
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">Mail versturen</span>
        </STNavigationTitle>

        <main>
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
import { Component, Prop, Mixins } from "vue-property-decorator";

import { NavigationMixin } from "shared/classes/NavigationMixin";
import { Member } from "shared/models/Member";
import STNavigationBar from "shared/components/navigation/STNavigationBar.vue";
import STNavigationTitle from "shared/components/navigation/STNavigationTitle.vue";
import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import STToolbar from "shared/components/navigation/STToolbar.vue";
import MailEditor from "./MailEditor.vue";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        STToolbar,
        MailEditor,
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
@use '~scss/layout/view.scss';

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
