import { UitpasEventResponse, UitpasEventsResponse } from '@stamhoofd/structures';
import { SimpleError } from '@simonbackx/simple-errors';

type EventsResponse = {
    totalItems: number;
    itemsPerPage: number;
    member: Array<{
        '@id': string;
        'name': {
            nl: string;
        };
        'location': {
            name: object;
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
            || typeof member.name !== 'object'
            || member.name === null
            || !('nl' in member.name)
            || typeof member.name.nl !== 'string'
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
            human: $t(`Er is een fout opgetreden bij het ophalen van de UiTPAS-evenementen.`),
        });
    }
}

export async function searchUitpasEvents(clientId: string, useTestEnv: boolean, uitpasOrganizerId: string, textQuery?: string): Promise<UitpasEventsResponse> {
    // uses no credentials (only client id of the organization)
    // https://docs.publiq.be/docs/uitpas/events/searching
    if (!clientId) {
        throw new SimpleError({
            code: 'no_client_id_for_uitpas_events',
            message: `No client ID configured for Uitpas events`,
            human: $t(`Er is geen UiTPAS client ID geconfigureerd voor deze organisatie.`),
        });
    }
    const baseUrl = 'https://search-test.uitdatabank.be/events';
    const params = new URLSearchParams();
    params.append('clientId', clientId);
    params.append('organizerId', uitpasOrganizerId);
    params.append('embed', 'true');
    params.append('uitpas', 'true');
    params.append('start', '0');
    params.append('limit', '200');
    if (textQuery) {
        params.append('text', textQuery);
    }
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
            human: $t(`Er is een fout opgetreden bij het verbinden met UiTPAS. Probeer het later opnieuw.`),
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

    assertIsEventsResponse(json);
    const eventsResponse = new UitpasEventsResponse();
    eventsResponse.totalItems = json.totalItems;
    eventsResponse.itemsPerPage = json.itemsPerPage;
    eventsResponse.member = json.member.map((member) => {
        const event = new UitpasEventResponse();
        event.url = member['@id'];
        event.name = member.name.nl;
        const locationName = member.location.name as Record<string, string>;
        const entrs = Object.entries(locationName);
        const hasNl = entrs.find(([key]) => key === 'nl');
        if (hasNl) {
            event.location = locationName.nl;
        }
        else {
            const lang = entrs[0];
            event.location = lang ? lang[1] : '';
        }
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
