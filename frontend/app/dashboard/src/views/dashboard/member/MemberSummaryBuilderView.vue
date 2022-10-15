<template>
    <div class="st-view member-summary-view">
        <STNavigationBar title="Exporteren naar PDF" :dismiss="canDismiss" />

        <main>
            <h1>
                Exporteren naar PDF
            </h1>
            <p>Exporteer de gegevens van de geselecteerde leden naar een PDF-bestand die je kan afdrukken of opslaan.</p>

            <STErrorsDefault :error-box="errorBox" />

            <hr>
            <h2 class="style-with-button">
                <div>Kenmerken per lid oplijsten</div>
                <div>
                    <button v-if="hasMemberProperties" class="button text" type="button" @click="deselectAllMemberProperties">
                        Deselecteren
                    </button>
                </div>
            </h2>
            <p>Selecteer hier alle kenmerken die je in de samenvatting wilt oplijsten, gegroepeerd per lid.</p>

            <STList>
                <STListItem v-for="(property, index) of memberProperties" :key="index" :selectable="true" element-name="label">
                    <Checkbox slot="left" v-model="property.selected" />
                    {{ property.name }}
                </STListItem>
            </STList>

            <hr>
            <h2 class="style-with-button">
                <div>Leden oplijsten per categorie</div>
                <div>
                    <button v-if="hasGroupProperties" class="button text" type="button" @click="deselectAllGroupProperties">
                        Deselecteren
                    </button>
                </div>
            </h2>
            <p>Je kan ook leden oplijsten per categorie, eventueel met extra opmerkingen erbij (bv. bij aanvinkvakjes met opmerkingen).</p>

            <STList>
                <STListItem v-for="(property, index) of groupProperties" :key="index" :selectable="true" element-name="label">
                    <Checkbox slot="left" v-model="property.selected" />
                    {{ property.name }}
                </STListItem>
            </STList>
        </main>

        
        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" @click="createPDF">
                        <span class="icon download" />
                        <span v-if="!$isNative">Download</span>
                        <span v-else>Opslaan</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import metropolisMediumUrl from '@stamhoofd/assets/fonts/Metropolis/WOFF2/Metropolis-Medium.woff2';
import metropolisBoldUrl from '@stamhoofd/assets/fonts/Metropolis/WOFF2/Metropolis-SemiBold.woff2';
import logoUrl from '@stamhoofd/assets/images/logo/logo-horizontal.png';
import { BackButton, Checkbox, ErrorBox, LoadingButton, SegmentedControl, STErrorsDefault, STList, STListItem, STNavigationBar, STNavigationTitle, STToolbar, TooltipDirective } from "@stamhoofd/components";
import { AppManager } from "@stamhoofd/networking";
import { Group, Member, MemberWithRegistrations, ParentTypeHelper, RecordCategory, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordMultipleChoiceAnswer, RecordSettings, RecordType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
// Keep for types only
import PDFKit from "pdfkit"
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";

const mm = 2.834666666666667 // = 1 mm

const margin = 15 * mm
const docWidth = 595.28
const docHeight = 841.89

const colorDark = "#000716"
const colorBorder = "#e7e7e7"
const colorGray = "#868686"

class SamenvattingGroep {
    title = ""
    items: Map<string, string> = new Map()

    constructor(title: string) {
        this.title = title
    }
}

/**
 * Properties that are displayed per member
 */
class SummaryMemberProperty {
    selected = false

    name = ""
    getValues: (member: MemberWithRegistrations) => (Map<string, string> | undefined)

    constructor(settings: {
        name: string, 
        selected?: boolean,
        getValues?: (member: MemberWithRegistrations) => (Map<string, string> | undefined),
        getValue?: (member: MemberWithRegistrations) => string | undefined | null
    }) {
        this.name = settings.name
        this.selected = settings.selected ?? false

        if (settings.getValue && settings.getValues) {
            throw new Error("getValue + getValues can't be used together")
        }

        if (settings.getValue) {
            const getValue = settings.getValue
            this.getValues = (member) => {
                const v = getValue(member)
                if (v === undefined || v === null) {
                    return
                }
                return new Map([[this.name, v]])
            }
        } else if (settings.getValues) {
            this.getValues = settings.getValues
        }
        else {
            throw new Error("Missing getValue or getValues")
        }
    }
}

/**
 * Properties that list members with given property and values
 */
class SummaryGroupProperty {
    selected = false
    name = ""

    /**
     * Return an empty string when you only want to display the name
     */
    getValue: (member: MemberWithRegistrations) => string | null

    constructor(settings: {
        name: string, 
        selected?: boolean,
        getValue: (member: MemberWithRegistrations) => string | null
    }) {
        this.name = settings.name
        this.getValue = settings.getValue
        this.selected = settings.selected ?? false
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
export default class MemberSummaryBuilderView extends Mixins(NavigationMixin) {
    loading = false
    errorBox: ErrorBox | null = null

    @Prop({ default: null })
    group: Group | null;

    @Prop()
    members!: MemberWithRegistrations[];

    memberProperties = [
        new SummaryMemberProperty({
            name: "Geboortedatum", 
            getValue: (member) => member.details.birthDayFormatted
        }),
        new SummaryMemberProperty({
            name: "GSM", 
            getValue: (member) => member.details.phone
        }),
        new SummaryMemberProperty({
            name: "Ouders", 
            getValues: (member) => {
                return new Map(member.details.parents.map(parent => {
                    return [ParentTypeHelper.getName(parent.type), parent.name+(parent.phone ? ("\n"+parent.phone) : "")]
                }))
            }
        }),
        new SummaryMemberProperty({
            name: "Adres", 
            getValues: (member) => {
                const addresses = new Set<string>()

                if (member.details.address) {
                    addresses.add(member.details.address.toString())
                }
                
                const parentAddresses = new Set<string>()

                for (const parent of member.details.parents) {
                    if (parent.address) {
                        addresses.add(parent.address.toString())
                        parentAddresses.add(parent.address.toString())
                    }
                }

                if (parentAddresses.size == 1 && addresses.size == 1) {
                    return new Map([["Adres", [...addresses].join("\n")]])
                }

                if (parentAddresses.size >= 1) {
                    if (!member.details.address || addresses.size === parentAddresses.size) {
                        return new Map(member.details.parents.flatMap(parent => {
                            if (!parent.address) {
                                return []
                            }
                            return [["Adres "+ParentTypeHelper.getName(parent.type), parent.address.toString()]]
                        }))
                    }
                    return new Map([
                        ["Adres", member.details.address.toString()],
                        ...member.details.parents.flatMap(parent =>  {
                            if (!parent.address) {
                                return []
                            }
                            return [["Adres "+ParentTypeHelper.getName(parent.type), parent.address.toString()]] as [string, string][]
                        })
                    ])
                }

                return new Map([["Adres", [...addresses].join("\n")]])
            }
            
        })
    ]

    groupProperties = [
        new SummaryGroupProperty({
            name: "Financiële ondersteuning",
            getValue: (member) => {
                return member.details.requiresFinancialSupport?.value ? "" : null
            }
        }),
        new SummaryGroupProperty({
            name: "Geen toestemming verzamelen gevoelige gegevens",
            getValue: (member) => {
                return member.details.dataPermissions?.value ? null : ""
            }
        })
    ]

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

    created() {
        for (const record of this.records) {
            if (record.type === RecordType.Checkbox) {
                const preferInverted = record.warning?.inverted ?? false
                this.groupProperties.push(
                    new SummaryGroupProperty({
                        name: record.name+": aangevinkt",
                        selected: !preferInverted && !!record.warning,
                        getValue: (member) => {
                            const answer = member.details.recordAnswers.find(a => a.settings.id == record.id)
                            if (!answer) {
                                return null
                            }
                            if (answer instanceof RecordCheckboxAnswer) {
                                return answer.selected ? (answer.comments ?? "") : null
                            }
                            return null
                        }
                    })
                )

                this.groupProperties.push(
                    new SummaryGroupProperty({
                        name: record.name+": niet aangevinkt",
                        selected: preferInverted && !!record.warning,
                        getValue: (member) => {
                            const answer = member.details.recordAnswers.find(a => a.settings.id == record.id)
                            if (!answer) {
                                return ""
                            }
                            if (answer instanceof RecordCheckboxAnswer) {
                                return answer.selected ? null : ""
                            }
                            return ""
                        }
                    })
                )
            } else if (record.type === RecordType.ChooseOne) {
                this.memberProperties.push(
                    new SummaryMemberProperty({
                        name: record.name,
                        selected: false,
                        getValue: (member) => {
                            const answer = member.details.recordAnswers.find(a => a.settings.id == record.id)
                            if (!answer) {
                                return
                            }
                            if (answer instanceof RecordChooseOneAnswer) {
                                return answer.selectedChoice?.name
                            }
                        }
                    })
                )

                for (const choice of record.choices) {
                    this.groupProperties.push(
                        new SummaryGroupProperty({
                            name: record.name+": "+choice.name,
                            selected: !!choice.warning,
                            getValue: (member) => {
                                const answer = member.details.recordAnswers.find(a => a.settings.id == record.id)
                                if (!answer) {
                                    return null
                                }
                                if (answer instanceof RecordChooseOneAnswer) {
                                    return answer.selectedChoice?.id == choice.id ? "" : null
                                }
                                return null
                            }
                        })
                    )
                }
            } else if (record.type === RecordType.MultipleChoice) {
                this.memberProperties.push(
                    new SummaryMemberProperty({
                        name: record.name,
                        selected: false,
                        getValue: (member) => {
                            const answer = member.details.recordAnswers.find(a => a.settings.id == record.id)
                            if (!answer) {
                                return
                            }
                            if (answer instanceof RecordMultipleChoiceAnswer) {
                                return answer.selectedChoices.map(c => c.name).join(", ")
                            }
                        }
                    })
                )

                for (const choice of record.choices) {
                    this.groupProperties.push(
                        new SummaryGroupProperty({
                            name: record.name+": "+choice.name,
                            selected: !!choice.warning,
                            getValue: (member) => {
                                const answer = member.details.recordAnswers.find(a => a.settings.id == record.id)
                                if (!answer) {
                                    return null
                                }
                                if (answer instanceof RecordMultipleChoiceAnswer) {
                                    return answer.selectedChoices.find(c => c.id == choice.id) ? "" : null
                                }
                                return null
                            }
                        })
                    )
                }
            } else  {
                this.memberProperties.push(
                    new SummaryMemberProperty({
                        name: record.name,
                        selected: false,
                        getValue: (member) => {
                            const answer = member.details.recordAnswers.find(a => a.settings.id == record.id)
                            if (!answer) {
                                return
                            }
                            const value = answer.stringValue.trim();
                            return value && value !== "/" && value.toLowerCase() !== 'nee' && value.toLowerCase() !== 'neen' && value.toLowerCase() !== 'nvt' && value.toLowerCase() !== 'n.v.t.' ? value : undefined
                        }
                    })
                )

                this.groupProperties.push(
                    new SummaryGroupProperty({
                        name: record.name,
                        selected: !!record.warning,
                        getValue: (member) => {
                            const answer = member.details.recordAnswers.find(a => a.settings.id == record.id)
                            if (!answer) {
                                return null
                            }
                            
                            const value = answer.stringValue.trim();
                            return value && value !== "/" && value.toLowerCase() !== 'nee' && value.toLowerCase() !== 'neen' && value.toLowerCase() !== 'nvt' && value.toLowerCase() !== 'n.v.t.' ? value : null
                        }
                    })
                )
            }


        }
        
    }

    get hasGroupProperties() {
        return !!this.groupProperties.find(m => m.selected)
    }

    get hasMemberProperties() {
        return !!this.memberProperties.find(m => m.selected)
    }

    deselectAllGroupProperties() {
        for (const prop of this.groupProperties) {
            prop.selected = false
        }
    }

    deselectAllMemberProperties() {
        for (const prop of this.memberProperties) {
            prop.selected = false
        }
    }

    buildMemberGroups() {
        const groups: SamenvattingGroep[] = []

        // Sort members
        const members = this.members.slice()
        members.sort(Member.sorterByName("ASC"));

        for (const member of members) {
            const group = new SamenvattingGroep(member.name)

            for (const property of this.memberProperties) {
                if (!property.selected) {
                    continue
                }

                const m = property.getValues(member)
                if (m) {
                    for (const [key, value] of m) {
                        group.items.set(key, value)
                    }
                }
            }

            if (group.items.size > 0) {
                groups.push(group)
            }
        }
        return groups
    }

    buildGroupGroups() {
        const groups: SamenvattingGroep[] = []

        // Sort members
        const members = this.members.slice()
        members.sort(Member.sorterByName("ASC"));

        for (const property of this.groupProperties) {
            if (!property.selected) {
                continue
            }
            const group = new SamenvattingGroep(property.name)

            for (const member of members) {
                const m = property.getValue(member)
                if (m !== null) {
                    group.items.set(member.name, m)
                }
            }

            if (group.items.size == 0) {
                group.items.set("Geen leden", "")
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

    async newCreatePDF() {
        const PDFDocument = (await import("../../../pdfkit.standalone")).default as PDFKit.PDFDocument
        let title = "Samenvatting"

        if (this.group) {
            title += " "+this.group.settings.name
        }

        const logoSrc = await(await fetch(logoUrl)).arrayBuffer()
        const metropolisMedium = await(await fetch(metropolisMediumUrl)).arrayBuffer()
        const metropolisBold = await(await fetch(metropolisBoldUrl)).arrayBuffer()

        const buffer = await new Promise<Buffer>(resolve => {
            const doc = new PDFDocument({ size: [docWidth, docHeight], margin: 10*mm, bufferPages: true });

            doc.registerFont('metropolisMedium', metropolisMedium);
            doc.registerFont('metropolisBold', metropolisBold);

            const bufs: any[] = [];
            doc.on('data', function (d) { bufs.push(d); });
            doc.on('end', function () {
                const buf = Buffer.concat(bufs);
                resolve(buf)
            });

            // logo
            doc.image(logoSrc, docWidth - margin - 30*mm, margin, { width: 30*mm })

            doc.fontSize(20);
            doc.fillColor(colorDark);

            doc.font('metropolisBold').text(title, margin, margin, { align: 'left', width: docWidth - margin*2 })

            doc.fontSize(9);
            doc.fillColor(colorGray);
            doc.font('metropolisMedium').text("Bewaar dit document op een veilige plaats en vernietig het na gebruik.", margin, doc.y + 2*mm, { align: 'left', width: docWidth - margin*2 })


            // Draw boxes...
            if (this.hasGroupProperties) {
                doc.moveDown(2);
                this.drawBoxes(doc, 1, this.buildGroupGroups(), false)
            }
           
            if (this.hasMemberProperties) {
                doc.moveDown(2);
                this.drawBoxes(doc, 2, this.buildMemberGroups(), this.hasGroupProperties)
            }
        
            // Page numbers
            // see the range of buffered pages
            const range = doc.bufferedPageRange(); // => { start: 0, count: 2 }
            const end = range.start + range.count

            // Title
            if (range.count > 1) {
                for (let i = range.start; i < end; i++) {
                    doc.switchToPage(i);
                    doc.fontSize(9);
                    doc.fillColor(colorGray);
                    doc.font('metropolisMedium');
                    doc.text(title+` - ${i + 1} / ${range.count}`, margin, docHeight - margin, { align: "right", baseline: "bottom", width: docWidth - margin*2 });
                }
            }

            // manually flush pages that have been buffered
            doc.flushPages();
            
            doc.end();
        });


        if (AppManager.shared.downloadFile) {
            const data = buffer.toString('base64')
            await AppManager.shared.downloadFile(data, Formatter.slug(title)+".pdf")
        } else {
            const blob = new Blob([buffer], {type: "application/pdf"});
            const link = document.createElement('a');
            const href = window.URL.createObjectURL(blob);
            link.href = href        
            const fileName = Formatter.slug(title)+".pdf";
            link.download = fileName;
            link.click();
        }
    }

    drawBoxes(doc: PDFKit.PDFDocument, columns: number, data: SamenvattingGroep[], allowSkipFirstPage = true) {
        
        const columnGap = 5*mm
        const width = (docWidth - margin*2 + columnGap)/columns - columnGap
        let y = doc.y
        let isFirst = true

        while(data.length > 0) {        
            let maxHeight = 0;
            let maxPages = 0
            
            const cp = data.slice()
            for (let index = 0; index < columns; index++) {
                const next = cp.shift()
                if (!next) {
                    // done
                    break;
                }
                let [height, pages] = this.drawBox(doc, next, margin, y, width, true, columns == 1 ? 2 : 1);
                if (pages >= maxPages && height > maxHeight) {
                    maxHeight = height
                }
                if (pages > maxPages) {
                    maxPages = pages
                    maxHeight = height
                }
            }

            // If the biggest one doesnt fit nicely, give it a full page
            if ((allowSkipFirstPage || !isFirst) && maxPages == 1 && maxHeight < docHeight - margin*2) {
                console.log("Gave it a separate page")
                // Go to next page
                doc.addPage()
                doc.moveTo(margin, margin)
                y = margin
            }

            isFirst = false

            const range = doc.bufferedPageRange();

            let maxLastY = 0;
            maxPages = 0

            for (let index = 0; index < columns; index++) {
                const next = data.shift()
                if (!next) {
                    // done
                    break;
                }
                const [_, pages, lastY] =  this.drawBox(doc, next, margin + index*width + columnGap*index, y, width, false, columns == 1 ? 2 : 1);

                if (pages > 0 && index < columns - 1) {
                    // Go to last page before we did draw anything
                    doc.switchToPage(range.start + range.count - 1);
                }

                if (pages > maxPages) {
                    maxPages = pages
                    maxLastY = lastY
                } else if (pages === maxPages && maxLastY < lastY) {
                    maxLastY = lastY
                }
            }

            y = maxLastY
            y += columnGap
        }
    }

    drawBox(doc: PDFKit.PDFDocument, data: SamenvattingGroep, x: number, y: number, width: number, calcHeight: boolean, columns = 1, joinKeys = false): [number, number, number] {
        // Calculate height + width
        // Check if we need to start on a new page

        const hasValues = !![...data.items].find(a => a[1].length > 0)

        if (!hasValues) {
            columns *= 2
        }

        columns = Math.max(Math.min(columns, Math.floor(data.items.size / 4)), 1)

        let height = 0;
        let pages =  0;

        const gap = 0.75 * mm;

        // Title
        doc.fontSize(11);
        doc.fillColor(colorDark);
        doc.font('metropolisBold');

        if (!calcHeight) {
            doc.text(data.title, x, y + height, { align: 'left', width })
        }
        const titleH = doc.heightOfString(data.title, { align: 'left', width })
        y += titleH
        y += 4*mm;
        height += titleH
        height += 4*mm;

        if (y > docHeight - margin) {
            y = margin
            pages++

            if (!calcHeight) {
                doc.addPage()
                doc.moveTo(margin, margin)
            }
        }

        // Items
        doc.fontSize(8);
        doc.font('metropolisMedium');

        const columnMargin = 5*mm
        const columnWidth = (width - columnMargin*(columns-1)) / columns


        // Calculate width of titles
        let maxWidth = hasValues ? Math.min(columnWidth / 5, 15*mm) : columnWidth; // Minimum width to keep differences between multiple columns comparable
        if (hasValues) {
            for (const [title, text] of data.items) {
                const w = Math.min(columnWidth / 2, doc.widthOfString(title, { align: 'left', lineGap: gap }))
                if (w > maxWidth) {
                    maxWidth = w+1 // +1 to fix rounding error that causes text to wrap
                }
            }
        }

        // Calculate the column positioning
        let columnConfig = [...Array(columns)].map(x => {
            return {
                items: [] as number[],
                totalHeight: 0
            }
        });

        if (columns > 1) {
            // Fill in
            for (const [title, text] of data.items) {
                // Determine the best column to draw in
                let h = 0;
                const t = text.replaceAll(" ", " ")
                h = Math.max(h, doc.heightOfString(title, { align: 'left', width: maxWidth, lineGap: gap }))
                if (t.length > 0) {
                    h = Math.max(h, doc.heightOfString(t, { align: 'left', width: columnWidth - maxWidth - 3*mm, lineGap: gap }))
                    h += 0.75*mm
                }

                // do not add gap here: breaks column calculation for some reason
                //h += gap

                columnConfig[0].items.push(h)
                columnConfig[0].totalHeight += h
            }


            let columnIndex = 0
            let didPush = false
            while (columnIndex < columnConfig.length - 1) {
                const config = columnConfig[columnIndex]
                const nextConfig = columnConfig[columnIndex + 1]

                if (config.items.length > 1) {
                    // Can we move the last item to the next column, without making the other column larger than the current?
                    const lastH = config.items[config.items.length - 1]

                    for (let nextIndex = columnIndex + 1; nextIndex < columnConfig.length; nextIndex++) {
                        const nConfig = columnConfig[nextIndex]
                        if (nConfig.totalHeight + lastH <= config.totalHeight - lastH) {
                            // Perform operation and move back to first column
                            config.items.pop()
                            nextConfig.items.unshift(lastH)
                            nextConfig.totalHeight += lastH
                            config.totalHeight -= lastH
                            didPush = true
                            break
                        }
                    }
                    
                }

                // Check others
                // Move to next column: we can't do anything here
                columnIndex++

                if (didPush && columnIndex >= columnConfig.length - 1) {
                    columnIndex = 0
                    didPush = false
                }
            }
            console.log("Column config", columnConfig)
        }

        let maxPages = pages
        let startPages = pages
        let maxHeight = height
        let startHeight = height
        let maxY = y
        let startY = y
        let column = 0
        let row = 0

        const range = doc.bufferedPageRange();

        for (const [title, text] of data.items) {

            let h = 0;
            const t = text.replaceAll(" ", " ")

            h = Math.max(h, doc.heightOfString(title, { align: 'left', width: maxWidth, lineGap: gap }))
            if (t.length > 0) {
                h = Math.max(h, doc.heightOfString(t, { align: 'left', width: columnWidth - maxWidth - 3*mm, lineGap: gap }))
                h += 0.75*mm
            }

            //const preferredColumn = Math.floor(pendingHeight / (columnHeight))
            
            row++
            if (column < columnConfig.length - 1 && row > columnConfig[column].items.length) {
                // Move to next column
                column++
                row = 1

                maxPages = Math.max(pages, maxPages)

                if (pages === maxPages) {
                    // Did this column reach the last page?
                    // -> update maxY
                    maxY = Math.max(y, maxY)
                }
                maxHeight = Math.max(height, maxHeight)

                // Move back to start
                if (!calcHeight && pages > startPages) {
                    console.log("Switching back to first page")
                    doc.switchToPage(range.start + range.count - 1);
                }

                y = startY
                pages = startPages
                height = startHeight
            }

            if (y + h > docHeight - margin) {
                console.log("Started new page at", column, row, y, pages)
                y = margin
                pages++

                if (pages > maxPages) {
                    maxY = y
                }

                if (!calcHeight) {
                    if (pages > maxPages) {
                        doc.addPage()
                    } else {
                        if (column == 0) {
                            console.warn("Warning: switching page in first column is not possible!")
                        }
                        doc.switchToPage(range.start + range.count - 1 + pages - startPages);
                    }
                    doc.moveTo(margin, margin)
                }
            }

            const xOffset = (columnWidth+columnMargin) * column
    
            if (!calcHeight) {
                doc.fillColor(colorDark);
                doc.text(title, x + xOffset, y, { align: 'left', width: maxWidth, lineGap: gap })
                if (t.length > 0) {
                    doc.fillColor(colorGray);
                    doc.text(t, x + maxWidth + 3*mm + xOffset, y, { align: 'left', width: columnWidth - maxWidth - 3*mm, lineGap: gap })
                }
            }


            height += h + gap
            y += h + gap
        }

        maxPages = Math.max(pages, maxPages)
        if (pages == maxPages) {
            // If last drawn item was on the last page
            y = Math.max(y, maxY)
        } else {
            y = maxY
            console.log("Last drawn item for "+data.title+" is not on last page")
        }

        if (!calcHeight && pages < maxPages) {
            // Move to last page drawn by this box (e.g. first column ended on new page, but others didn't)
            console.log("Switching back to last page")
            doc.switchToPage(range.start + range.count - 1 + maxPages - startPages);
        }

        // get pages + y of largest column
        pages = Math.max(pages, maxPages)
        height = Math.max(height, maxHeight)

        return [height, pages, y]
    }



    async createPDF() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.errorBox = null;

        try {
            await this.newCreatePDF()
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
      
        this.loading = false
       
    }

}
</script>