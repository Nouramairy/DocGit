import { BOLD, CYAN, DIM, GREEN, RED, RESET } from "./colors.js";
import { getDomain, setDomain } from "./http.js";
import { tryLoginAsTestUser } from "./testUser.js";

let inputKeyword = "grupp";
let advanced = false;

export function isAdvanced() {
    return advanced;
}

export function setInputKeyword(keyword) {
    inputKeyword = keyword;
}

export async function startProgram(printHelp) {
    advanced = process.argv[2] == inputKeyword;
    const domain = process.argv[advanced ? 3 : 2];

    if (process.argv.length == 2) {
        printHelp();
        process.exit(1);
    }

    if (!domain) {
        console.log(RED + "Ingen domän angiven" + RESET);
        console.log();
        printHelp();
        process.exit(1);
    }

    setDomain(domain);
    console.log(`Kör mot ${CYAN}${getDomain()}${RESET}`);
    await tryLoginAsTestUser(advanced, false);

    console.log();
}




export function printExampleCommands(npm, args, guideSimple, guideAdvanced) {
    console.log(`För att köra detta måste er C# server först vara igång. Det här programmet kommer`)
    console.log(`sedan anropa servern, men för att veta vilken port servern ligger på måste detta`)
    console.log(`anges som argument. I följande exempel används port ${CYAN}3000${RESET}, men byt ut detta`)
    console.log(`till det som stämmer med er server.`)
    console.log()
    console.log("Programmet förväntas köras på ett av två sätt:");
    console.log()
    console.log(` ${DIM}-${RESET} ${BOLD}${npm} <domän>${RESET}, ${guideSimple ?? "för er som arbetar på egen hand"}, exempelvis:`);
    console.log(`   ${GREEN}${npm} localhost:3000 ${args ?? ""}${RESET}`);
    console.log();
    console.log(` ${DIM}-${RESET} ${BOLD}${npm} ${inputKeyword} <domän>${RESET}, ${guideAdvanced ?? "för er som arbetar i grupp"}, exempelvis:`);
    console.log(`   ${GREEN}${npm} ${inputKeyword} localhost:3000 ${args ?? ""}${RESET}`);
    console.log();
}