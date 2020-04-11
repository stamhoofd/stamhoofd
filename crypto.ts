import sodium from "libsodium-wrappers";

(async () => {
    await sodium.ready;

    /*const key = sodium.crypto_secretstream_xchacha20poly1305_keygen();
    console.log(Buffer.from(key).toString('base64'));

    const res = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
    const [stateOut, header] = [res.state, res.header];
    const c1 = sodium.crypto_secretstream_xchacha20poly1305_push(stateOut,
        sodium.from_string('message 1'), null,
        sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE);
    const c2 = sodium.crypto_secretstream_xchacha20poly1305_push(stateOut,
        sodium.from_string('message 2'), null,
        sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL);

    const stateIn = sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, key);
    const r1 = sodium.crypto_secretstream_xchacha20poly1305_pull(stateIn, c1);
    const [m1, tag1] = [sodium.to_string(r1.message), r1.tag];
    const r2 = sodium.crypto_secretstream_xchacha20poly1305_pull(stateIn, c2);
    const [m2, tag2] = [sodium.to_string(r2.message), r2.tag];

    console.log(Buffer.from(c1).toString('base64'));
    console.log(Buffer.from(c2).toString('base64'));

    console.log(m1);
    console.log(m2);*/

    const keyPair = sodium.crypto_box_keypair();
    console.log(keyPair);

    const memberPair = sodium.crypto_box_keypair();
    console.log(memberPair);

    // Encrypt the member private key using the user's key pair
    const sealedMemberKey = sodium.crypto_box_seal(memberPair.privateKey, keyPair.publicKey);
    console.log(sealedMemberKey);

    // Clear private key
    memberPair.privateKey = new Uint8Array();

    const original = "Sensitive user data??".repeat(50);
    console.log(original);

    // Encrypt the sensitive data with the member's key
    const sealed = sodium.crypto_box_seal(original, memberPair.publicKey);
    console.log(sealed);

    // Encrypt the sensitive data with the member's key
    const test = sodium.crypto_box_seal("this is a  test", memberPair.publicKey);
    console.log(test);

    try {
        const plainText = sodium.crypto_box_seal_open(sealed, memberPair.publicKey, memberPair.privateKey, 'text');
        console.log(plainText);
    } catch (e) {
        console.error("Invalid public and/or private key. Could not decrypt the data.");
    }

    for (let index = 0; index < 1000; index++) {
        // Recover private key using user key
        const memberPrivateKey = sodium.crypto_box_seal_open(sealedMemberKey, keyPair.publicKey, keyPair.privateKey);
        //console.log(keyPair);


        try {
            const plainText = sodium.crypto_box_seal_open(sealed, memberPair.publicKey, memberPrivateKey, 'text');
            //console.log(plainText);
        } catch (e) {
            console.error("Invalid public and/or private key. Could not decrypt the data.");
        }
    }






})().catch(e => {
    console.error(e);
});