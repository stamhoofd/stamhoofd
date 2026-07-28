import type { I18n } from '@stamhoofd/backend-i18n';
import type { Organization } from '@stamhoofd/models';
import { PasswordToken, Platform, User } from '@stamhoofd/models';
import { getAppHost } from '@stamhoofd/structures';

/**
 * Owns the password recovery links.
 *
 * Which app the link points to depends on whether the user is an administrator of the organization,
 * and that requires the platform. Models have no request context to resolve the platform they
 * belong to, so both the permission check and the url building live here instead of on PasswordToken.
 */
export class PasswordForgotService {
    /**
     * Create a new password token for the user and build the recovery url for it.
     */
    static async getPasswordRecoveryUrl(user: User, organization: Organization | null, i18n: I18n, validUntil?: Date) {
        // Send an e-mail to say you already have an account + follow password forgot flow
        const token = await PasswordToken.createToken(user, validUntil);
        return await this.getPasswordRecoveryUrlForToken(token, organization, i18n, user);
    }

    /**
     * Build the recovery url for an already created password token.
     * Pass the user to avoid an extra query when it is already loaded.
     */
    static async getPasswordRecoveryUrlForToken(token: PasswordToken, organization: Organization | null, i18n: I18n, user?: User) {
        const tokenUser = user ?? await User.getByID(token.userId);
        if (!tokenUser) {
            throw new Error('PasswordToken without a valid user');
        }

        if (tokenUser.organizationId !== null && ((tokenUser.organizationId ?? null) !== (organization?.id ?? null))) {
            throw new Error('Unexpected mismatch in organization id for PasswordToken');
        }

        const hasOrganizationPermissions = organization ? tokenUser.permissions?.forOrganization(organization, await Platform.getSharedStruct())?.isEmpty === false : false;
        const host = 'https://' + getAppHost(hasOrganizationPermissions ? 'dashboard' : 'registration', organization, hasOrganizationPermissions, i18n);
        return host + '/reset-password?token=' + encodeURIComponent(token.token);
    }
}
