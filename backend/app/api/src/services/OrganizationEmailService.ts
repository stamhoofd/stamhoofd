import { I18n } from '@stamhoofd/backend-i18n';
import type { Organization } from '@stamhoofd/models';
import { sendEmailTemplate } from '@stamhoofd/models';
import { validateDNSRecords } from '@stamhoofd/models/helpers/DNSValidator.js';
import { DNSRecordStatus, EmailTemplateType, Replacement, STPackageType } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';

/**
 * Owns the notification emails Stamhoofd sends to the administrators of an organization: the mail
 * domain (DNS) state changes and the drip emails.
 *
 * Composing these emails needs the platform (via the shared email builder) and they are all sent
 * without an organization as sender (`sendEmailTemplate(null, ...)`), so they are sent from Stamhoofd
 * itself. Models have no request context to resolve the platform they belong to, so both the decision
 * of which template to send and the sending itself live here instead of on Organization.
 *
 * updateDNSRecords moved along with them: every state transition it makes exists to decide whether the
 * organization may send email and which notification its admins receive, so splitting the state machine
 * from the emails would only spread one decision over two layers.
 */
export class OrganizationEmailService {
    static async updateDNSRecords(organization: Organization) {
        // Check initial status
        let isValidRecords = true;
        for (const record of organization.privateMeta.dnsRecords) {
            if (record.status !== DNSRecordStatus.Valid) {
                isValidRecords = false;
            }
        }

        const { allValid } = await validateDNSRecords(organization.privateMeta.dnsRecords);

        if (organization.registerDomain ?? organization.privateMeta.pendingRegisterDomain) {
            const registerDomainRecord = (organization.privateMeta.pendingRegisterDomain ?? organization.registerDomain) + '.';
            const records = organization.privateMeta.dnsRecords.filter(r => r.name === registerDomainRecord);
            const areRegisterDomainRecordsValid = records.length === 0 || records.every(r => r.status === DNSRecordStatus.Valid);

            if (areRegisterDomainRecordsValid) {
                // We can setup the register domain if needed
                if (organization.privateMeta.pendingRegisterDomain !== null) {
                    organization.registerDomain = organization.privateMeta.pendingRegisterDomain;
                    organization.privateMeta.pendingRegisterDomain = null;

                    console.log('Did set register domain for ' + organization.id + ' to ' + organization.registerDomain);
                }
            } else {
                // Clear register domain
                if (organization.registerDomain) {
                    // We need to clear it, to prevent sending e-mails with invalid links
                    organization.privateMeta.pendingRegisterDomain = organization.privateMeta.pendingRegisterDomain ?? organization.registerDomain;
                    organization.registerDomain = null;

                    console.log('Cleared register domain for ' + organization.id + ' because of invalid non txt records');
                }
            }
        }

        if (allValid) {
            if (organization.privateMeta.pendingMailDomain !== null) {
                organization.privateMeta.mailDomain = organization.privateMeta.pendingMailDomain;
                organization.privateMeta.pendingMailDomain = null;
            }

            const wasUnstable = organization.serverMeta.isDNSUnstable;
            organization.serverMeta.markDNSValid();

            const didSendDomainSetupMail = organization.serverMeta.didSendDomainSetupMail;
            const didSendWarning = organization.serverMeta.DNSRecordWarningCount > 0;
            organization.serverMeta.DNSRecordWarningCount = 0;

            const wasActive = organization.privateMeta.mailDomainActive;
            await organization.updateAWSMailIdenitity();

            // yay! Do not Save until after doing AWS changes
            await organization.save();

            if (wasUnstable && !organization.serverMeta.isDNSUnstable) {
                console.warn('DNS settings became stable for ' + organization.name + ' ' + organization.id);

                await this.sendEmailTemplate(organization, {
                    type: EmailTemplateType.OrganizationStableDNS,
                    bcc: true,
                });
            } else if (!wasActive && organization.privateMeta.mailDomainActive && (!didSendDomainSetupMail || didSendWarning) && !organization.serverMeta.isDNSUnstable) {
                organization.serverMeta.didSendDomainSetupMail = true;
                await organization.save();

                if (!didSendDomainSetupMail) {
                    await this.sendEmailTemplate(organization, {
                        type: EmailTemplateType.OrganizationDNSSetupComplete,
                    });
                } else {
                    await this.sendEmailTemplate(organization, {
                        type: EmailTemplateType.OrganizationValidDNS,
                    });
                }
            }
        } else {
            // DNS settings gone broken
            if (organization.privateMeta.mailDomain) {
                organization.privateMeta.pendingMailDomain = organization.privateMeta.pendingMailDomain ?? organization.privateMeta.mailDomain;
                organization.privateMeta.mailDomain = null;
            }

            const wasDNSUnstable = organization.serverMeta.isDNSUnstable;

            organization.serverMeta.markDNSFailure();

            // disable AWS emails
            organization.privateMeta.mailDomainActive = false;

            // save
            await organization.save();

            if (!wasDNSUnstable && organization.serverMeta.isDNSUnstable) {
                // DNS became instable
                console.warn('DNS settings became instable for ' + organization.name + ' ' + organization.id);

                await this.sendEmailTemplate(organization, {
                    type: EmailTemplateType.OrganizationUnstableDNS,
                    bcc: true,
                });
            } else if (!organization.serverMeta.isDNSUnstable && organization.serverMeta.didSendDomainSetupMail && organization.serverMeta.DNSRecordWarningCount == 0) {
                organization.serverMeta.DNSRecordWarningCount += 1;
                await organization.save();

                await this.sendEmailTemplate(organization, {
                    type: EmailTemplateType.OrganizationInvalidDNS,
                });
            }
        }
    }

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

        // Create e-mail builder
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
