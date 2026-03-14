import { appToUri } from '@stamhoofd/structures';
import { I18nController } from './I18nController';

export class LocalizedDomains {
    static getDomain(localizedDomain: LocalizedDomain) {
        return I18nController.getDomain(localizedDomain);
    }

    static get adminUrl() {
        return 'https://' + STAMHOOFD.domains.dashboard + '/' + appToUri('admin');
    }

    static get dashboard() {
        return STAMHOOFD.domains.dashboard;
    }

    static get marketing() {
        return this.getDomain(STAMHOOFD.domains.marketing);
    }

    static get marketingUrl() {
        return 'https://' + this.marketing;
    }

    static get documentation() {
        return this.getDomain(STAMHOOFD.domains.documentation ?? STAMHOOFD.domains.marketing);
    }

    static getDocs(path: string) {
        return 'https://' + this.documentation + '/' + path + '/';
    }
}
