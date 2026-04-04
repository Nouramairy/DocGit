import { CYAN, GREEN, RED, RESET } from "../colors.js";
import { assertEqual, assertHasProperty, group, setup, skip, test } from "../framework.js";
import { assertOk, DELETE, GET, HEAD, POST, PUT } from "../http.js";
import { isAdvanced as isGroup } from "../inputHandler.js";
import { randomString } from "../random.js";

let allFiles = undefined;
let tempPath = undefined;
let tempFile = undefined;
let extension = undefined;
let fileContent = "";
let timestamp;



export function registerApiFilesPost() {
    const extensions = [
        ".txt",
        ".json",
        ".md",
        ".md",
        ".cs",
        ".h",
        ".r",
        ".test",
        ".exempel",
    ];
    group("/api/files", () => {
        let couldPost = false;
        let couldGet = false;
        let couldDelete = false;
        let couldPut = false;

        test("kan hämta alla filer med GET", async () => {
            couldPost = false;
            couldGet = false;
            couldDelete = false;
            couldPut = false;
            try {
                allFiles = await GET.json("/api/files");
                extension = extensions[Math.floor(Math.random() * extensions.length)];
                do { tempFile = randomString(16) + extension; }
                while (tempFile in allFiles);
                fileContent = randomString(10 + Math.floor(Math.random() * 5000));
                timestamp = getTimeStamp();
            }
            catch (e) {
                allFiles = undefined;
                throw e;
            }
        });

        test("kan skapa en ny fil med POST", async () => {
            if (allFiles == undefined) return skip();

            await POST.void("/api/files/" + tempFile, fileContent);
            timestamp = getTimeStamp();
            couldPost = true;
        });

        test("kan inte skapa samma fil igen med POST", async () => {
            if (allFiles == undefined) return skip();

            const response = await POST.everything("/api/files/" + tempFile, fileContent);
            if (response.status != 409) throw `Status ${GREEN}409${RESET} förväntades, fick ${RED}${response.status}${RESET}`;
        });

        mapHeaderTestsFor("HEAD");
        mapHeaderTestsFor("GET");

        group("tester för alla filer via GET", () => {
            let canRun;
            setup(() => {
                canRun = couldPost;
                if (!canRun) throw "GET, POST och DELETE måste fungera först";
            });

            let createdFile;
            test(`kan hämta bland annat den skapade filen med GET ${CYAN}/api/files${RESET}`, async () => {
                createdFile = undefined;
                if (!canRun) return skip();

                const allFilesNow = await GET.json("/api/files");
                createdFile = allFilesNow[tempFile]; // TODO: + "test" for testing

                if (createdFile == undefined) throw `Den skapade filen borde ha funnits i svarets body\nEftersom filen heter "${tempFile}" borde en property med det namnet funnits`;
                if (typeof createdFile != "object") throw `Filens property borde vara ett objekt, men var av typen ${RED}${typeof createdFile}${RESET}`;
            });

            group("propertyn innehåller följande:", () => {
                setup(() => {
                    if (!createdFile) throw "Testet ovan måste gå igenom först";
                });
                test('"created"', () => {
                    if (!createdFile) return skip();
                    assertHasProperty(createdFile, "created", timestamp);
                });
                test('"changed"', () => {
                    if (!createdFile) return skip();
                    assertHasProperty(createdFile, "changed", timestamp);
                });
                test('"file"', () => {
                    if (!createdFile) return skip();
                    assertHasProperty(createdFile, "file", true);
                });
                test('"bytes"', () => {
                    if (!createdFile) return skip();
                    assertHasProperty(createdFile, "bytes", fileContent.length);
                });
                test('"extension"', () => {
                    if (!createdFile) return skip();
                    assertHasProperty(createdFile, "extension", createdFile.extension);
                });
            })
        });

        test("kan läsa filinnehåll med GET", async () => {
            const content = await GET.text("/api/files/" + tempFile);
            assertEqual(fileContent, content);
            couldGet = true;
        });

        test("kan ta bort fil med DELETE", async () => {
            await DELETE.void("/api/files/" + tempFile);

            const get = await GET.everything("/api/files/" + tempFile)
            if (get.ok) throw `Blev inte borttagen, gick fortfarande att hämta efter DELETE`;
            couldDelete = true;
        });

        test("får fortfarande 200 OK även om filen inte finns längre", async () => {
            if (!couldDelete) return skip();
            await DELETE.void("/api/files/" + tempFile);
            await DELETE.void("/api/files/" + tempFile);
            await DELETE.void("/api/files/" + tempFile);
        });

        group("kan skapas igen via PUT", () => {
            setup(() => {
                if (!couldPost || !couldGet || !couldDelete) throw "GET, POST och DELETE måste fungera först";
            });

            test("kan skapas", async () => {
                if (!couldPost || !couldGet || !couldDelete) return skip();

                await PUT.void("/api/files/" + tempFile, fileContent);
                couldPut = true;
            });

            test("får fortfarande 200 OK även om filen redan finns", async () => {
                if (!couldPut) return skip();

                await PUT.void("/api/files/" + tempFile, fileContent);
            });

            test("får rätt innehåll", async () => {
                if (!couldPut) return skip();

                const currentContent = await GET.text("/api/files/" + tempFile);
                assertEqual(fileContent, currentContent);
            });

            test("innehållet byts ut", async () => {
                if (!couldPut) return skip();

                const newContent = "Detta är ny text";
                await PUT.void("/api/files/" + tempFile, newContent);
                const currentContent = await GET.text("/api/files/" + tempFile);
                assertEqual(newContent, currentContent);
            });

            test("kan tas bort igen", async () => {
                if (!couldPut) return skip();
                await DELETE.void("/api/files/" + tempFile);
            });
        });


        test("kan skapa stora filer", async () => {
            if (!couldPost || !couldGet || !couldDelete) throw "GET, POST och DELETE måste fungera först";

            const size = 64_000_000; // 64 MB
            const bytes = new Uint8Array(size);

            const CHUNK = 65536; // crypto limit
            for (let i = 0; i < size; i += CHUNK) {
                crypto.getRandomValues(bytes.subarray(i, i + CHUNK));
            }

            const body = new TextDecoder().decode(bytes);
            await POST.void("/api/files/" + tempFile, body);
            await DELETE.void("/api/files/" + tempFile);
        });


        if (isGroup()) {
            group("mappar", () => {
                group("GET", () => {
                    test("får 404 Not Found om mappen inte finns", async () => {
                        const r = await GET.everything("/api/files/ad89sadas9dn9asnd/asd0nasdn8asd0asn/asd0nas0sadn80sdanas");
                        if (r.status != 404) throw `Borde fått status ${GREEN}404 Not Found${RESET}, fick ${RED}${r.status} ${r.statusText}${RESET}`;
                    })
                    test("får 404 Not Found om mappar med längd 0 anges", async () => {
                        const r = await GET.everything("/api/files//");
                        if (r.status != 404) throw `Borde fått status ${GREEN}404 Not Found${RESET}, fick ${RED}${r.status} ${r.statusText}${RESET}`;
                    })
                });
                mapDirectoryTestsFor("POST");
                mapDirectoryTestsFor("PUT");
            });
        }
    });
}


function mapDirectoryTestsFor(method, allowDuplicates) {
    const callApi = method == "POST" ? POST.void : PUT.void;

    let lastName;
    const toRemove = [];
    const genName = () => lastName = removeLater(`${method}-mapp_${randomString(16)}`);
    function removeLater(name) {
        toRemove.push(name);
        return name;
    }

    group(`skapas med ${method} utan en body`, () => {
        let couldCreate = false;
        test("på root nivå", async () => {
            couldCreate = false;
            await callApi("/api/files/" + genName());
            couldCreate = true;
        });
        test("och tas bort", async () => {
            if (!couldCreate) return skip();
            await callApi("/api/files/" + genName());
            await DELETE.void("/api/files/" + lastName);
        });

        if (method == "PUT") {
            test("skriver över dubletter", async () => {
                await callApi("/api/files/" + genName());
                await callApi("/api/files/" + lastName);
            });
        }
        else {
            test("varnar för dubletter", async () => {
                await callApi("/api/files/" + genName());
                const r = await POST.everything("/api/files/" + lastName)
                if (r.status != 409) throw `Borde fått status ${GREEN}409${RESET} eftersom mappen redan fanns, fick ${RED}${r.status} ${r.statusText}${RESET}`
            });
        }

        test("med flera nivåer", async () => {
            let path = genName();
            await callApi("/api/files/" + path);

            path = removeLater(path + "/undermapp");
            await callApi("/api/files/" + path);

            path = removeLater(path + "/en till undermapp");
            await callApi("/api/files/" + path);

            await callApi("/api/files/" + removeLater(path + "/en sista undermapp"));
            await callApi("/api/files/" + removeLater(path + "/lite fler på samma nivå"));
            await callApi("/api/files/" + removeLater(path + "/test test"));
        });

        group("filer", () => {
            let dir;
            let timeTxt;
            let timeMd;

            test("kan skapas under en mapp", async () => {
                dir = timeTxt = timeMd = undefined;
                const dirName = genName();
                await callApi("/api/files/" + dirName)
                dir = dirName;

                await POST.void("/api/files/" + dir + "/test.txt", "Detta är text");
                timeTxt = getTimeStamp();
                await POST.void("/api/files/" + dir + "/exempel.md", "# Hej!\nDetta är en markdown fil");
                timeMd = getTimeStamp();
            });

            test("kan hämtas med GET", async () => {
                if (!dir) return skip();
                const result = await GET.json("/api/files/" + dir);

                const txt = result["test.txt"];
                const md = result["exempel.md"];

                if (txt == undefined) throw `Bodyn borde haft en property som heter ${GREEN}test.txt${RESET}`;
                if (md == undefined) throw `Bodyn borde haft en property som heter ${GREEN}exempel.md${RESET}`;

                validateFile(txt, timeTxt, 14, ".txt");
                validateFile(md, timeMd, 32, ".md");
            });

            test("kan tas bort med DELETE", async () => {
                if (!dir) return skip();
                await DELETE.void("/api/files/" + dir + "/test.txt");
                await DELETE.void("/api/files/" + dir + "/exempel.md");
            });

            function validateFile(file, time, bytes, extension) {
                assertHasProperty(file, "created", time);
                assertHasProperty(file, "changed", time);
                assertHasProperty(file, "file", true);
                assertHasProperty(file, "bytes", bytes);
                assertHasProperty(file, "extension", extension);
            }
        });


        setup(async () => {
            const paths = [...toRemove];
            toRemove.length = 0;

            for (const path of paths) {
                try {
                    await DELETE.void("/api/files/" + path);
                }
                catch { }
            }
        });
    });
}


function mapHeaderTestsFor(method) {
    group(`kan läsa metadata (headers) med ${method}`, () => {
        let response;

        setup(async () => {
            response = undefined;
            // if (allFiles == undefined) throw "Går inte att köra innan första testet fungerar";

            const r = await (method === "HEAD" ? HEAD : GET).everything("/api/files/" + tempFile);
            assertOk(r);
            response = r;
        });
        test("X-Created-At", () => {
            if (response == undefined) return skip();
            assertEqual(response.headers.get("x-created-at"), timestamp);
        });
        test("X-Changed-At", () => {
            if (response == undefined) return skip();
            assertEqual(response.headers.get("x-changed-at"), timestamp);
        });
        test("X-Type", () => {
            if (response == undefined) return skip();
            assertEqual(response.headers.get("x-type"), "file");
        });
        test("X-Bytes", () => {
            if (response == undefined) return skip();
            assertEqual(response.headers.get("x-bytes"), `${fileContent.length}`);
        });
        test("X-Extension", () => {
            if (response == undefined) return skip();
            assertEqual(response.headers.get("x-extension"), extension);
        });
    });
}


function getTimeStamp() {
    let timestamp = new Date().toISOString().replace("T", " ");
    const lastIndex = timestamp.lastIndexOf(".");
    return timestamp.substring(0, lastIndex);
}
