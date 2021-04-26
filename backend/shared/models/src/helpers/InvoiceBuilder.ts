import { SimpleError } from "@simonbackx/simple-errors";
import { File, STInvoiceItem } from "@stamhoofd/structures";
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from "uuid";
import AWS from 'aws-sdk';
import { STInvoice } from "../models/STInvoice";
import { Formatter } from "@stamhoofd/utility";

// 1 mm
const MM = 2.834666666666667
const COLOR_PRIMARY = "#0053ff"
const COLOR_DARK = "#000716"
const COLOR_GRAY_DARK = "#5e5e5e"
const COLOR_GRAY = "#868686";

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89

const ITEM_MARGIN = 5*MM

const PAGE_MARGIN = 16*MM

const END_MAX_Y = 567; // End of page line for last page
const MAX_Y = PAGE_HEIGHT - 24*MM

// Can we fit everything on one page?
const FIRST_START_Y = 100*MM;
const NORMAL_START_Y = PAGE_MARGIN;

export class InvoiceBuilder {
    invoice: STInvoice
    document: PDFKit.PDFDocument

    private remainingItems: STInvoiceItem[]

    private posY = 0
    private page = 1

    private dataBuffer: any[] = []

    constructor(invoice: STInvoice) {
        this.invoice = invoice
        this.document = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: PAGE_MARGIN});
    }

    async build() {
        if (!process.env.SPACES_BUCKET || !process.env.SPACES_ENDPOINT || !process.env.SPACES_KEY || !process.env.SPACES_SECRET) {
            throw new SimpleError({
                code: "not_available",
                message: "Uploading is not available",
                statusCode: 503
            })
        }

        
        const buffer = await new Promise<Buffer>((resolve, reject) => {
            try {
                this.dataBuffer = [];
                this.document.on('data', (d) => { this.dataBuffer.push(d); });
                this.document.on('end', () => {
                    const buf = Buffer.concat(this.dataBuffer);
                    resolve(buf)
                });

                this.document.registerFont('Metropolis-SemiBold', __dirname +'/../assets/Metropolis-SemiBold.woff2');
                this.document.registerFont('Metropolis-Medium', __dirname +'/../assets/Metropolis-Medium.woff2');

                this.remainingItems = this.invoice.meta.items.slice()

                // Initiate building
                this.drawNextPages()
                this.drawPriceFooter()
                this.document.end()
            } catch (e) {
                reject(e)
            }
        });

        const fileId = uuidv4();

        let prefix = (process.env.SPACES_PREFIX ?? "")
        if (prefix.length > 0) {
            prefix += "/"
        }
        const key = prefix + (process.env.NODE_ENV ?? "development") + "/invoices/" + fileId + ".pdf";

        const s3 = new AWS.S3({
            endpoint: process.env.SPACES_ENDPOINT,
            accessKeyId: process.env.SPACES_KEY,
            secretAccessKey: process.env.SPACES_SECRET
        });

        const params = {
            Bucket: process.env.SPACES_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: 'application/pdf',
            ACL: "public-read"
        };

        await s3.putObject(params).promise()

        return new File({
            id: fileId,
            server: "https://"+process.env.SPACES_BUCKET+"."+process.env.SPACES_ENDPOINT,
            path: key,
            size: buffer.byteLength,
            name: "Invoice "+this.invoice.id
        });
    }

    private writeHeader() {
        const logoX = 16
        const logoY = 17
        const logoHeight = 13

        this.document.image(__dirname + '/../assets/logo.png', (logoX - 1) * MM, logoY * MM, { height: logoHeight * MM })

        
        this.posY = 44

        // Invoice number
        this.document.fontSize(4.24 * MM);
        this.document.fillColor(COLOR_DARK);
        this.document.font('Metropolis-SemiBold')

        this.document.text("Factuur", logoX * MM, this.posY * MM, { align: 'left' })

        this.document.fillColor(COLOR_PRIMARY);
        this.document.text(this.invoice.number! + "", 43 * MM, this.posY * MM, { align: 'left' })


        this.posY = 53
        this.document.fontSize(3 * MM);
        this.document.fillColor(COLOR_GRAY_DARK);
        this.document.font('Metropolis-Medium')

        this.document.text("Datum", logoX * MM, this.posY * MM, { align: 'left' })
        this.document.text(Formatter.date(this.invoice.meta.date!, true), 43 * MM, this.posY * MM, { align: 'left' })

        this.document.moveDown()
        const savedY = this.document.y
        this.document.text("Vervaldatum", logoX * MM, savedY, { align: 'left' })
        this.document.text(Formatter.date(this.invoice.meta.date!, true), 43 * MM, savedY, { align: 'left' })

        // Write Codawood BV
        const x = 120
        const y = 21

        this.document.fontSize(4.24 * MM);
        this.document.fillColor(COLOR_DARK);
        this.document.font('Metropolis-SemiBold')

        this.document.text("Codawood BV", x * MM, y * MM, { align: 'left' })

        this.document.fontSize(3 * MM);
        this.document.fillColor(COLOR_GRAY_DARK);
        this.document.font('Metropolis-Medium')

        this.document.text("Markt 14 bus 11, Wetteren, België\nBE0747.832.683", x * MM,  this.document.y + 4*MM, { align: 'left', width: 72 * MM, lineGap: 2*MM })

        // Write customer

        this.document.fontSize(4.24 * MM);
        this.document.fillColor(COLOR_DARK);
        this.document.font('Metropolis-SemiBold')

        this.document.text("Factuur voor", x * MM, this.document.y + 10*MM, { align: 'left' })

        this.document.fontSize(3 * MM);
        this.document.fillColor(COLOR_GRAY_DARK);
        this.document.font('Metropolis-Medium')

        this.document.text(this.invoice.meta.companyName+"\n"+this.invoice.meta.companyAddress.toString()+ (this.invoice.meta.companyVATNumber ? ("\n"+this.invoice.meta.companyVATNumber) : ""), x * MM,  this.document.y + 4*MM, { align: 'left', width: 72 * MM, lineGap: 2*MM })

    }

    drawSinglePageShape() {
        let grad = this.document.linearGradient(0, 0, 0, PAGE_HEIGHT);
        grad.stop(0, COLOR_PRIMARY, 0.05)
        grad.stop(1, COLOR_PRIMARY, 0.0125)
        this.document.path("M77.7712 218.083L171.619 235.042C243.199 247.977 296.942 170.932 260.082 108.224C227.956 53.5718 264.75 -15.7544 328.017 -19.7785L448.398 -27.4352C464.702 -28.4722 480.75 -32.0117 495.978 -37.9294L675 -107.5L620.736 657.908C632.149 683.877 636.326 712.954 632.019 741.981L599 964.5L620.736 657.908C610.866 635.452 595.586 615.319 575.701 599.553C517.911 553.731 435.178 556.051 379.56 604.487C336.64 641.865 276.285 652.913 223.063 632.745L207.613 626.89C152.353 605.95 90.367 613.137 41.3649 646.167L-82.2193 729.468C-100.412 741.73 -124.568 726.81 -121.748 705.052L-72.9101 328.306C-63.4384 255.239 5.26735 204.981 77.7712 218.083Z").fill(grad)
    }

    drawLastPageShape() {
        let grad = this.document.linearGradient(0, 0, 0, PAGE_HEIGHT);
        grad.stop(0, COLOR_PRIMARY, 0.05)
        grad.stop(1, COLOR_PRIMARY, 0.0125)
        this.document.path("M-0.5 217.5L0 0H596L597.916 613.667L634.755 642.877C641.094 647.903 644.268 655.931 643.081 663.933C638.973 691.617 598.15 688.669 598.062 660.681L597.916 613.667L575.701 596.053C517.911 550.231 435.178 552.551 379.56 600.987C336.64 638.365 276.285 649.413 223.063 629.245L207.613 623.39C152.353 602.45 90.367 609.637 41.3649 642.667L-76.3939 722.041C-95.0939 734.646 -119.534 717.721 -114.314 695.783L-0.5 217.5Z").fill(grad)
    }

    drawFirstPageShape() {
        let grad = this.document.linearGradient(0, 0, 0, PAGE_HEIGHT);
        grad.stop(0, COLOR_PRIMARY, 0.05)
        grad.stop(1, COLOR_PRIMARY, 0.0125)
        this.document.path("M75.804 217.728L171.619 235.042C243.199 247.977 296.942 170.932 260.082 108.224C227.956 53.5718 264.75 -15.7544 328.017 -19.7785L473 -29H658L617 853.5H187.043C61.057 853.5 -56.3482 789.664 -124.84 683.922C-127.52 679.785 -128.591 674.809 -127.85 669.935L-75.5533 325.915C-64.5699 253.664 3.88734 204.732 75.804 217.728Z").fill(grad)
    }

    drawBackground() {
          // Create a linear gradient
        let grad = this.document.linearGradient(0, 0, 0, PAGE_HEIGHT);
        grad.stop(0, "#F1F6FF", 1)
        grad.stop(1, "#FFFFFF", 1)
        this.document.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(grad)
    }

    private remainingItemHeight() {
        let y = 0
        for (const item of this.remainingItems) {
            y += ITEM_MARGIN
            y += this.drawInvoiceItem(item, y, true)
            y += ITEM_MARGIN
        }

        return y
    }

    drawNextPages() {
        if (this.page == 1) {
            this.posY = FIRST_START_Y
        } else {
            this.posY = NORMAL_START_Y
        }
       
        this.drawBackground()

        if (this.remainingItemHeight() + this.posY > END_MAX_Y) {
            // No end on this page
            if (this.page === 1) {
                // First page
                this.drawFirstPageShape()

            } else {
                // Middle page
                // No background
            }
        } else {
            // Will end on this page
            if (this.page === 1) {
                // Single page
                this.drawSinglePageShape()
            } else {
                // Last page
                this.drawLastPageShape()
            }
        }

        if (this.page === 1) {
            this.posY += this.drawTableHeader(this.posY)
            this.posY += ITEM_MARGIN/2;
        }

        for (const [index, item] of this.remainingItems.entries()) {
            let h = 0
            h += ITEM_MARGIN
            h += this.drawInvoiceItem(item, this.posY, true)
            h += ITEM_MARGIN
            if (h + this.posY > MAX_Y) {
                // Remove all items that were already printed (excluding the current one)
                this.remainingItems.splice(0, index)

                // Doesn't fit on this page
                this.endPage()
                this.page++
                this.document.addPage()
                this.drawNextPages()
                return
            }

            if (index > 0) {
                // Print line
                this.document.lineWidth(1)
                this.document.lineCap('round')
                this.document.moveTo(28*MM, this.posY - 1) // We use the line gap of the last text
                .lineTo(PAGE_WIDTH, this.posY - 1)
                .strokeOpacity(0.1)
                .stroke(COLOR_DARK);
            }

            // Does fit
            this.posY += ITEM_MARGIN
            this.posY += this.drawInvoiceItem(item, this.posY, false)
            this.posY += ITEM_MARGIN

            // Todo: print line
        }

        this.endPage()

        // Todo: print pricing footer
    }

    endPage() {
        if (this.page == 1) {
            this.writeHeader()
        }

        this.drawPageFooter()
    }

    /**
     * Returns the height of the drawn item
     */
    drawInvoiceItem(item: STInvoiceItem, y: number, dryRun: boolean) {
        const x1 = PAGE_MARGIN;
        const x2 = 28*MM;
        const x4 = PAGE_WIDTH - PAGE_MARGIN - 20*MM;
        const x3 = x4 - 20*MM;


        this.document.fontSize(3.5 * MM);
        this.document.fillColor(COLOR_DARK);
        this.document.font('Metropolis-Medium')

        let height = 0
        

        if (!dryRun) {
            this.document.text(item.amount+"", x1, y, { align: 'left', width: x2 - x1 })
            this.document.text(item.name, x2, y, { align: 'left', width: x3 - x2 - 5*MM, lineGap: 2*MM  })
        }
        
        height += this.document.heightOfString(item.name, { align: 'left', width: x3 - x2 - 5*MM, lineGap: 2*MM  })

        if (item.description) {
            height += 1*MM
            this.document.fontSize(3 * MM);
            this.document.fillColor(COLOR_GRAY_DARK);
            if (!dryRun) {
                this.document.text(item.description, x2, this.document.y + 1*MM, { align: 'left', width: x3 - x2 - 5*MM, lineGap: 2*MM  })
            }
            height += this.document.heightOfString(item.description, { align: 'left', width: x3 - x2 - 5*MM, lineGap: 2*MM  })

            this.document.fillColor(COLOR_DARK);
            this.document.fontSize(3.5 * MM);
        }

        if (!dryRun) {
            this.document.text(Formatter.price(item.unitPrice).replace(/ /g, " ").replace(/,00/g, ""), x3, y, { align: 'left', width: x4 - x3 })
            this.document.text(Formatter.price(item.price).replace(/ /g, " ").replace(/,00/g, ""), x4, y, { align: 'right', width: PAGE_WIDTH - x4 - PAGE_MARGIN })
        }

        return height
    }

    drawTableHeader(y: number) {
        const x1 = PAGE_MARGIN;
        const x2 = 28*MM;
        const x4 = PAGE_WIDTH - PAGE_MARGIN - 20*MM;
        const x3 = x4 - 20*MM;

        this.document.fontSize(3.5 * MM);
        this.document.fillColor(COLOR_DARK);
        this.document.font('Metropolis-SemiBold')
        this.document.text("#", x1, y, { align: 'left', width: x2 - x1 })
        this.document.text("Omschrijving", x2, y, { align: 'left', width: x3 - x2 - 5*MM })
        this.document.text("Per stuk", x3, y, { align: 'left', width: x4 - x3 })
        this.document.text("Totaal", x4, y, { align: 'right', width: PAGE_WIDTH - x4 - PAGE_MARGIN })

        return this.document.heightOfString("Omschrijving", { align: 'left', width: x3 - x2 - 5*MM })
    }

    drawPriceFooter() {
        let y = END_MAX_Y + 40*MM;
        const x4 = PAGE_WIDTH - PAGE_MARGIN - 30*MM;

        this.document.fontSize(3.5 * MM);
        this.document.fillColor(COLOR_DARK);
        this.document.font('Metropolis-SemiBold')


        this.document.text("Totaal excl. BTW", x4 - 40*MM, y, { align: 'right', width: 40*MM })
        this.document.font('Metropolis-Medium')
        this.document.text(Formatter.price(this.invoice.meta.priceWithoutVAT).replace(/ /g, " ").replace(/,00/g, ""), x4, y, { align: 'right', width: PAGE_WIDTH - x4 - PAGE_MARGIN })

        y = this.document.y + 5*MM
        this.document.font('Metropolis-SemiBold')
        this.document.text("BTW ("+this.invoice.meta.VATPercentage+"%)", x4 - 40*MM, y, { align: 'right', width: 40*MM })
        this.document.font('Metropolis-Medium')
        this.document.text(Formatter.price(this.invoice.meta.VAT).replace(/ /g, " ").replace(/,00/g, ""), x4, y, { align: 'right', width: PAGE_WIDTH - x4 - PAGE_MARGIN })

        // Keep semibold
        this.document.font('Metropolis-SemiBold')
        y = this.document.y + 5*MM
        this.document.fontSize(4 * MM);
        this.document.text("Totaal incl. BTW", x4 - 40*MM, y, { align: 'right', width: 40*MM })
        this.document.fontSize(3.5 * MM);
        this.document.text(Formatter.price(this.invoice.meta.priceWithVAT).replace(/ /g, " ").replace(/,00/g, ""), x4, y, { align: 'right', width: PAGE_WIDTH - x4 - PAGE_MARGIN })

        y = this.document.y - 12
        this.document.fillColor(COLOR_GRAY_DARK)
        this.document.translate(PAGE_MARGIN, y).path("M1.83691 4.39455C0.42209 6.04518 0.67106 8.20419 1.5693 9.24111C2.22727 8.2989 3.15346 7.54189 4.0855 6.78009C5.34645 5.74946 6.61812 4.71007 7.25085 3.19149C6.97654 4.83737 6.01424 5.92035 5.01992 7.03937C4.60105 7.51076 4.17651 7.98856 3.79531 8.51752C3.69684 8.60684 3.60336 8.69528 3.51692 8.78172C2.52065 9.77798 1.95631 11.086 1.58233 11.9835C1.45455 12.2902 1.59957 12.6424 1.90625 12.7702C2.21292 12.8979 2.56512 12.7529 2.6929 12.4462C3.00855 11.6887 3.4012 10.7978 3.99293 10.0538C8.76439 10.3184 10.0653 5.37356 8.15325 0.183655C7.03892 1.61637 5.87387 2.08317 4.73863 2.53802C3.72892 2.94257 2.7428 3.33768 1.83691 4.39455Z").fill('even-odd')
        
        this.document.translate(-PAGE_MARGIN, -y)
        const hh = this.document.heightOfString("Denk aan de natuur. Druk deze factuur niet af.", { align: 'left', width: PAGE_WIDTH - PAGE_MARGIN*2 })
        this.document.text("Denk aan de natuur. Druk deze factuur niet af.", PAGE_MARGIN + 8*MM, y + 12/2 - hh/2, { align: 'left' })

        y -= 10*MM
        this.document.fillColor(COLOR_PRIMARY)
        this.document.translate(PAGE_MARGIN, y).path("M6 12C9.31371 12 12 9.31371 12 6C12 2.68629 9.31371 0 6 0C2.68629 0 0 2.68629 0 6C0 9.31371 2.68629 12 6 12ZM8.88815 4.54879C9.08076 4.27914 9.0183 3.90441 8.74865 3.71181C8.479 3.5192 8.10427 3.58165 7.91167 3.8513L5.3881 7.3843L4.07991 5.64005C3.88109 5.37495 3.50501 5.32122 3.23991 5.52005C2.97481 5.71887 2.92109 6.09495 3.11991 6.36005L4.91991 8.76005C5.0347 8.91309 5.21559 9.00223 5.40689 9C5.59818 8.99778 5.77695 8.90446 5.88815 8.74879L8.88815 4.54879Z").fill('even-odd')
        
        this.document.translate(-PAGE_MARGIN, -y)
        const payText = "Deze factuur werd al betaald via "+"?"
        const h = this.document.heightOfString(payText, { align: 'left', width: PAGE_WIDTH - PAGE_MARGIN*2  })
        this.document.text(payText, PAGE_MARGIN + 8*MM, y + 12/2 - h/2, { align: 'left' })

    }

    drawPageFooter() {
        this.document.fillColor(COLOR_GRAY)
        this.document.font('Metropolis-Medium')
        this.document.fontSize(3 * MM);
        this.document.text(this.invoice.id+"", PAGE_MARGIN, PAGE_HEIGHT - PAGE_MARGIN, { align: 'left', baseline: "bottom", lineBreak: false, width: (PAGE_WIDTH - PAGE_MARGIN*2)/2, height: 10*MM })
        this.document.text("Pagina "+this.page, PAGE_WIDTH - PAGE_MARGIN - 31*MM, PAGE_HEIGHT - PAGE_MARGIN, { align: 'right', baseline: "bottom", width: 30*MM, lineBreak: false, height: 10*MM })
    }
    
}