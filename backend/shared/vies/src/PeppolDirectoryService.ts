import { SimpleError } from '@simonbackx/simple-errors';
import type { PeppolEndointId } from '@stamhoofd/structures';
import { PeppolScheme } from '@stamhoofd/structures';
import axios from 'axios';

/**
 * The PEPPOL schemes (ISO 6523 ICD codes) we currently support for a custom
 * PEPPOL endpoint id. The scheme identifier is the numeric code used in the
 * PEPPOL participant identifier (e.g. `iso6523-actorid-upis::0208:...`).
 */
export const supportedPeppolSchemes: string[] = Object.values(PeppolScheme);

export class PeppolDirectoryServiceStatic {
    /**
     * Validates a custom PEPPOL endpoint id: the scheme must be supported and the
     * participant must be registered in the PEPPOL directory. Throws a SimpleError
     * (with field `customPeppolEndpointId`) when the id is invalid or unknown.
     */
    async validate(endpointId: PeppolEndointId): Promise<void> {
        const schemeID = endpointId.schemeID.trim();
        const id = endpointId.id.trim();

        if (!supportedPeppolSchemes.includes(schemeID)) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Unsupported PEPPOL scheme ' + schemeID,
                human: $t('%ZcX'),
                field: 'customPeppolEndpointId',
            });
        }

        if (id.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Missing PEPPOL endpoint id',
                human: $t('%ZcY'),
                field: 'customPeppolEndpointId',
            });
        }

        const participant = `iso6523-actorid-upis::${schemeID}:${id}`;

        let data: any;
        try {
            const response = await axios.request({
                method: 'GET',
                url: 'https://directory.peppol.eu/search/1.0/json',
                params: { participant },
            });
            data = response.data;
        } catch (e) {
            // The directory is unavailable: we can't validate the id right now.
            console.error('PEPPOL directory error', e);
            throw new SimpleError({
                code: 'service_unavailable',
                message: 'PEPPOL directory unavailable',
                human: $t('%Zcf'),
                field: 'customPeppolEndpointId',
            });
        }

        if (typeof data !== 'object' || data === null || !Array.isArray(data.matches)) {
            throw new SimpleError({
                code: 'service_unavailable',
                message: 'Invalid response from PEPPOL directory',
                human: $t('%Zcf'),
                field: 'customPeppolEndpointId',
            });
        }

        console.log('PEPPOL lookup', participant, data);

        const expected = `${schemeID}:${id}`.toLowerCase();
        const match = data.matches.find((m: any) => {
            return typeof m?.participantID?.value === 'string'
                && m.participantID.value.toLowerCase() === expected;
        });

        if (!match) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'PEPPOL participant not found in directory: ' + participant,
                human: $t('%Zcr', { id: `${schemeID}:${id}` }),
                field: 'customPeppolEndpointId',
            });
        }

        // Store the registered entity name from the directory. This is server-controlled
        // and overwrites any value the client may have sent (see ViesHelper.checkCompany).
        endpointId.entityName = this.extractEntityName(match);
    }

    /**
     * Best-effort extraction of the registered entity name from a PEPPOL directory match.
     * The directory returns one or more entities, each with a list of localized names.
     */
    private extractEntityName(match: any): string | null {
        const entities = Array.isArray(match?.entities) ? match.entities : [];
        for (const entity of entities) {
            const names = Array.isArray(entity?.name) ? entity.name : [];
            for (const n of names) {
                if (typeof n?.name === 'string' && n.name.trim().length > 0) {
                    return n.name.trim();
                }
            }
        }
        return null;
    }
}

export const PeppolDirectoryService = new PeppolDirectoryServiceStatic();
