// ====================================================================
// Script za REGISTRIRANJE slash komandi na Discord API
// Pokreni: node deploy-commands.js
// ====================================================================
require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Zatvori trenutni tiket kanal")
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

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error("BOT_TOKEN i CLIENT_ID moraju biti u .env file.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(`Registriram ${commands.length} komandi...`);

    if (guildId) {
      // Guild komande - trenutne odmah
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands
      });
      console.log(`Uspjesno registrirane GUILD komande za ${guildId}`);
    } else {
      // Globalne - mogu trajat do sat vremena
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands
      });
      console.log("Uspjesno registrirane GLOBALNE komande.");
    }
  } catch (error) {
    console.error("Greska pri registraciji komandi:", error);
  }
})();
