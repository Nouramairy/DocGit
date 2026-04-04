import { BOLD, CYAN, DIM, GREEN, RED, RESET } from "./colors.js";
import { assertOk, customFetch, POST, PUT } from "./http.js";
import { isAdvanced as shouldGenerateDirectories, printExampleCommands, setInputKeyword, startProgram } from "./inputHandler.js";
import { randomString } from "./random.js";
import { apiLoginExists, getUserInfo } from "./testUser.js";
import FileSystem from "fs";

setInputKeyword("mappar");

await startProgram(printHelp);

await createFile("README.md", "text/markdown; charset=UTF-8", "# Detta är en README\nDetta är vanlig text under rubriken.");
await createFile("test.txt", "text/plain; charset=UTF-8", "Testfil!\nInnehåller lite unicode dumheter: 🥳🙂😊🎉🪿🦆👑❤️\nOch lite åäÅÄÖ, kanske lite ^¨~' också");
await createFile("table.csv", "text/csv; charset=UTF-8", "a,b,c\n1,2,3\n4,5,6\n7,8,9");
await uploadFile("sqlite.jpg", "./tests/sqlite.jpg");


if (shouldGenerateDirectories()) {
    await createFile("mapp 1");
    await createFile("mapp 1/random.txt", "text/markdown; charset=UTF-8", randomString(512));
    await uploadFile("mapp 1/nvarchar.jpeg", "./tests/nvarchar.jpeg");
    
    
    await createFile("mapp 2");
    await uploadFile("mapp 2/databases.png", "./tests/databases.png");
    await createFile("mapp 2/random1.txt", "text/markdown; charset=UTF-8", "Den här filen borde ligga under mapp 2");
    await createFile("mapp 2/random2.txt", "text/markdown; charset=UTF-8", randomString(512));

    await createFile("mapp 2/mapp 3");
    await uploadFile("mapp 2/mapp 3/css.gif", "./tests/css.gif");
    await createFile("mapp 2/mapp 3/random1.txt", "text/markdown; charset=UTF-8", "Den här filen borde ligga under mapp 2 -> mapp 3");
    await createFile("mapp 2/mapp 3/random2.txt", "text/markdown; charset=UTF-8", randomString(512));
    await createFile("mapp 2/mapp 3/random3.txt", "text/markdown; charset=UTF-8", randomString(512));
    await createFile("mapp 2/mapp 3/random4.txt", "text/markdown; charset=UTF-8", randomString(512));
    await createFile("mapp 2/mapp 3/random5.txt", "text/markdown; charset=UTF-8", randomString(512));
    await createFile("mapp 2/mapp 3/random6.txt", "text/markdown; charset=UTF-8", randomString(512));
}
else {
    await uploadFile("nvarchar.jpeg", "./tests/nvarchar.jpeg");
    await uploadFile("databases.png", "./tests/databases.png");
    await uploadFile("css.gif", "./tests/css.gif");
}



async function uploadFile(file, localPath) {
    const buffer = FileSystem.readFileSync(localPath, "base64");
    try {
        const r = await customFetch('/api/files/' + file, "POST", {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': buffer.length
            },
            body: buffer
        }, false);
        if (r.status != 409) assertOk(r);
        console.log(`${GREEN}✓${RESET} ${file}`);
    } catch (e) {
        console.error(`${RED}⨉${RESET} ${file} ${DIM}-${RESET} ${e}`)
    }
}
async function createFile(file, contentType, content) {
    try {
        let url = `/api/files/`;
        // if (apiLoginExists()) {
        //     const user = getUserInfo();
        //     url += `${user.name}/test/`;
        // }
        url += file;
        const r = await POST.everything(url, content, contentType);
        if (r.status != 409) assertOk(r);
        console.log(`${GREEN}✓${RESET} ${file}`);
    }
    catch (e) {
        console.error(`${RED}⨉${RESET} ${file} ${DIM}-${RESET} ${e}`)
    }
}


function printHelp() {
    console.log("Det här programmet kan automatiskt generera ett antal testfiler.");

    printExampleCommands("npm run generate", undefined, "för er som inte har stöd för mappar", "för er som har stöd för mappar");
}