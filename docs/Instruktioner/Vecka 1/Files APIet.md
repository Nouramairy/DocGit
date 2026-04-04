# API exempel

Målet med den här uppgiften är att skapa ett komplett fungerande REST API för
filer. Det följande är olika exempel på hur svaren ser ut, med beskrivningar för
varje endpoint. Exemplet här går att återskapa genom att köra `npm run generate`
kommandet, se ovan!

> **OBS**: Exempel för både med och utan mappar är inkluderade här, men kom ihåg
> att **mappar endast krävs för er som arbetar i grupp**. Det är dock fritt fram
> för alla att lägga till dem såklart!

- ## GET /api/files
  Hämtar ut **alla** filer i en enda stor JSON blob, men utan själva innehållet.
  Vi får ut allt som ett objekt (_inte en array_), där varje nyckel är namnet på
  filen (_eller mappen för de som har det_). Värdet är ett till objekt med
  metadata som när filen skapades eller hur stor den är:
  ```json
  {
      "README.md": {
          "created": "2026-03-13 20:03:20",
          "changed": "2026-03-13 20:03:20",
          "file": true,
          "bytes": 59,
          "extension": ".md"
      },
      "test.txt": {
          "created": "2026-03-13 20:03:20",
          "changed": "2026-03-13 20:03:20",
          "file": true,
          "bytes": 124,
          "extension": ".txt"
      }
  }
  ```

  För de som arbetar i grupp (_eller väljer att lägga till det ändå_) så kan det
  i stället se ut såhär:
  ```json
  {
      "README.md": {
          "created": "2026-03-13 20:03:20",
          "changed": "2026-03-13 20:03:20",
          "file": true,
          "bytes": 59,
          "extension": ".md",
      },
      "test.txt": {
          "created": "2026-03-13 20:03:20",
          "changed": "2026-03-13 20:03:20",
          "file": true,
          "bytes": 124,
          "extension": ".txt",
      },
      "mapp 1": {
          "created": "2026-03-13 20:03:20",
          "changed": "2026-03-13 20:03:20",
          "file": false,
          "bytes": 44533,
          "content": {
              "random.txt": {
                  "created": "2026-03-13 20:03:20",
                  "changed": "2026-03-13 20:03:20",
                  "file": true,
                  "bytes": 512,
                  "extension": ".txt",
              },
              "nvarchar.jpeg": {
                  "created": "2026-03-13 20:03:20",
                  "changed": "2026-03-13 20:03:20",
                  "file": true,
                  "bytes": 44021,
                  "extension": ".jpeg",
              }
          }
      }
  }
  ```

- ## GET /api/files/README.md
  Observera skillnaden i vår URL. Det är samma bas med `/api/files`, men nu
  följt av filnamnet (_eller sökvägen för de med mappar_) av den fil vi vill
  hämta innehållet från. I det här fallet hade vi fått följande svar:
  ```md
  # Detta är en README
  Detta är vanlig text under rubriken.
  ```

  För de som har mappar hade exempelvis `/api/files/mapp 1/nvarchar.jpeg` hämtat
  den specifika bilden, som då ligger under `mapp 1`. Kom ihåg att vi kan ha ett
  obegränsat antal nivåer på våra mappar, `/api/files/a/b/c/d/e/f/g/hej.txt` är
  en helt godkänd sökväg, precis som på vår egen dator!

- ## HEAD /api/files/README.md
  Exakt samma som `GET`, men utan body. Detta är användbart eftersom både `GET`
  och `HEAD` returnerar metadata i sina headers, så vi kan med `HEAD` få ut
  information som när filen skapades och hur stor den är utan att faktiskt hämta
  hem den. För en sån här liten fil gör det såklart ingen skillnad, men för en
  fil som är 1 GB stor gör det en extrem skillnad!

  De headers som ingår är (_med exempelvärden från README.md_):
  ```
  "X-Created-At": "2026-03-13 20:03:20"
  "X-Changed-At": "2026-03-13 20:03:20"
  "X-Type": "file"
  "X-Bytes": "59"
  "X-Extension": ".md"
  ```

- ## POST /api/files/README.md
  Detta skapar den angivna filen, i det här fallet `README.md`. Vi kan också
  ange något som `/api/files/exempel.txt` för att ladda upp en fil som heter
  `exempel.txt`.
  
  För de som arbetar med mappar är det såklart något i stil med
  `/api/files/mappnamn/exempel.txt` för att ladda upp samma fil men i det här
  fallet i mappen `mappnamn`!

  Filens innehåll kommer från vår body.

  **OBS**: Detta fungerar bara om filen inte finns. Finns den redan ska vi få
  status `409` tillbaka

- ## PUT /api/files/README.md
  Precis som POST, men med skillnaden att om filen redan finns så ersätts den
  med den version som laddas upp här.

- ## DELETE /api/files/README.md
  Tar bort den angivna filen, i det här fallet `README.md`. Om filen i fråga
  inte finns ska ändå status `200` returneras!
