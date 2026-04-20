// ====================================================================
// KONFIGURACIJA - popuni ID-eve svojih kanala i rola
// ====================================================================
// Kako pronaci ID: Discord Settings -> Advanced -> Developer Mode ON
// Onda desni klik na kanal/rolu/server -> Copy ID
// ====================================================================

module.exports = {
  // Kanal u koji bot salje DOBRODOSLICA kad neko udje na server
  welcomeChannelId: "1472172635445137733",

  // Kanal u kojem ce stajat TICKET PANEL sa dugmadima (donacije/prijave/ostalo)
  // Ovo je onaj kanal koji se spominje u welcome poruci
  ticketPanelChannelId: "1472166172878180362",

  // Kategorija u kojoj se KREIRAJU novi tiketi (svaki tiket = novi kanal u toj kategoriji)
  ticketCategoryId: "1472166172878180362",

  // Kanal u koji idu LOGOVI tiketa (ko je zatvorio + transcript)
  ticketLogsChannelId: "1495812353089077369",

  // Kanal u koji se postavljaju PRAVILA servera
  rulesChannelId: "1495808569193533623",

  // ID role koja kad se doda korisniku trigeruje STAFF welcome poruku
  staffRoleId: "1495814689341444227",

  // Kanal u koji ide STAFF welcome poruka (kad neko dobije staff rolu)
  staffWelcomeChannelId: "1472506015567188092",

  // Role koje mogu UPRAVLJAT tiketima (vidjeti, closat, itd.)
  // Mozes dodat vise ID-eva odvojenih zarezom
  staffRoleIds: [
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
