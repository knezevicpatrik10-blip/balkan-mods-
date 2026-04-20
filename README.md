# Novi Bot

Discord bot sa sljedecim funkcijama:

- **Dobrodoslica** - kad neko udje na server, bot salje pozdrav u welcome kanal i upucuje ga na ticket kanal
- **Ticket sistem** - panel sa dugmadima za **Donacije**, **Prijave za staff**, **Ostali tiketi**
- **Zatvaranje tiketa** - preko dugmeta `Zatvori tiket` ili slash komande `/close`
- **Transcript** - pri zatvaranju tiketa se generira HTML transcript, salje se u log kanal i DM onome ko je tiket otvorio
- **Logovi** - ko je otvorio, ko je zatvorio, transcript - sve ide u log kanal
- **Pravila** - slash komanda `/setup-rules` postavlja embed s pravilima u rules kanal
- **Staff welcome** - kad admin doda staff rolu nekome, bot automatski salje welcome u staff kanal

Bot ne koristi emojije u svojim porukama.

## 1. Priprema

1. Instaliraj [Node.js 18+](https://nodejs.org)
2. Napravi bota na https://discord.com/developers/applications
3. U **Bot** tabu ukljuci:
   - `SERVER MEMBERS INTENT`
   - `MESSAGE CONTENT INTENT`
4. Pozovi bota na server sa `Administrator` permisijom (najlakse za setup)

## 2. Instalacija

Otvori PowerShell/Terminal u ovom folderu i pokreni:

```
npm install
```

## 3. Konfiguracija

### `.env` file

Otvori `.env` i popuni:

```
BOT_TOKEN=tvoj_bot_token
CLIENT_ID=id_aplikacije_bota
GUILD_ID=id_tvog_servera
```

- **BOT_TOKEN** - Developer Portal -> Bot -> Reset Token
- **CLIENT_ID** - Developer Portal -> General Information -> Application ID
- **GUILD_ID** - desni klik na server u Discordu -> Copy Server ID (Developer Mode mora biti upaljen)

### `config.js` file

Otvori `config.js` i popuni ID-eve kanala i rola koje fale (one sa `POPUNI_...`):

- `welcomeChannelId` - kanal gdje idu dobrodoslica poruke
- `ticketCategoryId` - kategorija u kojoj ce bot praviti nove tiket kanale

Ostali ID-evi su vec popunjeni onim koje si dao:

- `ticketPanelChannelId` - `1472166172878180362`
- `ticketLogsChannelId` - `1495812353089077369`
- `rulesChannelId` - `1495808569193533623`
- `staffRoleId` - `1495814689341444227`
- `staffWelcomeChannelId` - `1472506015567188092`

## 4. Registracija slash komandi

Jednom (ili svaki put kad mijenjas komande):

```
npm run deploy
```

## 5. Pokretanje

```
npm start
```

## 6. Postavljanje panela i pravila

U Discordu, dok je bot online:

- U tiket panel kanalu upisi: `/setup-ticket-panel`
- U bilo kojem kanalu upisi: `/setup-rules` (ide u kanal iz configa)

## 7. Kako tiketi rade

1. User klikne dugme (Donacije / Prijave za staff / Ostali tiketi) u panel kanalu
2. Bot pravi privatan kanal u `ticketCategoryId` kategoriji
3. Vidi ga samo user koji je otvorio tiket + staff role iz configa
4. Zatvaranje:
   - User ili staff klikne `Zatvori tiket` -> trazi potvrdu -> zatvara
   - Staff moze u bilo kojem tiket kanalu koristit `/close`
5. Pri zatvaranju:
   - Bot pravi HTML transcript
   - Salje embed + transcript u log kanal (`ticketLogsChannelId`)
   - Salje transcript u DM onome ko je tiket otvorio (ako ima otvorene DM-ove)
   - Brise kanal za 5 sekundi

## Napomena o staff welcome poruci

Bot detektira kad bilo ko doda rolu `staffRoleId` nekom korisniku (bilo da to radis rucno,
preko `/role` komande drugog bota, itd.) i odmah salje welcome u `staffWelcomeChannelId`.
