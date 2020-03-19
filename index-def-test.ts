import { member, record } from './src/structs/Member';
import path from 'path';
import { Struct } from './src/classes/struct-builder/Struct';
import { CreateMember } from './src/endpoints/CreateMember';
import { Request } from './src/classes/routing/Request';


Struct.save([record, member], path.join(__dirname, 'src/generated/structs.ts'));


// Test endpoint
const createMemberEndpoint = new CreateMember()
var r = new Request();
r.body = JSON.stringify({
    firstName: "Simon",
    lastName: "Backx",
    records: [{
        name: "hallo"
    }]
});
r.headers['Content-Type'] = "application/vnd.stamhoofd.Member+json;version=2";
r.headers['Accept'] = "application/vnd.stamhoofd.Member+json;version=1";

try {
    var response = createMemberEndpoint.run(r);
    if (response) {
        console.log(response.body)
    }

} catch (err) {
    console.error(err);
}
