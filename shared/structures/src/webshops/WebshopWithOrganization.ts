import { AutoEncoder, field } from '@simonbackx/simple-encoding';
import { BaseOrganization } from '../Organization.js';
import { WebshopPreview } from './Webshop.js';

export class WebshopWithOrganization extends AutoEncoder {
    @field({ decoder: WebshopPreview })
    webshop: WebshopPreview = WebshopPreview.create({});

    @field({ decoder: BaseOrganization })
    organization: BaseOrganization = BaseOrganization.create({});

    /**
     * Proxy the webshop id so this object can be used in table/routing contexts
     * that require an id field (e.g. ModernTableView Route and useBackForward).
     */
    get id(): string {
        return this.webshop.id;
    }

    /**
     * Convenience getter for the webshop's full public URL (including https:// protocol).
     */
    get url(): string {
        return 'https://' + this.webshop.getUrl(this.organization);
    }
}
