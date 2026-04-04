# Klient

En C# klient som fungerar liknande `git` i terminalen ska skapas. Programmet ska
använda argument som styrning, men två argument som krav: `pull` och `push`,
precis som i `git pull` och `git push`. Målet är att kunna använda detta för att
hämta hem eller ladda upp alla filer från servern till den mapp programmet körs
från.

Om klienten hade byggts, låt säga med namnet `client`, så är det tänkt att
användaren ska navigera dit de vill och använda programmet där. Exempelvis:

```bash
# Navigera till någon mapp på disk
cd ./Some/Place/Test

# Hämta hem alla filer från servern
client pull 237.171.89.237

# Gör någon ändring
echo "# Hello World" > README.md
echo "Någon text" >> README.md
echo "test" > test.txt

# Ladda upp alla ändringar
client push 237.171.89.237
```

Detta gör att vi måste använda terminalens
[nuvarande arbetskatalog](https://en.wikipedia.org/wiki/Working_directory)
(_current working directory på engelska_) och inte förlita oss på att programmet
i fråga finns i samma mapp. Se detaljerana nedan för detta!

## Delad funktionalitet mellan `pull` och `push`

Oavsett om det första argumentent är `pull` eller `push` så ska det andra
argumentet vara serverns bas-adress, alltså exempelvis
[localhost:3000](http://localhost:3000) eller
[http://localhost:3000](http://localhost:3000). Klienten får sedan lägga till
`/api/files`, `api/login` om det behövs, liksom eventuella sökvägar för
fil-API:et på egen hand.

Om `http://` eller `https://` saknas så ska detta automatiskt läggas till, med
`http://` om domänen är `localhost` och `https://` för alla andra fall.

Om det inte går att nå en server på den angivna adressen så ska programmet ha
returkod `1`, annars ska `0` returneras som vanligt.

### Exempel på körning under utveckling

> ⚠️ **OBS**: Läs faktiskt det här, klaga inte om ni raderar hela projekt av
> misstag annars 🤷\
> _/ Oscar_

Eftersom klienten bygger på användning av den nuvarande arbetskatalogen, dvs den
plats som terminalen är på, så kan körning av klienten bli lite pillig. Denna
sökväg är ju alltid mappen som programmet befinner sig i om `dotnet run` körs
som vanligt, vilket är varför konfigurationsfiler brukar kunna hämtas rakt av,
men detta är **inte** vad vi vill göra nu. Ett tips är att göra något åt det här
hållet:

```bash
cd ./Client/
mkdir test
cd ./test/
dotnet run --project .. -- pull localhost:3000
```

Eller, om vi tar det steg för steg:

1. Navigera till klientmappen, vart den nu ligger:
   ```bash
   cd ./Client/
   ```

2. Skapa och gå in i en testmapp (_som **självklart** bör läggas till i
   `.gitignore`_, finns ingen poäng att synka dessa filer med GitHub)
   ```bash
   mkdir test
   cd ./test/
   ```

3. Kör klienten som vanligt, _**men**_, gör det med testmappen som nuvarande
   arbetskatalog:
   ```bash
   dotnet run --project .. -- pull localhost:3000
   ```
   Vi bygger alltså vårat program som vanligt, men det körs med den nuvarande
   terminalplatsen som nuvarande arbetskatalogen i stället för
   `Client\bin\Debug\net10.0` eller vart klienten nu ligger.

   Kom ihåg att lägga till användare / lösenord om dessa behövs såklart:
   ```bash
   dotnet run --project .. -- pull localhost:3000 "test-user" "So Long, and Thanks for All the Fish"
   ```

### Server och klient på olika datorer

Om servern skulle köras på en annan dator skulle klienten gå att köra via
exempelvis:

```csharp
dotnet run --project .. -- pull 192.168.1.187:3000
```

Givet att just `192.168.1.187` är serverdatorns IP såklart, liksom att servern
lyssnar på port `3000`.

### Användarnamn och lösenord

Om ett inloggningsysstem finns så ska användarnamn och lösenord anges som tredje
och fjärde argument, dvs något i stil med:

```bash
dotnet run --project .. -- pull localhost:3000 "Kalle Anka" "KallesBraLösenord123!"
```

Eller, om vi tar exemplet högst upp:

```bash
client push 237.171.89.237 "Kalle Anka" "KallesBraLösenord123!"
```

## Pull

När det första argumentet till C# klienten är `pull` så ska klienten göra ett
`GET` anrop mot serverns `/api/files` endpoint för att hämta alla filer (_och
mappar för er som har dessa_). Alla dessa filer ska sedan laddas ner och
placeras vid den nuvarande arbetskatalogen, dvs
[Directory.GetCurrentDirectory()](https://learn.microsoft.com/en-us/dotnet/api/system.io.directory.getcurrentdirectory?view=net-10.0).

> **OBS**: Det är endast obligatoriskt att ha stöd för textfiler, eftersom det
> endast är dessa som det kommer finnas tester för. Finns tid över är det dock
> värt att försöka lägga till stöd för bilder, zip-filer osv!

## Push

När det första argumentet till C# klienten är `push` så ska servern göra tvärt
om. Alla filer vid den nuvarande arbetskatalogen, dvs
[Directory.GetCurrentDirectory()](https://learn.microsoft.com/en-us/dotnet/api/system.io.directory.getcurrentdirectory?view=net-10.0),
ska laddas upp via `PUT` mot `/api/files/{filnamn}`. För grupper inkluderar
detta såklart även mappar liksom deras undermappar och filer.

Anledningen att `PUT` används är att om filen inte finns så ska den skapas, men
om den redan finns så ska den ersättas med det nya innehållet, och historik ska
genereras som vanligt.

> **OBS**: Samma som med `pull`, det är endast obligatoriskt med stöd för
> textfiler, men försök lägga till stöd för alla om tid finns!

Alla filer som **inte** finns lokalt men finns på servern ska även tas bort. Säg
att vi har följande struktur lokalt för att ge ett exempel:

- fil-1.txt
- fil-2.txt

Men denna på servern:

- fil-2.txt
- fil-3.txt

Då ska `fil-1.txt` skapas, `fil-2.txt` uppdateras och `fil-3.txt` tas bort på
servern!

## Skrytversion: automatisk synkronisering

Lägg till ett annat kommand, förslagsvis `sync`, och aktivera då
realtidssynkronisering av filer och mappar via SignalR-API:et. Annars bör det
fungera likadant, den baseras på den nuvarande arbetskatalogen och behöver
domän + eventuella inloggningsdetaljer för att fugnera.

Gör denna version om det finns tid över. Det kommer vara otroligt lärorikt, och
kommer göra programmet till något som är genuint användbart i framtiden, alltid
en stor bonus att ha gjort den typen av program när vi är på intervjuer!
