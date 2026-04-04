# SignalR

Det ska finnas en SignalR-hub som lyssnar på `/api/events/signalr`. Valfria
metoder får läggas till i denna hub, men inga krävs. Det som krävs är att när
`POST`, `PUT` eller `DELETE` metoderna i fil-API:et anropas så ska event skickas
ut till alla SignalR-klienter. Dessa ska skickas mot metoden `"Event"`, och ha
två argument: typ och filsökväg.

## Krav för grupper

Hubben skyddas av samma JWT autentisering som används av API:et.

## Typ-argumentet för `"Event"`

Typen (_det första argumentet för `"Event"`_), ska vara ett heltal enligt
följande:

| Heltal | Betydelse                                            |
| ------ | ---------------------------------------------------- |
| 0      | En fil har skapats                                   |
| 1      | En fil har uppdaterats                               |
| 2      | En fil har tagits bort                               |
| 5      | En mapp har skapats (för er med stöd för mappar)     |
| 7      | En mapp har tagits bort (för er med stöd för mappar) |

Observera att om `PUT` skapar en fil som inte redan fanns så blir typen `0`,
**inte** `1`. Endast om filen redan fanns blir det `1`!

> **Tips**: En enum med specifika värden är väldigt lämpliga för det här!

## Filsökvägsargumentet för `"Event"`

Typen (_det andra argumentet för `"Event"`_), ska vara en sträng som motsvarar
sökvägen för filen eller mappen i fråga. Om `/api/files/exempel.txt` anropades
ska denna sträng vara `"exempel.txt"`. Var det `/api/files/test.xml` ska
strängen vara `"test.xml"`, och om det var `/api/files/a/b/c/d/hej.md` (_för de
med stöd för mappar_) så ska strängen vara `"a/b/c/d/hej.md"`. Det ska alltså
vara en exakt match mot sökvägen.

## Exempel

Säg att vi skapar en fil via `POST` mot `/api/files/exempel.txt`. Då hade ett
SignalR event mot metoden `"Event"` skickats ut från servern till alla klienter.
Det första argumentet hade varit siffran `0`, eftersom detta var en fil som
**skapades**. Det andra argumentet hade varit `"exempel.txt"`, eftersom det är
den **kompletta sökvägen till filen**.

Om vi i stället tar bort en fil under en mapp (_givet att vårat system har stöd
för det_) hade vi kunnat göra en `DELETE` mot
`/api/files/någon mapp/skabort.json`. Vi hade då fått ett SignalR event med
heltalet `2` som första argument och strängen `"någon mapp/skabort.json"` som
andra argument.
