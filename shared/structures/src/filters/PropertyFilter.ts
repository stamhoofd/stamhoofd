import { cloneObject, Data, Encodeable, EncodeContext, PlainObject } from '@simonbackx/simple-encoding';

import { AuditLogReplacement } from '../AuditLogReplacement.js';
import { Filterable } from '../members/records/RecordCategory.js';
import { StamhoofdFilterDecoder } from './FilteredRequest.js';
import { isEmptyFilter, StamhoofdFilter } from './StamhoofdFilter.js';

export class PropertyFilter implements Encodeable {
    constructor(enabledWhen: StamhoofdFilter | null, requiredWhen: StamhoofdFilter | null) {
        this.enabledWhen = enabledWhen;
        this.requiredWhen = requiredWhen;
    }

    static createDefault() {
        return new PropertyFilter(null, {});
    }

    /**
     * Enabled when...
     * null = always enabled
     */
    enabledWhen: StamhoofdFilter | null = null;

    /**
     * If enabled, whether it is required
     * null = always skippable
     * empty filter = always required
     */
    requiredWhen: StamhoofdFilter | null = null;

    isEnabled(object: Filterable): boolean {
        if (this.enabledWhen === null) {
            return true;
        }
        return object.doesMatchFilter(this.enabledWhen);
    }

    get isAlwaysEnabledAndRequired() {
        return this.enabledWhen === null && isEmptyFilter(this.requiredWhen) && this.requiredWhen !== null;
    }

    isRequired(object: Filterable): boolean {
        if (this.requiredWhen === null) {
            return false;
        }
        return object.doesMatchFilter(this.requiredWhen);
    }

    encode(context: EncodeContext): PlainObject {
        return {
            enabledWhen: StamhoofdFilterDecoder.encode(this.enabledWhen, context),
            requiredWhen: StamhoofdFilterDecoder.encode(this.requiredWhen, context),
        };
    }

    static decode<T>(data: Data): PropertyFilter {
        if (data.context.version < 251) {
            console.error('PropertyFilter: legacy filter detected - this is not implemented yet. Possible data loss.');
            return PropertyFilter.createDefault();
        }

        return new PropertyFilter(
            data.field('enabledWhen').nullable(StamhoofdFilterDecoder),
            data.field('requiredWhen').nullable(StamhoofdFilterDecoder),
        );
    }

    clone() {
        return new PropertyFilter(
            cloneObject(this.enabledWhen),
            cloneObject(this.requiredWhen),
        );
    }

    getDiffValue() {
        if (this.isAlwaysEnabledAndRequired) {
            return AuditLogReplacement.key('alwaysEnabledAndRequired');
        }
        if (this.enabledWhen === null && this.requiredWhen === null) {
            return AuditLogReplacement.key('alwaysEnabledAndOptional');
        }
        if (this.enabledWhen !== null && this.requiredWhen === null) {
            return AuditLogReplacement.key('sometimesEnabledAndOptional');
        }
        if (this.enabledWhen === null && this.requiredWhen !== null) {
            return AuditLogReplacement.key('alwaysEnabledAndSometimesRequired');
        }
        if (this.enabledWhen !== null && isEmptyFilter(this.requiredWhen)) {
            return AuditLogReplacement.key('sometimesEnabledAndRequired');
        }
        return AuditLogReplacement.key('sometimesEnabledAndSometimesRequired');
    }
}
