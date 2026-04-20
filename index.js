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
  SlashCommandBuilder
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
    label: "Donacije",
    emoji: null,
    style: ButtonStyle.Success,
    prefix: "donacija",
    title: "Donacije",
    description:
      "Hvala sto zelis donirat. Opisi ukratko kakvu donaciju radis i staff ce ti odgovorit u najkracem mogucem roku."
  },
  prijave: {
    label: "Prijave za staff",
    emoji: null,
    style: ButtonStyle.Primary,
    prefix: "prijava",
    title: "Prijava za staff",
    description:
      "Napisi prijavu za staff. Ukljuci: godine, koliko si aktivan, tvoje iskustvo i zasto zelis bit staff."
  },
  ostalo: {
    label: "Ostali tiketi",
    emoji: null,
    style: ButtonStyle.Secondary,
    prefix: "tiket",
    title: "Ostali tiket",
    description:
      "Opisi pitanje, molbu ili problem. Staff ce ti odgovorit u najkracem mogucem roku."
  }
};

// ---------------------------------------------------------------
// Helper: da li user ima staff role iz configa
// ---------------------------------------------------------------
function isStaff(member) {
  if (!member) return false;
  return config.staffRoleIds.some(id => member.roles.cache.has(id));
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

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_create_donacije")
      .setLabel(TICKET_TYPES.donacije.label)
      .setStyle(TICKET_TYPES.donacije.style),
    new ButtonBuilder()
      .setCustomId("ticket_create_prijave")
      .setLabel(TICKET_TYPES.prijave.label)
      .setStyle(TICKET_TYPES.prijave.style),
    new ButtonBuilder()
      .setCustomId("ticket_create_ostalo")
      .setLabel(TICKET_TYPES.ostalo.label)
      .setStyle(TICKET_TYPES.ostalo.style)
  );

  return { embeds: [embed], components: [row] };
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
        name: "1. Postivanje clanova",
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
// Helper: ZATVORI tiket (transcript + log + DM + arhiviraj)
// Kanal NE brisemo - samo skine permisije vlasniku, preimenuje,
// i oznaci status:closed u topic.
// ---------------------------------------------------------------
async function closeTicket(channel, closedBy) {
  const info = getTicketInfo(channel);
  const ownerId = info ? info.ownerId : null;

  if (info && info.closed) {
    // Vec je zatvoren - ne radi nista
    return false;
  }

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

  // ARHIVIRAJ: skini owneru view/send permisije
  if (ownerId) {
    try {
      await channel.permissionOverwrites.edit(ownerId, {
        ViewChannel: false,
        SendMessages: false
      });
    } catch (err) {
      console.error("Greska pri oduzimanju permisija:", err);
    }
  }

  // Preimenuj kanal (closed- prefix)
  try {
    if (!channel.name.startsWith("closed-")) {
      await channel.setName(`closed-${channel.name}`.slice(0, 100));
    }
  } catch (err) {
    console.error("Greska pri preimenovanju kanala:", err);
  }

  // Oznaci status:closed u topic-u
  try {
    const newTopic = (channel.topic || "") + " status:closed";
    await channel.setTopic(newTopic.trim());
  } catch (err) {
    console.error("Greska pri azuriranju topic-a:", err);
  }

  // Finalna poruka u kanalu (samo staff ga jos vidi)
  try {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(config.colors.danger)
          .setTitle("Tiket arhiviran")
          .setDescription(
            `Tiket zatvorio ${closedBy}. Korisnik vise ne vidi ovaj kanal.\n` +
              `Za ponovno otvaranje koristi **/otvori** u ovom kanalu.`
          )
      ]
    });
  } catch (err) {
    console.error("Greska pri slanju finalne poruke:", err);
  }

  return true;
}

// ---------------------------------------------------------------
// Helper: OTVORI ponovo arhivirani tiket
// ---------------------------------------------------------------
async function reopenTicket(channel, reopenedBy) {
  const info = getTicketInfo(channel);
  if (!info) return { ok: false, reason: "not_ticket" };
  if (!info.closed) return { ok: false, reason: "not_closed" };

  const ownerId = info.ownerId;

  // Vrati owneru view/send permisije
  try {
    await channel.permissionOverwrites.edit(ownerId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true
    });
  } catch (err) {
    console.error("Greska pri vracanju permisija:", err);
  }

  // Preimenuj nazad (makni closed- prefix)
  try {
    if (channel.name.startsWith("closed-")) {
      await channel.setName(channel.name.replace(/^closed-/, ""));
    }
  } catch (err) {
    console.error("Greska pri preimenovanju:", err);
  }

  // Skini status:closed iz topic-a
  try {
    const newTopic = (channel.topic || "").replace(/\s*status:closed/g, "").trim();
    await channel.setTopic(newTopic);
  } catch (err) {
    console.error("Greska pri azuriranju topic-a:", err);
  }

  // Poruka u kanalu
  try {
    await channel.send({
      content: `<@${ownerId}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle("Tiket ponovo otvoren")
          .setDescription(
            `Tiket je ponovo otvorio ${reopenedBy}. Mozes nastavit razgovor.`
          )
      ]
    });
  } catch (err) {
    console.error("Greska pri slanju poruke:", err);
  }

  return { ok: true, ownerId };
}

// ---------------------------------------------------------------
// Slash komande - definicije (auto-register na startup)
// ---------------------------------------------------------------
const slashCommands = [
  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Zatvori trenutni tiket kanal (alias za /zatvori)")
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("zatvori")
    .setDescription("Zatvori (arhiviraj) trenutni tiket")
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("otvori")
    .setDescription("Ponovo otvori arhivirani tiket")
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
// EVENT: Ready
// ---------------------------------------------------------------
client.once(Events.ClientReady, async c => {
  console.log(`Bot je online kao ${c.user.tag}`);
  const clientId = process.env.CLIENT_ID || c.user.id;
  const guildId = process.env.GUILD_ID || null;
  await registerCommands(clientId, guildId);
});

// ---------------------------------------------------------------
// EVENT: Novi clan - DOBRODOSLICA
// ---------------------------------------------------------------
client.on(Events.GuildMemberAdd, async member => {
  try {
    const channel = await member.guild.channels
      .fetch(config.welcomeChannelId)
      .catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(config.colors.success)
      .setTitle("Dobrodosli!")
      .setDescription(
        `Dobrodosli ${member} u server!\n\n` +
          `U slucaju da imate neko pitanje, molbu ili zelju otvorite ticket ovdje <#${config.ticketPanelChannelId}>.`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }));

    await channel.send({ content: `${member}`, embeds: [embed] });
  } catch (err) {
    console.error("Greska u welcome event:", err);
  }
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

      await interaction.deferReply({ ephemeral: true });

      // Provjeri da user nema vec tiket istog tipa (aktivan ILI arhiviran)
      const existing = interaction.guild.channels.cache.find(ch => {
        if (ch.parentId !== config.ticketCategoryId) return false;
        const info = getTicketInfo(ch);
        if (!info) return false;
        return (
          info.ownerId === interaction.user.id && info.type === typeKey
        );
      });
      if (existing) {
        const info = getTicketInfo(existing);
        if (info && info.closed) {
          return interaction.editReply({
            content:
              `Vec imas ZATVOREN tiket ovog tipa (${existing.name}). Staff ga mora ponovo otvorit preko /otvori ili obrisat.`
          });
        }
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
        ...config.staffRoleIds.map(roleId => ({
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
          parent: config.ticketCategoryId || null,
          topic: `owner:${interaction.user.id} tip:${typeKey}`,
          permissionOverwrites: overwrites
        })
        .catch(err => {
          console.error("Greska pri kreiranju kanala:", err);
          return null;
        });

      if (!channel) {
        return interaction.editReply({
          content:
            "Nisam uspio kreirat kanal. Provjeri da li je `ticketCategoryId` ispravan i da li bot ima permissions."
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

      const staffMentions = config.staffRoleIds
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
  }

  // -------- SLASH COMMANDI --------
  if (interaction.isChatInputCommand()) {
    const cmd = interaction.commandName;

    if (cmd === "close" || cmd === "zatvori") {
      const ch = interaction.channel;
      const info = getTicketInfo(ch);
      if (!info) {
        return interaction.reply({
          content: "Ovu komandu mozes koristit samo unutar tiket kanala.",
          ephemeral: true
        });
      }
      if (info.closed) {
        return interaction.reply({
          content: "Ovaj tiket je vec zatvoren. Koristi /otvori da ga vratis.",
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

    if (cmd === "otvori") {
      const ch = interaction.channel;
      const info = getTicketInfo(ch);
      if (!info) {
        return interaction.reply({
          content: "Ovu komandu mozes koristit samo u tiket kanalu.",
          ephemeral: true
        });
      }
      if (!info.closed) {
        return interaction.reply({
          content: "Ovaj tiket nije zatvoren.",
          ephemeral: true
        });
      }
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "Samo staff moze ponovo otvorit tiket.",
          ephemeral: true
        });
      }

      const result = await reopenTicket(ch, interaction.user);
      if (result.ok) {
        return interaction.reply({
          content: `Tiket ponovo otvoren. Vlasnik (<@${result.ownerId}>) opet ima pristup.`,
          ephemeral: true
        });
      }
      return interaction.reply({
        content: "Nisam uspio otvoriti tiket.",
        ephemeral: true
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

      await target.send(buildTicketPanel());
      return interaction.reply({
        content: `Panel postavljen u ${target}.`,
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
