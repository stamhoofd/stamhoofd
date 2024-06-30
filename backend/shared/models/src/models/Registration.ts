import { column, Database, ManyToOneRelation, Model } from '@simonbackx/simple-database';
import { Email } from '@stamhoofd/email';
import { EmailTemplateType, PaymentMethod, PaymentMethodHelper, Recipient, Registration as RegistrationStructure, Replacement } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { getEmailBuilder } from '../helpers/EmailBuilder';
import { Document, EmailTemplate, Organization, User } from './';

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
    organizationId: string

    @column({ type: "string" })
    periodId: string;

    @column({ type: "string", foreignKey: Registration.group})
    groupId: string;

    /**
     * @deprecated
     */
    @column({ type: "string", nullable: true })
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

    /**
     * Part of price that is paid
     */
    @column({ type: "integer" })
    pricePaid = 0

    static group: ManyToOneRelation<"group", import('./Group').Group>

    getStructure(this: Registration & {group: import('./Group').Group}) {
        return RegistrationStructure.create({
            ...this,
            group: this.group.getStructure(),
            price: this.price ?? 0
        })
    }

    /**
     * Update the outstanding balance of multiple members in one go (or all members)
     */
    static async updateOutstandingBalance(registrationIds: string[] | 'all', organizationId: string) {
        if (registrationIds !== 'all' && registrationIds.length == 0) {
            return
        }

        const params: any[] = []
        let firstWhere = ''
        let secondWhere = ''

        if (registrationIds !== 'all') {
            firstWhere = ` AND registrationId IN (?)`
            params.push(registrationIds)

            secondWhere = `WHERE registrations.id IN (?)`
            params.push(registrationIds)
        }
        
        const query = `UPDATE
            registrations
            LEFT JOIN (
                SELECT
                    registrationId,
                    sum(price) AS price,
                    sum(pricePaid) AS pricePaid
                FROM
                    balance_items
                WHERE status != 'Hidden'${firstWhere}
                GROUP BY
                    registrationId
            ) i ON i.registrationId = registrations.id 
        SET registrations.price = coalesce(i.price, 0), registrations.pricePaid = coalesce(i.pricePaid, 0)
        ${secondWhere}`
        
        await Database.update(query, params)

        if (registrationIds !== 'all') {
            await Document.updateForRegistrations(registrationIds, organizationId)
        }
    }

    /**
     * Get the number of active members that are currently registered
     * This is used for billing
     */
    static async getActiveMembers(organizationId: string): Promise<number> {
        const query = `
        SELECT COUNT(DISTINCT \`${Registration.table}\`.memberId) as c FROM \`${Registration.table}\` 
        JOIN \`groups\` ON \`groups\`.id = \`${Registration.table}\`.groupId
        WHERE \`groups\`.organizationId = ? AND \`${Registration.table}\`.cycle = \`groups\`.cycle AND \`groups\`.deletedAt is null AND \`groups\`.status != 'Archived' AND \`${Registration.table}\`.registeredAt is not null AND \`${Registration.table}\`.waitingList = 0`
        
        const [results] = await Database.select(query, [organizationId])
        const count = results[0]['']['c'];

        if (Number.isInteger(count)) {
           return count as number
        } else {
            console.error("Unexpected result for occupancy", results)
            throw new Error("Query failed")
        }
    }

    async markValid(this: Registration) {
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

        const {Member} = await import('./Member');
        const member = await Member.getByID(this.memberId);
        if (member) {
            const registrationMemberRelation = new ManyToOneRelation(Member, "member")
            registrationMemberRelation.foreignKey = Member.registrations.foreignKey
            await Document.updateForRegistration(this.setRelation(registrationMemberRelation, member))
        }

        return true;
    }

    async getRecipients(organization: Organization, group: import('./').Group) {
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
                Replacement.create({
                    token: "loginDetails",
                    value: "",
                    html: user.hasAccount() ? `<p class="description"><em>Je kan op het ledenportaal inloggen met <strong>${Formatter.escapeHtml(user.email)}</strong></em></p>` : `<p class="description"><em>Je kan op het ledenportaal een nieuw account aanmaken met het e-mailadres <strong>${Formatter.escapeHtml(user.email)}</strong>, dan krijg je automatisch toegang tot alle bestaande gegevens.</em></p>`
                }),
            ]
        }));
    }

    async sendEmailTemplate(data: {
        type: EmailTemplateType
    }) {
        const Group = (await import('./')).Group
        const group = await Group.getByID(this.groupId);

        if (!group) {
            return
        }

        // Most specific template: for specific group
        let templates = (await EmailTemplate.where({ type: data.type, groupId: this.groupId, organizationId: group.organizationId }))

        // Then for organization
        if (templates.length == 0) {
            templates = (await EmailTemplate.where({ type: data.type, organizationId: group.organizationId, groupId: null }))
        }

        // Then default
        if (templates.length == 0) {
            templates = (await EmailTemplate.where({ type: data.type, organizationId: null, groupId: null }))
        }

        if (templates.length == 0) {
            console.error("Could not find email template for type "+data.type)
            return
        }

        const template = templates[0]

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
            type: "transactional",
            replyTo
        })

        Email.schedule(builder)
    }

    static async sendTransferEmail(user: User, organization: Organization, payment: import('./').Payment) {
        const data = {
            type: EmailTemplateType.RegistrationTransferDetails
        };

        // First fetch template
        let templates = (await EmailTemplate.where({ type: data.type, organizationId: organization.id, groupId: null }))

        if (templates.length == 0) {
            templates = (await EmailTemplate.where({ type: data.type, organizationId: null, groupId: null }))
        }

        if (templates.length == 0) {
            console.error("Could not find email template for type "+data.type)
            return
        }

        const template = templates[0]

        const paymentGeneral = await payment.getGeneralStructure();
        const registrations = paymentGeneral.registrations
        let groupIds = registrations.map(r => r.groupId);
        
        // Remove duplicate groupIds
        groupIds = groupIds.filter((v, i, a) => a.indexOf(v) === i);

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
                        html: paymentGeneral.getDetailsHTMLTable()
                    }),
                    Replacement.create({
                        token: "overviewContext",
                        value: "Inschrijving van " + paymentGeneral.memberFirstNames
                    }),
                    Replacement.create({
                        token: "memberNames",
                        value: paymentGeneral.memberNames
                    }),
                    Replacement.create({
                        token: "overviewTable",
                        value: "",
                        html: paymentGeneral.getDetailsHTMLTable()
                    }),
                    Replacement.create({
                        token: "paymentTable",
                        value: "",
                        html: paymentGeneral.getHTMLTable()
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
                        token: "loginDetails",
                        value: "",
                        html: user.hasAccount() ? `<p class="description"><em>Je kan op het ledenportaal inloggen met <strong>${Formatter.escapeHtml(user.email)}</strong></em></p>` : `<p class="description"><em>Je kan op het ledenportaal een nieuw account aanmaken met het e-mailadres <strong>${Formatter.escapeHtml(user.email)}</strong>, dan krijg je automatisch toegang tot alle bestaande gegevens.</em></p>`
                    })
                ]
            })
        ];

        let {from, replyTo} = organization.getDefaultEmail()

        if (groupIds.length == 1) {
            const Group = (await import('./')).Group
            const group = await Group.getByID(groupIds[0]);
            if (group) {
                const groupEmail = organization.getGroupEmail(group)
                from = groupEmail.from
                replyTo = groupEmail.replyTo
            }
        }

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
