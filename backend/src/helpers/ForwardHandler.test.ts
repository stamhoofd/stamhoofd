/* eslint-disable jest/expect-expect */

import { OrganizationEmail, PermissionLevel, Permissions } from "@stamhoofd/structures"
import { OrganizationFactory } from "../factories/OrganizationFactory"
import { UserFactory } from "../factories/UserFactory"
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
            to: '"default" <def@example.com>',
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
            to: '"First" <first@example.com>',
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
            to: user.email,
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
        expect(options!.to).toBeOneOf([user.email+", "+user2.email, user2.email+", "+user.email])
        expect(options!.text).toContain("Content hier")

        // Check notice
        expect(options!.text).toContain("naar alle beheerders")
    })

    it("Skip email if organization doesn't have emails", async () => {
        const organization = await new OrganizationFactory({}).create()

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
        expect(options).toBeUndefined()
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

    it("should not ignore aws bounce emails for own", async () => {
        const options = await ForwardHandler.handle("From: bounces@amazonses.com\nSubject: Hello\nTo: ksjdgsdgkjlsdg@stamhoofd.email\nContent-Type: text/plain\n\nContent hier", {
            recipients: ["ksjdgsdgkjlsdg@stamhoofd.email"],
            spamVerdict: { status: 'PASS' },
            virusVerdict: { status: 'PASS' },
            spfVerdict: { status: 'PASS' },
            dkimVerdict: { status: 'PASS' },
            dmarcVerdict: { status: 'PASS' },
        })
        expect(options).toMatchObject({
            to: 'hallo@stamhoofd.be',
            subject: "Hello",
            replyTo: "bounces@amazonses.com"
        })
    })
})