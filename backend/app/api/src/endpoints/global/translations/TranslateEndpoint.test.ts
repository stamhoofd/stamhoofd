import { Request } from '@simonbackx/simple-endpoints';
import type { Token } from '@stamhoofd/models';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TranslateRequest } from '@stamhoofd/structures/endpoints/TranslateRequest.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { Language } from '@stamhoofd/types/Language';
import type { OpenAIMocker } from '../../../../tests/helpers/OpenAIMocker.js';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initOpenAIApi } from '../../../../tests/init/initOpenAIApi.js';
import { initPlatformAdmin } from '../../../../tests/init/initPlatformAdmin.js';
import { SessionService } from '../../../services/SessionService.js';
import { TRANSLATION_MODEL } from '../../../services/TranslationService.js';
import { TranslateEndpoint } from './TranslateEndpoint.js';

const baseUrl = '/translate';
const endpoint = new TranslateEndpoint();

const tiptapDoc = {
    type: 'doc',
    content: [
        {
            type: 'paragraph',
            content: [
                { type: 'text', text: 'Hallo ' },
                { type: 'smartVariable', attrs: { id: 'firstName' } },
                { type: 'text', text: ', welkom!', marks: [{ type: 'bold' }] },
            ],
        },
    ],
};

describe('Endpoint.Translate', () => {
    let adminToken: Token;
    let mocker: OpenAIMocker;

    beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
        ({ adminToken } = await initPlatformAdmin());
    });

    beforeEach(() => {
        mocker = initOpenAIApi();
    });

    const translate = async (body: TranslateRequest, token: Token = adminToken) => {
        const request = Request.buildJson('POST', baseUrl, undefined, body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    test('translates strings and TipTap documents into multiple languages', async () => {
        const response = await translate(TranslateRequest.create({
            inputs: new Map<string, any>([
                ['name', 'Zomerkamp'],
                ['description', tiptapDoc],
            ]),
            sourceLanguage: Language.Dutch,
            targetLanguages: [Language.French, Language.English],
        }));

        expect(response.body.translations.size).toBe(2);

        const french = response.body.translations.get(Language.French)!;
        expect(french.get('name')).toBe('[French] Zomerkamp');
        expect(french.get('description')).toEqual({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        { type: 'text', text: '[French] Hallo ' },
                        { type: 'smartVariable', attrs: { id: 'firstName' } },
                        { type: 'text', text: '[French] , welkom!', marks: [{ type: 'bold' }] },
                    ],
                },
            ],
        });

        expect(response.body.translations.get(Language.English)!.get('name')).toBe('[English] Zomerkamp');

        // One request per language, all inputs sent together so the model has context
        expect(mocker.requests).toHaveLength(2);
        for (const request of mocker.requests) {
            expect(request.model).toBe(TRANSLATION_MODEL);
            const userMessage = JSON.parse(request.messages.find(m => m.role === 'user')!.content);
            expect(Object.keys(userMessage.inputs)).toEqual(['name', 'description']);
            expect(request.messages.find(m => m.role === 'system')!.content).toContain('written in Dutch');
        }
    });

    test('passes the context prompt to the model', async () => {
        await translate(TranslateRequest.create({
            inputs: new Map([['name', 'Zomerkamp']]),
            targetLanguages: [Language.French],
            context: 'Use informal language (tutoyer).',
        }));

        const system = mocker.lastRequest!.messages.find(m => m.role === 'system')!.content;
        expect(system).toContain('Use informal language (tutoyer).');
        expect(system).toContain('Detect the source language');
    });

    test('rejects an organization admin without full platform access', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);

        await expect(translate(TranslateRequest.create({
            inputs: new Map([['name', 'Zomerkamp']]),
            targetLanguages: [Language.French],
        }), token)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        expect(mocker.requests).toHaveLength(0);
    });

    test('rejects empty inputs and missing target languages', async () => {
        await expect(translate(TranslateRequest.create({
            inputs: new Map(),
            targetLanguages: [Language.French],
        }))).rejects.toThrow(STExpect.errorWithCode('invalid_field'));

        await expect(translate(TranslateRequest.create({
            inputs: new Map([['name', 'Zomerkamp']]),
            targetLanguages: [],
        }))).rejects.toThrow(STExpect.errorWithCode('invalid_field'));
    });

    test('rejects input values that are neither a string nor a TipTap document', async () => {
        const request = Request.buildJson('POST', baseUrl, undefined, {
            inputs: { name: 123 },
            sourceLanguage: null,
            targetLanguages: [Language.French],
            context: null,
        });
        request.headers.authorization = 'Bearer ' + adminToken.accessToken;

        await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('invalid_field'));
    });

    test('fails when the model output does not match the inputs', async () => {
        mocker.respondWith(() => ({ translations: { name: { type: 'doc' } } }));

        await expect(translate(TranslateRequest.create({
            inputs: new Map([['name', 'Zomerkamp']]),
            targetLanguages: [Language.French],
        }))).rejects.toThrow(STExpect.errorWithCode('translation_invalid_output'));
    });

    test('fails when OpenAI is unavailable', async () => {
        mocker.forceFailure();

        await expect(translate(TranslateRequest.create({
            inputs: new Map([['name', 'Zomerkamp']]),
            targetLanguages: [Language.French],
        }))).rejects.toThrow(STExpect.errorWithCode('translation_failed'));
    });

    test('fails when OPENAI_API_KEY is not configured', async () => {
        TestUtils.setEnvironment('OPENAI_API_KEY', undefined);
        const { adminToken: token } = await initPlatformAdmin();

        await expect(translate(TranslateRequest.create({
            inputs: new Map([['name', 'Zomerkamp']]),
            targetLanguages: [Language.French],
        }), token)).rejects.toThrow(STExpect.errorWithCode('translation_not_configured'));
    });
});
