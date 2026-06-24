require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");

const {
  getGiveaway,
  updateGiveaway
} = require("./utils/database");

const {
  refreshGiveawayMessage,
  startGiveawayWatcher
} = require("./utils/giveawayManager");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity("AS GAMING GIVEAWAYS");
  startGiveawayWatcher(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("gw_enter_")) {
      const messageId = interaction.customId.replace("gw_enter_", "");
      const giveaway = getGiveaway(messageId);

      if (!giveaway) {
        return interaction.reply({
          content: "❌ Giveaway not found.",
          ephemeral: true
        });
      }

      if (giveaway.ended) {
        return interaction.reply({
          content: "❌ Giveaway already ended.",
          ephemeral: true
        });
      }

      if (giveaway.paused) {
        return interaction.reply({
          content: "⏸️ Giveaway is paused right now.",
          ephemeral: true
        });
      }

      if (Date.now() >= giveaway.endAt) {
        return interaction.reply({
          content: "❌ Giveaway already ended.",
          ephemeral: true
        });
      }

      let participants = Array.isArray(giveaway.participants)
        ? giveaway.participants
        : [];

      if (participants.includes(interaction.user.id)) {
        return interaction.reply({
          content: "❌ Tum already is giveaway me enter ho.",
          ephemeral: true
        });
      }

      participants.push(interaction.user.id);

      updateGiveaway(messageId, { participants });
      await refreshGiveawayMessage(client, messageId);

      return interaction.reply({
        content: "🎉 Successfully entered the giveaway!",
        ephemeral: true
      });
    }
  } catch (error) {
    console.error(error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "❌ Kuch error aa gaya.",
        ephemeral: true
      }).catch(() => {});
    } else {
      await interaction.reply({
        content: "❌ Kuch error aa gaya.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(process.env.TOKEN);
