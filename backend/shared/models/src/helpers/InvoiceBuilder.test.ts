import { Address, PaymentMethod, PaymentStatus, STInvoiceItem, STInvoiceMeta } from "@stamhoofd/structures";
import { AddressFactory } from "../factories/AddressFactory";
import { Payment } from "../models/Payment";
import { STInvoice } from "../models/STInvoice";
import { InvoiceBuilder } from "./InvoiceBuilder";

describe("InvoiceBuilder", () => {
    test("Generate a PDF", async () => {
        const invoice = new STInvoice()
        invoice.number = 124
        invoice.meta = STInvoiceMeta.create({
            date: new Date(),
            companyName: "De Testers VZW",
            companyContact: "Jane Doe",
            companyAddress: await new AddressFactory({}).create(),
            companyVATNumber: "BE123412341234"
        })

        const payment = new Payment()
        payment.method = PaymentMethod.Bancontact
        payment.status = PaymentStatus.Succeeded
        payment.price = 123
        await payment.save()
        invoice.paymentId = payment.id

        for (let index = 0; index < 100; index++) {
            const amount = Math.floor(Math.random()*999) + 1
            const unitPrice = Math.floor(Math.random()*999) + 1
            invoice.meta.items.push(STInvoiceItem.create({
                name: "Dit is een voorbeeld",
                description: "Met wat extra tekst eronder",
                amount,
                unitPrice,
                price: unitPrice * amount,
            }))
        }

        invoice.meta.items.push(STInvoiceItem.create({
            name: "Iets zonder beschrijving",
            amount: 1,
            unitPrice: 5900,
            price: 5900,
        }))

        invoice.meta.items.push(STInvoiceItem.create({
            name: "Iets lang met meerdere lijnen. Zowel in de titel als in de beschrijving, dat zou ook altijd moeten werken...",
            description: "Iets lang met meerdere lijnen. Zowel in de titel als in de beschrijving, dat zou ook altijd moeten werken...",
            amount: 1,
            unitPrice: 5900,
            price: 5900,
        }))

        const builder = new InvoiceBuilder(invoice)

        const file = await builder.build()
        console.warn(file.getPublicPath())

        expect(file).toBeDefined()
    });
});
