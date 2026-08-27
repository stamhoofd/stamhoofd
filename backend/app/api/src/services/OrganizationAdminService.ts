import type { Organization } from '@stamhoofd/models';
import { Platform, Token, User } from '@stamhoofd/models';
import type { EmailInterfaceRecipient } from '@stamhoofd/email';
import type { OrganizationEmail } from '@stamhoofd/structures';
import { AccessRight, Recipient } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

/**
 * Resolves which administrators of an organization should receive a given kind of email.
 */
export class OrganizationAdminService {
    /**
     * E-mail address when we receive replies for organization@stamhoofd.email.
     * Note that this sould be private because it can contain personal e-mail addresses if the organization is not configured correctly
     */
    static async getReplyEmails(organization: Organization): Promise<EmailInterfaceRecipient[]> {
        const sender: OrganizationEmail | undefined = organization.privateMeta.emails.find(e => e.default) ?? organization.privateMeta.emails[0];

        if (sender) {
            return [
                {
                    name: sender.name,
                    email: sender.email,
                },
            ];
        }

        return await this.getAdminToEmails(organization);
    }

    static async getAdmins(organization: Organization) {
        return await User.getAdmins(organization.id, { verified: true });
    }

    /**
     * These email addresess are private
     */
    static async getFullAdmins(organization: Organization) {
        const admins = await this.getAdmins(organization);
        const platform = await Platform.getSharedStruct();

        // Only full access
        return admins.filter(a => a.permissions && a.permissions.forOrganization(organization, platform, { inheritFromPlatform: false })?.hasFullAccess());
    }

    /**
     * These email addresess are private
     */
    static async getFinanceAdmins(organization: Organization) {
        const admins = await this.getAdmins(organization);
        const platform = await Platform.getSharedStruct();
        const filtered = admins.filter(a => a.permissions && (a.permissions.forOrganization(organization, platform, { inheritFromPlatform: false })?.hasFullAccess() || a.permissions.forOrganization(organization, platform, { inheritFromPlatform: false })?.hasAccessRight(AccessRight.OrganizationFinanceDirector)));

        // Only full access
        return filtered;
    }

    /**
     * These email addresess are private
     */
    static async getAdminToEmails(organization: Organization): Promise<EmailInterfaceRecipient[]> {
        const filtered = await this.getFullAdmins(organization);

        if (STAMHOOFD.environment === 'production') {
            if (filtered.length > 1) {
                // remove stamhoofd email addresses
                const f = filtered.flatMap(f => f.getEmailTo()).filter(e => !e.email.endsWith('@stamhoofd.be') && !e.email.endsWith('@stamhoofd.nl'));
                if (f.length > 0) {
                    return f;
                }
            }
        }

        return filtered.flatMap(f => f.getEmailTo());
    }

    static adminsToRecipients(admins: User[]) {
        return admins.flatMap((f) => {
            return Recipient.create({
                firstName: f.firstName,
                lastName: f.lastName,
                email: f.email,
                language: f.language,
                replacements: [],
            });
        });
    }

    /**
     * These email addresess are private
     */
    static async getAdminRecipients(organization: Organization): Promise<Recipient[]> {
        const filtered = await this.getFullAdmins(organization);
        return this.adminsToRecipients(filtered);
    }

    /**
     * These email addresess are private
     */
    static async getFinanceAdminRecipients(organization: Organization): Promise<Recipient[]> {
        const filtered = await this.getFinanceAdmins(organization);
        return this.adminsToRecipients(filtered);
    }

    /**
     * Returns one email for invoices. since in ubl we can only add one address.
     * We choose the oldest user that was active in the last 3 months (otherwise the oldest user if noone was active)
     */
    static async getInvoicingToEmail(organization: Organization): Promise<string | undefined> {
        const admins = await this.getAdmins(organization);

        const tokens = await Token.select().where('userId', admins.map(a => a.id)).fetch();

        // Sort by admins that were active in the last 3 months, then creation date
        const cutoffDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 31 * 3);
        admins.sort((a, b) => {
            const aTokens = tokens.filter(t => t.userId === a.id);
            const bTokens = tokens.filter(t => t.userId === b.id);
            const aActive = !!aTokens.find(t => t.updatedAt > cutoffDate);
            const bActive = !!bTokens.find(t => t.updatedAt > cutoffDate);
            return Sorter.stack(
                Sorter.byBooleanValue(aActive, bActive),
                Sorter.byDateValue(b.createdAt, a.createdAt),
            );
        });

        const platform = await Platform.getSharedStruct();
        const filtered = admins.filter(a => a.verified && a.permissions && !a.email.endsWith('@stamhoofd.be') && (a.permissions.forOrganization(organization, platform, { inheritFromPlatform: false })?.hasFullAccess() || a.permissions.forOrganization(organization, platform, { inheritFromPlatform: false })?.hasAccessRight(AccessRight.OrganizationFinanceDirector)));

        if (filtered.length > 0) {
            return filtered.map(f => f.email)[0];
        }
        const filtered2 = admins.filter(a => a.verified && a.permissions && (a.permissions.forOrganization(organization, platform, { inheritFromPlatform: false })?.hasFullAccess() || a.permissions.forOrganization(organization, platform, { inheritFromPlatform: false })?.hasAccessRight(AccessRight.OrganizationFinanceDirector)));

        if (filtered2.length > 0) {
            return filtered2.map(f => f.email)[0];
        }
        return undefined;
    }
}
