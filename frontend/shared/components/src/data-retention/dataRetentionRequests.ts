import type { Decoder } from '@common/encoding';
import type { SessionContext } from '@stamhoofd/frontend-session/SessionContext';
import type { DataRetentionCategory, DataRetentionTerms } from '@stamhoofd/structures';
import { DataRetentionPolicyUpdate, DataRetentionPreview, DataRetentionSettings } from '@stamhoofd/structures';

/**
 * Without an organization in scope (the administration portal), these requests use the terms of the platform.
 */
export async function loadDataRetentionSettings(context: SessionContext, owner: object) {
    const response = await context.authenticatedServer.request({
        method: 'GET',
        path: '/data-retention',
        decoder: DataRetentionSettings as Decoder<DataRetentionSettings>,
        owner,
    });
    return response.data;
}

/**
 * Needs a fresh authentication: run it with useFreshAction.
 */
export async function saveDataRetentionTerms(context: SessionContext, owner: object, category: DataRetentionCategory, terms: DataRetentionTerms) {
    const response = await context.authenticatedServer.request({
        method: 'PATCH',
        path: '/data-retention',
        body: DataRetentionPolicyUpdate.create({ category, terms }),
        decoder: DataRetentionSettings as Decoder<DataRetentionSettings>,
        owner,
        shouldRetry: false,
    });
    return response.data;
}

export async function cancelPendingDataRetentionChange(context: SessionContext, owner: object, category: DataRetentionCategory) {
    const response = await context.authenticatedServer.request({
        method: 'DELETE',
        path: '/data-retention/pending/' + encodeURIComponent(category),
        decoder: DataRetentionSettings as Decoder<DataRetentionSettings>,
        owner,
        shouldRetry: false,
    });
    return response.data;
}

/**
 * What saving these terms would do. Does not need a fresh authentication.
 */
export async function previewDataRetentionTerms(context: SessionContext, owner: object, category: DataRetentionCategory, terms: DataRetentionTerms) {
    const response = await context.authenticatedServer.request({
        method: 'POST',
        path: '/data-retention/preview',
        body: DataRetentionPolicyUpdate.create({ category, terms }),
        decoder: DataRetentionPreview as Decoder<DataRetentionPreview>,
        owner,
        shouldRetry: false,
        timeout: 30 * 1000,
    });
    return response.data;
}
