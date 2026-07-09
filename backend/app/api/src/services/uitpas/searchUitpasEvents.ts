import { UitpasEventResponse, UitpasEventsResponse } from '@stamhoofd/structures';
import { SimpleError } from '@simonbackx/simple-errors';

/* Pick a translated string, prefer 'nl' */
function pickTranslation(value: unknown): string {
    if (typeof value !== 'object' || value === null) {
        return '';
    }
    const entries = Object.entries(value as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string');
    if (entries.length === 0) {
        return '';
    }
    const nl = entries.find(([key]) => key === 'nl');
    return nl ? nl[1] : entries[0][1];
}

type EventsResponse = {
    totalItems: number;
    itemsPerPage: number;
    member: Array<{
        '@id': string;
        'name': Record<string, string>;
        'location': {
            name: Record<string, string>;
        };
        'startDate'?: string;
        'endDate'?: string;
    }>;
};

function assertIsEventsResponse(json: unknown): asserts json is EventsResponse {
    if (
        typeof json !== 'object'
        || json === null
        || !('totalItems' in json)
        || typeof json.totalItems !== 'number'
        || !('itemsPerPage' in json)
        || typeof json.itemsPerPage !== 'number'
        || !('member' in json)
        || !Array.isArray(json.member)
        || json.member.some(member => (
            typeof member !== 'object'
            || member === null
            || !('@id' in member)
            || typeof member['@id'] !== 'string'
            || !('name' in member)
            || pickTranslation(member.name) === ''
            || !('location' in member)
            || typeof member.location !== 'object'
            || member.location === null
            || !('name' in member.location)
            || typeof member.location.name !== 'object'
            || member.location.name === null
        ))
    ) {
        console.error('Invalid events response', json);
        throw new SimpleError({
            code: 'invalid_events_response',
            message: `Invalid events response`,
            human: $t(`%1BY`),
        });
    }
}

export async function searchUitpasEvents(clientId: string, uitpasOrganizerId: string, textQuery?: string): Promise<UitpasEventsResponse> {
    // uses no credentials (only client id of the organization)
    // https://docs.publiq.be/docs/uitpas/events/searching
    if (!clientId) {
        throw new SimpleError({
            code: 'no_client_id_for_uitpas_events',
            message: `No client ID configured for Uitpas events`,
            human: $t(`%1BZ`),
        });
    }
    const baseUrl = STAMHOOFD.UITPAS_API_URL?.includes('test') ? 'https://search-test.uitdatabank.be/events' : 'https://search.uitdatabank.be/events';
    const params = new URLSearchParams();
    params.append('clientId', clientId);
    params.append('organizerId', uitpasOrganizerId);
    params.append('embed', 'true');
    params.append('uitpas', 'true');
    params.append('disableDefaultFilters', 'true');
    params.append('start', '0');
    params.append('limit', '200');
    if (textQuery) {
        params.append('text', textQuery);
    }
    params.append('sort[availableTo]', 'desc'); // last available first
    const url = `${baseUrl}?${params.toString()}`;
    const myHeaders = new Headers();
    myHeaders.append('Accept', 'application/json');
    const requestOptions = {
        method: 'GET',
        headers: myHeaders,
    };
    const response = await fetch(url, requestOptions).catch(() => {
        // Handle network errors
        throw new SimpleError({
            code: 'uitpas_unreachable_searching_events',
            message: `Network issue when searching for UiTPAS events`,
            human: $t(
                `We konden UiTPAS niet bereiken om UiTPAS-evenementen op te zoeken. Probeer het later opnieuw.`,
            ),
        });
    });
    if (!response.ok) {
        console.error('Unsuccessful response when searching for UiTPAS events', response);
        throw new SimpleError({
            code: 'unsuccessful_response_searching_uitpas_events',
            message: `Unsuccessful response when searching for UiTPAS events`,
            human: $t(`%18C`),
        });
    }
    const json = await response.json().catch(() => {
        // Handle JSON parsing errors
        throw new SimpleError({
            code: 'invalid_json_searching_uitpas_events',
            message: `Invalid json when searching for UiTPAS events`,
            human: $t(
                `Er is een fout opgetreden bij het communiceren met UiTPAS. Probeer het later opnieuw.`,
            ),
        });
    });

    return parseUitpasEventsResponse(json);
}

export function parseUitpasEventsResponse(json: unknown): UitpasEventsResponse {
    assertIsEventsResponse(json);
    const eventsResponse = new UitpasEventsResponse();
    eventsResponse.totalItems = json.totalItems;
    eventsResponse.itemsPerPage = json.itemsPerPage;
    eventsResponse.member = json.member.map((member) => {
        const event = new UitpasEventResponse();
        event.url = member['@id'];
        event.name = pickTranslation(member.name);
        event.location = pickTranslation(member.location.name);
        if (member.startDate) {
            event.startDate = new Date(member.startDate);
        }
        if (member.endDate) {
            event.endDate = new Date(member.endDate);
        }
        return event;
    });
    return eventsResponse;
}
