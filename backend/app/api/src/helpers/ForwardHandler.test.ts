/* eslint-disable jest/expect-expect */

import { EmailAddress } from "@stamhoofd/email"
import { OrganizationFactory, UserFactory } from "@stamhoofd/models"
import { OrganizationEmail, PermissionLevel, Permissions } from "@stamhoofd/structures"

import { ForwardHandler } from "./ForwardHandler"

describe("ForwardHandler", () => {
    it("should send to default e-mail", async () => {
        const organization = await new OrganizationFactory({}).create()
        organization.privateMeta.emails.push(OrganizationEmail.create({
            name: "First",
            email: "first@example.com"
        }))
        organization.privateMeta.emails.push(OrganizationEmail.create({
            name: "default",
            email: "def@example.com",
            default: true
        }))
        await organization.save()

        const options = await ForwardHandler.handle("From: someone@example.com\nSubject: Hello\nTo: "+organization.uri + "@stamhoofd.email\nContent-Type: text/plain\n\nContent hier", {
            recipients: [organization.uri + "@stamhoofd.email"],
            spamVerdict: { status: 'PASS' },
            virusVerdict: { status: 'PASS' },
            spfVerdict: { status: 'PASS' },
            dkimVerdict: { status: 'PASS' },
            dmarcVerdict: { status: 'PASS' },
        })
        expect(options).toMatchObject({
            to: [
                {
                    email: "def@example.com",
                    name: "default",
                }
            ],
            subject: "Hello",
            replyTo: "someone@example.com"
        })
        expect(options!.text).toContain("Content hier")
    })

    it("should send to first e-mail", async () => {
        const organization = await new OrganizationFactory({}).create()
        organization.privateMeta.emails.push(OrganizationEmail.create({
            name: "First",
            email: "first@example.com"
        }))
        organization.privateMeta.emails.push(OrganizationEmail.create({
            name: "second",
            email: "second@example.com",
        }))
        await organization.save()

        const options = await ForwardHandler.handle("From: someone@example.com\nSubject: Hello\nTo: "+organization.uri + "@stamhoofd.email\nContent-Type: text/plain\n\nContent hier", {
            recipients: [organization.uri + "@stamhoofd.email"],
            spamVerdict: { status: 'PASS' },
            virusVerdict: { status: 'PASS' },
            spfVerdict: { status: 'PASS' },
            dkimVerdict: { status: 'PASS' },
            dmarcVerdict: { status: 'PASS' },
        })
        expect(options).toMatchObject({
            to: [
                {
                    email: "first@example.com",
                    name: "First"
                }
            ],
            subject: "Hello",
            replyTo: "someone@example.com"
        })
        expect(options!.text).toContain("Content hier")
    })

    it("should send to administrators if no emails defined", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create()

        const options = await ForwardHandler.handle("From: someone@example.com\nSubject: Hello\nTo: "+organization.uri + "@stamhoofd.email\nContent-Type: text/plain\n\nContent hier", {
            recipients: [organization.uri + "@stamhoofd.email"],
            spamVerdict: { status: 'PASS' },
            virusVerdict: { status: 'PASS' },
            spfVerdict: { status: 'PASS' },
            dkimVerdict: { status: 'PASS' },
            dmarcVerdict: { status: 'PASS' },
        })
        expect(options).toMatchObject({
            to: [
                {
                    email: user.email,
                    name: null
                }
            ],
            subject: "Hello",
            replyTo: "someone@example.com"
        })
        expect(options!.text).toContain("Content hier")

        // Check notice
        expect(options!.text).toContain("naar alle beheerders")
    })

    it("should send to all full administrators if no emails defined", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create()
        const user2 = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create()
        
        // Admin that should get ignored
        await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Read }) }).create()

        const options = await ForwardHandler.handle("From: someone@example.com\nSubject: Hello\nTo: "+organization.uri + "@stamhoofd.email\nContent-Type: text/plain\n\nContent hier", {
            recipients: [organization.uri + "@stamhoofd.email"],
            spamVerdict: { status: 'PASS' },
            virusVerdict: { status: 'PASS' },
            spfVerdict: { status: 'PASS' },
            dkimVerdict: { status: 'PASS' },
            dmarcVerdict: { status: 'PASS' },
        })

        expect(options).toMatchObject({
            subject: "Hello",
            replyTo: "someone@example.com"
        })
        expect(options!.to).toIncludeAllMembers([
            {
                email: user.email,
                name: null
            },
            {
                email: user2.email,
                name: null
            }
        ])
        expect(options!.text).toContain("Content hier")

        // Check notice
        expect(options!.text).toContain("naar alle beheerders")
    })

    it("should ignore aws bounce emails", async () => {
        const organization = await new OrganizationFactory({}).create()
        organization.privateMeta.emails.push(OrganizationEmail.create({
            name: "First",
            email: "first@example.com"
        }))
        organization.privateMeta.emails.push(OrganizationEmail.create({
            name: "second",
            email: "second@example.com",
        }))
        await organization.save()

        const options = await ForwardHandler.handle("From: bounces@amazonses.com\nSubject: Hello\nTo: "+organization.uri + "@stamhoofd.email\nContent-Type: text/plain\n\nContent hier", {
            recipients: [organization.uri + "@stamhoofd.email"],
            spamVerdict: { status: 'PASS' },
            virusVerdict: { status: 'PASS' },
            spfVerdict: { status: 'PASS' },
            dkimVerdict: { status: 'PASS' },
            dmarcVerdict: { status: 'PASS' },
        })
        expect(options).toBeUndefined()
    })

    it("should ignore aws bounce emails for unknown organizations", async () => {
        const options = await ForwardHandler.handle("From: bounces@amazonses.com\nSubject: Hello\nTo: ksjdgsdgkjlsdg@stamhoofd.email\nContent-Type: text/plain\n\nContent hier", {
            recipients: ["ksjdgsdgkjlsdg@stamhoofd.email"],
            spamVerdict: { status: 'PASS' },
            virusVerdict: { status: 'PASS' },
            spfVerdict: { status: 'PASS' },
            dkimVerdict: { status: 'PASS' },
            dmarcVerdict: { status: 'PASS' },
        })
        expect(options).toBeUndefined()
    })

    it("should unsubscribe email addresses that send to unsubscribe", async () => {
        const address = new EmailAddress()
        address.email = "exampleaddress-unsusbcribe-test@example.com";
        address.organizationId = null
        address.token = null;
        await address.save()

        const id = address.id

        const options = await ForwardHandler.handle(`From: bounces@amazonses.com\nSubject: Hello\nTo: unsubscribe+${id}@stamhoofd.email\nContent-Type: text/plain\n\nContent hier`, {
            recipients: [`unsubscribe+${id}@stamhoofd.email`],
            spamVerdict: { status: 'PASS' },
            virusVerdict: { status: 'PASS' },
            spfVerdict: { status: 'PASS' },
            dkimVerdict: { status: 'PASS' },
            dmarcVerdict: { status: 'PASS' },
        })
        expect(options).toBeUndefined()

        // Refresh adress and check unsubscribed for all
        const updatedAddress = await EmailAddress.getByID(id)
        expect(updatedAddress).toBeDefined()
        expect(updatedAddress!.unsubscribedAll).toEqual(true);
    })

    it("should forward unsubscribe emails to unrecognized id", async () => {
        const options = await ForwardHandler.handle(`From: bounces@amazonses.com\nSubject: Hello\nTo: unsubscribe+testid@stamhoofd.email\nContent-Type: text/plain\n\nContent hier`, {
            recipients: [`unsubscribe+testid@stamhoofd.email`],
            spamVerdict: { status: 'PASS' },
            virusVerdict: { status: 'PASS' },
            spfVerdict: { status: 'PASS' },
            dkimVerdict: { status: 'PASS' },
            dmarcVerdict: { status: 'PASS' },
        })
        expect(options).toMatchObject({
             to: "hallo@stamhoofd.be",
            subject: "E-mail unsubscribe mislukt",
        });
    })
})