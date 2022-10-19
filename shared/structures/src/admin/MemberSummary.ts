import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { Formatter, StringCompare } from "@stamhoofd/utility";

import { Address } from "../addresses/Address";
import { Recipient, Replacement } from "../endpoints/EmailRequest";
import { Gender } from "../members/Gender";
import { Parent } from "../members/Parent";

export class MemberSummary extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    firstName: string

    @field({ decoder: StringDecoder })
    lastName: string

    get name() {
        return this.firstName + " " + this.lastName
    }

    @field({ decoder: StringDecoder, nullable: true })
    email: string | null = null

    @field({ decoder: new EnumDecoder(Gender) })
    gender: Gender = Gender.Other;

    @field({ decoder: StringDecoder, nullable: true })
    phone: string | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    birthDay: Date | null = null

    @field({ decoder: Address, nullable: true })
    address: Address | null = null;

    @field({ decoder: new ArrayDecoder(Parent)})
    parents: Parent[] = [];

    @field({ decoder: StringDecoder })
    organizationName: string

    @field({ decoder: StringDecoder })
    organizationId: string

    matchQuery(query: string) {
        const parts = query.split(" ");
        const nameParts = [...this.firstName.split(" "), ...this.lastName.split(" ")];

        // Each part should at least match a namepart
        for (const part of parts) {
            if (!nameParts.find(p => StringCompare.contains(p, part))) {
                return false;
            }
        }
        return parts.length > 0;

        //return StringCompare.contains(this.firstName, query) || StringCompare.contains(this.lastName, query)
    }

    get addresses() {
        const addresses = this.parents.map(p => p.address).filter(a => a !== null) as Address[]
        if (this.address) {
            addresses.push(this.address)
        }

        // Remove duplicates by toString()
        return addresses.filter((a, i, self) => self.findIndex(b => b.toString() === a.toString()) === i)
    }

    get age(): number | null {
        if (!this.birthDay) {
            return null
        }

        // For now calculate based on Brussels timezone (we'll need to correct this later)
        const today = new Date();
        const birthDay = Formatter.luxon(this.birthDay);
        let age = today.getFullYear() - birthDay.year;
        const m = today.getMonth() - (birthDay.month - 1)
        if (m < 0 || (m === 0 && today.getDate() < birthDay.day)) {
            age--;
        }
        return age;
    }

    get emailRecipients(): Recipient[] {
        // for each parent
        const recipients: Recipient[] = []
        for (const parent of this.parents) {
            if (parent.email) {
                recipients.push(Recipient.create({
                    firstName: parent.firstName,
                    lastName: parent.lastName,
                    email: parent.email,
                    types: ['parent'],
                    replacements: [
                        Replacement.create({
                            token: "firstName",
                            value: parent.firstName
                        }),
                        Replacement.create({
                            token: "lastName",
                            value: parent.lastName
                        }),
                        Replacement.create({
                            token: "organization",
                            value: this.organizationName
                        }),
                    ]
                }))
            }
        }

        if (this.email && (!this.age || this.age >= 18)) {
            recipients.push(Recipient.create({
                firstName: this.firstName,
                lastName: this.lastName,
                email: this.email,
                types: ['member'],
                replacements: [
                    Replacement.create({
                        token: "firstName",
                        value: this.firstName
                    }),
                    Replacement.create({
                        token: "lastName",
                        value: this.lastName
                    }),
                    Replacement.create({
                        token: "organization",
                        value: this.organizationName
                    }),
                ]
            }))
        }

        return recipients
    }

    get emailaddresses() {
        const emails = this.parents.map(p => p.email).filter(e => e !== null) as string[]
        if (this.email && (!this.age || this.age >= 18)) {
            emails.push(this.email)
        }

        // Remove duplicates
        return emails.filter((a, i, self) => self.indexOf(a) === i)
    }
}