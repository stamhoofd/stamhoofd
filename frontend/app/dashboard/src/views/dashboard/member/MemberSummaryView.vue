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
                <button class="button secundary" @click="createPDF(false, true)">
                    <span class="icon download"/><span>Steekkaart</span>
                </button>

                <button class="button secundary" @click="createPDF(true, false)">
                    <span class="icon download"/><span>Noodcontacten</span>
                </button>

                <LoadingButton :loading="loading">
                    <button class="button primary" @click="createPDF(true, true)">
                        <span class="icon download"/><span>Alles</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STNavigationTitle, TooltipDirective, STErrorsDefault } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { SegmentedControl, BackButton, STToolbar, LoadingButton } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

import { MemberWithRegistrations, RecordType, RecordTypeHelper, Member, Group, ParentTypeHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

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

    async newCreatePDF(contacts = false, steekkaart = false) {
        const PDFDocument = (await import("../../../pdfkit.standalone")).default as PDFKit.PDFDocument
        let title = "Samenvatting"

        if (contacts && !steekkaart) {
            title = "Noodcontacten"
        }
        if (!contacts && steekkaart) {
            title = "Steekkaart"
        }

        if (this.group) {
            title += " "+this.group.settings.name
        }

        const logoSrc = (await import('!!arraybuffer-loader!@stamhoofd/assets/images/logo/logo-horizontal.png')).default
        const metropolisMedium = (await import('!!arraybuffer-loader!@stamhoofd/assets/fonts/Metropolis/WOFF2/Metropolis-Medium.woff2')).default
        const metropolisBold = (await import('!!arraybuffer-loader!@stamhoofd/assets/fonts/Metropolis/WOFF2/Metropolis-SemiBold.woff2')).default

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
            if (steekkaart) {
                doc.moveDown(2);
                this.drawBoxes(doc, 1, this.createSamenvattingSteekkaart())
            }
           
            if (contacts) {
                doc.moveDown(2);
                this.drawBoxes(doc, 3, this.createContacts())
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

        var blob = new Blob([buffer], {type: "application/pdf"});
        var link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        var fileName = Formatter.slug(title)+".pdf";
        link.download = fileName;
        link.click();
    }

    drawBoxes(doc: PDFKit.PDFDocument, columns: number, data: SamenvattingGroep[]) {
        
        const columnGap = 5*mm
        const width = (docWidth - margin*2 + columnGap)/columns - columnGap
        let y = doc.y

        while(data.length > 0) {        
            let maxHeight = 0;
            
            const cp = data.slice()
            for (let index = 0; index < columns; index++) {
                const next = cp.shift()
                if (!next) {
                    // done
                    break;
                }
                let height = this.drawBox(doc, next, margin, y, width, true);
                if (height > maxHeight) {
                    maxHeight = height
                }
            }

            if (y + maxHeight > docHeight - margin) {
                // Go to next page
                doc.addPage()
                doc.moveTo(margin, margin)
                y = margin
            }

            for (let index = 0; index < columns; index++) {
                const next = data.shift()
                if (!next) {
                    // done
                    break;
                }
                this.drawBox(doc, next, margin + index*width + columnGap*index, y, width, false);
            }

            y += maxHeight
            y += columnGap
     }
    }

    drawBox(doc: PDFKit.PDFDocument, data: SamenvattingGroep, x: number, y: number, width: number, calcHeight: boolean) {
        // Calculate height + width
        // Check if we need to start on a new page
        let height = 0;
        const gap = 1.5 * mm;

        // Title
        doc.fontSize(13);
        doc.fillColor(colorDark);
        doc.font('metropolisBold');

        if (!calcHeight) {
            doc.text(data.title, x, y + height, { align: 'left', width })
        }
        height += doc.heightOfString(data.title, { align: 'left', width })
        height += 4*mm;

        // Items
        doc.fontSize(9);

        // Calculate width of titles
        let maxWidth = width / 5; // Minimum width to keep differences between multiple columns comparable
        for (const [title, text] of data.items) {
            doc.fillColor(colorDark);
            doc.font('metropolisMedium');

            const w = doc.widthOfString(title, { align: 'left', width: width / 2, lineGap: gap })
            if (w > maxWidth) {
                maxWidth = w
            }
        }

        if (maxWidth > width / 2 - 5*mm) {
            maxWidth = width/2 - 5*mm
        }

        for (const [title, text] of data.items) {
            doc.fillColor(colorDark);
            doc.font('metropolisMedium');
            let h = 0;

            h = Math.max(h, doc.heightOfString(title, { align: 'left', width: maxWidth, lineGap: gap }))
            if (!calcHeight) {
                doc.text(title, x, y + height, { align: 'left', width: maxWidth, lineGap: gap })
            }

            doc.fillColor(colorGray);
            doc.font('metropolisMedium');

            const t = text.replaceAll(" ", " ")

            h = Math.max(h, doc.heightOfString(t, { align: 'left', width: width - maxWidth - 5*mm, lineGap: gap }))
            if (!calcHeight) {
                doc.text(t, x + maxWidth + 5*mm, y + height, { align: 'left', width: width - maxWidth - 5*mm, lineGap: gap })
            }
            height += h + gap
        }

        return height
    }



    async createPDF(contacts = false, steekkaart = false) {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.errorBox = null;

        try {
            await this.newCreatePDF(contacts, steekkaart)
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
