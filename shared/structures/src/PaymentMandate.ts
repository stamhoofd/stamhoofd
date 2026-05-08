import { AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { PaymentProvider } from './PaymentProvider.js';
import { Formatter } from '@stamhoofd/utility';

export enum PaymentMandateType {
    DirectDebit = 'DirectDebit',
    CreditCard = 'CreditCard',
    // Todo: add "Bancontact WIP" support
}

/**
 * The status of the mandate. A status can be pending for mandates when the first payment is not yet finalized, or when we did not received the IBAN yet from the first payment.
 */
export enum PaymentMandateStatus {
    Valid = 'Valid',
    Pending = 'Pending',
    Invalid = 'Invalid'
}

export class PaymentMandateDetails extends AutoEncoder {
    /**
     * Name of the card holder
     */
    @field({ decoder: StringDecoder, nullable: true })
    name: string | null = null

    /**
     * Full iban if direct debit
     */
    @field({ decoder: StringDecoder, nullable: true })
    iban: string | null = null

    /**
     * Last 4 digits if credit card
     */
    @field({ decoder: StringDecoder, nullable: true })
    cardNumber: string | null = null

    /**
     * Bic code for iban numbers
     */
    @field({ decoder: StringDecoder, nullable: true })
    bic: string | null = null

    // Card expiry date (timezone Brussels for now)
    @field({ decoder: DateDecoder, nullable: true })
    expiryDate: Date | null = null
    
    // Brand name: American Express Carta Si Carte Bleue Dankort Diners Club Discover JCB Laser Maestro Mastercard Unionpay Visa
    @field({ decoder: StringDecoder, nullable: true })
    brand: string | null = null
}

export class PaymentMandate extends AutoEncoder {
    /**
     * External mandate id of the provider.
     */
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: BooleanDecoder })
    isDefault = false;

    @field({ decoder: new EnumDecoder(PaymentMandateStatus) })
    status: PaymentMandateStatus

    @field({ decoder: new EnumDecoder(PaymentProvider) })
    provider: PaymentProvider;

    @field({ decoder: new EnumDecoder(PaymentMandateType) })
    type: PaymentMandateType

    @field({ decoder: PaymentMandateDetails })
    details: PaymentMandateDetails;

    @field({decoder: DateDecoder})
    createdAt: Date

    get name() {
        if (this.details.iban) {
            return Formatter.iban(this.details.iban)
        }

        if (this.details.cardNumber) {
            return '•••• ' + this.details.cardNumber;
        }

        return $t('Onbekende betaalmethode');
    }

    get formattedExpiryDate() {
        if (!this.details.expiryDate) {
            return null;
        }
        return Formatter.monthNumber(this.details.expiryDate) + '/' + Formatter.year(this.details.expiryDate)
    }

    get description() {
        return this.details.name || ''
    }

    get bankName() {
        if (!this.details.bic) {
            return null;
        }

        return getBicName(this.details.bic)
    }
}

function getBicName(bic: string): string | null {
    if (bic.length < 8) {
        return null;
    }
    bic = bic.toUpperCase();
    const country = bic.substring(4, 6);
    if (country !== 'BE') {
        return null;
    }
 
    if (bic.startsWith('GEBA')) return 'BNP Paribas Fortis';
    if (bic.startsWith('GKCC')) return 'Belfius';
    if (bic.startsWith('NICA')) return 'Crelan';
    if (bic.startsWith('AXAB')) return 'Crelan';
    if (bic.startsWith('CTBK')) return 'Beobank';
    if (bic.startsWith('ABER')) return 'Bank J. Van Breda & C°';
    if (bic.startsWith('JVBA')) return 'Bank J. Van Breda & C°';
    if (bic.startsWith('BCMC')) return 'Bancontact';
    if (bic.startsWith('BSCH')) return 'Santander';
    if (bic.startsWith('BBRU')) return 'ING';
    if (bic.startsWith('KRED')) return 'KBC';
    if (bic.startsWith('ABNA')) return 'ABN AMRO Bank';
    if (bic.startsWith('FVLB')) return 'F. van Lanschot';
    if (bic.startsWith('TRIO')) return 'Triodos Bank';
    if (bic.startsWith('CITI')) return 'Citibank';
    if (bic.startsWith('DEUT')) return 'Deutsche Bank';
    if (bic.startsWith('BNAG')) return 'Bank Nagelmackers';
    if (bic.startsWith('REVO')) return 'Revolut';
    if (bic.startsWith('NBBE')) return 'Nationale Bank van België';
    if (bic.startsWith('PAUI')) return 'HR Pay Solutions';
    if (bic.startsWith('ATMN')) return 'Atlantic Money';
    if (bic.startsWith('CPHB')) return 'Banque CPH';
    if (bic.startsWith('MPSN')) return 'Mobile Payment Solutions';
    if (bic.startsWith('DIGE')) return 'Digiteal';
    if (bic.startsWith('BUNQ')) return 'Bunq';
    if (bic.startsWith('SMBC')) return 'Sumitomo Mitsui Banking Corporation (SMBC)';
    if (bic.startsWith('CREG')) return 'CIR (Verrekeningsinstelling)';
    if (bic.startsWith('DHBN')) return 'Demir-Halk Bank (DHB)';
    if (bic.startsWith('PANX')) return 'Unifiedpost Payments';
    if (bic.startsWith('DIER')) return 'Dierickx, Leys & Cie Effectenbank';
    if (bic.startsWith('PARB')) return 'BNP Paribas SA – Securities Services';
    if (bic.startsWith('VAPE')) return 'VAN DE PUT & CO Privaatbankiers';
    if (bic.startsWith('DNIB')) return 'NIBC Bank';
    if (bic.startsWith('PUIL')) return 'Puilaetco / Quintet Private Bank';
    if (bic.startsWith('IRVT')) return 'The Bank of New York Mellon';
    if (bic.startsWith('UTWB')) return 'United Taiwan Bank';
    if (bic.startsWith('WAFA')) return 'Attijariwafa bank Europe';
    if (bic.startsWith('BKID')) return 'Bank of India';
    if (bic.startsWith('LOCY')) return 'Lombard Odier (Europe)';
    if (bic.startsWith('CHAS')) return 'J.P. Morgan SE';
    if (bic.startsWith('JPMG')) return 'J.P. Morgan SE';
    if (bic.startsWith('MHCB')) return 'Mizuho Bank Europe';
    if (bic.startsWith('DEGR')) return 'Bank Degroof Petercam';
    if (bic.startsWith('BIBL')) return 'BinckBank';
    if (bic.startsWith('CMCI')) return 'Crédit Industriel et Commercial / Banque Transatlantique';
    if (bic.startsWith('SWNB')) return 'Swan';
    if (bic.startsWith('BKCH')) return 'Bank of China (Europe)';
    if (bic.startsWith('DLLU')) return 'Delen Private Bank Luxembourg';
    if (bic.startsWith('DELE')) return 'Delen Private Bank';
    if (bic.startsWith('ICBK')) return 'Industrial and Commercial Bank of China (Europe)';
    if (bic.startsWith('BBVA')) return 'BBVA';
    if (bic.startsWith('BMPB')) return 'UniCredit';
    if (bic.startsWith('CEPA')) return 'CEPA';
    if (bic.startsWith('KEYT')) return 'Keytrade Bank';
    if (bic.startsWith('BARC')) return 'Barclays';
    if (bic.startsWith('HABB')) return 'Habib Bank';
    if (bic.startsWith('BMEU')) return 'BMCE Euro Services';
    if (bic.startsWith('BCDM')) return 'Banque Chaabi du Maroc';
    if (bic.startsWith('SBIN')) return 'State Bank of India';
    if (bic.startsWith('EURB')) return 'Europabank';
    if (bic.startsWith('BYBB')) return 'Byblos Bank Europe';
    if (bic.startsWith('CBPX')) return 'Intesa Sanpaolo Wealth Management';
    if (bic.startsWith('SGAB')) return 'Société Générale';
    if (bic.startsWith('BOFA')) return 'Bank of America';
    if (bic.startsWith('MGTC')) return 'Euroclear Bank';
    if (bic.startsWith('BOTK')) return 'MUFG Bank (Europe)';
    if (bic.startsWith('CRLY')) return 'Crédit Agricole CIB';
    if (bic.startsWith('ISAE')) return 'CACEIS Bank Belgian Branch';
    if (bic.startsWith('BLUX')) return 'Banque de Luxembourg';
    if (bic.startsWith('PRIB')) return 'Edmond de Rothschild (Europe)';
    if (bic.startsWith('MBWM')) return 'MeDirect Bank';
    if (bic.startsWith('VDSP')) return 'vdk bank';
    if (bic.startsWith('TRWI')) return 'Wise';
    if (bic.startsWith('CEKV')) return 'Centrale Kredietverlening (C.K.V.)';
    if (bic.startsWith('TUNZ')) return 'Worldline Financial Solutions';
    if (bic.startsWith('EPBF')) return 'EPBF';
    if (bic.startsWith('FXBB')) return 'Ibanfirst';
    if (bic.startsWith('OONX')) return 'Equals Money Europe';
    if (bic.startsWith('GOCF')) return 'Gold Commodities Forex (G.C.F.)';
    if (bic.startsWith('FMMS')) return 'Fimaser';
    if (bic.startsWith('EBPB')) return 'Ebury Partners Belgium';
    if (bic.startsWith('CLIQ')) return 'Banque Centrale de Compensation (Clearnet)';
    if (bic.startsWith('HOMN')) return 'Mastercard Transaction Services (Europe)';
    if (bic.startsWith('HSBC')) return 'HSBC Continental Europe Belgium';
    if (bic.startsWith('FPEB')) return 'Nickel Belgium';
    if (bic.startsWith('ENIB')) return 'ENIB';
    if (bic.startsWith('ARSP')) return 'Argenta';
    if (bic.startsWith('PESO')) return 'PPS EU SA';
    if (bic.startsWith('PAYV')) return 'Paynovate';
    if (bic.startsWith('RCBP')) return 'RCBP';
    if (bic.startsWith('CFFR')) return 'CFFR';
 
    return null;
}
