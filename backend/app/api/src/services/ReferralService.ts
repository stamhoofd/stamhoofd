import type { Model } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import type { EmailInterfaceBase } from '@stamhoofd/email';
import { Email } from '@stamhoofd/email';
import { BalanceItem, Organization, Platform, RegisterCode, UsedRegisterCode } from '@stamhoofd/models';
import { BalanceItemStatus, BalanceItemType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { VATService } from './VATService.js';

export class ReferralService {
    /**
     * Prepares a register code for usage.
     * Returns the models to save and the emails to send when succesful
     */
    static async markUsed(organization: Organization, codeString: string): Promise<{models: Model[], emails: EmailInterfaceBase[]}> {
        const alreadyUsed = await UsedRegisterCode.getFor(organization.id)
        if (alreadyUsed) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid register code',
                human: 'Je hebt al een doorverwijzingscode gebruikt',
                field: 'registerCode',
            });
        }

        const code = await RegisterCode.getByID(codeString)
        if (!code) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid register code',
                human: 'De doorverwijzingscode die je hebt opgegeven is niet langer geldig',
                field: 'registerCode',
            });
        }

        const otherOrganization = code.organizationId ? await Organization.getByID(code.organizationId) : undefined
        
        const membershipOrganizationId = (await Platform.getShared()).membershipOrganizationId!;
        const membershipOrganization = await Organization.getByID(membershipOrganizationId, true)

        const delayEmails: EmailInterfaceBase[] = []
        let credit: BalanceItem | undefined = undefined

        if (code.value > 0) {
            credit = new BalanceItem();
            credit.type = BalanceItemType.Other; // todo: ReferralDiscount
            credit.description = otherOrganization ? ('Tegoed gekregen van '+otherOrganization.name) : code.description
            credit.payingOrganizationId = organization.id
            credit.organizationId = membershipOrganization.id
            credit.VATPercentage = 21;
            credit.VATExcempt = VATService.getVATExcempt({
                company: organization.defaultCompanies[0] ?? null,
                sellingOrganization: membershipOrganization,
                type: 'services'
            });
            credit.VATIncluded = false;
            credit.quantity = 1;
            credit.unitPrice = -code.value
            credit.createdAt = new Date();
            credit.status = BalanceItemStatus.Due;

            // Expire in one year (will get extended for every purchase or activation)
            //credit.expireAt = new Date()
            //credit.expireAt.setFullYear(credit.expireAt.getFullYear() + 1)
            //credit.expireAt.setMilliseconds(0)
            
            // Save later
        }

        if (otherOrganization) {
            const admins = await otherOrganization.getAdminToEmails()
            if (admins) {
                if (code.invoiceValue) {
                    // Delay email until everything is validated and saved
                    delayEmails.push({
                        to: admins,
                        subject: organization.name+' heeft jullie doorverwijzingslink gebruikt 🥳',
                        type: 'transactional',
                        text: 'Dag '+otherOrganization.name+',\n\nGoed nieuws! '+organization.name+' heeft jullie doorverwijzingslink gebruikt om zich op Stamhoofd te registreren.\n\n— Stamhoofd'
                    })
                } else {
                    // Delay email until everything is validated and saved
                    delayEmails.push({
                        to: admins,
                        subject: organization.name+' heeft jullie doorverwijzingslink gebruikt 🥳',
                        type: 'transactional',
                        text: 'Dag '+otherOrganization.name+',\n\nGoed nieuws! '+organization.name+' heeft jullie doorverwijzingslink gebruikt om zich op Stamhoofd te registreren. Als zij minstens 1 euro op Stamhoofd uitgeven ontvangen jullie een tegoed dat kan oplopen tot 100 euro per vereniging (zie daarvoor Stamhoofd > Instellingen). Lees zeker onze tips na om nog een groter bedrag te verzamelen.\n\n— Stamhoofd'
                    })
                }
            }
        } else {
            delayEmails.push({
                to: [
                    {email: 'hallo@stamhoofd.be'}
                ],
                subject: organization.name+' heeft jullie doorverwijzingslink gebruikt 🥳',
                type: 'transactional',
                text: 'Dag Stamhoofd,\n\nGoed nieuws! '+organization.name+' heeft jullie doorverwijzingslink '+code.code+' gebruikt om zich op Stamhoofd te registreren. \n\n— Stamhoofd'
            })
        }

        // Save that we used this code (so we can reward the other organization)
        const usedCode = new UsedRegisterCode()
        usedCode.organizationId = organization.id
        usedCode.code = code.code
        
        // Save later
        return {
            models: credit ? [credit, usedCode] : [usedCode],
            emails: delayEmails
        }
    }
    
    static async reward(usedCode: UsedRegisterCode) {
        if (usedCode.balanceItemId) {
            // Already received
            console.error('Already rewarded for used register code '+usedCode.id)
            return
        }

        const code = await RegisterCode.getByID(usedCode.code)
        if (!code || !code.organizationId) {
            console.error("Couldn't find code "+usedCode.code+' for used register code '+usedCode.id)
            return
        }

        const organization = await Organization.getByID(usedCode.organizationId)
        if (!organization) {
            console.error("Couldn't find organization with id "+usedCode.organizationId+' for used register code '+usedCode.id)
            return
        }

        const receivingOrganization = await Organization.getByID(code.organizationId)
        if (!receivingOrganization) {
            console.error("Couldn't find receiving organization with id "+code.organizationId+' for used register code '+usedCode.id)
            return
        }
        const membershipOrganizationId = (await Platform.getShared()).membershipOrganizationId!;
        const membershipOrganization = await Organization.getByID(membershipOrganizationId, true)

        const usedCount = await UsedRegisterCode.getUsedCount(usedCode.code) + 1

        const credit = new BalanceItem();
        credit.type = BalanceItemType.Other; // todo: ReferralDiscount
        credit.description = $t('{organization-name} doorverwezen 🙌', {'organization-name': organization.name})
        credit.payingOrganizationId = code.organizationId
        credit.organizationId = (await Platform.getShared()).membershipOrganizationId! // where do we get this discount from
        credit.VATPercentage = 21;
        credit.VATExcempt = VATService.getVATExcempt({
            company: organization.defaultCompanies[0] ?? null,
            sellingOrganization: membershipOrganization,
            type: 'services'
        });
        credit.VATIncluded = false;
        credit.quantity = 1;
        credit.unitPrice = -(code.invoiceValue ? 0 : Math.min(100 * 100_00, usedCount * 10 * 100_00))
        credit.createdAt = new Date();
        credit.status = BalanceItemStatus.Due;

        // Expire in one year (will get extended for every purchase or activation)
        //credit.expireAt = new Date()
        //credit.expireAt.setFullYear(credit.expireAt.getFullYear() + 1)
        //credit.expireAt.setMilliseconds(0)

        await credit.save()

        usedCode.balanceItemId = credit.id
        await usedCode.save()

        if (code.invoiceValue) {
            // The receiving organization is invoiced instead of the organization for the usage of Stamhoofd.
            const item = new BalanceItem();
            item.type = BalanceItemType.Other;
            item.description = 'Aankoop Stamhoofd voor ' + organization.name
            item.payingOrganizationId = receivingOrganization.id;
            item.organizationId = membershipOrganizationId
            item.VATPercentage = 21;
            item.VATExcempt = VATService.getVATExcempt({
                company: organization.defaultCompanies[0] ?? null,
                sellingOrganization: membershipOrganization,
                type: 'services'
            });
            item.VATIncluded = false;
            item.quantity = 1;
            item.unitPrice = code.invoiceValue;
            item.createdAt = new Date();
            item.status = BalanceItemStatus.Due;
            await item.save()
        }

        const admins = await receivingOrganization.getAdminRecipients()
        if (admins) {
            if (code.invoiceValue) {
                Email.send({
                    to: admins,
                    from: Email.getQuickFromEmail(receivingOrganization.address.country),
                    subject: `${organization.name} heeft jullie tegoed gebruikt`,
                    text: 'Dag '+receivingOrganization.name+',\n\n'+organization.name+' had jullie doorverwijzingslink gebruikt om zich op Stamhoofd te registreren, en nu hebben ze dit ook gebruikt. Zoals afgesproken wordt hiervoor ' + Formatter.price(code.invoiceValue)+ ' aangerekend via jullie openstaand saldo in jullie Stamhoofd account.'
                    + '\n\n— Stamhoofd'
                })

            } else {
                // Delay email until everything is validated and saved
                Email.send({
                    from: Email.getQuickFromEmail(receivingOrganization.address.country),
                    to: admins,
                    subject: 'Je hebt '+Formatter.price(-credit.unitPrice)+' tegoed ontvangen 💰',
                    text: 'Dag '+receivingOrganization.name+',\n\nGeweldig nieuws! '+organization.name+' had jullie doorverwijzingslink gebruikt om zich op Stamhoofd te registreren, en nu hebben ze ook voor het eerst minstens één euro uitgegeven. Daardoor ontvangen jullie '+Formatter.price(-credit.unitPrice)+' tegoed voor Stamhoofd (zie daarvoor Stamhoofd > Instellingen). '
                    + (-credit.unitPrice <= 90*100_00 ? ('Bij de volgende vereniging ontvangen jullie nog meer: '+Formatter.price(-credit.unitPrice + 10*100_00)+'. ') : '')
                    + (-credit.unitPrice <= 80*100_00 ? ('En dat blijft oplopen tot € 100,00 per vereniging die je aanbrengt.') : '')
                    + 'Doe zo verder! Lees zeker onze tips na om nog een groter bedrag te verzamelen.\n\n— Stamhoofd'
                })
            }
        }
    }

}
