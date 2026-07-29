// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import { expect } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { MemberFactory, OrganizationFactory, RegistrationFactory, Token, UserFactory } from '@stamhoofd/models';
import { File, PermissionLevel, RecordCategory, RecordFileAnswer, RecordSettings, RecordType, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { readFile } from 'node:fs/promises';
import { WorkerData } from '../helpers/index.js';

/**
 * A file of a member is uploaded by that member, and a File keeps the server it is stored on (see File in
 * @stamhoofd/structures). Nothing stops someone from storing a file that points at a server of their own, so
 * opening that url would take whoever looks at the member to a page an attacker controls: an easy way to
 * phish an administrator or a family member.
 *
 * We download the file instead, so a click never navigates anywhere.
 */
const attackerOrigin = 'https://files.attacker.example.com';
const attackerFilename = 'attest.html';
const attackerPage = '<!DOCTYPE html><html><body><h1>Log in to continue</h1></body></html>';

test.describe('Member file downloads @member-file-download', () => {
    let organization: Organization;
    let user: User;
    let recordSettings: RecordSettings;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        organization = await new OrganizationFactory({
            name: `Bestand downloaden ${WorkerData.id}`,
        }).create();

        // A questionnaire with a file the member uploads themselves
        recordSettings = RecordSettings.create({
            name: TranslatedString.create('Medisch attest'),
            type: RecordType.File,
            externalPermissionLevel: PermissionLevel.Write,
        });

        organization.meta.recordsConfiguration.recordCategories = [
            RecordCategory.create({
                name: TranslatedString.create('Vragenlijst'),
                records: [recordSettings],
            }),
        ];
        await organization.save();

        user = await new UserFactory({
            firstName: 'Marie',
            lastName: 'Dupont',
            email: `member-file-${WorkerData.id}@example.com`,
        }).create();

        const member = await new MemberFactory({
            organization,
            firstName: 'Marie',
            lastName: 'Dupont',
            user,
        }).create();

        // The questionnaire of an organization only applies to a member that is registered there
        await new RegistrationFactory({ member, organization }).create();

        // The answer points at an html file on a server of the attacker, which is what we would get when
        // someone stores a file we never uploaded ourselves
        member.details.recordAnswers.set(recordSettings.id, RecordFileAnswer.create({
            settings: recordSettings,
            file: new File({
                id: 'attacker-file',
                server: attackerOrigin,
                path: attackerFilename,
                size: attackerPage.length,
                name: attackerFilename,
                contentType: 'text/html',
            }),
        }));
        await member.save();
    });

    test('it downloads a file that points at another server, instead of opening it', async ({ page, context }) => {
        test.setTimeout(90_000);

        // The server of the attacker serves the html file, and allows us to read it
        let requestedAsDocument = false;

        await page.route(attackerOrigin + '/**', async (route, request) => {
            if (request.resourceType() === 'document') {
                requestedAsDocument = true;
            }

            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                headers: { 'access-control-allow-origin': '*' },
                body: attackerPage,
            });
        });

        const token = await Token.createToken(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        await page.addInitScript((tokenString) => {
            window.localStorage.setItem('token-platform', tokenString);
        }, tokenString);

        await page.goto(`${WorkerData.urls.dashboard}/leden`);

        // Open the member, which shows the answers of the questionnaire
        await page.getByTestId('open-member-button').filter({ hasText: 'Marie' }).first().click();
        await expect(page.getByTestId('member-view')).toBeVisible();

        const fileButton = page.getByRole('button', { name: attackerFilename });
        await expect(fileButton).toBeVisible();

        // Clicking the file downloads it
        const downloadPromise = page.waitForEvent('download');
        await fileButton.click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toBe(attackerFilename);

        // The file itself is saved, so it was really read instead of opened
        const downloadPath = await download.path();
        expect(await readFile(downloadPath, 'utf8')).toBe(attackerPage);

        // Nothing navigated to the server of the attacker: not this page, and not a new tab
        expect(requestedAsDocument).toBe(false);
        expect(page.url()).toContain(new URL(WorkerData.urls.dashboard).host);
        expect(context.pages()).toHaveLength(1);
    });
});
