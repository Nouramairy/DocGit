import { spawnSync } from "child_process";
import { GREEN, RED, RESET } from "../colors.js";
import { assertEqual, group, setup, skip, test } from "../framework.js";
import Path from "path";
import FS from "fs";
import OS from "os";
import { GET, getDomain, POST } from "../http.js";
import { apiLoginExists, getUserInfo } from "../testUser.js";
import { fillDirectoryWithRandomContent, randomFileName, randomString } from "../random.js";
import { isAdvanced } from "../inputHandler.js";

let projectPath;
let runnableClientPath;
let currentPath;
export function registerClient(path) {
    projectPath = path;

    group("Klienten", () => {
        test("går att bygga", () => {
            runnableClientPath = undefined;
            goto(projectPath);
            const result = run("dotnet", "build");
            if (result.status !== 0) throw `${RED}dotnet build${RESET} fick status ${RED}${result.status}${RESET}`;

            // Find the path to the project (written as Client -> C:\Users\...\bin\Debug\net10.0\Client.dll)
            for (const row of result.stdout.toString().split("\n")) {
                const indexOfPath = row.indexOf(currentPath);
                if (indexOfPath < 0) continue;

                const pathToDll = row.substring(indexOfPath);
                const buildDir = Path.dirname(pathToDll);
                runnableClientPath = findExecutable(buildDir);
                break;
            }
        });

        test("utan varningar", () => {
            goto(projectPath);
            const result = run("dotnet", "build", "-warnaserror", "--no-incremental");
            if (result.status !== 0) throw `${RED}dotnet build -warnaserror --no-incremental${RESET} fick status ${RED}${result.status}${RESET}`;
        });

        group("pull", () => {
            registerSharedTests("pull");

            let content;

            setup(async () => {
                content = undefined;
                if (!runnableClientPath) return skip();

                let tempContent = await getOrGenerateContent(15);
                await loadExpectedStructure(tempContent);
                content = tempContent;
            });

            test("kan ladda ner filer", async () => {
                if (!content) return skip();
                runInTempDirectory((dir) => {
                    pull();
                    validateFiles(dir, content);
                });
            });

            test("tar bort lokala filer som inte finns på servern", async () => {
                if (!content) return skip();
                runInTempDirectory((dir) => {
                    fillDirectoryWithRandomContent(dir, 30);
                    pull();
                    validateNoExtraFiles(dir, content);
                });
            });

            test("ladda ner nya versioner av filer", async () => {
                if (!content) return skip();
                runInTempDirectory((dir) => {
                    pull();
                    for (const name in content) {
                        const entity = content[name];
                        if (!entity.file) continue;
                        FS.appendFileSync(Path.join(dir, name), "\nData som lades till på slutet, borde ha tagits bort", "utf8");
                    }
                    pull();
                    validateFiles(dir, content);
                });
            });
        });

        group("push", () => {
            registerSharedTests("push");

            test("tar bort alla filer på servern om mappen är tom", async () => {
                if (!runnableClientPath) return skip();

                // Ensure some files on the server, then push an empty dir
                await getOrGenerateContent(15);
                runInTempDirectory(() => push());

                const r = await GET.json("/api/files/");
                const numberOfFiles = Object.keys(r).length;
                if (numberOfFiles != 0) throw `Det fanns ${numberOfFiles} ${numberOfFiles == 1 ? "fil eller mapp" : "filer eller mappar"} kvar`;
            });

            test("laddar upp filer", async () => {
                if (!runnableClientPath) return skip();

                let dirCopy = undefined;
                runInTempDirectory((dir) => {
                    fillDirectoryWithRandomContent(dir, isAdvanced() ? 25 : 8);
                    push();
                    dirCopy = createDirCopy(dir);
                });

                const apiContent = await GET.json("/api/files");
                await loadExpectedStructure(apiContent);
                validateFileCopies(dirCopy, apiContent)
            });

            test("ersätter filer", async () => {
                if (!runnableClientPath) return skip();

                let dirCopy = undefined;
                runInTempDirectory((dir) => {
                    fillDirectoryWithRandomContent(dir, isAdvanced() ? 25 : 8);
                    push();
                    dirCopy = createDirCopy(dir);

                    for (const key in dirCopy) {
                        if (dirCopy[key].file) {
                            dirCopy[key].content += "\nEn ändring som lades till";
                            FS.writeFileSync(Path.join(dir, key), dirCopy[key].content, "utf8");
                        }
                    }

                    push();
                });

                const apiContent = await GET.json("/api/files");
                await loadExpectedStructure(apiContent);
                validateFileCopies(dirCopy, apiContent)
            });
        });
    });
}

function validateFileCopies(fs, api) {
    for (const name in api) {
        const fsEntity = fs[name];
        if (fsEntity == undefined) throw "Kunde inte hitta " + name;

        const apiEntity = api[name];
        if (apiEntity.file) {
            assertEqual(fsEntity.content, apiEntity.content);
        }
        else {
            validateFileCopies(fsEntity.content, apiEntity.content);
        }
    }
}

function validateFiles(onDiskDir, expected) {
    for (const name in expected) {
        const onDiskEntityPath = Path.join(onDiskDir, name);
        if (!FS.existsSync(onDiskEntityPath)) throw "Kunde inte hitta " + onDiskEntityPath;

        const entity = expected[name];
        if (entity.file) {
            const content = FS.readFileSync(onDiskEntityPath, "utf8");
            assertEqual(entity.content, content);
        }
        else {
            validateFiles(onDiskEntityPath, entity.content);
        }
    }
}

function validateNoExtraFiles(onDiskDir, expected) {
    function getNumberOfExtraFiles(onDiskDir, expected) {
        const entities = FS.readdirSync(onDiskDir);
        let shouldHaveBeenRemoved = 0;
        for (const entityName of entities) {
            if (expected[entityName] == undefined) shouldHaveBeenRemoved++;
            else if (!expected[entityName].file) {
                shouldHaveBeenRemoved += getNumberOfExtraFiles(
                    Path.join(onDiskDir, entityName),
                    expected[entityName].content
                );
            }
        }
        return shouldHaveBeenRemoved;
    }
    const n = getNumberOfExtraFiles(onDiskDir, expected);
    if (n > 0) throw `Det fanns ${RED}${n}${RESET} ${n == 1 ? "fil / mapp" : "filer / mappar"} kvar på disk som inte fanns på servern`;
}


function registerSharedTests(type) {
    setup(() => {
        if (!runnableClientPath) throw "Klienten måste kunna byggas först";
    });

    test(fårReturkod1 + " om en url saknas", () => {
        if (!runnableClientPath) return skip();

        runInTempDirectory(() => {
            const result = run(runnableClientPath, type);
            if (result.status != 1) throw `Fick returkod ${RED}${result.status}${RESET}`;
        });
    });

    test(fårReturkod1 + " för en ogiltig url", () => {
        if (!runnableClientPath) return skip();

        runInTempDirectory(() => {
            const result = pullOrPush(type, { domain: "asjdajldasdjladlasdlasndasdlasdasdasldasdadjlnladjdlanala.dljdq219nfnfn9ewf9uewewnf3nsfnlsdfldsfjldsnfsdlj" });
            if (result.status != 1) throw `Fick returkod ${RED}${result.status}${RESET}`;
        });
    });

    if (apiLoginExists()) {
        const user = getUserInfo();

        test(`${fårReturkod1} när användare och lösenord saknas`, () => {
            if (!runnableClientPath) return skip();

            runInTempDirectory(() => {
                const result = run(runnableClientPath, type, getDomain());
                if (result.status != 1) throw `Fick returkod ${RED}${result.status}${RESET}`;
            });
        });

        test(`${fårReturkod1} när lösenord saknas`, () => {
            if (!runnableClientPath) return skip();

            runInTempDirectory(() => {
                const result = run(runnableClientPath, type, getDomain(), user.name);
                if (result.status != 1) throw `Fick returkod ${RED}${result.status}${RESET}`;
            });
        });

        test(`${fårReturkod1} när lösenord är fel`, () => {
            if (!runnableClientPath) return skip();

            runInTempDirectory(() => {
                const result = run(runnableClientPath, type, getDomain(), user.name, "nda98nsa9dnaso sadasodbas");
                if (result.status != 1) throw `Fick returkod ${RED}${result.status}${RESET}`;
            });
        });

        test(`${fårReturkod1} när användaren inte finns`, () => {
            if (!runnableClientPath) return skip();

            runInTempDirectory(() => {
                const result = run(runnableClientPath, type, getDomain(), "Skapa inte den här användaren eftersom testerna blir fel då :)", user.password);
                if (result.status != 1) throw `Fick returkod ${RED}${result.status}${RESET}`;
            });
        });
    }
}


function goto(path) {
    currentPath = Path.resolve(path);
}

async function loadExpectedStructure(entities, path) {
    for (const name in entities) {
        const fullPath = path ? `${path}/${name}` : name;
        const entity = entities[name];
        if (entity.file) {
            try {
                entity.content = await GET.text("/api/files/" + fullPath);
            }
            catch (e) {
                throw "Kunde inte ladda filens innehåll via API:et: " + e;
            }
        }
        else {
            await loadExpectedStructure(entity.content, fullPath);
        }
    }
}

async function getOrGenerateContent(minimumNumberOfEntities) {
    let tempContent = await GET.json("/api/files/");
    const itemsToAdd = minimumNumberOfEntities - tempContent.length;
    if (itemsToAdd > 0) {
        await createMissing(itemsToAdd, 5 - tempContent.filter(x => !x.file).length)
        tempContent = await GET.json("/api/files/");
    }
    return tempContent;
}

async function createMissing(remainingFiles, remainingDirectories) {
    while (remainingFiles > 0 || remainingDirectories > 0) {
        let path = undefined;
        if (remainingDirectories > 0) {
            remainingDirectories--;
            path = randomString(20);
            try {
                await POST.void("/api/files/" + path);
            }
            catch (e) {
                throw "Det gick inte att skapa en mapp via API:et: " + e;
            }
        }

        const itemsToAdd = Math.min(remainingFiles, 1 + Math.floor(Math.random() * 4));
        for (let i = 0; i < itemsToAdd; i++) {
            remainingFiles--;
            const fileName = randomFileName();
            const fullPath = path ? `${path}/${fileName}` : fileName;
            try {
                await POST.void("/api/files/" + fullPath, randomString(Math.floor(Math.random() * 1000)));
            }
            catch (e) {
                throw "Det gick inte att skapa en fil via API:et: " + e;
            }
        }
    }
}

function pull() {
    const r = pullOrPush("pull");
    if (r.status != 0) throw `Kunde inte pusha, klienten returnerade status ${RED}${r.status}${RESET}`;
}

function push() {
    const r = pullOrPush("push");
    if (r.status != 0) throw `Kunde inte pusha, klienten returnerade status ${RED}${r.status}${RESET}`;
}

function pullOrPush(type, custom) {
    if (apiLoginExists()) return run(
        runnableClientPath,
        type,
        custom?.domain ?? getDomain(),
        custom?.name ?? getUserInfo().name,
        custom?.password ?? getUserInfo().password
    );
    else return run(
        runnableClientPath,
        type,
        custom?.domain ?? getDomain()
    );
}

function run(program, ...args) {
    if (program != "dotnet" && !FS.existsSync(program)) throw ("Klientprogrammet blev borttaget innan testerna körde klart: " + program);
    const result = spawnSync(program, args, {
        // stdio: "pipe",
        cwd: currentPath
    });

    if (result.error) {
        throw RED + "Oväntat programfel: " + RESET + result.error;
    }


    return {
        status: result.status,
        stdout: result.stdout?.toString() ?? "",
        fullcommand: Path.basename(program) + (args.length > 0 ? (" " + args.join(" ")) : "")
    };
}

function findExecutable(dir) {
    const files = FS.readdirSync(dir);
    for (const file of files) {
        const fullPath = Path.join(dir, file);
        const stat = FS.statSync(fullPath);
        if (!stat.isFile()) continue;

        // Windows is just a .exe file
        if (process.platform == "win32") {
            if (file.endsWith(".exe")) return fullPath;
        }
        // UNIX has the execute bit
        else if ((stat.mode & 0o111) !== 0) {
            return fullPath;
        }
    }
}

function runInTempDirectory(delegate) {
    let tempDir = undefined;
    try {
        const targetPath = Path.join(OS.tmpdir(), 'aspnet-tests-');
        tempDir = FS.mkdtempSync(targetPath);
        goto(tempDir);
        delegate(tempDir);
    } finally {
        if (tempDir) {
            FS.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}

function createDirCopy(dir) {
    const copy = {};
    const content = FS.readdirSync(dir);
    for (const name of content) {
        const fullPath = Path.join(dir, name);
        const file = FS.statSync(fullPath).isFile();
        copy[name] = {
            file: file,
            content: file
                ? FS.readFileSync(fullPath, "utf8")
                : createDirCopy(fullPath)
        };
    }
    return copy;
}


const fårReturkod1 = `får returkod ${GREEN}1${RESET}`;
