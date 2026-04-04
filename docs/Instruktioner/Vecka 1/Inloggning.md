# Användare och inloggning
Inloggning med JWT är ett krav **för de som jobbar i grupp**. Alla `/api/files`
endpoints ska då kräva inloggning, och filerna som returneras **ska tillhöra den
inloggade personen**. Om vi loggar in med två olika användare ska de alltså se
helt olika filer, och även om de båda skapar en fil med samma sökväg så får de
två helt unika filer.

För att lösa detta måste alltså C# servern hämta ut information om vilken
användare det är som är inloggad just nu. Detta går ganska enkelt att hämta ut
via den angivna JWTns claims!

Inloggning sker via `POST /api/login`, med en simpel body:
```json
{
  "user": "test-user",
  "password": "So Long, and Thanks for All the Fish"
}
```
I det här specifika exemplet anger vi test-användaren, som **ska** finnas,
eftersom det är denna som används för att köra `NPM` testerna!

## Spara inlogget på klienten
Ett tips, men inte ett krav, är att spara JWT:n på klienten, exempelvis via
localstorage, så att inloggning inte behöver göras om varje gång användaren
laddar om sidan!