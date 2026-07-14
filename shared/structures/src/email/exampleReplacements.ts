import { Formatter } from '@stamhoofd/utility';
import { BalanceItem } from '../BalanceItem.js';
import { STPackageType, STPackageTypeHelper } from '../billing/STPackage.js';
import { Replacement } from '../endpoints/EmailRequest.js';

let _injectedReplacementValues = (replacements: Replacement[]): void => {
    throw new Error('injectReplacementValues is not yet injected. Call injectReplacementValues to inject dependencies.');
};

export function injectReplacementValues(injected: typeof _injectedReplacementValues) {
    _injectedReplacementValues = injected;
}

// The example values are built with $t, so they depend on the language that is active when
// they are generated: cache them per language so temporary language overrides (e.g. previewing
// an email template in the language that is being edited) get values in that language.
const _replacementsByLanguage = new Map<string, ReturnType<typeof getReplacements>>();

function getFilledReplacements() {
    const language = $getLanguage();
    const cached = _replacementsByLanguage.get(language);
    if (cached) {
        return cached;
    }
    const replacements = getReplacements();
    _injectedReplacementValues(Object.values(replacements));
    _replacementsByLanguage.set(language, replacements);
    return replacements;
}

export const ExampleReplacements = {
    get all() {
        return getFilledReplacements();
    },

    get default() {
        const replacements = getFilledReplacements();
        return [
            replacements.greeting,
            replacements.firstName,
            replacements.lastName,
            replacements.email,
            replacements.organizationName,
            replacements.fromAddress,
            replacements.fromName,
        ];
    },
};

function getReplacements() {
    /**
     * Note: please also add the corresponding smart variable to shared/structures/src/email/EditorSmartVariable.ts
     * and the corresponding buttons to shared/structures/src/email/EditorSmartButton.ts
     */
    const htmlPlaceholder = `<p class="description">${$t('%13W')}</p>`;
    const textPlaceholder = $t(`%13X`);

    const exampleBalanceItem = BalanceItem.create({
        description: $t('Spaghettisaus 1L'),
        amount: 3,
        unitPrice: 80000,
    });

    const exampleBalanceItem2 = BalanceItem.create({
        description: $t('Slagroomtaart'),
        amount: 1,
        unitPrice: 150000,
    });

    return {
        greeting: Replacement.create({
            token: 'greeting',
            value: $t(`%13Y`),
        }),
        firstName: Replacement.create({
            token: 'firstName',
            value: $t(`%13Z`),
        }),
        lastName: Replacement.create({
            token: 'lastName',
            value: $t(`%2c`),
        }),
        email: Replacement.create({
            token: 'email',
            value: $t(`%13a`),
        }),
        fromAddress: Replacement.create({
            token: 'fromAddress',
            value: $t(`%13b`),
        }),
        fromName: Replacement.create({
            token: 'fromName',
            value: $t(`%13c`),
        }),
        paymentUrl: Replacement.create({
            token: 'paymentUrl',
            value: 'https://www.example.com/payment',
        }),
        balanceTable: Replacement.create({
            token: 'balanceTable',
            html: BalanceItem.getDetailsHTMLTable([
                exampleBalanceItem,
                exampleBalanceItem2,
            ]),
        }),
        outstandingBalance: Replacement.create({
            token: 'outstandingBalance',
            value: '€ 55,00',
        }),
        objectName: Replacement.create({
            token: 'objectName',
            value: $t(`%13d`),
        }),
        resetUrl: Replacement.create({
            token: 'resetUrl',
            value: $t(`%13e`),
        }),
        confirmEmailUrl: Replacement.create({
            token: 'confirmEmailUrl',
            value: 'https://www.example.com/confirm-email',
        }),
        confirmEmailCode: Replacement.create({
            token: 'confirmEmailCode',
            value: '123 456',
        }),
        organizationName: Replacement.create({
            token: 'organizationName',
            value: $t('%D'),
        }),
        platformOrOrganizationName: Replacement.create({
            token: 'platformOrOrganizationName',
            value: $t('%Aq'),
        }),
        payingOrganizationName: Replacement.create({
            token: 'payingOrganizationName',
            value: $t('%1W4'),
        }),
        platformName: Replacement.create({
            token: 'platformName',
            value: $t('%1cV'),
        }),
        feedbackText: Replacement.create({
            token: 'feedbackText',
            html: '<p class="pre-wrap"><em>' + Formatter.escapeHtml($t('%B5')) + '</em></p>',
        }),
        downloadUrl: Replacement.create({
            token: 'downloadUrl',
            value: 'https://www.example.com/download',
        }),
        reviewUrl: Replacement.create({
            token: 'reviewUrl',
            value: 'https://www.example.com/review',
        }),
        submitterName: Replacement.create({
            token: 'submitterName',
            value: $t(`%13f`),
        }),
        eventName: Replacement.create({
            token: 'eventName',
            value: $t('%Ar'),
        }),
        dateRange: Replacement.create({
            token: 'dateRange',
            value: $t('%As'),
        }),
        inviterName: Replacement.create({
            token: 'inviterName',
            value: $t(`%13g`),
        }),
        validUntil: Replacement.create({
            token: 'validUntil',
            value: Formatter.dateTime(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
        }),
        validUntilDate: Replacement.create({
            token: 'validUntilDate',
            value: Formatter.date(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
        }),
        firstNameMember: Replacement.create({
            token: 'firstNameMember',
            value: $t(`%13h`),
        }),
        lastNameMember: Replacement.create({
            token: 'lastNameMember',
            value: $t(`%13i`),
        }),
        requesterEmail: Replacement.create({
            token: 'requesterEmail',
            value: $t(`%ZbK`),
        }),
        securityCode: Replacement.create({
            token: 'securityCode',
            html: `<p class="style-code-large">${
                Formatter.injectPattern(Formatter.escapeHtml($t('Voorbeeld').toLocaleUpperCase().padEnd(16, '0')), [
                    { length: 4 },
                    '-',
                    { length: 4 },
                    '-',
                    { length: 4 },
                    '-',
                    { length: 4 },
                    '-',
                    { length: 4 },
                ])
            }</p>`,
        }),
        registerUrl: Replacement.create({
            token: 'registerUrl',
            value: $t(`%13j`),
        }),
        groupName: Replacement.create({
            token: 'groupName',
            value: $t('%C0'),
        }),
        signInUrl: Replacement.create({
            token: 'signInUrl',
            value: 'https://www.example.com/sign-in',
        }),
        unsubscribeUrl: Replacement.create({
            token: 'unsubscribeUrl',
            value: 'https://www.example.com/unsubscribe',
        }),
        renewUrl: Replacement.create({
            token: 'renewUrl',
            value: 'https://www.example.com/renew',
        }),
        loginDetails: Replacement.create({
            token: 'loginDetails',
            html: `<p class="description"><em>${$t('%1EA', {
                email: '<strong>' + $t(`%13a`) + '</strong>' },
            )} ${$t('%1EC', {
                firstName: $t(`%13h`),
                securityCode: `<span class="style-inline-code">xxxx-xxxx-xxxx-xxxx</span>`,
            })}</em></p>`,
        }),
        mailDomain: Replacement.create({
            token: 'mailDomain',
            value: $t(`%13k`),
        }),
        paymentMethod: Replacement.create({
            token: 'paymentMethod',
            value: $t(`%1S`),
        }),
        priceToPay: Replacement.create({
            token: 'priceToPay',
            value: '€ 40,50',
        }),
        totalPrice: Replacement.create({
            token: 'totalPrice',
            value: '€ 40,50',
        }),
        invoiceNumber: Replacement.create({
            token: 'invoiceNumber',
            value: '000152',
        }),
        transferDescription: Replacement.create({
            token: 'transferDescription',
            value: '+++111/111/111+++',
        }),
        transferBankAccount: Replacement.create({
            token: 'transferBankAccount',
            value: 'BE1234 1234 1234',
        }),
        transferBankCreditor: Replacement.create({
            token: 'transferBankCreditor',
            value: $t('%D'),
        }),
        overviewContext: Replacement.create({
            token: 'overviewContext',
            value: $t(`%13l`),
        }),
        memberNames: Replacement.create({
            token: 'memberNames',
            value: $t(`%13m`),
        }),
        overviewTable: Replacement.create({
            token: 'overviewTable',
            html: htmlPlaceholder,
        }),
        paymentTable: Replacement.create({
            token: 'paymentTable',
            html: htmlPlaceholder,
        }),
        packageName: Replacement.create({
            token: 'packageName',
            value: STPackageTypeHelper.getName(STPackageType.Members),
        }),
        orderPrice: Replacement.create({
            token: 'orderPrice',
            value: '€ 15,00',
        }),
        orderStatus: Replacement.create({
            token: 'orderStatus',
            value: textPlaceholder,
        }),
        nr: Replacement.create({
            token: 'nr',
            value: '15',
        }),
        orderTime: Replacement.create({
            token: 'orderTime',
            value: textPlaceholder,
        }),
        orderDate: Replacement.create({
            token: 'orderDate',
            value: textPlaceholder,
        }),
        orderMethod: Replacement.create({
            token: 'orderMethod',
            value: textPlaceholder,
        }),
        orderLocation: Replacement.create({
            token: 'orderLocation',
            value: textPlaceholder,
        }),
        orderDetailsTable: Replacement.create({
            token: 'orderDetailsTable',
            html: htmlPlaceholder,
        }),
        orderTable: Replacement.create({
            token: 'orderTable',
            html: htmlPlaceholder,
        }),
        paymentData: Replacement.create({
            token: 'paymentData',
            html: htmlPlaceholder,
        }),
        orderUrl: Replacement.create({
            token: 'orderUrl',
            value: textPlaceholder,
        }),
        webshopName: Replacement.create({
            token: 'webshopName',
            value: $t('Voorbeeldshop'),
        }),

        errors: Replacement.create({
            token: 'errors',
            html: '<p>' + Formatter.escapeHtml($t(`%1Su`)) + '</p><p>' + Formatter.escapeHtml($t(`%1Rl`)) + '</p>',
        }),

    };
}
