process.title = "stamhoofd-sgv-mock";

import("./boot.js").catch((error) => {
    console.error("Failed to start SGV mock:", error);
    process.exit(1);
});
