import { Member } from "./src/members/models/Member"
import { Address } from './src/members/models/Address';

process.on('unhandledRejection', (error: Error) => {
    console.error("unhandledRejection")
    console.error(error.message, error.stack);
    process.exit(1);
});

// Set timezone!
process.env.TZ = "UTC"

// Quick check
if (new Date().getTimezoneOffset() != 0) {
    throw new Error("Process should always run in UTC timezone")
}

const start = async () => {
    try {
        const [found] = await Member.where({ key: "id", value: 67 }).with(Member.address).get()
        let member: Member
        if (found) {
            console.log("Found member " + found.firstName)
            member = found
        } else {
            console.log("Didn't find member")
            member = new Member();
        }

        if (!member.isLoaded(Member.address)) {
            throw new Error("Member addresss should have been loaded by now");
        }

        if (!member.hasRelation(Member.address)) {
            member.address = new Address()

            if (!member.hasRelation(Member.address)) {
                throw new Error("Failed to set address");
            }

            member.address.city = "Demo"
            member.address.country = "BE"
            member.address.street = "Straatnaam"
            member.address.number = "123"
            member.address.postalCode = "9000"
            await member.address.save()
        } else {
            // Move address of Simon

            member.address = new Address()
            member.address.city = "Moved"
            member.address.country = "BE"
            member.address.street = "Straatnaam"
            member.address.number = "123"
            member.address.postalCode = "9000"
            await member.address.save()
        }

        console.log(`${member.firstName} woont in ${member.address.city}`);

        member.firstName = "Simon";
        member.lastName = "Backx";

        await member.save();
        member.lastName = "";
        member.lastName = "Backx";
        await member.save();
        console.log("Done.")
    } catch (e) {
        console.error("Failed to save member: ", e);
    }

};

start().catch((error) => {
    console.error('unhandledRejection', error);
    process.exit(1);
}).finally(() => {
    process.exit();
});
