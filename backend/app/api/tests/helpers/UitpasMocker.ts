import nock from 'nock';
import {
    UitpasEventResponse,
    UitpasEventsResponse,
    UitpasOrganizerResponse,
    UitpasOrganizersResponse,
} from '@stamhoofd/structures';

type UitpasTestEvent = {
    id: string;
    name: string;
    location?: string;
    startDate?: Date;
    endDate?: Date;
    ticketSales: {
        uitpasNumber: string;
        id: string;
        price: number;
    }[];
    staticTariffs: {
        id: string;
        discountPercent: number;
    }[];
};

export class UitpasMocker {
    baseUrls = [
        {
            databank: 'https://io-test.uitdatabank.be',
            pas: 'https://api-test.uitpas.be',
            id: 'https://account-test.uitid.be',
        },
        {
            databank: 'https://io.uitdatabank.be',
            pas: 'https://api.uitpas.be',
            id: 'https://account.uitid.be',
        },
    ];

    accessTokens: { [accessToken: string]: string } = {}; // accessToken -> clientId
    clientPermissions: { [clientId: string]: string[] } = {}; // clientId -> permissions

    passes: {
        [uitpasNumber: string]: {
            socialTariffStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED'; // etc
            messages?: { text: string }[];
        };
    } = {};

    organizers: {
        id: string;
        name: string;
        events: UitpasTestEvent[];
    }[] = [];

    addUitpasNumber(uitpasNumber: string, socialTariffStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED', messages?: { text: string }[]) {
        this.passes[uitpasNumber] = {
            socialTariffStatus: socialTariffStatus,
            messages: messages,
        };
    }

    addClientCredentials(clientId: string, permissions: string[]) {
        this.clientPermissions[clientId] = permissions;
    }

    start() {
        nock.cleanAll();
        nock.enableNetConnect();

        const uitpasMocker = this;

        for (const baseUrl of this.baseUrls) {
            // access token endpoint
            nock(baseUrl.id)
                .persist()
                .post('/realms/uitid/protocol/openid-connect/token')
                .reply(200, (_uri, requestBody) => {
                    const params = new URLSearchParams(requestBody as string);
                    const clientId = params.get('client_id') ?? '';
                    const token = `mock-access-token-${clientId}`;
                    uitpasMocker.accessTokens[token] = clientId;
                    return {
                        access_token: token,
                        expires_in: 3600,
                        token_type: 'bearer',
                    };
                });

            // EVENTS endpoint
            nock(baseUrl.databank)
                .persist()
                .get('/events')
                .query(true)
                .reply(200, function () {
                    const url = new URL(this.req.path, `${baseUrl.databank}`);
                    const organizerId = url.searchParams.get('organizerId');

                    const organizer = organizerId
                        ? uitpasMocker.organizers.find(o => o.id === organizerId)
                        : undefined;

                    if (!organizer) {
                        return UitpasEventsResponse.create({ totalItems: 0, itemsPerPage: 0, member: [] });
                    }

                    return UitpasEventsResponse.create({
                        totalItems: organizer.events.length,
                        itemsPerPage: organizer.events.length,
                        member: organizer.events.map(event => UitpasEventResponse.create({
                            url: `${baseUrl.databank}/events/${event.id}`,
                            name: event.name,
                            location: event.location,
                            startDate: event.startDate,
                            endDate: event.endDate,
                        })),
                    });
                });

            // ORGANIZER by ID
            nock(baseUrl.databank)
                .persist()
                .get(/\/organizers\/[^/]+$/)
                .reply(function (uri) {
                    const organizerId = uri.split('/').pop()!;
                    const org = uitpasMocker.organizers.find(o => o.id === organizerId);

                    if (!org) {
                        return [404, {
                            title: 'Not Found',
                            detail: `Organizer ${organizerId} not found`,
                        }];
                    }

                    return [200, {
                        '@id': `${baseUrl.databank}/organizers/${org.id}`,
                        'name': {
                            nl: org.name,
                        },
                    }];
                });

            // ORGANIZER search by name
            nock(baseUrl.pas)
                .persist()
                .get('/organizers')
                .query(true)
                .reply(200, function () {
                    const url = new URL(this.req.path, `${baseUrl.pas}`);
                    const name = url.searchParams.get('name');

                    const matching = name
                        ? uitpasMocker.organizers.filter(o => o.name.includes(name))
                        : [];

                    return UitpasOrganizersResponse.create({
                        totalItems: matching.length,
                        member: matching.map(org => UitpasOrganizerResponse.create({ id: org.id, name: org.name })),
                    });
                });

            // passes endpoint
            nock(baseUrl.pas)
                .persist()
                .get(/\/passes\/[^/]+$/)
                .reply(function () {
                    const path = this.req.path;
                    const url = new URL(path, baseUrl.pas);
                    const uitpasNumber = url.pathname.split('/').pop()!;

                    const pass = uitpasMocker.passes[uitpasNumber];

                    if (!pass) {
                        return [404, {
                            endUserMessage: {
                                nl: 'Dit UiTPAS-nummer werd niet gevonden.',
                            },
                        }];
                    }

                    const responseBody: any = {
                        socialTariff: {
                            status: pass.socialTariffStatus,
                        },
                    };

                    if (pass.messages) {
                        responseBody.messages = pass.messages;
                    }

                    return [200, responseBody];
                });

            // tariff for event with specific uitpas number
            nock(baseUrl.pas)
                .persist()
                .get('/tariffs')
                .query(true)
                .reply(function () {
                    const path = typeof this.req.path === 'string' ? this.req.path : '';
                    const url = new URL(path, `${baseUrl.pas}`);
                    const eventId = url.searchParams.get('eventId');
                    const uitpasNumber = url.searchParams.get('uitpasNumber');
                    let regularPrice: string | number | null = url.searchParams.get('regularPrice');
                    if (!eventId || !uitpasNumber || !regularPrice || typeof regularPrice !== 'string' || isNaN(Number(regularPrice)) || typeof eventId !== 'string' || typeof uitpasNumber !== 'string') {
                        return [400, { message: 'Missing or wrong eventId, uitpasNumber or regularPrice' }];
                    }
                    regularPrice = Number(regularPrice); // Convert to cents

                    const event = uitpasMocker.organizers.flatMap(o => o.events).find(e => e.id === eventId);
                    if (!event) {
                        return [404, {
                            endUserMessage: {
                                nl: 'Het evenement werd niet gevonden.',
                            },
                        }];
                    }
                    if (event.ticketSales.find(ts => ts.uitpasNumber === uitpasNumber)) {
                        return [200, {
                            available: [],
                            endUserMessage: {
                                nl: 'Je kan dit ticket niet meer aankopen aan kansentarief omdat je het al eerder hebt gekocht. Je kan maximaal 1 ticket(s) kopen aan kansentarief voor deze activiteit.',
                            },
                        }];
                    }
                    return [200, {
                        available: event.staticTariffs.map(tariff => ({
                            id: tariff.id,
                            price: tariff.discountPercent * regularPrice,
                        })),
                    }];
                });

            // static tariff for event
            nock(baseUrl.pas)
                .persist()
                .get('/tariffs/static')
                .query(true)
                .reply(function () {
                    const path = typeof this.req.path === 'string' ? this.req.path : '';
                    const url = new URL(path, `${baseUrl.pas}`);
                    const eventId = url.searchParams.get('eventId');
                    let regularPrice: string | number | null = url.searchParams.get('regularPrice');
                    if (!eventId || !regularPrice || typeof regularPrice !== 'string' || isNaN(Number(regularPrice)) || typeof eventId !== 'string') {
                        return [400, { message: 'Missing or wrong eventId, uitpasNumber or regularPrice' }];
                    }
                    regularPrice = Number(regularPrice);

                    const event = uitpasMocker.organizers.flatMap(o => o.events).find(e => e.id === eventId);
                    if (!event) {
                        return [404, {
                            endUserMessage: {
                                nl: 'Het evenement werd niet gevonden.',
                            },
                        }];
                    }
                    return [200, {
                        available: event.staticTariffs.map(tariff => ({
                            id: tariff.id,
                            price: tariff.discountPercent * regularPrice,
                        })),
                    }];
                });

            // permissions endpoint
            nock(baseUrl.pas)
                .persist()
                .get('/permissions')
                .reply(function () {
                    const auth = this.req.headers['authorization'];
                    const token = Array.isArray(auth) ? auth[0] : auth;
                    if (!token || !token.startsWith('Bearer ')) {
                        return [401, { message: 'Unauthorized' }];
                    }
                    const accessToken = token.split(' ')[1];
                    const clientId = uitpasMocker.accessTokens[accessToken];
                    const permissions = uitpasMocker.clientPermissions[clientId];
                    if (!permissions) {
                        return [200, []];
                    }
                    return [200, uitpasMocker.organizers.map(org => ({
                        organizer: {
                            id: org.id,
                            name: org.name,
                        },
                        permissions: permissions,
                    }))];
                });
        }
    }

    clear() {
        this.organizers = [];
    }

    stop() {
        nock.cleanAll();
        nock.disableNetConnect();
    }
}
