import { column, Database, ManyToOneRelation } from '@simonbackx/simple-database';
import { AppliedRegistrationDiscount, EmailTemplateType, GroupPrice, PaymentMethod, PaymentMethodHelper, Recipient, RecordAnswer, RecordAnswerDecoder, RegisterItemOption, Registration as RegistrationStructure, Replacement, StockReservation } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { ArrayDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { QueryableModel } from '@stamhoofd/sql';
import { sendEmailTemplate } from '../helpers/EmailBuilder.js';
import { Group, Organization, User } from './index.js';

export class Registration extends QueryableModel {
    static table = 'registrations';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    memberId: string;

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'string', nullable: true })
    payingOrganizationId: string | null = null;

    @column({ type: 'string' })
    periodId: string;

    @column({ type: 'string', foreignKey: Registration.group })
    groupId: string;

    @column({ type: 'json', decoder: GroupPrice })
    groupPrice: GroupPrice;

    @column({ type: 'json', decoder: new ArrayDecoder(RegisterItemOption) })
    options: RegisterItemOption[] = [];

    @column({ type: 'json', decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder) })
    recordAnswers: Map<string, RecordAnswer> = new Map();

    /**
     * @deprecated
     */
    @column({ type: 'string', nullable: true })
    paymentId: string | null = null;

    /**
     * @deprecated
     */
    @column({ type: 'integer' })
    cycle: number = 0;

    /**
     * @deprecated
     * Moved to cached balances
     */
    @column({ type: 'integer', nullable: true })
    price: number | null = null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    /**
     * The date when the registration was confirmed
     */
    @column({ type: 'datetime', nullable: true })
    registeredAt: Date | null = null;

    @column({ type: 'datetime', nullable: true })
    reservedUntil: Date | null = null;

    /**
     * Start date of the registration. Defaults to the start date of the related group
     */
    @column({ type: 'datetime', nullable: true })
    startDate: Date | null = null;

    /**
     * End date of the registration. Defaults to null.
     */
    @column({ type: 'datetime', nullable: true })
    endDate: Date | null = null;

    /**
     * If this registration is under a trial, this is the end date of the trial
     */
    @column({ type: 'datetime', nullable: true })
    trialUntil: Date | null = null;

    /**
     * @deprecated - replaced by group type
     */
    @column({ type: 'boolean' })
    waitingList = false;

    /**
     * When a registration is on the waiting list or is invite only, set this to true to allow the user to
     * register normally.
     */
    @column({ type: 'boolean' })
    canRegister = false;

    @column({ type: 'boolean' })
    sendConfirmationEmail = true;

    @column({ type: 'datetime', nullable: true })
    deactivatedAt: Date | null = null;

    /**
     * @deprecated
     * Moved to cached balances
     */
    @column({ type: 'integer' })
    pricePaid = 0;

    /**
     * Set to null if no reservations are made, to help faster querying
     */
    @column({ type: 'json', decoder: new ArrayDecoder(StockReservation) })
    stockReservations: StockReservation[] = [];

    /**
     * Cached value for calculation of discounts of other registrations (based on the single-source-of-truth stored in balance items)
     *
     * Discounts that were applied to this registration.
     * Note that these discounts are saved in separate balance items and
     * are not included in the price.
     *
     * Reason is that discounts can change after you've been registered
     */
    @column({ type: 'json', decoder: new MapDecoder(StringDecoder, AppliedRegistrationDiscount) })
    discounts = new Map<string, AppliedRegistrationDiscount>();

    static group: ManyToOneRelation<'group', import('./Group').Group>;

    getStructure(this: Registration & { group: import('./Group').Group }) {
        return RegistrationStructure.create({
            ...this,
            group: this.group.getStructure(),
            price: this.price ?? 0,
        });
    }

    /**
     * Get the number of active members that are currently registered
     * This is used for billing
     */
    static async getActiveMembers(organizationId: string): Promise<number> {
        const query = `
        SELECT COUNT(DISTINCT \`${Registration.table}\`.memberId) as c FROM \`${Registration.table}\` 
        JOIN \`groups\` ON \`groups\`.id = \`${Registration.table}\`.groupId
        WHERE \`groups\`.organizationId = ? AND \`${Registration.table}\`.cycle = \`groups\`.cycle AND \`groups\`.deletedAt is null AND \`${Registration.table}\`.registeredAt is not null AND \`${Registration.table}\`.deactivatedAt is null`;

        const [results] = await Database.select(query, [organizationId]);
        const count = results[0]['']['c'];

        if (Number.isInteger(count)) {
            return count as number;
        }
        else {
            console.error('Unexpected result for occupancy', results);
            throw new Error('Query failed');
        }
    }

    async getRecipients(organization: Organization, group: import('./').Group) {
        const { Member } = await import('./Member.js');

        const member = await Member.getByIdWithUsers(this.memberId);

        if (!member) {
            return [];
        }

        const allowedEmails = member.details.getNotificationEmails();

        return member.users.map(user => Recipient.create({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            userId: user.id,
            replacements: [
                Replacement.create({
                    token: 'firstNameMember',
                    value: member.details.firstName,
                }),
                Replacement.create({
                    token: 'lastNameMember',
                    value: member.details.lastName,
                }),
                Replacement.create({
                    token: 'registerUrl',
                    value: 'https://' + organization.getHost(),
                }),
                Replacement.create({
                    token: 'groupName',
                    value: group.settings.name.toString(),
                }),
            ],
        })).filter(r => allowedEmails.includes(r.email.toLocaleLowerCase()));
    }

    async sendEmailTemplate(data: {
        type: EmailTemplateType;
    }) {
        const Group = (await import('./index.js')).Group;
        const group = await Group.getByID(this.groupId);

        if (!group) {
            return;
        }

        const organization = await Organization.getByID(group.organizationId);
        if (!organization) {
            return;
        }

        const recipients = await this.getRecipients(organization, group);

        // Create e-mail builder
        await sendEmailTemplate(organization, {
            template: {
                type: data.type,
                group,
            },
            recipients,
            type: 'transactional',
        });
    }

    static async sendTransferEmail(user: User, organization: Organization, payment: import('./').Payment) {
        const paymentGeneral = await payment.getGeneralStructure();
        const groupIds = paymentGeneral.groupIds;

        const recipients = [
            Recipient.create({
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                userId: user.id,
                replacements: [
                    Replacement.create({
                        token: 'priceToPay',
                        value: Formatter.price(payment.price),
                    }),
                    Replacement.create({
                        token: 'paymentMethod',
                        value: PaymentMethodHelper.getName(payment.method ?? PaymentMethod.Unknown),
                    }),
                    Replacement.create({
                        token: 'transferDescription',
                        value: (payment.transferDescription ?? ''),
                    }),
                    Replacement.create({
                        token: 'transferBankAccount',
                        value: payment.transferSettings?.iban ?? '',
                    }),
                    Replacement.create({
                        token: 'transferBankCreditor',
                        value: payment.transferSettings?.creditor ?? organization.name,
                    }),
                    Replacement.create({
                        token: 'overviewContext',
                        value: $t(`01d5fd7e-2960-4eb4-ab3a-2ac6dcb2e39c`) + ' ' + paymentGeneral.memberNames,
                    }),
                    Replacement.create({
                        token: 'memberNames',
                        value: paymentGeneral.memberNames,
                    }),
                    Replacement.create({
                        token: 'overviewTable',
                        value: '',
                        html: paymentGeneral.getDetailsHTMLTable(),
                    }),
                    Replacement.create({
                        token: 'paymentTable',
                        value: '',
                        html: paymentGeneral.getHTMLTable(),
                    }),
                    Replacement.create({
                        token: 'registerUrl',
                        value: 'https://' + organization.getHost(),
                    }),
                    Replacement.create({
                        token: 'organizationName',
                        value: organization.name,
                    }),
                ],
            }),
        ];

        let group: Group | undefined | null = null;

        if (groupIds.length == 1) {
            const Group = (await import('./index.js')).Group;
            group = await Group.getByID(groupIds[0]);
        }

        // Create e-mail builder
        await sendEmailTemplate(organization, {
            template: {
                type: EmailTemplateType.RegistrationTransferDetails,
                group,
            },
            type: 'transactional',
            recipients,
        });
    }

    shouldIncludeStock() {
        return (this.registeredAt !== null && this.deactivatedAt === null) || this.canRegister || (this.reservedUntil && this.reservedUntil > new Date());
    }
}
