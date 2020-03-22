import { Member } from "./src/database/models/Member"

process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    console.error('unhandledRejection', error);
});



const start = async () => {
    try {
        const member = new Member();

        member.id = 123;
        member.firstName = "Simon";

        member.save();
        member.firstName = "Simon";
        member.lastName = "Backx";

        await member.save();

    } catch (e) {
        console.error("Failed to save member: ", e);
    }

};

start();
