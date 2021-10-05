export class GoogleTranslateHelper {
    static isGoogleTranslateDomain(domain: string): boolean {
        return domain.endsWith(".translate.goog")
    }

    static getDomainFromTranslateDomain(domain: string): string {
        if (this.isGoogleTranslateDomain(domain)) {
            // Strip it out
            let cleaned = domain.substr(0, domain.length - (".translate.goog").length )

            // Replace dashes with points
            cleaned = cleaned.replace(/-/g, ".")

            // Replace double points with dashes
            cleaned = cleaned.replace(/\.\./g, "-")
            return cleaned
        }
        return domain
    }
}