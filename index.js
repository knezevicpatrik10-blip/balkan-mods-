// ====================================================================
// Discord bot - welcome, tiketi, pravila, staff welcome
// ====================================================================
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  Events,
  AttachmentBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ActivityType
} = require("discord.js");
const discordTranscripts = require("discord-html-transcripts");

const config = require("./config.js");

// ---------------------------------------------------------------
// Client
// ---------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message]
});

// ---------------------------------------------------------------
// Tipovi tiketa (button ID -> config)
// ---------------------------------------------------------------
const TICKET_TYPES = {
  donacije: {
    label: "DONACIJE",
    emoji: null,
    style: ButtonStyle.Success,
    prefix: "donacija",
    title: "Donacije",
    description:
      "Hvala sto zelis donirat. Opisi ukratko kakvu donaciju radis i staff ce ti odgovorit u najkracem mogucem roku."
  },
  prijave: {
    label: "PRIJAVE ZA STAFF",
    emoji: null,
    style: ButtonStyle.Primary,
    prefix: "prijava",
    title: "Prijava za staff",
    description:
      "Napisi prijavu za staff. Ukljuci: godine, koliko si aktivan, tvoje iskustvo i zasto zelis bit staff."
  },
  ostalo: {
    label: "OSTALI TIKETI",
    emoji: null,
    style: ButtonStyle.Secondary,
    prefix: "tiket",
    title: "Ostali tiket",
    description:
      "Opisi pitanje, molbu ili problem. Staff ce ti odgovorit u najkracem mogucem roku."
  }
};

// ---------------------------------------------------------------
// STATE: koji tipovi tiketa su TRENUTNO zatvoreni (dugme onemoguceno)
// Persista u JSON file-u izmedju startova
// ---------------------------------------------------------------
const STATE_FILE = path.join(__dirname, "botState.json");
let disabledTypes = new Set();
let panelMessageId = null;
let panelChannelId = null;

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      const data = JSON.parse(raw);
      disabledTypes = new Set(data.disabledTypes || []);
      panelMessageId = data.panelMessageId || null;
      panelChannelId = data.panelChannelId || null;
      console.log(
        `State ucitan: onemogucena su ${disabledTypes.size} tipova tiketa`
      );
    }
  } catch (err) {
    console.error("Greska pri ucitavanju state-a:", err);
  }
}

function saveState() {
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(
        {
          disabledTypes: [...disabledTypes],
          panelMessageId,
          panelChannelId
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error("Greska pri snimanju state-a:", err);
  }
}

loadState();

// ---------------------------------------------------------------
// Helper: da li user ima bilo koju staff rolu
// ---------------------------------------------------------------
function isStaff(member) {
  if (!member) return false;
  return config.allStaffRoleIds.some(id => member.roles.cache.has(id));
}

// ---------------------------------------------------------------
// Helper: skup svih ticketCategoryId-eva (za scan postojecih tiketa)
// ---------------------------------------------------------------
function allTicketCategoryIds() {
  return Object.values(config.ticketTypes).map(t => t.categoryId);
}

// ---------------------------------------------------------------
// Helper: napravi ticket panel embed + buttone
// ---------------------------------------------------------------
function buildTicketPanel() {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle("Otvaranje tiketa")
    .setDescription(
      "Klikni na jedno od dugmadi ispod za otvaranje tiketa.\n\n" +
        "Donacije - za donacije na serveru\n" +
        "Prijave za staff - prijavi se za staff tim\n" +
        "Ostali tiketi - pitanja, molbe, ostalo"
    );

  function makeBtn(key) {
    const t = TICKET_TYPES[key];
    const isClosed = disabledTypes.has(key);
    const btn = new ButtonBuilder().setCustomId(`ticket_create_${key}`);
    if (isClosed) {
      btn
        .setLabel(`${t.label} (ZATVORENO)`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
    } else {
      btn.setLabel(t.label).setStyle(t.style);
    }
    return btn;
  }

  const row = new ActionRowBuilder().addComponents(
    makeBtn("donacije"),
    makeBtn("prijave"),
    makeBtn("ostalo")
  );

  return { embeds: [embed], components: [row] };
}

// ---------------------------------------------------------------
// Helper: osvjezi postojeci panel (kad /zatvori ili /otvori)
// ---------------------------------------------------------------
async function refreshTicketPanel() {
  if (!panelMessageId || !panelChannelId) return false;
  try {
    const channel = await client.channels
      .fetch(panelChannelId)
      .catch(() => null);
    if (!channel || !channel.isTextBased()) return false;
    const msg = await channel.messages
      .fetch(panelMessageId)
      .catch(() => null);
    if (!msg) return false;
    await msg.edit(buildTicketPanel());
    return true;
  } catch (err) {
    console.error("Greska pri osvjezavanju panela:", err);
    return false;
  }
}

// ---------------------------------------------------------------
// Helper: embed sa donacijama i nacinima placanja
// ---------------------------------------------------------------
function buildDonacijeEmbed() {
  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setTitle("Donacije")
    .setDescription(
      "Hvala sto razmisljas o donaciji. Ispod je lista svih dostupnih donacija sa cijenama i nacinima placanja.\n" +
        "Za narudzbu otvori ticket pod **DONACIJE** dugmetom u ticket panelu."
    )
    .addFields(
      {
        name: "Vrste donacija",
        value:
          "```\n" +
          "Custom reshade preset       5$\n" +
          "Custom citizen             10$\n" +
          "Custom soundpack           10$\n" +
          "Custom skinpack             5$\n" +
          "```"
      },
      {
        name: "Nacini placanja",
        value: "PayPal\nPaysafe\nAircash",
        inline: true
      },
      {
        name: "Kako narucit",
        value:
          `1. Otvori ticket u <#${config.ticketPanelChannelId}>\n` +
          "2. Izaberi **DONACIJE** dugme\n" +
          "3. Napisi koju donaciju zelis i nacin placanja\n" +
          "4. Staff ce ti odgovorit u najkracem mogucem roku",
        inline: true
      }
    )
    .setFooter({ text: "Sve donacije se rade rucno - sacekaj odgovor staffa." });
}

// ---------------------------------------------------------------
// Helper: napravi embed s pravilima
// ---------------------------------------------------------------
function buildRulesEmbed() {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle("Pravila servera")
    .setDescription(
      "Molimo sve clanove da procitaju i postuju pravila."
    )
    .addFields(
      {
        name: "1. Postovanje clanova",
        value:
          "Ponasaj se prema drugima onako kako bi zelio da se ponasaju prema tebi. Zabranjeno vrijedjanje, omalovazavanje i provociranje."
      },
      {
        name: "2. Nacionalnost, vjera, rasa",
        value:
          "Zabranjene su bilo kakve uvrede, diskriminacija ili rasprave na temu nacionalnosti, vjere i rase."
      },
      {
        name: "3. Psovanje",
        value:
          "Psovanje drugih clanova, staffa, porodice ili nanoseno uvrede je strogo zabranjeno."
      },
      {
        name: "4. Spam i flood",
        value:
          "Zabranjeno je slanje istih ili slicnih poruka vise puta, caps lock spam i spam mentiona."
      },
      {
        name: "5. Reklamiranje",
        value:
          "Zabranjeno je reklamiranje drugih servera, linkova, socialnih mreza bez dozvole administracije."
      },
      {
        name: "6. NSFW sadrzaj",
        value:
          "Zabranjen je bilo kakav NSFW, nasilan ili uznemirujuc sadrzaj u porukama, avatarima i nickovima."
      },
      {
        name: "7. Nickovi i avatari",
        value:
          "Nick i avatar moraju biti pristojni, citljivi i bez uvredljivog sadrzaja."
      },
      {
        name: "8. Kanali",
        value:
          "Koristi kanale za ono cemu su namijenjeni. Off-topic poruke drzi u za to odredjenim kanalima."
      },
      {
        name: "9. Staff",
        value:
          "Odluka staffa je konacna. Ako smatras da je staff pogrijesio, otvori tiket i rasprava ce se voditi tamo, ne u javnim kanalima."
      },
      {
        name: "10. Pravila servera i Discorda",
        value:
          "Obavezno postovanje Discord ToS-a i Community Guidelinesa. Nepoznavanje pravila nije opravdanje za krsenje."
      }
    )
    .setFooter({ text: "Koriscenjem servera prihvatas sva pravila." });
}

// ---------------------------------------------------------------
// Helper: generiraj transcript tiketa
// ---------------------------------------------------------------
async function createTranscript(channel) {
  return await discordTranscripts.createTranscript(channel, {
    limit: -1,
    filename: `${channel.name}.html`,
    saveImages: true,
    footerText: "Ukupno poruka: {number}",
    poweredBy: false
  });
}

// ---------------------------------------------------------------
// Helper: je li kanal tiket (i je li vec zatvoren)
// ---------------------------------------------------------------
function getTicketInfo(channel) {
  if (!channel || !channel.topic) return null;
  const ownerMatch = channel.topic.match(/owner:(\d+)/);
  const typeMatch = channel.topic.match(/tip:(\w+)/);
  if (!ownerMatch) return null;
  return {
    ownerId: ownerMatch[1],
    type: typeMatch ? typeMatch[1] : null,
    closed: channel.topic.includes("status:closed")
  };
}

// ---------------------------------------------------------------
// Helper: ZATVORI individualni tiket (transcript + log + DM + obrisi kanal)
// ---------------------------------------------------------------
async function closeTicket(channel, closedBy) {
  const info = getTicketInfo(channel);
  const ownerId = info ? info.ownerId : null;

  // Generiraj transcript
  let transcript;
  try {
    transcript = await createTranscript(channel);
  } catch (err) {
    console.error("Greska pri generiranju transcripta:", err);
  }

  // Embed za log
  const logEmbed = new EmbedBuilder()
    .setColor(config.colors.danger)
    .setTitle("Tiket zatvoren")
    .addFields(
      { name: "Tiket", value: `#${channel.name}`, inline: true },
      {
        name: "Otvorio",
        value: ownerId ? `<@${ownerId}> (${ownerId})` : "nepoznato",
        inline: true
      },
      {
        name: "Zatvorio",
        value: `<@${closedBy.id}> (${closedBy.id})`,
        inline: true
      }
    )
    .setTimestamp();

  // Posalji u log kanal
  try {
    const logChannel = await client.channels
      .fetch(config.ticketLogsChannelId)
      .catch(() => null);
    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send({
        embeds: [logEmbed],
        files: transcript ? [transcript] : []
      });
    }
  } catch (err) {
    console.error("Greska pri slanju u log kanal:", err);
  }

  // Posalji transcript na DM otvaracu
  if (ownerId) {
    try {
      const owner = await client.users.fetch(ownerId).catch(() => null);
      if (owner) {
        const transcriptForDm = await createTranscript(channel).catch(
          () => null
        );
        const dmEmbed = new EmbedBuilder()
          .setColor(config.colors.primary)
          .setTitle("Tvoj tiket je zatvoren")
          .setDescription(
            `Tiket **${channel.name}** je zatvoren. U prilogu ti saljem transcript razgovora.`
          )
          .addFields({ name: "Zatvorio", value: `${closedBy.tag}` })
          .setTimestamp();

        await owner
          .send({
            embeds: [dmEmbed],
            files: transcriptForDm ? [transcriptForDm] : []
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("Greska pri slanju DM-a otvaracu:", err);
    }
  }

  // Obrisi kanal
  try {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(config.colors.danger)
          .setDescription("Kanal ce biti obrisan za 5 sekundi...")
      ]
    });
    setTimeout(() => {
      channel.delete("Tiket zatvoren").catch(() => {});
    }, 5000);
  } catch (err) {
    console.error("Greska pri brisanju kanala:", err);
  }

  return true;
}

// ---------------------------------------------------------------
// Slash komande - definicije (auto-register na startup)
// ---------------------------------------------------------------
const TIP_CHOICES = [
  { name: "Donacije", value: "donacije" },
  { name: "Prijave za staff", value: "prijave" },
  { name: "Ostali tiketi", value: "ostalo" }
];

const slashCommands = [
  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Zatvori trenutni tiket kanal (staff only)")
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("zatvori")
    .setDescription("Zatvori dugme za odredjeni tip tiketa - niko ne moze otvorit taj tip")
    .addStringOption(opt =>
      opt
        .setName("tip")
        .setDescription("Koji tip tiketa zatvaras")
        .setRequired(true)
        .addChoices(...TIP_CHOICES)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("otvori")
    .setDescription("Ponovo omoguci dugme za odredjeni tip tiketa")
    .addStringOption(opt =>
      opt
        .setName("tip")
        .setDescription("Koji tip tiketa otvaras")
        .setRequired(true)
        .addChoices(...TIP_CHOICES)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("setup-ticket-panel")
    .setDescription("Postavi ticket panel sa dugmadima u kanal")
    .addChannelOption(opt =>
      opt
        .setName("kanal")
        .setDescription("Kanal u koji ide panel (opciono - inace trenutni)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("setup-rules")
    .setDescription("Postavi pravila servera u rules kanal")
    .addChannelOption(opt =>
      opt
        .setName("kanal")
        .setDescription("Kanal u koji idu pravila (opciono - inace iz configa)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("setup-verify")
    .setDescription("Postavi verify panel (dugme s kvacicom za rolu)")
    .addChannelOption(opt =>
      opt
        .setName("kanal")
        .setDescription("Kanal u koji ide panel (opciono - inace iz configa)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("setup-donacije")
    .setDescription("Postavi embed sa cijenama donacija i nacinima placanja")
    .addChannelOption(opt =>
      opt
        .setName("kanal")
        .setDescription("Kanal u koji ide embed (opciono - inace trenutni)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
].map(c => c.toJSON());

async function registerCommands(clientId, guildId) {
  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
  try {
    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: slashCommands }
      );
      console.log(`Slash komande registrirane na guild ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), {
        body: slashCommands
      });
      console.log("Slash komande registrirane GLOBALNO");
    }
  } catch (err) {
    console.error("Greska pri registraciji slash komandi:", err);
  }
}

// ---------------------------------------------------------------
// Helper: prebroji ljude (bez botova) i azuriraj bot activity
// ---------------------------------------------------------------
async function updateMemberCountPresence() {
  try {
    const guildId = process.env.GUILD_ID;
    const guild = guildId
      ? client.guilds.cache.get(guildId)
      : client.guilds.cache.first();
    if (!guild) return;

    // Fetch da cache bude svjez (potrebno za tacan broj)
    await guild.members.fetch().catch(() => null);
    const humans = guild.members.cache.filter(m => !m.user.bot).size;

    client.user.setActivity(`${humans} ljudi na serveru`, {
      type: ActivityType.Watching
    });
  } catch (err) {
    console.error("Greska pri azuriranju presence:", err);
  }
}

// ---------------------------------------------------------------
// EVENT: Ready
// ---------------------------------------------------------------
client.once(Events.ClientReady, async c => {
  console.log(`Bot je online kao ${c.user.tag}`);
  const clientId = process.env.CLIENT_ID || c.user.id;
  const guildId = process.env.GUILD_ID || null;
  await registerCommands(clientId, guildId);
  await updateMemberCountPresence();

  // Osvjezavanje svakih 10 minuta kao safety net
  setInterval(updateMemberCountPresence, 10 * 60 * 1000);
});

// ---------------------------------------------------------------
// EVENT: Novi clan - DOBRODOSLICA + update activity
// ---------------------------------------------------------------
client.on(Events.GuildMemberAdd, async member => {
  // Azuriraj broj ljudi (samo ako nije bot)
  if (!member.user.bot) {
    updateMemberCountPresence();
  }

  // AUTO-ROLA - svakom novom clanu dodaj rolu iz configa
  if (config.autoRoleId && !member.user.bot) {
    try {
      await member.roles.add(config.autoRoleId, "Auto rola na join");
    } catch (err) {
      console.error("Greska pri dodavanju auto role:", err);
    }
  }

  try {
    const channel = await member.guild.channels
      .fetch(config.welcomeChannelId)
      .catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(config.colors.success)
      .setTitle("Dobrodosli!")
      .setDescription(
        `Dobrodosli ${member} u server! Procitajte.<#${config.rulesChannelId}>\n\n` +
          `U slucaju da imate neko pitanje, molbu ili zelju otvorite ticket ovdje <#${config.ticketPanelChannelId}>.`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }));

    await channel.send({ content: `${member}`, embeds: [embed] });
  } catch (err) {
    console.error("Greska u welcome event:", err);
  }
});

// ---------------------------------------------------------------
// EVENT: Clan napusti server - update activity
// ---------------------------------------------------------------
client.on(Events.GuildMemberRemove, async member => {
  if (!member.user || member.user.bot) return;
  updateMemberCountPresence();
});

// ---------------------------------------------------------------
// EVENT: Promjena rola - STAFF welcome
// ---------------------------------------------------------------
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    const hadRole = oldMember.roles.cache.has(config.staffRoleId);
    const hasRole = newMember.roles.cache.has(config.staffRoleId);

    // Samo kad se role DODA (nije imao prije, sad ima)
    if (!hadRole && hasRole) {
      const channel = await newMember.guild.channels
        .fetch(config.staffWelcomeChannelId)
        .catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle("Novi staff clan")
        .setDescription(
          `Dobrodoso ${newMember} u staff team!\n\n` +
            `Morate biti aktivni i morate zasluzit rup ili plus.`
        )
        .setThumbnail(newMember.user.displayAvatarURL({ size: 256 }));

      await channel.send({ content: `${newMember}`, embeds: [embed] });
    }
  } catch (err) {
    console.error("Greska u staff welcome event:", err);
  }
});

// ---------------------------------------------------------------
// EVENT: Interactions (buttons + slash commandi)
// ---------------------------------------------------------------
client.on(Events.InteractionCreate, async interaction => {
  // -------- BUTTONS --------
  if (interaction.isButton()) {
    const id = interaction.customId;

    // Kreiranje tiketa
    if (id.startsWith("ticket_create_")) {
      const typeKey = id.replace("ticket_create_", "");
      const type = TICKET_TYPES[typeKey];
      if (!type) {
        return interaction.reply({
          content: "Nepoznat tip tiketa.",
          ephemeral: true
        });
      }

      // Provjeri da li je tip ZATVOREN (kroz /zatvori komandu)
      if (disabledTypes.has(typeKey)) {
        return interaction.reply({
          content: `Otvaranje **${type.label}** tiketa je trenutno **zatvoreno**. Pokusaj kasnije.`,
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      // Per-type config
      const typeConfig = config.ticketTypes[typeKey];
      if (!typeConfig || !typeConfig.categoryId) {
        return interaction.editReply({
          content: `Tip tiketa \`${typeKey}\` nije konfigurisan u config.js.`
        });
      }
      const typeCategoryId = typeConfig.categoryId;
      const typeStaffRoleIds = typeConfig.staffRoleIds || [];

      // Provjeri da user nema vec OTVOREN tiket istog tipa
      const existing = interaction.guild.channels.cache.find(ch => {
        if (ch.parentId !== typeCategoryId) return false;
        const info = getTicketInfo(ch);
        if (!info) return false;
        return (
          info.ownerId === interaction.user.id && info.type === typeKey
        );
      });
      if (existing) {
        return interaction.editReply({
          content: `Vec imas otvoren tiket: ${existing}`
        });
      }

      // Permissions za novi kanal
      const overwrites = [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        ...typeStaffRoleIds.map(roleId => ({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages
          ]
        }))
      ];

      // Kreiraj kanal
      const channel = await interaction.guild.channels
        .create({
          name: `${type.prefix}-${interaction.user.username}`.toLowerCase(),
          type: ChannelType.GuildText,
          parent: typeCategoryId,
          topic: `owner:${interaction.user.id} tip:${typeKey}`,
          permissionOverwrites: overwrites
        })
        .catch(err => {
          console.error("Greska pri kreiranju kanala:", err);
          return { __error: err };
        });

      if (!channel || channel.__error) {
        const errMsg = channel && channel.__error ? String(channel.__error.message || channel.__error) : "nepoznato";
        return interaction.editReply({
          content:
            `Nisam uspio kreirat kanal.\nKategorija: \`${typeCategoryId}\`\nGreska: \`${errMsg}\`\nProvjeri da bot ima **Manage Channels** permisiju u toj kategoriji.`
        });
      }

      // Embed + close button u tiketu
      const ticketEmbed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(type.title)
        .setDescription(type.description)
        .addFields({ name: "Otvorio", value: `${interaction.user}` })
        .setTimestamp();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("Zatvori tiket")
          .setStyle(ButtonStyle.Danger)
      );

      const staffMentions = typeStaffRoleIds
        .map(r => `<@&${r}>`)
        .join(" ");

      await channel.send({
        content: `${interaction.user} ${staffMentions}`,
        embeds: [ticketEmbed],
        components: [closeRow]
      });

      await interaction.editReply({
        content: `Tiket kreiran: ${channel}`
      });
      return;
    }

    // Zatvaranje tiketa preko buttona
    if (id === "ticket_close") {
      const ch = interaction.channel;
      if (
        !ch ||
        !ch.topic ||
        !ch.topic.includes("owner:")
      ) {
        return interaction.reply({
          content: "Ovo nije tiket kanal.",
          ephemeral: true
        });
      }

      // Confirm button
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close_confirm")
          .setLabel("Da, zatvori")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("ticket_close_cancel")
          .setLabel("Otkazi")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.danger)
            .setDescription(
              "Jesi li siguran da zelis zatvorit ovaj tiket?"
            )
        ],
        components: [confirmRow]
      });
    }

    if (id === "ticket_close_confirm") {
      const ch = interaction.channel;
      if (!ch || !ch.topic || !ch.topic.includes("owner:")) {
        return interaction.reply({
          content: "Ovo nije tiket kanal.",
          ephemeral: true
        });
      }

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.danger)
            .setDescription(
              "Zatvaram tiket, generiram transcript..."
            )
        ],
        components: []
      });

      await closeTicket(ch, interaction.user);
      return;
    }

    if (id === "ticket_close_cancel") {
      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.info)
            .setDescription("Otkazano.")
        ],
        components: []
      });
    }

    // Verify panel - klik na kvacicu za rolu
    if (id === "verify_click") {
      const roleId = config.verifyPanel && config.verifyPanel.roleId;
      if (!roleId) {
        return interaction.reply({
          content: "Verify panel nije konfigurisan u config.js",
          ephemeral: true
        });
      }
      const unverifiedRoleId = config.autoRoleId;
      try {
        if (interaction.member.roles.cache.has(roleId)) {
          // Vec verify-an: skidamo member rolu, vracamo unverified rolu
          await interaction.member.roles.remove(roleId, "Verify toggle off");
          if (unverifiedRoleId) {
            await interaction.member.roles.add(unverifiedRoleId, "Verify toggle off - vracam unverified").catch(() => {});
          }
          return interaction.reply({
            content: "Skinuta ti je member rola, vracena unverified rola.",
            ephemeral: true
          });
        }
        // Nije verify-an: dodajemo member rolu, skidamo unverified
        await interaction.member.roles.add(roleId, "Verify klik");
        if (unverifiedRoleId && interaction.member.roles.cache.has(unverifiedRoleId)) {
          await interaction.member.roles.remove(unverifiedRoleId, "Verify klik - skidam unverified").catch(() => {});
        }
        return interaction.reply({
          content: "Dobio si member rolu. Dobrodosao!",
          ephemeral: true
        });
      } catch (err) {
        console.error("Greska pri verify toggle:", err);
        return interaction.reply({
          content: `Nisam mogao dodat rolu: \`${err.message}\`. Provjeri da je bot iznad te role u hijerarhiji.`,
          ephemeral: true
        });
      }
    }
  }

  // -------- SLASH COMMANDI --------
  if (interaction.isChatInputCommand()) {
    const cmd = interaction.commandName;

    // /close - zatvori INDIVIDUALNI trenutni tiket (obrise kanal)
    if (cmd === "close") {
      const ch = interaction.channel;
      const info = getTicketInfo(ch);
      if (!info) {
        return interaction.reply({
          content: "Ovu komandu mozes koristit samo unutar tiket kanala.",
          ephemeral: true
        });
      }
      if (!isStaff(interaction.member) && interaction.user.id !== info.ownerId) {
        return interaction.reply({
          content: "Samo staff ili vlasnik tiketa moze ga zatvorit.",
          ephemeral: true
        });
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.danger)
            .setDescription(
              `Tiket zatvara ${interaction.user}. Generiram transcript...`
            )
        ]
      });

      await closeTicket(ch, interaction.user);
      return;
    }

    // /zatvori tip:<type> - ONEMOGUCI dugme za otvaranje tog tipa
    if (cmd === "zatvori") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: "Nemas permisiju za ovu komandu.",
          ephemeral: true
        });
      }
      const tip = interaction.options.getString("tip", true);
      const type = TICKET_TYPES[tip];
      if (!type) {
        return interaction.reply({
          content: `Nepoznat tip: ${tip}`,
          ephemeral: true
        });
      }
      if (disabledTypes.has(tip)) {
        return interaction.reply({
          content: `**${type.label}** su vec zatvoreni.`,
          ephemeral: true
        });
      }
      disabledTypes.add(tip);
      saveState();
      const refreshed = await refreshTicketPanel();
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.danger)
            .setTitle("Tip tiketa zatvoren")
            .setDescription(
              `Dugme za **${type.label}** je onemoguceno.\nNiko ne moze otvorit novi tiket tog tipa dok ne koristis \`/otvori tip:${tip}\`.` +
                (refreshed ? "" : "\n\nNapomena: nisam nasao panel poruku za auto-update. Pokreni /setup-ticket-panel da ga postavim ponovo.")
            )
            .setFooter({ text: `Zatvorio: ${interaction.user.tag}` })
        ]
      });
    }

    // /otvori tip:<type> - OMOGUCI dugme za tip
    if (cmd === "otvori") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: "Nemas permisiju za ovu komandu.",
          ephemeral: true
        });
      }
      const tip = interaction.options.getString("tip", true);
      const type = TICKET_TYPES[tip];
      if (!type) {
        return interaction.reply({
          content: `Nepoznat tip: ${tip}`,
          ephemeral: true
        });
      }
      if (!disabledTypes.has(tip)) {
        return interaction.reply({
          content: `**${type.label}** su vec otvoreni.`,
          ephemeral: true
        });
      }
      disabledTypes.delete(tip);
      saveState();
      const refreshed2 = await refreshTicketPanel();
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle("Tip tiketa otvoren")
            .setDescription(
              `Dugme za **${type.label}** je ponovo omoguceno.\nKorisnici mogu otvorit nove tikete tog tipa.` +
                (refreshed2 ? "" : "\n\nNapomena: nisam nasao panel poruku za auto-update. Pokreni /setup-ticket-panel da ga postavim ponovo.")
            )
            .setFooter({ text: `Otvorio: ${interaction.user.tag}` })
        ]
      });
    }

    if (cmd === "setup-ticket-panel") {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "Nemas permisiju za ovu komandu.",
          ephemeral: true
        });
      }

      const target = interaction.options.getChannel("kanal") || interaction.channel;
      if (!target.isTextBased()) {
        return interaction.reply({
          content: "Meta mora biti tekstualni kanal.",
          ephemeral: true
        });
      }

      const sent = await target.send(buildTicketPanel());
      panelMessageId = sent.id;
      panelChannelId = target.id;
      saveState();
      return interaction.reply({
        content: `Panel postavljen u ${target}. Dugmad ce se auto-osvjezavat na /zatvori i /otvori.`,
        ephemeral: true
      });
    }

    if (cmd === "setup-rules") {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "Nemas permisiju za ovu komandu.",
          ephemeral: true
        });
      }

      const target =
        interaction.options.getChannel("kanal") ||
        (await interaction.guild.channels
          .fetch(config.rulesChannelId)
          .catch(() => null));

      if (!target || !target.isTextBased()) {
        return interaction.reply({
          content:
            "Rules kanal nije pronadjen. Provjeri `rulesChannelId` u configu.",
          ephemeral: true
        });
      }

      await target.send({ embeds: [buildRulesEmbed()] });
      return interaction.reply({
        content: `Pravila postavljena u ${target}.`,
        ephemeral: true
      });
    }

    if (cmd === "setup-verify") {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "Nemas permisiju za ovu komandu.",
          ephemeral: true
        });
      }

      const target =
        interaction.options.getChannel("kanal") ||
        (await interaction.guild.channels
          .fetch(config.verifyPanel.channelId)
          .catch(() => null));

      if (!target || !target.isTextBased()) {
        return interaction.reply({
          content:
            "Verify kanal nije pronadjen. Provjeri `verifyPanel.channelId` u configu.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle("Verifikacija")
        .setDescription(
          "Klikni na **kvacicu** ispod da dobijes pristup serveru.\n" +
            "Ako kliknes ponovo, member rola se uklanja i vraca ti unverified rola."
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("verify_click")
          .setEmoji("\u2705") // kvacica
          .setStyle(ButtonStyle.Success)
      );

      await target.send({ embeds: [embed], components: [row] });
      return interaction.reply({
        content: `Verify panel postavljen u ${target}.`,
        ephemeral: true
      });
    }

    if (cmd === "setup-donacije") {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "Nemas permisiju za ovu komandu.",
          ephemeral: true
        });
      }

      const target = interaction.options.getChannel("kanal") || interaction.channel;
      if (!target.isTextBased()) {
        return interaction.reply({
          content: "Meta mora biti tekstualni kanal.",
          ephemeral: true
        });
      }

      await target.send({ embeds: [buildDonacijeEmbed()] });
      return interaction.reply({
        content: `Donacije embed postavljen u ${target}.`,
        ephemeral: true
      });
    }
  }
});

// ---------------------------------------------------------------
// Login
// ---------------------------------------------------------------
if (!process.env.BOT_TOKEN) {
  console.error("BOT_TOKEN nije postavljen (.env ili Railway variables)!");
  process.exit(1);
}

// Graceful error handling da proces ne umre na Railway-u
process.on("unhandledRejection", err => {
  console.error("Unhandled rejection:", err);
});
process.on("uncaughtException", err => {
  console.error("Uncaught exception:", err);
});

client.login(process.env.BOT_TOKEN);
