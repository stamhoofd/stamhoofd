import Email from "./Email"

describe("Email", () => {
    it("should parse e-mail strings correctly", () => {
        expect(Email.parseEmail('"My crazy name" <hallo@stamhoofd.be>')).toEqual(["hallo@stamhoofd.be"])
        expect(Email.parseEmail('hallo@stamhoofd.be')).toEqual(["hallo@stamhoofd.be"])
        expect(Email.parseEmail('hallo@stamhoofd.be ')).toEqual(["hallo@stamhoofd.be"])
        expect(Email.parseEmail('"hallo@stamhoofd.be"')).toEqual(["hallo@stamhoofd.be"])
        expect(Email.parseEmail('<"hallo@stamhoofd.be">')).toEqual(["hallo@stamhoofd.be"])
        expect(Email.parseEmail('Gekke naam <"hallo@stamhoofd.be">')).toEqual(["hallo@stamhoofd.be"])
        expect(Email.parseEmail('<"hallo@stam\\"hoofd.be">')).toEqual([])
        expect(Email.parseEmail('<"hallo@stam,hoofd.be">')).toEqual([])
        expect(Email.parseEmail('<hallo@stam,hoofd.be>')).toEqual([])
        expect(Email.parseEmail('"Hallo <dit is een test>" <hallo@stamhoofd.be>')).toEqual(["hallo@stamhoofd.be"])
        expect(Email.parseEmail('"Hallo 👋🏽" <hallo@stamhoofd.be>')).toEqual(["hallo@stamhoofd.be"])
        expect(Email.parseEmail('Hallo <hallo@stam.hoofd.be>')).toEqual(["hallo@stam.hoofd.be"])
        expect(Email.parseEmail('Hallo <hallo@stam.hoofd.be')).toEqual([])

        expect(Email.parseEmail('"Hallo <dit is \\" een test>" <hallo@stamhoofd.be>')).toEqual(["hallo@stamhoofd.be"])
        expect(Email.parseEmail('"Hallo <dit is \\" een test佐>" <hallo@stamhoofd.be>')).toEqual(["hallo@stamhoofd.be"])

        expect(Email.parseEmail('"Voornaam \'l Achternaam, en nog iets" <jwz@netscape.com>')).toEqual(["jwz@netscape.com"])
        expect(Email.parseEmail('"Voornaam \'l Achternaam, en nog iets" <jwz@netscape.com>, "My crazy name" <hallo@stamhoofd.be>')).toEqual(["jwz@netscape.com", "hallo@stamhoofd.be"])

        expect(Email.parseEmail('hallo@example.com, test@test.com')).toEqual(["hallo@example.com", "test@test.com"])
        expect(Email.parseEmail('hallo@example.com, invalid, test@test.com')).toEqual(["hallo@example.com", "test@test.com"])
    })
})