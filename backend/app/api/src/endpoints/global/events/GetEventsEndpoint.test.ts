import { Request } from '@node/endpoints';
import type { Event, Organization, Token } from '@stamhoofd/models';
import { EventFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import type { SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { LimitedFilteredRequest, SortItemDirection, TranslatedString } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetEventsEndpoint } from './GetEventsEndpoint.js';

const baseUrl = `/events`;
const endpoint = new GetEventsEndpoint();

type Scope = { host: string; token: Token };

describe('Endpoint.GetEventsEndpoint', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
        TestUtils.setEnvironment('locales', { [Country.Belgium]: [Language.Dutch, Language.English, Language.French] });
    });

    /**
     * Events are listed in the scope of the organization of the request host, so every test gets its own organization.
     */
    async function createScope(): Promise<Scope & { organization: Organization }> {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await SessionService.createSession(user);
        return { organization, host: organization.getApiHost(), token };
    }

    async function get(scope: Scope, { filter, sort, limit = 100, search, language = Language.Dutch }: { filter?: StamhoofdFilter; sort?: SortList; limit?: number; search?: string; language?: Language }) {
        const request = Request.get({
            path: baseUrl,
            host: scope.host,
            query: new LimitedFilteredRequest({ filter, sort, limit, search }),
            headers: {
                'authorization': 'Bearer ' + scope.token.accessToken,
                'x-locale': `${language}-BE`,
            },
        });
        return await testServer.test(endpoint, request);
    }

    /**
     * Follows the 'next' request of every page, like the frontend does. That request is built from the
     * sorter's getValue, so this covers getValue -> page filter -> query -> SQL for the name sorter.
     */
    async function fetchAllPages(scope: Scope, { filter, sort, limit, language }: { filter: StamhoofdFilter; sort: SortList; limit: number; language?: Language }) {
        const ids: string[] = [];
        let query: LimitedFilteredRequest | undefined = new LimitedFilteredRequest({ filter, sort, limit });
        let pages = 0;

        while (query) {
            const request = Request.get({
                path: baseUrl,
                host: scope.host,
                query,
                headers: {
                    'authorization': 'Bearer ' + scope.token.accessToken,
                    'x-locale': `${language ?? Language.Dutch}-BE`,
                },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);

            ids.push(...response.body.results.map(e => e.id));
            query = response.body.next;
            pages += 1;

            if (pages > 10) {
                throw new Error('Pagination did not terminate');
            }
        }

        return ids;
    }

    /**
     * Creates events with a mix of legacy (untranslated) and translated names for a fresh organization,
     * deliberately not in alphabetical order.
     */
    async function createMixedEvents() {
        const scope = await createScope();
        const events: Event[] = [];

        for (const name of [
            'Zomerkamp',
            new TranslatedString({ nl: 'Bosspel', en: 'Forest game' }),
            'Avondspel',
            new TranslatedString({ en: 'Dance night', fr: 'Soirée dansante' }),
            new TranslatedString({ nl: 'Weekend', en: 'Weekend' }),
        ]) {
            events.push(await new EventFactory({ organization: scope.organization, name }).create());
        }

        const [zomerkamp, bosspel, avondspel, danceNight, weekend] = events;
        return { scope, filter: { organizationId: scope.organization.id }, zomerkamp, bosspel, avondspel, danceNight, weekend };
    }

    describe('Name sorter', () => {
        test('Events are sorted by name ascending across all pages, mixing legacy and translated names', async () => {
            const { scope, filter, zomerkamp, bosspel, avondspel, danceNight, weekend } = await createMixedEvents();

            const ids = await fetchAllPages(scope, {
                filter,
                sort: [{ key: 'name', order: SortItemDirection.ASC }],
                limit: 2,
            });

            expect(ids).toEqual([avondspel.id, bosspel.id, danceNight.id, weekend.id, zomerkamp.id]);
        });

        test('Events are sorted by name descending across all pages', async () => {
            const { scope, filter, zomerkamp, bosspel, avondspel, danceNight, weekend } = await createMixedEvents();

            const ids = await fetchAllPages(scope, {
                filter,
                sort: [{ key: 'name', order: SortItemDirection.DESC }],
                limit: 2,
            });

            expect(ids).toEqual([zomerkamp.id, weekend.id, danceNight.id, bosspel.id, avondspel.id]);
        });

        test('Events are sorted on the name in the language of the request', async () => {
            const { scope, filter, zomerkamp, bosspel, avondspel, danceNight, weekend } = await createMixedEvents();

            const ids = await fetchAllPages(scope, {
                filter,
                sort: [{ key: 'name', order: SortItemDirection.ASC }],
                limit: 1,
                language: Language.English,
            });

            expect(ids).toEqual([avondspel.id, danceNight.id, bosspel.id, weekend.id, zomerkamp.id]);
        });

        test('Events with the same name are not skipped or duplicated between pages', async () => {
            const scope = await createScope();
            const events: Event[] = [];
            for (let i = 0; i < 5; i++) {
                events.push(await new EventFactory({ organization: scope.organization, name: i % 2 === 0 ? 'Kamp' : new TranslatedString({ nl: 'Kamp', en: 'Camp' }) }).create());
            }

            const ids = await fetchAllPages(scope, {
                filter: { organizationId: scope.organization.id },
                sort: [{ key: 'name', order: SortItemDirection.ASC }],
                limit: 2,
            });

            expect(ids).toIncludeSameMembers(events.map(e => e.id));
        });
    });

    describe('Name filter', () => {
        test('Filters on a legacy name', async () => {
            const { scope, filter, zomerkamp } = await createMixedEvents();

            const response = await get(scope, { filter: { ...filter, name: 'Zomerkamp' } });
            expect(response.status).toBe(200);
            expect(response.body.results.map(e => e.id)).toEqual([zomerkamp.id]);
        });

        test('Filters on a translated name in the language of the request', async () => {
            const { scope, filter, bosspel } = await createMixedEvents();

            const dutch = await get(scope, { filter: { ...filter, name: 'Bosspel' } });
            expect(dutch.body.results.map(e => e.id)).toEqual([bosspel.id]);

            const english = await get(scope, { filter: { ...filter, name: 'Forest game' }, language: Language.English });
            expect(english.body.results.map(e => e.id)).toEqual([bosspel.id]);

            const englishNameInDutchRequest = await get(scope, { filter: { ...filter, name: 'Forest game' } });
            expect(englishNameInDutchRequest.body.results).toHaveLength(0);
        });

        test('Falls back to another language when the name has no translation for the request language', async () => {
            const { scope, filter, danceNight } = await createMixedEvents();

            const response = await get(scope, { filter: { ...filter, name: 'Dance night' } });
            expect(response.body.results.map(e => e.id)).toEqual([danceNight.id]);
        });

        test('Searching matches legacy and translated names', async () => {
            const { scope, filter, zomerkamp, bosspel, avondspel } = await createMixedEvents();

            const response = await get(scope, { filter, search: 'spel' });
            expect(response.body.results.map(e => e.id)).toIncludeSameMembers([bosspel.id, avondspel.id]);

            const kamp = await get(scope, { filter, search: 'kamp' });
            expect(kamp.body.results.map(e => e.id)).toEqual([zomerkamp.id]);
        });
    });
});
