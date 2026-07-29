import type { GetEmailIdentityCommandOutput } from '@aws-sdk/client-sesv2';
import { CreateEmailIdentityCommand, DeleteEmailIdentityCommand, GetEmailIdentityCommand, PutEmailIdentityFeedbackAttributesCommand, PutEmailIdentityMailFromAttributesCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { Organization } from '@stamhoofd/models';
import { validateDNSRecords } from '@stamhoofd/models/helpers/DNSValidator.js';
import { DNSRecordStatus, EmailTemplateType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { OrganizationEmailService } from './OrganizationEmailService.js';

export class OrganizationDNSService {
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
            await this.updateAWSMailIdenitity(organization);

            // yay! Do not Save until after doing AWS changes
            await organization.save();

            if (wasUnstable && !organization.serverMeta.isDNSUnstable) {
                console.warn('DNS settings became stable for ' + organization.name + ' ' + organization.id);

                await OrganizationEmailService.sendEmailTemplate(organization, {
                    type: EmailTemplateType.OrganizationStableDNS,
                    bcc: true,
                });
            } else if (!wasActive && organization.privateMeta.mailDomainActive && (!didSendDomainSetupMail || didSendWarning) && !organization.serverMeta.isDNSUnstable) {
                organization.serverMeta.didSendDomainSetupMail = true;
                await organization.save();

                if (!didSendDomainSetupMail) {
                    await OrganizationEmailService.sendEmailTemplate(organization, {
                        type: EmailTemplateType.OrganizationDNSSetupComplete,
                    });
                } else {
                    await OrganizationEmailService.sendEmailTemplate(organization, {
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

                await OrganizationEmailService.sendEmailTemplate(organization, {
                    type: EmailTemplateType.OrganizationUnstableDNS,
                    bcc: true,
                });
            } else if (!organization.serverMeta.isDNSUnstable && organization.serverMeta.didSendDomainSetupMail && organization.serverMeta.DNSRecordWarningCount == 0) {
                organization.serverMeta.DNSRecordWarningCount += 1;
                await organization.save();

                await OrganizationEmailService.sendEmailTemplate(organization, {
                    type: EmailTemplateType.OrganizationInvalidDNS,
                });
            }
        }
    }

    static get forbiddenEmailDomains() {
        return [
            STAMHOOFD.domains.dashboard,
            ...Object.values(STAMHOOFD.domains.defaultBroadcastEmail ?? {}),
            ...Object.values(STAMHOOFD.domains.defaultTransactionalEmail ?? {}),
        ];
    }

    static async deleteAWSMailIdenitity(organization: Organization, mailDomain: string) {
        // Protect specific domain names
        if (this.forbiddenEmailDomains.includes(mailDomain.toLowerCase())) {
            return;
        }

        if (STAMHOOFD.environment !== 'production') {
            // Temporary ignore this
            return;
        }

        const client = new SESv2Client({});

        // Check if mail identitiy already exists..
        try {
            const cmd = new GetEmailIdentityCommand({
                EmailIdentity: mailDomain,
            });
            const result = await client.send(cmd);

            if (result.VerifiedForSendingStatus === true) {
                console.log('Cant delete AWS mail idenitiy @' + organization.id + ' for ' + mailDomain + ': already validated and might be in use by other organizations');
                return;
            }

            console.log('Deleting AWS mail identity @' + organization.id + ' for ' + mailDomain);

            const deleteCmd = new DeleteEmailIdentityCommand({
                EmailIdentity: mailDomain,
            });

            await client.send(deleteCmd);
            console.log('Deleted AWS mail idenitiy @' + organization.id + ' for ' + organization.privateMeta.mailDomain);
        } catch (e) {
            console.error('Could not delete AWS email identitiy @' + organization.id + ' for ' + organization.privateMeta.mailDomain);
            console.error(e);
        }
    }

    /**
     * Create or update the AWS mail idenitiy and also update the active state of the mailDomain
     */
    static async updateAWSMailIdenitity(organization: Organization) {
        if (organization.privateMeta.mailDomain === null) {
            return;
        }

        // Protect specific domain names
        if (['stamhoofd.be', 'stamhoofd.nl', 'stamhoofd.shop', 'stamhoofd.app', 'stamhoofd.email'].includes(organization.privateMeta.mailDomain)) {
            console.error('Tried to validate AWS mail identity with protected domains @' + organization.id);
            organization.privateMeta.mailDomainActive = false;
            return;
        }

        if (STAMHOOFD.environment !== 'production') {
            // Temporary ignore this
            organization.privateMeta.mailDomainActive = true;
            return;
        }

        const client = new SESv2Client({});
        const expectedConfigurationSetName = Formatter.slug(STAMHOOFD.platformName + '-domains');

        // Check if mail identitiy already exists..
        let exists = false;
        let existing: GetEmailIdentityCommandOutput | undefined = undefined;
        try {
            const cmd = new GetEmailIdentityCommand({
                EmailIdentity: organization.privateMeta.mailDomain,
            });

            existing = await client.send(cmd);
            exists = true;

            console.log('AWS mail idenitiy exists already: just checking the verification status in AWS @' + organization.id);

            if (existing.ConfigurationSetName !== expectedConfigurationSetName) {
                // Not allowed to use this identity
                organization.privateMeta.mailDomainActive = false;
                console.error('Organization is not allowed to use email identity ' + organization.privateMeta.mailDomain + ' @' + organization.id + ', got ' + existing.ConfigurationSetName);
                return;
            }

            organization.privateMeta.mailDomainActive = existing.VerifiedForSendingStatus ?? false;

            if (existing.VerifiedForSendingStatus !== true) {
                console.error('Not validated @' + organization.id);
            }

            if (existing.VerifiedForSendingStatus !== true && existing.DkimAttributes?.Status === 'FAILED') {
                console.error('AWS failed to verify DKIM records. Triggering a forced recheck @' + organization.id);

                const deleteCmd = new DeleteEmailIdentityCommand({
                    EmailIdentity: organization.privateMeta.mailDomain,
                });
                await client.send(deleteCmd);

                // Recreate it immediately
                exists = false;
            }
        } catch (e) {
            console.error(e);
        }

        if (!exists) {
            console.log('Creating email identity in AWS SES...');

            const cmd = new CreateEmailIdentityCommand({
                EmailIdentity: organization.privateMeta.mailDomain,
                ConfigurationSetName: expectedConfigurationSetName,
                DkimSigningAttributes: {
                    DomainSigningPrivateKey: organization.serverMeta.privateDKIMKey!,
                    DomainSigningSelector: Formatter.slug(STAMHOOFD.platformName),
                },
                Tags: [
                    {
                        Key: 'OrganizationId',
                        Value: organization.id,
                    },
                    {
                        Key: 'Environment',
                        Value: STAMHOOFD.environment ?? 'Unknown',
                    },
                ],
            });

            const result = await client.send(cmd);
            organization.privateMeta.mailDomainActive = result.VerifiedForSendingStatus ?? false;

            // Disable email forwarding of bounces and complaints
            // We handle this now with the configuration set
            const putFeedbackCmd = new PutEmailIdentityFeedbackAttributesCommand({
                EmailIdentity: organization.privateMeta.mailDomain,
                EmailForwardingEnabled: false,
            });

            await client.send(putFeedbackCmd);
        }

        if (organization.privateMeta.mailFromDomain && (!exists || (existing && (!existing.MailFromAttributes || existing.MailFromAttributes.MailFromDomain !== organization.privateMeta.mailFromDomain)))) {
            // Also set a from domain, to fix SPF
            console.log('Setting mail from domain: ' + organization.privateMeta.mailFromDomain + ' for ' + organization.id);

            const cmd = new PutEmailIdentityMailFromAttributesCommand({
                EmailIdentity: organization.privateMeta.mailDomain,
                BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
                MailFromDomain: organization.privateMeta.mailFromDomain,
            });

            await client.send(cmd);
        }
    }
}
