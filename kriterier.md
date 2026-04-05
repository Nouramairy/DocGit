## Kriterier för G

Det finns framförallt två punkter från kursplanen som den här uppgiften bockar av:

- Att utveckla webbapplikationer genom ASP.NET  
- Att anropa Web-API:er från samt utveckla egna med .NET  

För att uppnå det ska programspecifikationen från projektets markdownfiler uppfyllas. Utöver det ska:

- Inga compile-varningar finnas när C#-projekten byggs. Inget gult, och självklart inget rött – det ska bygga rakt av utan konstigheter.

- Programmet ska gå att starta rakt av, utan konfiguration, existerande databas eller uppstart av webbramverk. Detta är enklast löst genom att använda SQLite och ren JS eller något inbyggt i C# som Blazor, men:

  - Om det krävs någon form av setup för att köra systemet så ska detta hanteras via NPM-scripter i root-mappens `package.json`, specifikt `npm run build`.  
  - Skriptet får alltså köra docker-anrop, gå in i någon undermapp där ramverk är installerade och köra `npm install` och `npm build`, sedan kopiera allt som byggs till `wwwroot`-mappen (eller motsvarande) i ett enda stort svep utan att några fler anrop behöver göras.  
  - Oscar ska kunna klona repot, köra `npm run build`, och sedan kunna starta C#-servern utan några fler steg.

- Håll i åtanke att det är ok med flera olika `package.json`-filer i samma projekt.  
  - Vi har en sådan i root-mappen, men ni kan exempelvis välja att skapa en "klient"- och "server"-mapp och ha en ny `package.json` i klientmappen där exempelvis Vue installeras, liksom C#-projekt under server-mappen.  
  - Gör hur ni vill, fråga Oscar om ni är osäkra!

- Håll också i åtanke att det här skriptet måste gå att köra på Windows, Mac eller Linux.  
  - Specifika terminalanrop måste undvikas.  
  - Enklaste lösningen för komplexa konfigurationer är att köra ett JS-skript som kör program, flyttar filer osv istället för att göra allt via terminalanrop.  
  - Så länge det bara är typ `cd vue-project && npm run build` så är det dock lugnt!

- Programmet ska endast använda resurser som finns i repot  
  - Dvs inget externt API för att spara filer på någon extern databas  
  - Inga bilder från nätet osv  
  - Allt som ska användas ska finnas i repot så att det kan köras på en dator som är offline  

---

## Kriterier för VG

Det finns bara en punkt från kursplanen som är relevant för VG för den här uppgiften:

- Den studerande tar dessutom en bra arkitektur i applikationen som gör den både enkel att underhålla och säkrare att använda  

Det blir alltså en helhetsbedömning på koden baserat på saker som exempelvis:

- Trådsäkerhet  
- Korrekt användning av CancellationTokens  
- Användning av polymorfism eller motsvarande generiska lösningar vid behov för att undvika duplicering  
  - (Polymorfism / generiska lösningar för sakens skull hjälper inte – observera "vid behov"!)  
- Säker hantering av potentiella null-värden  