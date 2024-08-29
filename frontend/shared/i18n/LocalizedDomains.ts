import { I18nController } from ".";

export class LocalizedDomains {
    static getDomain(localizedDomain: LocalizedDomain) {
        return I18nController.getDomain(localizedDomain);
    }
    
    static get marketing() {
        return this.getDomain(STAMHOOFD.domains.marketing);
    }

    static get documentation() {
        return this.getDomain(STAMHOOFD.domains.documentation ?? STAMHOOFD.domains.marketing);
    }

    static getDocs(path: string) {
        return 'https://'+this.documentation+'/'+path+'/';
    }
}
