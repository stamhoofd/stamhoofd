import { Member, FullyLoadedMember } from "./src/members/models/Member"
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
        const found = await Member.getByID(123)
        let member: FullyLoadedMember

        if (found) {
            console.log("Found member " + found.firstName)
            member = found

            // Move address of Simon
            const address = new Address()
            address.city = "Moved"
            address.country = "BE"
            address.street = "Straatnaam"
            address.number = "123"
            address.postalCode = "9000"
            await address.save()
            found.address = address

        } else {
            console.log("Didn't find member")
            const address = new Address()
            address.city = "Demo"
            address.country = "BE"
            address.street = "Straatnaam"
            address.number = "123"
            address.postalCode = "9000"
            await address.save()

            member = new Member().setRelation("address", address)
        }

        member.logCountry()

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
