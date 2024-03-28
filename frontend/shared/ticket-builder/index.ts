/* eslint-disable no-irregular-whitespace */
import metropolisMediumUrl from '@stamhoofd/assets/fonts/Metropolis/WOFF2/Metropolis-Medium.woff2'
import metropolisBoldUrl from '@stamhoofd/assets/fonts/Metropolis/WOFF2/Metropolis-SemiBold.woff2'
import { I18nController } from "@stamhoofd/frontend-i18n";
import { AppManager } from '@stamhoofd/networking';
import { Order, Organization, Sponsor, TicketPublic, Webshop, WebshopOnSiteMethod, WebshopPreview, WebshopTakeoutMethod, WebshopTicketType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
// PDFKit is used! Wrong warning below!
//import PDFKit from "pdfkit"
import QRCode from "qrcode"

import PDFDocument from './pdfkit.standalone';

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

    /**
     * Optional
     */
    order?: Order

    webshop: WebshopPreview | Webshop
    organization: Organization

    document: PDFDocument

    private dataBuffer: any[] = []

    constructor(tickets: TicketPublic[], webshop: WebshopPreview | Webshop, organization: Organization, order?: Order) {
        this.tickets = tickets
        this.webshop = webshop
        this.organization = organization
        this.order = order
        this.document = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: PAGE_MARGIN});
    }

    get primaryColor() {
        return this.webshop.meta.color ?? this.organization.meta.color ?? COLOR_PRIMARY
    }

    async download() {
        console.log("Download tickets...")

        const metropolisMedium = await(await fetch(metropolisMediumUrl)).arrayBuffer()
        const metropolisBold = await(await fetch(metropolisBoldUrl)).arrayBuffer()

        console.log(metropolisMedium)

        const buffer = await new Promise<Buffer>((resolve, reject) => {
            try {
                this.dataBuffer = [];
                this.document.on('data', (d) => { this.dataBuffer.push(d); });
                this.document.on('end', () => {
                    const buf = Buffer.concat(this.dataBuffer);
                    resolve(buf)
                });

                this.document.registerFont('Metropolis-SemiBold',  metropolisBold);
                this.document.registerFont('Metropolis-Medium',  metropolisMedium);

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

        const fileName = (this.tickets.length == 1 ? Formatter.fileSlug(this.tickets[0].getTitle() + (this.tickets[0].getIndexText() ? (" "+this.tickets[0].getIndexText()): "")) : Formatter.fileSlug("Tickets "+this.webshop.meta.name)) + ".pdf";

        if (AppManager.shared.downloadFile) {
            const data = buffer.toString('base64')
            await AppManager.shared.downloadFile(data, fileName)
        } else {
            const blob = new Blob([buffer], {type: "application/pdf"});
            const link = document.createElement('a');
            const href = window.URL.createObjectURL(blob);
            link.href = href        
            link.download = fileName;
            link.click();
        }
    }

    async drawItems() {
        let isFirst = true
        for (const ticket of this.tickets) {
            if (!ticket.isValid) {
                continue
            }
            const remainingHeight = PAGE_HEIGHT - this.document.y - PAGE_MARGIN + (isFirst ? 10*MM : 0)
            const neededHeight = await this.drawItem(ticket, true)

            if (neededHeight > remainingHeight) {
                this.document.addPage()
                this.document.moveTo(PAGE_MARGIN, PAGE_MARGIN)
                isFirst = true
            }
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

                // Add extra margin
                this.document.y += 5*MM
            }
            isFirst = false
            this.document.y = this.document.y + await this.drawItem(ticket, false)
        }
    }

    async drawItem(ticket: TicketPublic, dryRun: boolean) {
        const QR_WIDTH = 50*MM
        const QR_MARGIN = 5*MM
        const QR_COLUMN_WIDTH = QR_WIDTH + QR_MARGIN
        const COLUMN_MAX_WIDTH = (PAGE_WIDTH - PAGE_MARGIN*2 - QR_COLUMN_WIDTH) / 2

        let height = 10 * MM // Initial QR margin
        const y = this.document.y

        const x = PAGE_WIDTH - PAGE_MARGIN - QR_COLUMN_WIDTH
        if (!dryRun) {
            // Generate QR
            const url = "https://"+this.webshop.getUrl(this.organization) + "/tickets/"+ticket.secret
            const imgUrl = await QRCode.toDataURL(url, { margin: 0, width: QR_WIDTH*2, height: QR_WIDTH*2 })
            this.document.image(imgUrl, x + QR_MARGIN, y + height, {
                width: QR_WIDTH,
                height: QR_WIDTH
            })
            this.document.link(x + QR_MARGIN, y + height, QR_WIDTH, QR_WIDTH, url)
        }
        height += QR_WIDTH + 2*MM
        
        this.document.fontSize(6);
        this.document.fillColor(COLOR_GRAY);

        if (!dryRun) {
            this.document.text(ticket.secret, x + QR_MARGIN, y + height, { align: 'center', width: QR_WIDTH })
        }
        height += 2; // Height of text
        console.log('qrheight', height)
        const qrHeight = height 
        
        height = 0

        // Logo
        const logo = (this.webshop.meta.useLogo ? (this.webshop.meta.horizontalLogo ?? this.webshop.meta.squareLogo) : null) ?? (this.organization.meta.horizontalLogo ?? this.organization.meta.squareLogo)
        const expandLogo = this.webshop.meta.useLogo ? this.webshop.meta.expandLogo : this.organization.meta.expandLogo

        if (logo) {
            const DPI = 300;

            let preferredWidth = 50*MM; // = Postscript points = 72dpi = 1 point = 1/72 of an inch
            let preferredMaxHeight = 10*MM;

            if (expandLogo) {
                preferredMaxHeight = 20*MM;
            }
            const preferredWidthInPixels = preferredWidth / 72 * DPI;
            const resolution = logo.getResolutionForSize(preferredWidthInPixels, undefined)

            let calculatedHeight = preferredWidth / resolution.width * resolution.height

            // Adjust width based on available height
            if (calculatedHeight > preferredMaxHeight) {
                calculatedHeight = preferredMaxHeight
                preferredWidth = calculatedHeight / resolution.height * resolution.width;
            }

            if (!dryRun) {
                // Download image
                const imgResponse = await fetch(resolution.file.getPublicPath(), {
                    credentials: 'omit',
                    cache: 'force-cache'
                })
                const imgBuffer = await imgResponse.arrayBuffer()                
                this.document.image(imgBuffer, PAGE_MARGIN, y + height, {
                    width: preferredWidth,
                    height: calculatedHeight
                })
                const webshopUrl = 'https://'+this.webshop.getUrl(this.organization);
                this.document.link(PAGE_MARGIN, y + height, preferredWidth, calculatedHeight, webshopUrl)
            }

            height += calculatedHeight
            height += 7.5*MM;
        } else {
            height += 5 * MM // Initial margin
        }

        const repeatWebshopName = !this.webshop.meta.useLogo || !this.webshop.meta.horizontalLogo;

        // Title
        this.document.fontSize(8);
        this.document.fillColor(this.primaryColor);
        this.document.font('Metropolis-SemiBold');

        if (!dryRun) {
            if (repeatWebshopName) {
                this.document.text(this.webshop.meta.name.toLocaleUpperCase(), PAGE_MARGIN, y + height, { align: 'left', width: PAGE_WIDTH - PAGE_MARGIN*2 - 40*MM, lineGap: 2, paragraphGap: 2 })
            }

            const indexText = ticket.getIndexText()
            if (indexText) {
                this.document.text(indexText.toLocaleUpperCase(), PAGE_WIDTH - PAGE_MARGIN  - 40*MM, y, { align: "right", width: 40*MM })
            }
        }
        if (repeatWebshopName) {
            height += this.document.heightOfString(this.webshop.meta.name.toLocaleUpperCase(), { align: 'left', width: PAGE_WIDTH - PAGE_MARGIN*2 - 40*MM, lineGap: 2, paragraphGap: 2 }) - 2
            height += 3
        }

        this.document.fontSize(17);
        this.document.fillColor(COLOR_DARK);
        
        if (!dryRun) {
            this.document.text(ticket.getTitle(), PAGE_MARGIN, y + height, { align: 'left', width: PAGE_WIDTH - PAGE_MARGIN*2, lineGap: 2, paragraphGap: 2 })
        }
        height += this.document.heightOfString(ticket.getTitle(), { align: 'left', width: PAGE_WIDTH - PAGE_MARGIN*2, lineGap: 2, paragraphGap: 2 }) - 2

        // Margin
        height += 5*MM

        // Save height
        const initialColumnHeight = height
        let MAX_COLUMN_HEIGHT = 0
        
        // START LEFT COLUMN
        // Draw left text
        this.document.fontSize(8);
        this.document.font('Metropolis-Medium');

        if (this.webshop.meta.ticketType === WebshopTicketType.Tickets || !this.order) {
            if (ticket.items[0]) {
                const location = ticket.items[0].product.location
                if (location) {
                    if (!dryRun) {
                        this.document.text(location.name+(location.address ? "\n"+location.address : ""), PAGE_MARGIN, y + height, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM , lineGap: 2, paragraphGap: 2 })
                    }
                    height += this.document.heightOfString(location.name+(location.address ? "\n"+location.address : ""), { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM, lineGap: 2, paragraphGap: 2 })
                }

                const dateRange = ticket.items[0].product.dateRange
                if (dateRange) {
                    const str = Formatter.capitalizeFirstLetter(dateRange.toString())
                    if (!dryRun) {
                        this.document.text(str, PAGE_MARGIN, y + height, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM, lineGap: 2, paragraphGap: 2 })
                    }
                    height += this.document.heightOfString(str, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM, lineGap: 2, paragraphGap: 2 })
                }
            }
        } else {
            if (!dryRun) {
                this.document.text("Bestelling #"+this.order.number, PAGE_MARGIN, y + height, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM , lineGap: 2, paragraphGap: 2 })
            }
            height += this.document.heightOfString("Bestelling #"+this.order.number, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM, lineGap: 2, paragraphGap: 2 })

            if (!dryRun) {
                this.document.text(this.order.data.customer.name, PAGE_MARGIN, y + height, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM , lineGap: 2, paragraphGap: 2 })
            }
            height += this.document.heightOfString(this.order.data.customer.name, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM, lineGap: 2, paragraphGap: 2 })

            const checkoutMethod = this.order.data.checkoutMethod
            if (checkoutMethod) {
                let str = checkoutMethod.name
                if (checkoutMethod instanceof WebshopTakeoutMethod || checkoutMethod instanceof WebshopOnSiteMethod) {
                    str += "\n"+checkoutMethod.address
                }
                if (!dryRun) {
                    this.document.text(str, PAGE_MARGIN, y + height, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM , lineGap: 2, paragraphGap: 2 })
                }
                height += this.document.heightOfString(str, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM, lineGap: 2, paragraphGap: 2 })
            }

            const timeSlot = this.order.data.timeSlot
            if (timeSlot) {
                const str = Formatter.capitalizeFirstLetter(timeSlot.toString())
                if (!dryRun) {
                    this.document.text(str, PAGE_MARGIN, y + height, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM , lineGap: 2, paragraphGap: 2 })
                }
                height += this.document.heightOfString(str, { align: 'left', width: COLUMN_MAX_WIDTH  - 5*MM, lineGap: 2, paragraphGap: 2 })
            }
        }

        const price = ticket.getPrice(this.order)
        if (!dryRun) {
            this.document.text(Formatter.price(price).replace(/ /g, " ").replace(/,00/g, ""), PAGE_MARGIN, y + height, { align: 'left', width: COLUMN_MAX_WIDTH - 5*MM })
        }
        height += this.document.heightOfString(Formatter.price(price).replace(/ /g, " ").replace(/,00/g, ""), { align: 'left', width: COLUMN_MAX_WIDTH - 5*MM })

        // END LEFT COLUMN
        MAX_COLUMN_HEIGHT = height - initialColumnHeight

        // SECOND COLUMN
        let description = ticket.items.map(item => (ticket.isSingle ? '' : item.amount+"x "+item.product.name)+(item.descriptionWithoutDate ? ((!ticket.isSingle ? "\n" : '')+item.descriptionWithoutDate) : "")).join("\n")

        // Index description
        const indexDescription = ticket.getIndexDescription(this.webshop)
        if (indexDescription.length > 0) {
            if (description) {
                description += "\n"
            }
            description += indexDescription.map(d => d.title+": "+d.value).join("\n")
        }

        if (description) {
            // Second column
            height = initialColumnHeight

            if (!dryRun) {
                this.document.text(description, PAGE_MARGIN + COLUMN_MAX_WIDTH + 5*MM, y + height, { align: 'left', width: COLUMN_MAX_WIDTH - 5*MM, lineGap: 2, paragraphGap: 2 })
            }
            height += this.document.heightOfString(description, { align: 'left', width: COLUMN_MAX_WIDTH - 5*MM, lineGap: 2, paragraphGap: 2 })

            MAX_COLUMN_HEIGHT = Math.max(height - initialColumnHeight, MAX_COLUMN_HEIGHT)
        }

        // END COLUMN

        // End of columns
        height = initialColumnHeight + MAX_COLUMN_HEIGHT
      
        height += 5*MM

        // Sponsors
        const sponsors = (this.webshop.meta.sponsors?.sponsors ?? []).filter(s => s.onTickets && (s.banner||s.logo))
        if (sponsors.length > 0) {
            height += 15*MM
             
            const DPI = 300;

            let currentSponsorMaxHeight = 0;
            let sponsorX = PAGE_MARGIN
            const sponsorMarginX = 7.5*MM;
            const sponsorMarginY = 5*MM;
            const maximumSponsorX = PAGE_WIDTH - PAGE_MARGIN - QR_COLUMN_WIDTH;
            const remainingSponsors = sponsors.slice();

            const calculateNextLineMaxHeight = (remainingSponsors: Sponsor[]) => {
                let xx = PAGE_MARGIN
                let current = 0

                for (const sponsor of remainingSponsors) {
                    if (!sponsor.logo && !sponsor.banner) {
                        continue;
                    }

                    let preferredWidth = 35*MM; // = Postscript points = 72dpi = 1 point = 1/72 of an inch
                    let preferredMaxHeight = 10*MM;

                    if (!sponsor.logo) {
                        // Banners are allowed to be a bit larger
                        preferredMaxHeight = 25*MM;
                        preferredWidth = 50*MM;
                    }

                    if (sponsors.length === 1) {
                        preferredWidth += 20*MM;
                        preferredMaxHeight += 10*MM;
                    }

                    const preferredWidthInPixels = preferredWidth / 72 * DPI;
                    const resolution = (sponsor.logo || sponsor.banner)!.getResolutionForSize(preferredWidthInPixels, undefined)

                    let calculatedHeight = preferredWidth / resolution.width * resolution.height

                    // Adjust width based on available height
                    if (calculatedHeight > preferredMaxHeight) {
                        calculatedHeight = preferredMaxHeight
                        preferredWidth = calculatedHeight / resolution.height * resolution.width;
                    }

                    if (xx + preferredWidth > maximumSponsorX) {
                        return current;
                    }

                    xx += preferredWidth + sponsorMarginX

                    if (calculatedHeight > current) {
                        current = calculatedHeight
                    }
                }
                return current;
            }

            let currentHeightExpectedHeight = calculateNextLineMaxHeight(remainingSponsors);

            while (remainingSponsors.length) {
                const sponsor = remainingSponsors.shift();

                if (!sponsor) {
                    break;
                }

                if (!sponsor.logo && !sponsor.banner) {
                    continue;
                }

                let preferredWidth = 35*MM; // = Postscript points = 72dpi = 1 point = 1/72 of an inch
                let preferredMaxHeight = 10*MM;

                if (!sponsor.logo) {
                    // Banners are allowed to be a bit larger
                    preferredMaxHeight = 25*MM;
                    preferredWidth = 50*MM;
                }

                if (sponsors.length === 1) {
                    preferredWidth += 20*MM;
                    preferredMaxHeight += 10*MM;
                }

                const preferredWidthInPixels = preferredWidth / 72 * DPI;
                const resolution = (sponsor.logo || sponsor.banner)!.getResolutionForSize(preferredWidthInPixels, undefined)

                let calculatedHeight = preferredWidth / resolution.width * resolution.height

                // Adjust width based on available height
                if (calculatedHeight > preferredMaxHeight) {
                    calculatedHeight = preferredMaxHeight
                    preferredWidth = calculatedHeight / resolution.height * resolution.width;
                }

                if (sponsorX + preferredWidth > maximumSponsorX) {
                    height += currentSponsorMaxHeight;
                    height += sponsorMarginY

                    // Next sponsor line
                    currentSponsorMaxHeight = 0;
                    sponsorX = PAGE_MARGIN;
                    currentHeightExpectedHeight = calculateNextLineMaxHeight([sponsor, ...remainingSponsors]);
                }


                if (!dryRun) {
                    // Download image
                    const imgResponse = await fetch(resolution.file.getPublicPath(), {
                        credentials: 'omit',
                        cache: 'force-cache'
                    })
                    const imgBuffer = await imgResponse.arrayBuffer()                
                    this.document.image(imgBuffer, sponsorX, y + height + currentHeightExpectedHeight/2 - calculatedHeight/2, {
                        width: preferredWidth,
                        height: calculatedHeight
                    });

                    if (sponsor.url) {
                        this.document.link(sponsorX,  y + height, preferredWidth, calculatedHeight, sponsor.url)
                    }
                }

                sponsorX += preferredWidth + sponsorMarginX

                if (calculatedHeight > currentSponsorMaxHeight) {
                    currentSponsorMaxHeight = calculatedHeight
                }
            }

            height += currentSponsorMaxHeight
            height += 7.5*MM;
        }

        // Share and download text
        this.document.fontSize(8);
        this.document.font('Metropolis-Medium');
        this.document.fillColor(COLOR_GRAY);

        const shareText = "Ticketverkoop via Stamhoofd"
        const expectedHeight = this.document.heightOfString(shareText, { align: 'left', width: PAGE_WIDTH - PAGE_MARGIN*2, lineGap: 2, paragraphGap: 2 }) - 2
        height = Math.max(height, qrHeight - expectedHeight)

        if (!dryRun) {
            this.document.text("Ticketverkoop via ", PAGE_MARGIN, y + height, { align: 'left', width: PAGE_WIDTH - PAGE_MARGIN*2 , lineGap: 2, paragraphGap: 2, continued: true })
            this.document.font('Metropolis-SemiBold');
            this.document.fillColor(COLOR_PRIMARY);
            this.document.text("Stamhoofd", { continued: true, link: 'https://'+I18nController.i18n.t("shared.domains.marketing"), })
        }

        height += expectedHeight + 2

        height = Math.max(height, qrHeight)

        // Add end margin
        height += 5*MM

        return height
    }  
}