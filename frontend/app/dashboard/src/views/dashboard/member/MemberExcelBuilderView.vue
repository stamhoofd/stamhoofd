<template>
    <div class="st-view">
        <STNavigationBar title="Exporteren naar Excel" :dismiss="canDismiss" />

        <main>
            <h1>
                Exporteren naar Excel
            </h1>
            <p>Exporteer de gegevens van de geselecteerde leden naar een Excel-bestand. Kies hieronder welke gegevens je wilt opnemen in het bestand.</p>

            <STErrorsDefault :error-box="errorBox" />
            
            <div v-for="(group, index) of propertyGroups" :key="index" class="container">
                <hr>
                <h2 class="style-with-button">
                    <div>{{ group.name }}</div>
                    <div>
                        <button v-if="group.selected" class="button text" type="button" @click="group.selected = false">
                            Deselecteren
                        </button>
                        <button v-else class="button text" type="button" @click="group.selected = true">
                            Selecteren
                        </button>
                    </div>
                </h2>
                <p v-if="group.description !== undefined" v-text="group.description" />

                <STList>
                    <STListItem v-for="(property, i) of group.properties" :key="i" :selectable="true" element-name="label">
                        <Checkbox slot="left" v-model="property.selected" />
                        <h3 class="style-title-list">
                            {{ property.name }}
                        </h3>
                        <p v-if="property.description !== undefined" class="style-description-small">
                            {{ property.description }}
                        </p>
                    </STListItem>
                </STList>
            </div>
        </main>

        
        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="exportExcel">
                        <span class="icon download" />
                        <span v-if="!$isNative">Exporteren</span>
                        <span v-else>Opslaan</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, ErrorBox, LoadingButton, SegmentedControl, STErrorsDefault, STList, STListItem, STNavigationBar, STNavigationTitle, STToolbar, Toast, TooltipDirective } from "@stamhoofd/components";
import { AppManager } from "@stamhoofd/networking";
import { Address, Gender, Group, MemberWithRegistrations, ParentTypeHelper, RecordAddressAnswer, RecordCategory, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordMultipleChoiceAnswer, RecordSettings, RecordTextAnswer, RecordType } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";
import XLSX from "xlsx";

import { OrganizationManager } from "../../../classes/OrganizationManager";

type RowValue = (string | number | Date | {value: string | number | Date, format: null | string});

function transformRowValues(row: RowValue[][]): (string | number | Date)[][] {
    return row.map(r => r.map(c => {
        if (typeof c === "object" && !(c instanceof Date)) {
            return c.value
        }
        return c
    }))
}

class ExcelMemberPropertyGroup {
    name: string;
    description?: string
    properties: ExcelMemberProperty[];

    constructor(name: string, description: string | undefined, properties: ExcelMemberProperty[]) {
        this.name = name;
        this.description = description;
        this.properties = properties;
    }

    get selected() {
        return !this.properties.find(p => !p.selected)
    }

    set selected(selected: boolean) {
        for (const p of this.properties) {
            p.selected = selected;
        }
    }
}

/**
 * Properties that are displayed per member
 */
class ExcelMemberProperty {
    selected = false

    name = ""
    width = 10
    getValue: (member: MemberWithRegistrations) => RowValue
    format?: string
    description?: string

    constructor(settings: {
        name: string, 
        selected?: boolean,
        getValue: (member: MemberWithRegistrations) => RowValue,
        format?: string,
        width?: number,
        description?: string
    }) {
        this.name = settings.name
        this.selected = settings.selected ?? false
        this.getValue = settings.getValue
        this.format = settings.format
        this.width = settings.width ?? 10
        this.description = settings.description
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
        STErrorsDefault,
        Checkbox,
        STList,
        STListItem
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class MemberExcelBuilderView extends Mixins(NavigationMixin) {
    loading = false
    errorBox: ErrorBox | null = null

    @Prop({ default: [] })
        groups!: Group[];

    @Prop({ default: false })
        waitingList!: boolean;

    @Prop({ default: 0 })
        cycleOffset!: number;

    @Prop()
        members!: MemberWithRegistrations[];

    propertyGroups: ExcelMemberPropertyGroup[] = [
        new ExcelMemberPropertyGroup("Persoonsgegevens", undefined, [
            new ExcelMemberProperty({
                name: "Voornaam",
                getValue: (member: MemberWithRegistrations) => member.details.firstName,
                width: 15,
                selected: true
            }),
            new ExcelMemberProperty({
                name: "Achternaam",
                getValue: (member: MemberWithRegistrations) => member.details.lastName,
                width: 15,
                selected: true
            }),
            new ExcelMemberProperty({
                name: "Geboortedatum",
                getValue: (member: MemberWithRegistrations) => member.details.birthDay ?? "",
                width: 15
            }),
            new ExcelMemberProperty({
                name: "Geslacht",
                getValue: (member: MemberWithRegistrations) => member.details.gender === Gender.Male ? "Man" : (member.details.gender === Gender.Female ? "Vrouw" : ""),
                width: 10
            }),
            new ExcelMemberProperty({
                name: this.$i18n.t("shared.inputs.mobile.label").toString(),
                getValue: (member: MemberWithRegistrations) => member.details.phone ?? "",
                width: 20,
                description: OrganizationManager.organization.meta.recordsConfiguration.parents === null ? undefined : "Nummer van lid zelf, niet van een ouder"
            }),
            new ExcelMemberProperty({
                name: "E-mailadres",
                getValue: (member: MemberWithRegistrations) => member.details.email ?? "",
                width: 30,
                description: OrganizationManager.organization.meta.recordsConfiguration.parents === null ? undefined : "E-mailadres van lid zelf, niet van een ouder"
            }),
        ]),
        new ExcelMemberPropertyGroup("Betaling", undefined, [
            new ExcelMemberProperty({
                name: "Openstaand bedrag",
                description: 'Totaal van aangerekende bedragen die nog niet betaald werden.',
                getValue: (member: MemberWithRegistrations) => member.outstandingBalance/100,
                format: "€0.00",
                width: 20
            }),
            new ExcelMemberProperty({
                name: "Prijs",
                description: "Prijs van alle inschrijvingen bij " + Formatter.joinLast(this.groups.map(g => g.settings.name), ', ', ' en '),
                getValue: (member: MemberWithRegistrations) => {
                    const registrations = member.filterRegistrations({groups: this.groups, waitingList: this.waitingList, cycleOffset: this.cycleOffset})
                    return registrations.reduce((a, b) => a + b.price, 0)/100
                },
                format: "€0.00",
                width: 12
            }),
            new ExcelMemberProperty({
                name: "Prijs betaald",
                description: "Totaal bedrag betaald van 'Prijs'",
                getValue: (member: MemberWithRegistrations) => {
                    const registrations = member.filterRegistrations({groups: this.groups, waitingList: this.waitingList, cycleOffset: this.cycleOffset})
                    return registrations.reduce((a, b) => a + b.pricePaid, 0)/100
                },
                format: "€0.00",
                width: 15
            }),
        ]),
        new ExcelMemberPropertyGroup("Adres 1", OrganizationManager.organization.meta.recordsConfiguration.parents === null ? "Adres van het lid zelf" : "Adres van het lid zelf, of van de eerste ouder", [
            new ExcelMemberProperty({
                name: "Straat",
                getValue: (member: MemberWithRegistrations) => this.firstAddress(member)?.street ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "Huisnummer",
                getValue: (member: MemberWithRegistrations) => this.firstAddress(member)?.number ?? "",
                width: 10,
            }),
            new ExcelMemberProperty({
                name: "Postcode",
                getValue: (member: MemberWithRegistrations) => this.firstAddress(member)?.postalCode ?? "",
                width: 10,
            }),
            new ExcelMemberProperty({
                name: "Gemeente",
                getValue: (member: MemberWithRegistrations) => this.firstAddress(member)?.city ?? "",
                width: 20,
            }),
            new ExcelMemberProperty({
                name: "Land",
                getValue: (member: MemberWithRegistrations) => this.firstAddress(member)?.country ?? "",
                width: 10,
            }),
        ]),
        ...(OrganizationManager.organization.meta.recordsConfiguration.parents !== null ?  [
            new ExcelMemberPropertyGroup("Ouders",  "In Stamhoofd kan je meer dan twee ouders toevoegen, waaronder ook stiefouders/plusouders.", [
                new ExcelMemberProperty({
                    name: "Benaming ouder 1",
                    description: "Mama, papa, pluspapa...",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[0] ? ParentTypeHelper.getName(member.details.parents[0].type) : "",
                    width: 10
                }),
                new ExcelMemberProperty({
                    name: "Naam ouder 1",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[0]?.name ?? "",
                    width: 20
                }),
                new ExcelMemberProperty({
                    name: "GSM-nummer ouder 1",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[0]?.phone ?? "",
                    width: 20
                }),
                new ExcelMemberProperty({
                    name: "E-mailadres ouder 1",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[0]?.email ?? "",
                    width: 30
                }),

                new ExcelMemberProperty({
                    name: "Benaming ouder 2",
                    description: "Mama, papa, pluspapa...",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[1] ? ParentTypeHelper.getName(member.details.parents[1].type) : "",
                    width: 10
                }),
                new ExcelMemberProperty({
                    name: "Naam ouder 2",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[1]?.name ?? "",
                    width: 20
                }),
                new ExcelMemberProperty({
                    name: "GSM-nummer ouder 2",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[1]?.phone ?? "",
                    width: 20
                }),
                new ExcelMemberProperty({
                    name: "E-mailadres ouder 2",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[1]?.email ?? "",
                    width: 30
                }),

                new ExcelMemberProperty({
                    name: "Benaming ouder 3",
                    description: "Mama, papa, pluspapa...",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[2] ? ParentTypeHelper.getName(member.details.parents[2].type) : "",
                    width: 10
                }),
                new ExcelMemberProperty({
                    name: "Naam ouder 3",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[2]?.name ?? "",
                    width: 20
                }),
                new ExcelMemberProperty({
                    name: "GSM-nummer ouder 3",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[2]?.phone ?? "",
                    width: 20
                }),
                new ExcelMemberProperty({
                    name: "E-mailadres ouder 3",
                    getValue: (member: MemberWithRegistrations) => member.details.parents[2]?.email ?? "",
                    width: 30
                }),
            ]),
            new ExcelMemberPropertyGroup("Adres 2",  "Adres van een tweede ouder indien verschillend of eerste ouder indien lid op ander adres woont", [
                new ExcelMemberProperty({
                    name: "Straat 2",
                    getValue: (member: MemberWithRegistrations) => this.secondAddress(member)?.street ?? "",
                    width: 30,
                }),
                new ExcelMemberProperty({
                    name: "Huisnummer 2",
                    getValue: (member: MemberWithRegistrations) => this.secondAddress(member)?.number ?? "",
                    width: 10,
                }),
                new ExcelMemberProperty({
                    name: "Postcode 2",
                    getValue: (member: MemberWithRegistrations) => this.secondAddress(member)?.postalCode ?? "",
                    width: 10,
                }),
                new ExcelMemberProperty({
                    name: "Gemeente 2",
                    getValue: (member: MemberWithRegistrations) => this.secondAddress(member)?.city ?? "",
                    width: 20,
                }),
                new ExcelMemberProperty({
                    name: "Land 2",
                    getValue: (member: MemberWithRegistrations) => this.secondAddress(member)?.country ?? "",
                    width: 10,
                }),
            ]),
            new ExcelMemberPropertyGroup("Adres 3",  "Zelden het geval, maar als er een derde (stief)ouder is met een ander adres. Of het adres van de tweede ouder als de ouders en het lid op een ander adres wonen.", [
                new ExcelMemberProperty({
                    name: "Straat 3",
                    getValue: (member: MemberWithRegistrations) => this.thirdAddress(member)?.street ?? "",
                    width: 30,
                }),
                new ExcelMemberProperty({
                    name: "Huisnummer 3",
                    getValue: (member: MemberWithRegistrations) => this.thirdAddress(member)?.number ?? "",
                    width: 10,
                }),
                new ExcelMemberProperty({
                    name: "Postcode 3",
                    getValue: (member: MemberWithRegistrations) => this.thirdAddress(member)?.postalCode ?? "",
                    width: 10,
                }),
                new ExcelMemberProperty({
                    name: "Gemeente 3",
                    getValue: (member: MemberWithRegistrations) => this.thirdAddress(member)?.city ?? "",
                    width: 20,
                }),
                new ExcelMemberProperty({
                    name: "Land 3",
                    getValue: (member: MemberWithRegistrations) => this.thirdAddress(member)?.country ?? "",
                    width: 10,
                }),
            ]),
        ] : []),

        ...(OrganizationManager.organization.meta.recordsConfiguration.emergencyContacts !== null ?  [
            new ExcelMemberPropertyGroup("Noodcontact", undefined, [
                new ExcelMemberProperty({
                    name: "Noodcontact titel",
                    description: "Bv. oma, buurvrouw, ...",
                    getValue: (member: MemberWithRegistrations) => member.details.emergencyContacts[0]?.title ?? "",
                    width: 10,
                }),
                new ExcelMemberProperty({
                    name: "Noodcontact naam",
                    getValue: (member: MemberWithRegistrations) => member.details.emergencyContacts[0]?.name ?? "",
                    width: 20,
                }),
                new ExcelMemberProperty({
                    name: "Noodcontact GSM-nummer",
                    getValue: (member: MemberWithRegistrations) => member.details.emergencyContacts[0]?.phone ?? "",
                    width: 20,
                }),
            ]),
        ] : []),

        ...this.recordCategories.map(category => {
            return new ExcelMemberPropertyGroup(category.name, category.description, category.getAllRecords().map(record => {
                return new ExcelMemberProperty({
                    name: record.name,
                    description: record.description,
                    getValue: (member: MemberWithRegistrations) => {
                        const answer = member.details.recordAnswers.find(answer => answer.settings.id === record.id);
                        if (!answer) {
                            return ""
                        }
                        return answer.excelValue;
                    },
                    width: 30,
                });
            }));
        }),
    ]

    nthAddress(member: MemberWithRegistrations, n: number): Address | null {
        const s = new Set<string>()
        const list = [member.details.address, member.details.parents[0]?.address, member.details.parents[1]?.address, member.details.parents[2]?.address, member.details.parents[3]?.address]
        for (const address of list) {
            if (address !== null && address !== undefined && !s.has(address.toString())) {
                s.add(address.toString())
                if (n === 0) {
                    return address
                }
                n--
            }
        }
        return null
    }

    firstAddress(member: MemberWithRegistrations): Address | null {
        return this.nthAddress(member, 0)
    }

    secondAddress(member: MemberWithRegistrations): Address | null {
        return this.nthAddress(member, 1)
    }

    thirdAddress(member: MemberWithRegistrations): Address | null {
        return this.nthAddress(member, 2)
    }

    get recordCategories(): RecordCategory[] {
        // TODO: only show the record categories that are relevant for the given member (as soon as we implement filters)
        return OrganizationManager.organization.meta.recordsConfiguration.recordCategories.flatMap(category => {
            if (category.childCategories.length > 0) {
                return category.childCategories
            }
            return [category]
        })
    }

    get records(): RecordSettings[] {
        // TODO: only show the record categories that are relevant for the given member (as soon as we implement filters)
        return this.recordCategories.flatMap(c => c.records)
    }

    async exportExcel() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.errorBox = null;

        try {
            await this.export(this.propertyGroups.flatMap(g => g.properties.filter(p => p.selected)), this.members)
        } catch (e: unknown) {
            console.error(e)
            if (e instanceof Error) {
                this.errorBox = new ErrorBox(e)
            }
        }
      
        this.loading = false
       
    }

    formatColumn(colNum: number, fmt: string, worksheet: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for(let i = range.s.r + 1; i <= range.e.r; ++i) {
            /* find the data cell (range.s.r + 1 skips the header row of the worksheet) */
            const ref = XLSX.utils.encode_cell({r:i, c:colNum});
            /* if the particular row did not contain data for the column, the cell will not be generated */
            if(!worksheet[ref]) continue;
            /* `.t == "n"` for number cells */
            if(worksheet[ref].t != 'n' && worksheet[ref].t != 'd') continue;
            /* assign the `.z` number format */
            worksheet[ref].z = fmt;
        }
    }

    async export(columns: ExcelMemberProperty[], members: MemberWithRegistrations[]) {
        const wsName = "Leden";
        const wb = XLSX.utils.book_new();

        /* make worksheet */
        const wsData: RowValue[][] = [
            columns.map(c => c.name),
        ];

        for (const member of members) {
            wsData.push(columns.map(c => c.getValue(member)))
        }

        const ws = XLSX.utils.aoa_to_sheet(transformRowValues(wsData), { cellDates: true });

        // Format columns based on format option in wsData
        if (wsData[1]) {
            for (const [index, col] of wsData[1].entries()) {
                if (typeof col !== "object" || (col instanceof Date)) {
                    continue
                }
                if (col.format) {
                    this.formatColumn(index, col.format, ws)
                }
            }
        }

        // Set column width
        ws['!cols'] = []
        for (const [index, column] of columns.entries()) {
            ws['!cols'].push({width: column.width});
            if (column.format) {
                this.formatColumn(index, column.format, ws)
            }
        }

        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, ws, wsName);

        const fileName = Formatter.fileSlug((this.waitingList ? 'Wachtlijst ' : '') + (this.groups.length === 1 ? this.groups[0].settings.name : 'Leden'))

        if (AppManager.shared.downloadFile) {
            const data = XLSX.write(wb, { type: 'base64' });
            await AppManager.shared.downloadFile(data, fileName+".xlsx")
        } else {
            XLSX.writeFile(wb, fileName+".xlsx");
        }
    }

}
</script>