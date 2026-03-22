import { DecodedRequest } from '@simonbackx/simple-endpoints';
import { I18n } from './I18n.js';

export * from './I18n.js';

// Extend decoded request here
declare module '@simonbackx/simple-endpoints' {
    interface DecodedRequest<Params, Query, Body> {
        get i18n(): I18n;
        $t(key: string, replace?: Record<string, string>): string;
    }
}

Object.defineProperty(DecodedRequest.prototype, 'i18n', {
    get(this: DecodedRequest<unknown, unknown, unknown>) {
        return I18n.fromRequest(this);
    },
});

DecodedRequest.prototype.$t = function<Params, Query, Body>(this: DecodedRequest<Params, Query, Body>, key: string, replace?: Record<string, string>): string {
    return this.i18n.$t(key, replace);
};
