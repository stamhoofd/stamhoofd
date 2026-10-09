import { I18n } from '@stamhoofd/backend-i18n';
import type { Organization } from '@stamhoofd/models';
import { Platform } from '@stamhoofd/models';

/**
 * Every tag Stamhoofd manages starts with this prefix. Tags without it are never touched.
 */
export const MAILCHIMP_TAG_PREFIX = 'Stamhoofd: ';

/**
 * Mailchimp refuses longer tag names
 */
const MAX_TAG_LENGTH = 100;

function limit(tag: string) {
    return tag.length <= MAX_TAG_LENGTH ? tag : tag.substring(0, MAX_TAG_LENGTH - 1) + '…';
}

/**
 * Names of the tags Stamhoofd manages in Mailchimp. Tags are matched by name, so they always use the
 * language of the organization (or platform), never the language of the administrator who starts a sync.
 */
export class MailchimpTags {
    readonly i18n: I18n;

    constructor(i18n: I18n) {
        this.i18n = i18n;
    }

    static async forScope(organization: Organization | null) {
        const platform = await Platform.getShared();
        const language = organization?.language ?? platform.language ?? I18n.defaultLanguage;
        const country = organization?.address.country ?? STAMHOOFD.fixedCountry ?? I18n.defaultCountry;
        return new MailchimpTags(new I18n(language, country));
    }

    get member() {
        return MAILCHIMP_TAG_PREFIX + this.i18n.$t('Lid');
    }

    get parent() {
        return MAILCHIMP_TAG_PREFIX + this.i18n.$t('Ouder');
    }

    get customer() {
        return MAILCHIMP_TAG_PREFIX + this.i18n.$t('Besteller');
    }

    get removed() {
        return MAILCHIMP_TAG_PREFIX + this.i18n.$t('Niet meer ingeschreven');
    }

    group(name: string) {
        return limit(MAILCHIMP_TAG_PREFIX + this.i18n.$t('Groep') + ' – ' + name);
    }

    organization(name: string) {
        return limit(MAILCHIMP_TAG_PREFIX + this.i18n.$t('Vereniging') + ' – ' + name);
    }

    webshop(name: string) {
        return limit(MAILCHIMP_TAG_PREFIX + this.i18n.$t('Webshop') + ' – ' + name);
    }

    record(name: string) {
        return limit(MAILCHIMP_TAG_PREFIX + name);
    }

    recordChoice(name: string, choice: string) {
        return limit(MAILCHIMP_TAG_PREFIX + name + ' – ' + choice);
    }

    isManaged(tag: string) {
        return tag.startsWith(MAILCHIMP_TAG_PREFIX);
    }

    /**
     * Tags managed by order synchronisations. Member synchronisations never change them.
     */
    isOrderTag(tag: string) {
        return tag === this.customer || tag.startsWith(this.webshop(''));
    }

    isMemberTag(tag: string) {
        return this.isManaged(tag) && !this.isOrderTag(tag);
    }
}
