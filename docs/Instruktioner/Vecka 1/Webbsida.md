# Webbsida / klient
Vi behöver såklart en webbsida som visar upp allting, i stil med Google Drive
eller GitHub. Följande förväntningar finns:
- Sidan ska visa en vy av alla filer
- Filerna ska hämtas via API:et med hjälp av fetch
- Uppladdning och borttagning av filer ska fungera (också via fetch såklart),
  precis som i Google Drive uppgiften vi gjorde för ett tag sedan
- Förhandsvisning och redigering av filer är en bonus, men **inte** ett krav
- Allt som visas på sidan ska fungera. Lägg inte till knappar eller länker som
  inte gör något!

## Extra krav för er som arbetar i grupp
Det ska finnas en inloggningsdialog i valfritt format. Användaren ska ange sitt
användarnamn och lösenord. Det är helt ok att hårdkoda dessa användare i C#
servern, men en "registrera användare"-dialog är såklart en bonus. Observera att
inloggning **ska** använda JWTs, se [Användare och inloggning](./Inloggning.md)
för exempel.

Utöver det ska även mappar ha ett stöd. Detta är redan ett krav från
[API:et](./Files%20APIet.md), men för att bli godkänd måste såklart även
webbsidan använda detta. Det ska gå att:
- Skapa en mapp i gränssnittet
- Skapa undermappar
- Lägga till och ta bort filer från mappar
- Ta bort mappar

## Ren HTML, CSS och Javascript, Typescript, eller ramverk?
Valfritt! Använd vad ni vill, om det så är ren JS som vi gjort under uppgifterna
nu eller om ni föredrar att bygga allt i React eller Angular. För er som vill
ligga lite före så får ni även använda Blazor för det här, men vi kommer ha
uppgifter för det senare. Håll dock i åtanke att ni måste ha ett byggskript som
placerar de byggda ramverksfilerna under `wwwroot` (eller vart ni nu har era
statiska filer) så att servern går att starta **utan att ha en devserver för
ramverket igång**.

Kom ihåg följande krav från Learnpoint:
> Om det krävs någon form av setup för att köra systemet så **ska** detta
> hanteras via NPM scripter i root-mappens package.json, specifikt **npm run
> build**. Skriptet får alltså köra docker anrop, gå in i någon undermapp där
> ramverk är installerade och köra npm install och npm build, sedan kopiera allt
> som byggs till wwwroot mappen (eller motsvarande) i ett enda stort svep utan
> att några fler anrop behöver göras. Oscar ska kunna klona repot, köra **npm
> run build**, och sedan kunna starta C# servern utan några fler steg!

Det här kan vara lite nytt, så det är fritt fram att kontakta Oscar och be om
hjälp för att komma igång! Är det många som vill använda ramverk här kan vi
även boka in en snabb liten genomgång på hur detta går till!

## **OBS**: fetch-anropen **ska** göras med relativa länkar
Det börjar bli dags att vi bygger våra sidor helt korrekt nu, och detta är en
stor del av det. För att sidan ska fungera om vi lägger upp vår C# server på
riktig hårdvara så måste alla anrop vara relativa, dvs exempelvis:
```js
const allFiles = fetch("/api/files");
```

Om vi hade hårdkodat en sökväg som `"http://localhost:3000/api/files"` så kommer
det **inte** fungera på riktig hårdvara, utan webbläsarna kommer antingen få
`404 Not Found` eller en massa CORS problem eftersom URL:en då blir fel. Så
uppgiften kommer bli underkänd tills detta är åtgärdat!

> Om ett ramverk används behöver ni sannolikt konfigurera ramverkets devservers
> reverse-proxy, så att anrop mot exempelvis `"/api/files"` i stället går mot
> `"http://localhost:5275/api/files"` eller vart ni nu har er C# server!