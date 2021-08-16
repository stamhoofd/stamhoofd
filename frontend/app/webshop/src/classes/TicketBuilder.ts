/* eslint-disable no-irregular-whitespace */
import { Organization, TicketPublic, Webshop } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
// PDFKit is used! Wrong warning below!
import PDFKit from "pdfkit"
import QRCode from "qrcode"

import PDFDocument from '../pdfkit.standalone';

// 1 mm
const MM = 2.834666666666667
const COLOR_PRIMARY = "#0053ff"
const COLOR_DARK = "#000716"
const COLOR_GRAY = "#5e5e5e";
const COLOR_BORDER = "#868686";

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89

const ITEM_MARGIN = 5*MM

const PAGE_MARGIN = 16*MM

const END_MAX_Y = 567; // End of page line for last page
const MAX_Y = PAGE_HEIGHT - 24*MM

export class TicketBuilder {
    tickets: TicketPublic[]
    webshop: Webshop
    organization: Organization

    document: PDFKit.PDFDocument

    private dataBuffer: any[] = []

    constructor(tickets: TicketPublic[], webshop: Webshop, organization: Organization) {
        this.tickets = tickets
        this.webshop = webshop
        this.organization = organization
        this.document = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: PAGE_MARGIN});
    }

    async download() {

        const metropolisMedium = (await import('!!arraybuffer-loader!@stamhoofd/assets/fonts/Metropolis/WOFF2/Metropolis-Medium.woff2')).default
        const metropolisBold = (await import('!!arraybuffer-loader!@stamhoofd/assets/fonts/Metropolis/WOFF2/Metropolis-SemiBold.woff2')).default

        const buffer = await new Promise<Buffer>((resolve, reject) => {
            try {
                this.dataBuffer = [];
                this.document.on('data', (d) => { this.dataBuffer.push(d); });
                this.document.on('end', () => {
                    const buf = Buffer.concat(this.dataBuffer);
                    resolve(buf)
                });

                this.document.registerFont('Metropolis-SemiBold', metropolisBold);
                this.document.registerFont('Metropolis-Medium', metropolisMedium);

                // Initiate building
                this.drawItems().then(() => {
                    this.document.end()
                }).catch((e) => {
                    reject(e)
                })
            } catch (e) {
                reject(e)
            }
        });

        const blob = new Blob([buffer], {type: "application/pdf"});
        const link = document.createElement('a');
        const href = window.URL.createObjectURL(blob);
        link.href = href        

        const fileName = (this.tickets.length == 1 ? Formatter.fileSlug(this.tickets[0].getTitle() + (this.tickets[0].getIndexText() ? (" "+this.tickets[0].getIndexText()): "")) : Formatter.fileSlug("Tickets "+this.webshop.meta.name)) + ".pdf";
        link.download = fileName;
        link.click();
    }

    async drawItems() {
        let isFirst = true
        for (const ticket of this.tickets) {
            const remainingHeight = PAGE_HEIGHT - this.document.y - PAGE_MARGIN + (isFirst ? 10*MM : 0)
            const neededHeight = await this.drawItem(ticket, true)

            if (neededHeight > remainingHeight) {
                this.document.addPage()
                this.document.moveTo(PAGE_MARGIN, PAGE_MARGIN)
                isFirst = true
            } else {
                if (!isFirst) {
                    this.document.y += 10*MM
                    this.document.save()

                    // Draw line
                    this.document.lineWidth(1);
                    this.document.strokeColor(COLOR_DARK);
                    this.document.lineCap('round').moveTo(0, this.document.y - 5*MM).lineTo(PAGE_MARGIN - 5, this.document.y - 5*MM).dash(5, { space: 4 }).stroke()   

                    this.document.lineCap('round').moveTo(PAGE_MARGIN + 12 + 5, this.document.y - 5*MM).lineTo(PAGE_WIDTH, this.document.y - 5*MM).dash(5, { space: 4 }).stroke()
                    
                    this.document.translate(PAGE_MARGIN, this.document.y - 5*MM - 5)
                    this.document.path("M1.5 2.5C1.5 1.94772 1.94772 1.5 2.5 1.5C3.05228 1.5 3.5 1.94772 3.5 2.5C3.5 3.05228 3.05228 3.5 2.5 3.5C1.94772 3.5 1.5 3.05228 1.5 2.5ZM2.5 0.5C1.39543 0.5 0.5 1.39543 0.5 2.5C0.5 3.60457 1.39543 4.5 2.5 4.5C2.81987 4.5 3.1222 4.42491 3.39033 4.29139L4.81676 4.95654L3.29712 5.66516C3.05289 5.55891 2.78333 5.5 2.5 5.5C1.39543 5.5 0.5 6.39543 0.5 7.5C0.5 8.60457 1.39543 9.5 2.5 9.5C3.60457 9.5 4.5 8.60457 4.5 7.5C4.5 7.23871 4.44989 6.98912 4.35876 6.76032C4.39438 6.44286 4.59265 6.16442 4.88508 6.02806L5.99986 5.50823L9.79731 7.27901C10.5481 7.62912 11.4406 7.30429 11.7907 6.55348L8.36606 4.95654L11.7907 3.35961C11.4406 2.6088 10.5481 2.28397 9.79731 2.63407L5.99986 4.40485L4.88508 3.88503C4.6122 3.75778 4.42131 3.50682 4.36807 3.21588C4.4533 2.99361 4.5 2.75226 4.5 2.5C4.5 1.39543 3.60457 0.5 2.5 0.5ZM1.5 7.5C1.5 6.94772 1.94772 6.5 2.5 6.5C3.05228 6.5 3.5 6.94772 3.5 7.5C3.5 8.05228 3.05228 8.5 2.5 8.5C1.94772 8.5 1.5 8.05228 1.5 7.5Z").fill(COLOR_DARK)
                    
                    this.document.restore()
                }
                isFirst = false
            }
            await this.drawItem(ticket, false)
        }
    }

    async drawItem(ticket: TicketPublic, dryRun: boolean) {
        let height = 5 * MM // Initial margin
        const y = this.document.y

        // Title
        this.document.fontSize(8);
        this.document.fillColor(this.organization.meta.color ?? COLOR_PRIMARY);
        this.document.font('Metropolis-SemiBold');

        if (!dryRun) {
            this.document.text(this.webshop.meta.name.toLocaleUpperCase(), PAGE_MARGIN, y + height, { align: 'left' })
        }
        height += this.document.heightOfString(this.webshop.meta.name.toLocaleUpperCase(), { align: 'left' })
        height += 3

        this.document.fontSize(17);
        this.document.fillColor(COLOR_DARK);
        
        if (!dryRun) {
            this.document.text(ticket.getTitle(), PAGE_MARGIN, y + height, { align: 'left' })
        }
        height += this.document.heightOfString(ticket.getTitle(), { align: 'left' })

        // Margin
        height += 5*MM

        // Draw horizontal line
        if (!dryRun) {
            this.document.lineWidth(0.5);
            this.document.strokeColor(COLOR_BORDER);
            this.document.moveTo(0, y + height).lineTo(PAGE_WIDTH, y + height).stroke()   
        }
        height += 0.5

        // Save height
        const initialColumnHeight = height
        let MAX_COLUMN_HEIGHT = 0
        
        const QR_WIDTH = 30*MM
        const QR_MARGIN = 5*MM
        const QR_COLUMN_WIDTH = QR_WIDTH + QR_MARGIN
        const COLUMN_MAX_WIDTH = (PAGE_WIDTH - PAGE_MARGIN*2 - QR_COLUMN_WIDTH - 2) / 2

        // START LEFT COLUMN
        // Draw left text
       
        height += 5*MM
        this.document.fontSize(8);
        this.document.font('Metropolis-Medium');

        const location = ticket.items[0].product.location
        if (location) {
            if (!dryRun) {
                this.document.text(location.name+"\n"+location.address, PAGE_MARGIN, y + height, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM , lineGap: 2, paragraphGap: 2 })
            }
            height += this.document.heightOfString(location.name+"\n"+location.address, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM, lineGap: 2, paragraphGap: 2 })
        }

        const dateRange = ticket.items[0].product.dateRange
        if (dateRange) {
            const str = Formatter.capitalizeFirstLetter(dateRange.toString())
            if (!dryRun) {
                this.document.text(str, PAGE_MARGIN, y + height, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM })
            }
            height += this.document.heightOfString(str, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM })
            height += 2
        }

        if (!dryRun) {
            this.document.text(Formatter.price(ticket.items[0].unitPrice ?? 0).replace(/ /g, " ").replace(/,00/g, ""), PAGE_MARGIN, y + height, { align: 'left', width: COLUMN_MAX_WIDTH - 5*MM })
        }
        height += this.document.heightOfString(Formatter.price(ticket.items[0].unitPrice ?? 0).replace(/ /g, " ").replace(/,00/g, ""), { align: 'left', width: COLUMN_MAX_WIDTH - 5*MM })
        height += 5*MM

        // END LEFT COLUMN
        MAX_COLUMN_HEIGHT = height - initialColumnHeight

        // SECOND COLUMN
        if (ticket.items[0].description) {
            // Second column
            height = initialColumnHeight
            height += 5*MM

            if (!dryRun) {
                this.document.text(ticket.items[0].description, PAGE_MARGIN + COLUMN_MAX_WIDTH + 5*MM, y + height, { align: 'left', width: COLUMN_MAX_WIDTH - 10*MM, lineGap: 2, paragraphGap: 2 })
            }
            height += this.document.heightOfString(ticket.items[0].description, { align: 'left', width: COLUMN_MAX_WIDTH - 10*MM, lineGap: 2, paragraphGap: 2 })
            height += 5*MM

            MAX_COLUMN_HEIGHT = Math.max(height - initialColumnHeight, MAX_COLUMN_HEIGHT)
        }

        // END SECOND COLUMN

        // QR CODE COLUMN
        height = initialColumnHeight
        height += QR_MARGIN

        const x = PAGE_WIDTH - PAGE_MARGIN - QR_COLUMN_WIDTH
        if (!dryRun) {
            //this.document.rect(x + QR_MARGIN, y + height, QR_WIDTH, QR_WIDTH).fill(COLOR_GRAY)

            // Generate QR
            const url = "https://"+this.webshop.getUrl(this.organization) + "/tickets/"+ticket.secret
            const imgUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 0, width: QR_WIDTH*2, height: QR_WIDTH*2 })
            this.document.image(imgUrl, x + QR_MARGIN, y + height, {
                width: QR_WIDTH,
                height: QR_WIDTH
            })
        }
        height += QR_WIDTH
        
        this.document.fontSize(6);
        this.document.fillColor(COLOR_GRAY);

        if (!dryRun) {
            this.document.text(ticket.secret, x + QR_MARGIN, y + height + 2*MM, { align: 'center', width: QR_WIDTH })
        }
        // ignore text height here
        height += 2*MM
        height += QR_MARGIN
        
        MAX_COLUMN_HEIGHT = Math.max(height - initialColumnHeight, MAX_COLUMN_HEIGHT)

        // END QR CODE COLUMN

        // End of columns
        height = initialColumnHeight + MAX_COLUMN_HEIGHT

        // Draw vertical lines
        if (!dryRun) {
            this.document.lineWidth(0.5);
            this.document.strokeColor(COLOR_BORDER);
            this.document.moveTo(PAGE_WIDTH - PAGE_MARGIN - QR_COLUMN_WIDTH, y + initialColumnHeight - 1).lineTo(PAGE_WIDTH - PAGE_MARGIN - QR_COLUMN_WIDTH, y + height).stroke()   
        }

        // Draw vertical lines
        if (!dryRun && ticket.items[0].description) {
            this.document.lineWidth(0.5);
            this.document.strokeColor(COLOR_BORDER);
            this.document.moveTo(PAGE_MARGIN + COLUMN_MAX_WIDTH, y + initialColumnHeight - 1).lineTo(PAGE_MARGIN + COLUMN_MAX_WIDTH, y + height).stroke()   
        }

        // Draw horizontal line
        if (!dryRun) {
            this.document.lineWidth(0.5);
            this.document.strokeColor(COLOR_BORDER);
            this.document.moveTo(0, y + height).lineTo(PAGE_WIDTH, y + height).stroke()   
        }
        height += 0.5
        height += 5*MM

        // Share and download text
        this.document.fontSize(8);
        this.document.font('Metropolis-Medium');
        this.document.fillColor(COLOR_GRAY);

        const shareText = "Scan de QR-code om op te slaan op jouw smartphone of om te delen.\nTicketverkoop via Stamhoofd. Software voor verenigingen."
        const expectedHeight = this.document.heightOfString(shareText, { align: 'left', width: PAGE_WIDTH - PAGE_MARGIN*2, lineGap: 2, paragraphGap: 2 }) - 2
        if (!dryRun) {
            const badgeWidth = (PAGE_WIDTH - PAGE_MARGIN*2) * 3/7
            const appleWalletWidth = badgeWidth / 3
            const badgesHeight = appleWalletWidth*0.308
            const gpWidth = badgesHeight/0.153

            this.document.text("Scan de QR-code om op te slaan op jouw smartphone of om te delen.\nTicketverkoop via ", PAGE_MARGIN, y + height, { align: 'left', width: PAGE_WIDTH - PAGE_MARGIN*2 - badgeWidth - 4*MM , lineGap: 2, paragraphGap: 2, continued: true })
            this.document.font('Metropolis-SemiBold');
            this.document.fillColor(COLOR_PRIMARY);
            this.document.text("Stamhoofd", { continued: true, link: 'https://www.stamhoofd.be', })
            
            this.document.font('Metropolis-Medium');
            this.document.fillColor(COLOR_GRAY);
            this.document.text(". Software voor verenigingen.")

            const appleWallet = (await import('!!arraybuffer-loader!@stamhoofd/assets/images/badges/apple-wallet-nl.png')).default
            const googlePayPass = (await import('!!arraybuffer-loader!@stamhoofd/assets/images/badges/google-pay-pass-nl.png')).default

            this.document.image(appleWallet,   PAGE_WIDTH - PAGE_MARGIN - appleWalletWidth,  y + height + expectedHeight/2 - badgesHeight/2, { width: appleWalletWidth })
            this.document.image(googlePayPass, PAGE_WIDTH - PAGE_MARGIN - badgeWidth - 2*MM, y + height + expectedHeight/2 - badgesHeight/2, { width: gpWidth })

            this.document.link(PAGE_WIDTH - PAGE_MARGIN - appleWalletWidth,  y + height + expectedHeight/2 - badgesHeight/2, appleWalletWidth, badgesHeight, "https://api.stamhoofd.app/tickets/download/apple/"+ticket.secret)
            this.document.link(PAGE_WIDTH - PAGE_MARGIN - badgeWidth - 2*MM, y + height + expectedHeight/2 - badgesHeight/2, gpWidth, badgesHeight, "https://api.stamhoofd.app/tickets/download/google/"+ticket.secret)
        }
        height += expectedHeight + 2


        // Add end margin
        height += 5*MM

        return height
    }
    

    
}