// ====================================================================
// KONFIGURACIJA - popuni ID-eve svojih kanala i rola
// ====================================================================
// Kako pronaci ID: Discord Settings -> Advanced -> Developer Mode ON
// Onda desni klik na kanal/rolu/server -> Copy ID
// ====================================================================

module.exports = {
  // Kanal u koji bot salje DOBRODOSLICA kad neko udje na server
  welcomeChannelId: "1472172635445137733",

  // Kanal u kojem ce stajat TICKET PANEL sa dugmadima
  ticketPanelChannelId: "1472166172878180362",

  // Kanal u koji idu LOGOVI tiketa (ko je zatvorio + transcript)
  ticketLogsChannelId: "1495812353089077369",

  // Kanal u koji se postavljaju PRAVILA servera
  rulesChannelId: "1495808569193533623",

  // ID role koja kad se doda korisniku trigeruje STAFF welcome poruku
  staffRoleId: "1495814689341444227",

  // Kanal u koji ide STAFF welcome poruka
  staffWelcomeChannelId: "1472506015567188092",

  // -----------------------------------------------------------------
  // TICKET TIPOVI - svaki tip ima svoju KATEGORIJU i svoje STAFF ROLE
  // categoryId   -> u koju kategoriju ide novi tiket kanal
  // staffRoleIds -> koje role vide tiket + mogu upravljat njime
  // -----------------------------------------------------------------
  ticketTypes: {
    donacije: {
      categoryId: "1495828948733657230",
      staffRoleIds: ["1472169510340395142"]
    },
    prijave: {
      categoryId: "1495828995579707473",
      staffRoleIds: ["1495814689341444227"]
    },
    ostalo: {
      categoryId: "1495829059253309570",
      staffRoleIds: ["1495814689341444227"]
    }
  },

  // Sve staff role (unija svih gore) - koristi se za /otvori i slicne checkove
  allStaffRoleIds: [
    "1472169510340395142",
    "1495814689341444227"
  ],

  // Boje za embed poruke (hex)
  colors: {
    primary: 0x2f3136,
    success: 0x57f287,
    danger: 0xed4245,
    info: 0x5865f2
  }
};
