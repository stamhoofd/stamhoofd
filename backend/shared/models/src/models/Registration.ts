import { column,Database,ManyToOneRelation,Model } from '@simonbackx/simple-database';
import { Email } from '@stamhoofd/email';
import { EmailTemplateType, MemberWithRegistrations, Payment as PaymentStructure, PaymentDetailed, Recipient, Registration as RegistrationStructure, Replacement, RegistrationWithMember as RegistrationWithMemberStruct, Member as MemberStruct, PaymentMethodHelper, PaymentMethod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";
import { getEmailBuilder } from '../helpers/EmailBuilder';
import { EmailTemplate } from './EmailTemplate';
import { Group } from './Group';
import { Member } from './Member';
import { Organization } from './Organization';

import { Payment } from './Payment';
import { User, UserWithOrganization } from './User';

export type RegistrationWithPayment = Registration & { payment: Payment | null }
export class Registration extends Model {
    static table = "registrations"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    memberId: string;

    @column({ type: "string" })
    groupId: string;

    @column({ type: "string", nullable: true, foreignKey: Registration.payment })
    paymentId: string | null = null

    @column({ type: "integer" })
    cycle: number;

    @column({ type: "integer", nullable: true })
    price: number | null = null;

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    @column({ type: "datetime", nullable: true })
    registeredAt: Date | null = null

    @column({ type: "datetime", nullable: true })
    reservedUntil: Date | null = null

    @column({ type: "boolean" })
    waitingList = false

    /**
     * When a registration is on the waiting list or is invite only, set this to true to allow the user to
     * register normally.
     */
    @column({ type: "boolean" })
    canRegister = false

    @column({ type: "datetime", nullable: true})
    deactivatedAt: Date | null = null

    static payment = new ManyToOneRelation(Payment, "payment")

    getStructure(this: RegistrationWithPayment) {
        return RegistrationStructure.create(
            Object.assign(Object.assign({}, this), {
                payment: this.payment ? PaymentStructure.create(this.payment) : null
            })
        )
    }

    /**
     * Get the number of active members that are currently registered
     * This is used for billing
     */
    static async getActiveMembers(organizationId: string): Promise<number> {
        const query = `
        SELECT COUNT(DISTINCT \`${Registration.table}\`.memberId) as c FROM \`${Registration.table}\` 
        JOIN \`groups\` ON \`groups\`.id = \`${Registration.table}\`.groupId
        WHERE \`groups\`.organizationId = ? AND \`${Registration.table}\`.cycle = \`groups\`.cycle AND \`groups\`.deletedAt is null AND \`${Registration.table}\`.registeredAt is not null AND \`${Registration.table}\`.waitingList = 0`
        
        const [results] = await Database.select(query, [organizationId])
        const count = results[0]['']['c'];

        if (Number.isInteger(count)) {
           return count
        } else {
            console.error("Unexpected result for occupancy", results)
            throw new Error("Query failed")
        }
    }

    async markValid() {
        if (this.registeredAt !== null) {
            await this.save();
            return false;
        }
        this.reservedUntil = null
        this.registeredAt = new Date()
        await this.save();

        await this.sendEmailTemplate({
            type: EmailTemplateType.RegistrationConfirmation
        });

        return true;
    }

    async getRecipients(organization: Organization, group: Group) {
        const {Member} = await import('./Member');

        const member = await Member.getWithRegistrations(this.memberId);

        if (!member) {
            return [];
        }

        return member.users.map(user => Recipient.create({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            userId: user.id,
            replacements: [
                Replacement.create({
                    token: "firstName",
                    value: member.details.firstName,
                }),
                Replacement.create({
                    token: "lastName",
                    value: member.details.lastName,
                }),
                Replacement.create({
                    token: "email",
                    value: user.email
                }),
                Replacement.create({
                    token: "registerUrl",
                    value: "https://" + organization.getHost()
                }),
                Replacement.create({
                    token: "organizationName",
                    value: organization.name
                }),
                Replacement.create({
                    token: "groupName",
                    value: group.settings.name
                }),
            ]
        }));
    }

    async sendEmailTemplate(data: {
        type: EmailTemplateType
    }) {
        // First fetch template
        let templates = (await EmailTemplate.where({ type: data.type, groupId: this.groupId }))

        if (templates.length == 0) {
            templates = (await EmailTemplate.where({ type: data.type, organizationId: null }))
        }

        if (templates.length == 0) {
            console.error("Could not find email template for type "+data.type)
            return
        }

        const template = templates[0]

        const group = await Group.getByID(this.groupId);

        if (!group) {
            return
        }
        const organization = await Organization.getByID(group.organizationId);
        if (!organization) {
            return
        }

        const recipients = await this.getRecipients(organization, group)

        const {from, replyTo} = organization.getGroupEmail(group)

        // Create e-mail builder
        const builder = await getEmailBuilder(organization, {
            recipients,
            subject: template.subject,
            html: template.html,
            from,
            replyTo
        })

        Email.schedule(builder)
    }

    static async sendTransferEmail(user: UserWithOrganization, payment: Payment) {
        const data = {
            type: EmailTemplateType.RegistrationTransferDetails
        };

        // First fetch template
        let templates = (await EmailTemplate.where({ type: data.type, organizationId: user.organizationId }))

        if (templates.length == 0) {
            templates = (await EmailTemplate.where({ type: data.type, organizationId: null }))
        }

        if (templates.length == 0) {
            console.error("Could not find email template for type "+data.type)
            return
        }

        const template = templates[0]

        const organization = user.organization;
        const registrations = await Member.getRegistrationWithMembersForPayment(payment.id)
        const groups = await Group.getByIDs(...Formatter.uniqueArray(registrations.map(r => r.groupId)))

        const paymentDetailed = PaymentDetailed.create({
            ...payment,
            registrations: registrations.map(r => RegistrationWithMemberStruct.create({
                ...r.setRelation(Registration.payment, payment).getStructure(),
                member: MemberStruct.create(r.member),
                group: groups.find(g => g.id === r.groupId)?.getStructure()
            }))
        })

        const recipients = [
            Recipient.create({
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                userId: user.id,
                replacements: [
                    Replacement.create({
                        token: "priceToPay",
                        value: Formatter.price(payment.price)
                    }),
                    Replacement.create({
                        token: "paymentMethod",
                        value: PaymentMethodHelper.getName(payment.method ?? PaymentMethod.Unknown)
                    }),
                    Replacement.create({
                        token: "transferDescription",
                        value: (payment.transferDescription ?? "")
                    }),
                    Replacement.create({
                        token: "transferBankAccount",
                        value: payment.transferSettings?.iban ?? ""
                    }),
                    Replacement.create({
                        token: "transferBankCreditor",
                        value: payment.transferSettings?.creditor ?? organization.name
                    }),
                    Replacement.create({
                        token: "overviewTable",
                        value: "",
                        html: paymentDetailed.getDetailsHTMLTable()
                    }),
                    Replacement.create({
                        token: "overviewContext",
                        value: "Inschrijving van " + paymentDetailed.getMemberFirstNames()
                    }),
                    Replacement.create({
                        token: "memberNames",
                        value: paymentDetailed.getMemberNames()
                    }),
                    Replacement.create({
                        token: "overviewTable",
                        value: "",
                        html: paymentDetailed.getDetailsHTMLTable()
                    }),
                    Replacement.create({
                        token: "paymentTable",
                        value: "",
                        html: paymentDetailed.getHTMLTable()
                    }),
                    Replacement.create({
                        token: "registerUrl",
                        value: "https://" + organization.getHost()
                    }),
                    Replacement.create({
                        token: "organizationName",
                        value: organization.name
                    })
                ]
            })
        ];

        const {from, replyTo} = groups.length == 1 ? organization.getGroupEmail(groups[0]) : organization.getDefaultEmail()

        // Create e-mail builder
        const builder = await getEmailBuilder(organization, {
            recipients,
            subject: template.subject,
            html: template.html,
            from,
            replyTo
        })

        Email.schedule(builder)
    }
}