import { I18n } from '@stamhoofd/backend-i18n';
import type { Organization } from '@stamhoofd/models';
import { sendEmailTemplate } from '../helpers/EmailBuilder.js';
import { EmailTemplateType, Replacement, STPackageType } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';

export class OrganizationEmailService {
    static async sendEmailTemplate(organization: Organization, data: {
        type: EmailTemplateType;
        personal?: boolean;
        bcc?: boolean;
    }) {
        const recipients = await organization.getAdminRecipients();
        const defaultI18n = new I18n(Language.Dutch, Country.Belgium);
        const i18n = organization.i18n;

        const replaceAll = [
            {
                from: defaultI18n.localizedDomains.marketing(),
                to: i18n.localizedDomains.marketing(),
            },
            {
                from: defaultI18n.$t('%2a'),
                to: i18n.$t('%2a'),
            },
            {
                from: defaultI18n.$t('%19'),
                to: i18n.$t('%19'),
            },
        ];

        await sendEmailTemplate(null, {
            replaceAll,
            recipients,
            template: {
                type: data.type,
            },
            singleBcc: data.bcc ? { email: 'simon@stamhoofd.be' } : undefined,
            type: 'transactional',
            defaultReplacements: [
                Replacement.create({
                    token: 'mailDomain',
                    value: organization.privateMeta.mailDomain ?? organization.privateMeta.pendingMailDomain ?? '',
                }),
                Replacement.create({
                    token: 'organizationName',
                    value: organization.name,
                }),
            ],
            unsubscribeType: 'marketing',
            fromStamhoofd: true,
        });
    }

    static async checkDrips(organization: Organization) {
        const days7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Welcome drip
        // Created maximum 7 days ago
        if (organization.createdAt > days7 && !organization.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWelcome)) {
            await this.sendEmailTemplate(organization, {
                type: EmailTemplateType.OrganizationDripWelcome,
                personal: true,
            });

            organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripWelcome);
            await organization.save();

            return; // Never send more than 1 drip email on the same day
        }

        // Webshop trial checkin
        if (!organization.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWebshopTrialCheckin)) {
            if (organization.meta.packages.isWebshopsTrial) {
                const activeTime = organization.meta.packages.getActiveTime(STPackageType.TrialWebshops);
                if (activeTime !== null && activeTime > 4 * 24 * 60 * 60 * 1000) {
                    // 7 days checkin
                    await this.sendEmailTemplate(organization, {
                        type: EmailTemplateType.OrganizationDripWebshopTrialCheckin,
                        personal: true,
                    });

                    organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopTrialCheckin);
                    organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripMembersTrialCheckin); // also mark members checkin
                    await organization.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        // Members trial checkin
        if (!organization.serverMeta.hasEmail(EmailTemplateType.OrganizationDripMembersTrialCheckin)) {
            if (organization.meta.packages.isMembersTrial) {
                const activeTime = organization.meta.packages.getActiveTime(STPackageType.TrialMembers);
                if (activeTime !== null && activeTime > 4 * 24 * 60 * 60 * 1000) {
                    // 7 days checkin
                    await this.sendEmailTemplate(organization, {
                        type: EmailTemplateType.OrganizationDripMembersTrialCheckin,
                        personal: true,
                    });

                    organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripMembersTrialCheckin);
                    organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopTrialCheckin); // Also mark webshop trial checkin
                    await organization.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        // Webshop trial expired after 1 week
        if (!organization.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWebshopTrialExpired)) {
            if (!organization.meta.packages.useWebshops) {
                const deactivatedTime = organization.meta.packages.getDeactivatedTime(STPackageType.TrialWebshops);
                if (deactivatedTime !== null && deactivatedTime < 14 * 24 * 60 * 60 * 1000 && deactivatedTime > 7 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate(organization, {
                        type: EmailTemplateType.OrganizationDripWebshopTrialExpired,
                        personal: true,
                    });

                    organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopTrialExpired);
                    organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripMembersTrialExpired); // also mark members
                    await organization.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        if (!organization.serverMeta.hasEmail(EmailTemplateType.OrganizationDripMembersTrialExpired)) {
            if (!organization.meta.packages.useMembers) {
                const deactivatedTime = organization.meta.packages.getDeactivatedTime(STPackageType.TrialMembers);
                if (deactivatedTime !== null && deactivatedTime < 14 * 24 * 60 * 60 * 1000 && deactivatedTime > 7 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate(organization, {
                        type: EmailTemplateType.OrganizationDripMembersTrialExpired,
                        personal: true,
                    });

                    organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripMembersTrialExpired);
                    organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopTrialExpired); // also mark webshops
                    await organization.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        // trial expired reminder (after 10 months)
        if (!organization.serverMeta.hasEmail(EmailTemplateType.OrganizationDripTrialExpiredReminder)) {
            if (!organization.meta.packages.isPaid && !organization.meta.packages.wasPaid) {
                const deactivatedTime1 = organization.meta.packages.getDeactivatedTime(STPackageType.TrialWebshops);
                const deactivatedTime2 = organization.meta.packages.getDeactivatedTime(STPackageType.TrialMembers);

                const deactivatedTime = deactivatedTime1 && deactivatedTime2 ? Math.max(deactivatedTime1, deactivatedTime2) : (deactivatedTime1 ? deactivatedTime1 : deactivatedTime2);

                if (deactivatedTime !== null && deactivatedTime > 10 * 30 * 24 * 60 * 60 * 1000 && deactivatedTime < 13 * 31 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate(organization, {
                        type: EmailTemplateType.OrganizationDripTrialExpiredReminder,
                        personal: true,
                        bcc: true,
                    });

                    organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripTrialExpiredReminder);
                    await organization.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        if (!organization.serverMeta.hasEmail(EmailTemplateType.OrganizationDripWebshopNotRenewed)) {
            if (!organization.meta.packages.useWebshops) {
                const deactivatedTime = organization.meta.packages.getDeactivatedTime(STPackageType.Webshops);

                if (deactivatedTime !== null && deactivatedTime > 30 * 24 * 60 * 60 * 1000 && deactivatedTime < 30 * 3 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate(organization, {
                        type: EmailTemplateType.OrganizationDripWebshopNotRenewed,
                        personal: true,
                        bcc: true,
                    });

                    organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripWebshopNotRenewed);
                    await organization.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }

        if (!organization.serverMeta.hasEmail(EmailTemplateType.OrganizationDripMembersNotRenewed)) {
            if (!organization.meta.packages.useMembers) {
                const deactivatedTime = organization.meta.packages.getDeactivatedTime(STPackageType.Members);

                if (deactivatedTime !== null && deactivatedTime > 30 * 24 * 60 * 60 * 1000 && deactivatedTime < 30 * 3 * 24 * 60 * 60 * 1000) {
                    await this.sendEmailTemplate(organization, {
                        type: EmailTemplateType.OrganizationDripMembersNotRenewed,
                        personal: true,
                        bcc: true,
                    });

                    organization.serverMeta.addEmail(EmailTemplateType.OrganizationDripMembersNotRenewed);
                    await organization.save();

                    return; // Never send more than 1 drip email on the same day
                }
            }
        }
    }
}
