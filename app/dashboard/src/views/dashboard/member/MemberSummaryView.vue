<template>
    <div class="st-view member-summary-view">
        <STNavigationBar title="Samenvatting">
            <template #right>
                <button class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">Samenvatting</span>
            <span
                v-tooltip="
                    'De steekkaart kan gevoelige gegevens bevatten. Spring hier uiterst zorgzaam mee om en kijk de privacyvoorwaarden van jouw vereniging na.'
                "
                class="icon gray privacy"
            />
        </STNavigationTitle>

        <SegmentedControl v-model="tab" :items="tabLabels" :labels="tabLabels" />

        <STErrorsDefault :error-box="errorBox"/>

        <main v-if="tab == 'Steekkaart'">
            <template v-for="group of createSamenvattingSteekkaart()">
                <hr>
                <h2>{{ group.title }}</h2>

                <dl class="details-grid small">
                    <template v-for="(text, key) of Object.fromEntries(group.items)">
                        <dt>{{ key }}</dt>
                        <dd v-text="text" />
                    </template>
                </dl>

            </template>

        </main>
        <main v-else class="split-main">
            <div v-for="group of createContacts()">
                <h2>{{ group.title }}</h2>
                <dl class="details-grid small">
                    <template v-for="(text, key) of Object.fromEntries(group.items)">
                        <dt>{{ key }}</dt>
                        <dd v-text="text" />
                    </template>
                </dl>
            </div>

        </main>

         <STToolbar>
            <template #right>
                <button class="button secundary" @click="createPDF(true)">
                    Contacten afdrukken
                </button>

                <LoadingButton :loading="loading">
                    <button class="button primary" @click="createPDF(false)">
                        Afdrukken
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STNavigationTitle, TooltipDirective, STErrorsDefault } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { SegmentedControl, BackButton, STToolbar, LoadingButton } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

import MemberContextMenu from "./MemberContextMenu.vue";
import MemberViewDetails from "./MemberViewDetails.vue";
import MemberViewHistory from "./MemberViewHistory.vue";
import MemberViewPayments from "./MemberViewPayments.vue";
import { MemberWithRegistrations, Gender, RecordType, RecordTypeHelper, Member, Group, ParentTypeHelper } from '@stamhoofd/structures';
import { FamilyManager } from '../../../classes/FamilyManager';
import { Sorter } from '@stamhoofd/utility';
import logoSrc from '@stamhoofd/assets/images/logo/logo-horizontal.png'

class SamenvattingGroep {
    title = ""
    items: Map<string, string> = new Map()

    constructor(title: string) {
        this.title = title
    }
}

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        STToolbar,
        BackButton,
        LoadingButton,
        STErrorsDefault
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class MemberSummaryView extends Mixins(NavigationMixin) {
    tabLabels = ["Steekkaart", "Contactgegevens"];
    tab = this.tabLabels[0];
    loading = false
    errorBox: ErrorBox | null = null
    @Prop({ default: null })
    group: Group | null;

    @Prop()
    members!: MemberWithRegistrations[];

    createSamenvattingSteekkaart(): SamenvattingGroep[] {
        const groups: Map<string, SamenvattingGroep> = new Map()

        // Sort members
        const members = this.members.slice()
        members.sort(Member.sorterByName("ASC"));

        // Sort by record type (start with first record types)
        for (const recordType of Object.values(RecordType)) {
            for (const member of members) {
                for (const record of member.details!.records) {
                    if (record.type != recordType) {
                        continue
                    }
                    let category = RecordTypeHelper.getCategory(record.type)
                    const repeatName = !!category
                    if (!category) {
                        category = RecordTypeHelper.getName(record.type)
                    }
                    const group = groups.get(category) ?? new SamenvattingGroep(category)
                    const existing = group.items.get(member.name) ?? ""

                    let text = ""
                    if (repeatName) {
                        text = RecordTypeHelper.getName(record.type) + (record.description ? ": "+record.description : "")
                    } else {
                        text = record.description ? record.description : RecordTypeHelper.getName(record.type)
                    }

                    group.items.set(member.name, (existing + "\n" + text).trim())

                    groups.set(category, group)
                }
            }
        }
        return [...groups.values()]
    }

    createContacts(): SamenvattingGroep[] {
        const groups: SamenvattingGroep[] = []

         // Sort members
        const members = this.members.slice()
        members.sort(Member.sorterByName("ASC"));

        for (const member of members) {
            const group = new SamenvattingGroep(member.name)

            if (member.details!.phone) {
                group.items.set(member.firstName, member.details!.phone)
            }

            for (const parent of member.details!.parents) {
                group.items.set(ParentTypeHelper.getName(parent.type), parent.name+"\n"+parent.phone)
            }

            for (const contact of [...member.details!.emergencyContacts, ...(member.details!.doctor ? [member.details!.doctor] : [])]) {
                group.items.set(contact.title, contact.name+"\n"+contact.phone)
            }

            groups.push(group)
        }
        return groups
    }

    escapeHTML(unsafeText) {
        let div = document.createElement('div');
        div.innerText = unsafeText;
        return div.innerHTML;
    }



    async createPDF(onlyContacts = false) {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.errorBox = null;

        try {
            const samenvatting = this.createSamenvattingSteekkaart()

            const printWin = window.open('about:blank')!;
            const css = (await import("./summary-page.url.scss")).default.toString()
            console.log(css)
            printWin.focus();

            const url = window.location.hostname
            console.log(url)
            const name = this.group?.settings?.name ?? ""
            let html = ""

            html += `
            <!DOCTYPE html>
            <html lang="en">

            <head>
                <meta charset="utf-8" />
                <meta http-equiv="X-UA-Compatible" content="IE=edge" />
                <title>Samenvatting ${name}</title>
                <base href="https://${url}/">
                <style>
                    ${css}
                </style>
            </head>

            <body>
                <img src="${logoSrc}" alt="Stamhoofd" /><h1>${onlyContacts ? 'Noodcontacten' : 'Samenvatting'} ${name}</h1>
                <p class="warning-box">Bewaar dit document op een veilige plaats en vernietig het na gebruik.</p>`;

            const els = document.createElement("div")

            if (!onlyContacts) {
                for (const group of samenvatting) {
                    const title = document.createElement("h2")
                    title.innerText = group.title
                    els.appendChild(title);

                    const definitionGroup = document.createElement("dl")
                    definitionGroup.className = "summary-details-grid small"


                    for (const [text, key] of group.items) {
                        const def = document.createElement("dt")
                        const d = document.createElement("dd")

                        def.innerText = text
                        d.innerText = key

                        definitionGroup.appendChild(def)
                        definitionGroup.appendChild(d)
                    }

                    els.appendChild(definitionGroup)

                }
            }

           

            const columns = document.createElement("div")
            columns.className = "columns"

            for (const group of this.createContacts()) {
                const div = document.createElement("div")
                const title = document.createElement("h2")
                title.innerText = group.title
                div.appendChild(title);

                const definitionGroup = document.createElement("dl")
                definitionGroup.className = "summary-details-grid tiny"

                for (const [text, key] of group.items) {
                    const def = document.createElement("dt")
                    const d = document.createElement("dd")

                    def.innerText = text
                    d.innerText = key

                    definitionGroup.appendChild(def)
                    definitionGroup.appendChild(d)
                }

                div.appendChild(definitionGroup)
                columns.appendChild(div);
            }
            if (!onlyContacts) {
                els.appendChild(document.createElement("hr"))
            }
            els.appendChild(columns)
            html += els.innerHTML;

            html += `</body></html>`;

            printWin.document.write(html);

            setTimeout(() => {
                printWin.print();
                printWin.close();
            }, 1000)
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
      
        this.loading = false
       
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.member-summary-view {
    > main {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }

    .details-grid dd {
        white-space: pre-wrap;
    }

    .split-main {
        display: grid;
        grid-template-columns: repeat( auto-fit, minmax(250px, 1fr) );
        gap: 10px;

        h2 {
            @extend .style-title-2;
            padding-top: 25px;
            padding-bottom: 15px;
        }
    }
}
</style>
