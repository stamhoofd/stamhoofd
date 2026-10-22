import { I18n } from '@stamhoofd/backend-i18n';
import type { Organization } from '@stamhoofd/models';
import { Platform } from '@stamhoofd/models';

/**
 * Mailchimp refuses longer tag names
 */
const MAX_TAG_LENGTH = 100;

/**
 * Prefix of tags created before tags started with the name of the platform. They stay managed, so a full sync replaces them.
 */
const LEGACY_PREFIX = 'Stamhoofd: ';

function limit(tag: string) {
    return tag.length <= MAX_TAG_LENGTH ? tag : tag.substring(0, MAX_TAG_LENGTH - 1) + '…';
}

/**
 * Names of the tags Stamhoofd manages in Mailchimp. Tags are matched by name, so they always use the
 * language of the organization (or platform), never the language of the administrator who starts a sync.
 */
export class MailchimpTags {
    readonly i18n: I18n;

    /**
     * Every tag Stamhoofd manages starts with the name of the platform. Tags without it are never touched,
     * so renaming the platform leaves the tags with the old name behind.
     */
    readonly prefix: string;

    constructor(i18n: I18n, platformName: string) {
        this.i18n = i18n;
        this.prefix = platformName + ': ';
    }

    static async forScope(organization: Organization | null) {
        const platform = await Platform.getShared();
        const language = organization?.language ?? platform.language ?? I18n.defaultLanguage;
        const country = organization?.address.country ?? STAMHOOFD.fixedCountry ?? I18n.defaultCountry;
        return new MailchimpTags(new I18n(language, country), platform.config.name);
    }

    get member() {
        return this.prefix + this.i18n.$t('%1PM');
    }

    get parent() {
        return this.prefix + this.i18n.$t('%14u');
    }

    get customer() {
        return this.prefix + this.i18n.$t('%ZwU');
    }

    get removed() {
        return this.prefix + this.i18n.$t('%ZwV');
    }

    /**
     * Default age group of the platform. Platforms often call organizations 'groups', so this cannot use the word for a group.
     */
    ageGroup(name: string) {
        return limit(this.prefix + this.i18n.$t('%wH') + ' – ' + name);
    }

    group(name: string) {
        return limit(this.prefix + this.i18n.$t('%wA') + ' – ' + name);
    }

    organization(name: string) {
        return limit(this.prefix + this.i18n.$t('%1PI') + ' – ' + name);
    }

    /**
     * Responsibility of the platform, optionally limited to the default age group the member holds it for
     */
    responsibility(name: string, ageGroup: string | null = null) {
        return limit(this.prefix + this.i18n.$t('%H2') + ' – ' + name + (ageGroup ? ' ' + this.i18n.$t('%wR') + ' ' + ageGroup : ''));
    }

    webshop(name: string) {
        return limit(this.prefix + this.i18n.$t('%1AV') + ' – ' + name);
    }

    record(name: string) {
        return limit(this.prefix + name);
    }

    recordChoice(name: string, choice: string) {
        return limit(this.prefix + name + ' – ' + choice);
    }

    private get managedPrefixes() {
        return this.prefix === LEGACY_PREFIX ? [this.prefix] : [this.prefix, LEGACY_PREFIX];
    }

    isManaged(tag: string) {
        return this.managedPrefixes.some(prefix => tag.startsWith(prefix));
    }

    /**
     * Tags managed by order synchronisations. Member synchronisations never change them.
     */
    isOrderTag(tag: string) {
        const customer = this.i18n.$t('%ZwU');
        const webshop = this.i18n.$t('%1AV') + ' – ';
        return this.managedPrefixes.some(prefix => tag === prefix + customer || tag.startsWith(prefix + webshop));
    }

    isMemberTag(tag: string) {
        return this.isManaged(tag) && !this.isOrderTag(tag);
    }
}
