import { Formatter } from '@stamhoofd/utility';
import { BalanceItem } from '../BalanceItem.js';
import { Replacement } from '../endpoints/EmailRequest.js';
import { STPackageType, STPackageTypeHelper } from '../billing/STPackage.js';

const exampleBalanceItem = BalanceItem.create({
    description: 'Voorbeeld item 1',
    amount: 5,
    unitPrice: 1000,
});

const exampleBalanceItem2 = BalanceItem.create({
    description: 'Voorbeeld item 2',
    amount: 1,
    unitPrice: 500,
});

let _injectedReplacementValues = (replacements: Replacement[]): void => {
    throw new Error('injectReplacementValues is not yet injected. Call injectReplacementValues to inject dependencies.');
};

export function injectReplacementValues(injected: typeof _injectedReplacementValues) {
    _injectedReplacementValues = injected;
}

let filled = false;
let _ExampleReplacements: ReturnType<typeof getReplacements> = {} as any;

function fillReplacementsIfNeeded() {
    if (!filled) {
        _ExampleReplacements = getReplacements();
        _injectedReplacementValues(Object.values(_ExampleReplacements));
        filled = true;
    }
}

export const ExampleReplacements = {
    get all() {
        fillReplacementsIfNeeded();
        return _ExampleReplacements;
    },

    get default() {
        fillReplacementsIfNeeded();
        return [
            _ExampleReplacements.greeting,
            _ExampleReplacements.firstName,
            _ExampleReplacements.lastName,
            _ExampleReplacements.email,
            _ExampleReplacements.organizationName,
            _ExampleReplacements.fromAddress,
        ];
    },
};

function getReplacements() {
    const htmlPlaceholder = '<p class="description">Oeps, er ging iets mis bij het laden van het voorbeeld dat hier moet komen</p>';
    const textPlaceholder = 'ONTBREEKT';

    return {
        greeting: Replacement.create({
            token: 'greeting',
            value: 'Dag Jan,',
        }),
        firstName: Replacement.create({
            token: 'firstName',
            value: 'Jan',
        }),
        lastName: Replacement.create({
            token: 'lastName',
            value: 'Jansen',
        }),
        email: Replacement.create({
            token: 'email',
            value: 'jan.jansen@voorbeeld.com',
        }),
        fromAddress: Replacement.create({
            token: 'fromAddress',
            value: 'verstuurder@voorbeeld.com',
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
            value: 'Naam schuldenaar',
        }),
        resetUrl: Replacement.create({
            token: 'resetUrl',
            value: 'https://www.example.com/reset',
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
            value: $t('aeace79f-c772-4944-8d1d-f92eb519267f'),
        }),
        platformOrOrganizationName: Replacement.create({
            token: 'platformOrOrganizationName',
            value: $t('6f77926b-801a-477d-8254-78166ca8e6be'),
        }),
        feedbackText: Replacement.create({
            token: 'feedbackText',
            html: '<p class="pre-wrap"><em>' + Formatter.escapeHtml($t('ac49cf9f-c0de-479c-829d-99e7a31874d2')) + '</em></p>',
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
            value: 'Piet Pieters',
        }),
        eventName: Replacement.create({
            token: 'eventName',
            value: $t('aaaaf4eb-6714-42b8-bd94-aa167246cac6'),
        }),
        dateRange: Replacement.create({
            token: 'dateRange',
            value: $t('b66ae14a-e02d-4c80-bec2-d7440da7643f'),
        }),
        inviterName: Replacement.create({
            token: 'inviterName',
            value: 'Piet',
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
            value: 'Klaas',
        }),
        lastNameMember: Replacement.create({
            token: 'lastNameMember',
            value: 'Klaassen',
        }),
        registerUrl: Replacement.create({
            token: 'registerUrl',
            value: 'https://www.example.com/register',
        }),
        groupName: Replacement.create({
            token: 'groupName',
            value: 'Voorbeeldgroep',
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
            html: `<p class="description"><em>Je kan op het ledenportaal inloggen met <strong>${Formatter.escapeHtml('voorbeeld@email.com')}</strong></em></p>`,
        }),
        mailDomain: Replacement.create({
            token: 'mailDomain',
            value: 'voorbeeld.com',
        }),
        paymentMethod: Replacement.create({
            token: 'paymentMethod',
            value: 'Bancontact',
        }),
        priceToPay: Replacement.create({
            token: 'priceToPay',
            value: '€ 40,50',
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
            value: $t('aeace79f-c772-4944-8d1d-f92eb519267f'),
        }),
        overviewContext: Replacement.create({
            token: 'overviewContext',
            value: 'Voorbeeldcontext',
        }),
        memberNames: Replacement.create({
            token: 'memberNames',
            value: 'Klaas en Piet',
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
        orderUrl: Replacement.create({
            token: 'orderUrl',
            value: textPlaceholder,
        }),
        webshopName: Replacement.create({
            token: 'webshopName',
            value: textPlaceholder,
        }),

    };
}
