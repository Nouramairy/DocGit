# Historik

Filhistorik ska läggas till i valfritt format. Kravet är att:

1. Historik går att se och interagera med via webbsidan. Det går att backa till
   äldre versioner och gå fram igen via gränssnittet. Den gamla versionen
   behöver inte appliceras (om inte uppgiften görs i grupp), men den ska gå att
   se den gamla versionen av filen

2. Historiken ska gälla för **alla** fil-API-anrop mot `PUT`, dvs varje gång
   `PUT` mot `/api/files/...` anropas så ska den gamla versionen av den
   relevanta filen sparas innan den ersätts med den nya så att det går att backa
   tillbaka senare

3. All denna historik ska sparas i en **Entity Framework SQLite databas** på
   valfritt sätt. Detta kan vara att spara hela filens innehåll i databasen,
   eller bara en tabell med massa sökvägar till filer som faktiskt ligger på
   disk.

   > **Tips**: För att göra det enkelt kan en ren kopia av filen sparas i en
   > kolumn i en historiktabell, förslagsvis med en annan kolumn som säger
   > vilket versionsnummer detta är (_börja med 1, sedan 2, sedan 3 osv för
   > samma fil_). Då blir det enkelt att hämta ut historik för en specifik fil,
   > och tack vare versionsnummer blir det korrekt sorterat!

   > **Tips för de som siktar högt**:
   > [LCS algoritmen](https://en.wikipedia.org/wiki/Longest_common_subsequence)
   > är väldigt vanlig för att beräkna skillnader mellan två texter, och kan
   > vara väldigt användbart att köra vid **PUT**. Då kan endast skillnaden
   > sparas i databasen, vilket dels tar mycket mindre plats men också gör det
   > enklare att få en diff i GIT-stil eftersom datan redan är sparad så!
   >
   > Det är också helt ok att skapa en annan endpoint via API:et eller via
   > SignalR där en ren diff skickas från klienten, så behöver inte en hel
   > **PUT** köras varje gång ifall det föredras, så länge som originalversionen
   > fortfarande går att göra via Postman så!

## Krav för grupper

1. Filer som tas bort via `DELETE` ska sparas i en "borttagna filer"-lista, och
   gå att återställa, inklusive deras individuella historik

2. Det ska gå att trycka på någon form av "återställ denna version"-knapp som
   återställer dokumentet till den version som gränssnittet kollar på
