const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const {
  createGiveaway,
  getGiveaway,
  updateGiveaway,
  deleteGiveaway
} = require("../utils/database");

const {
  buildGiveawayEmbed,
  buildGiveawayComponents,
  endGiveaway,
  refreshGiveawayMessage
} = require("../utils/giveawayManager");

function ms(input) {
  if (!input) return null;

  const match = /^(\d+)(s|m|h|d)$/i.exec(input.trim());
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * multipliers[unit];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage AS GAMING GIVEAWAYS giveaways")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a giveaway")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Giveaway channel")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("duration")
            .setDescription("Example: 10m, 1h, 2d")
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("winners")
            .setDescription("Number of winners")
            .setMinValue(1)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("prize")
            .setDescription("Prize name")
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End a giveaway early")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("Giveaway message ID")
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("reroll")
        .setDescription("Reroll giveaway winners")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("Giveaway message ID")
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("pause")
        .setDescription("Pause a giveaway")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("Giveaway message ID")
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("resume")
        .setDescription("Resume a paused giveaway")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("Giveaway message ID")
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a giveaway")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("Giveaway message ID")
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit giveaway prize / time / winners")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("Giveaway message ID")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("prize")
            .setDescription("New prize")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("duration")
            .setDescription("New duration from now. Example: 30m, 2h, 1d")
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("winners")
            .setDescription("New winner count")
            .setMinValue(1)
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === "start") {
      const channel = interaction.options.getChannel("channel");
      const durationInput = interaction.options.getString("duration");
      const winners = interaction.options.getInteger("winners");
      const prize = interaction.options.getString("prize");

      const duration = ms(durationInput);
      if (!duration || duration < 10000) {
        return interaction.reply({
          content: "❌ Invalid duration. Example: 10m, 1h, 2d",
          ephemeral: true
        });
      }

      const tempData = {
        messageId: "temp",
        guildId: interaction.guild.id,
        channelId: channel.id,
        hostId: interaction.user.id,
        prize,
        winnerCount: winners,
        endAt: Date.now() + duration,
        paused: false,
        ended: false,
        participants: [],
        winners: [],
        createdAt: Date.now()
      };

      const message = await channel.send({
        embeds: [buildGiveawayEmbed(tempData)],
        components: buildGiveawayComponents(tempData)
      });

      const giveawayData = {
        ...tempData,
        messageId: message.id
      };

      createGiveaway(giveawayData);

      await message.edit({
        embeds: [buildGiveawayEmbed(giveawayData)],
        components: buildGiveawayComponents(giveawayData)
      });

      return interaction.reply({
        content: `✅ Giveaway started in ${channel} for **${prize}**`,
        ephemeral: true
      });
    }

    if (sub === "end") {
      const messageId = interaction.options.getString("message_id");
      const giveaway = getGiveaway(messageId);

      if (!giveaway) {
        return interaction.reply({
          content: "❌ Giveaway not found.",
          ephemeral: true
        });
      }

      await endGiveaway(client, messageId, false);

      return interaction.reply({
        content: "✅ Giveaway ended.",
        ephemeral: true
      });
    }

    if (sub === "reroll") {
      const messageId = interaction.options.getString("message_id");
      const giveaway = getGiveaway(messageId);

      if (!giveaway) {
        return interaction.reply({
          content: "❌ Giveaway not found.",
          ephemeral: true
        });
      }

      await endGiveaway(client, messageId, true);

      return interaction.reply({
        content: "🔄 Giveaway rerolled.",
        ephemeral: true
      });
    }

    if (sub === "pause") {
      const messageId = interaction.options.getString("message_id");
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

      updateGiveaway(messageId, { paused: true });
      await refreshGiveawayMessage(client, messageId);

      return interaction.reply({
        content: "⏸️ Giveaway paused.",
        ephemeral: true
      });
    }

    if (sub === "resume") {
      const messageId = interaction.options.getString("message_id");
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

      updateGiveaway(messageId, { paused: false });
      await refreshGiveawayMessage(client, messageId);

      return interaction.reply({
        content: "▶️ Giveaway resumed.",
        ephemeral: true
      });
    }

    if (sub === "delete") {
      const messageId = interaction.options.getString("message_id");
      const giveaway = getGiveaway(messageId);

      if (!giveaway) {
        return interaction.reply({
          content: "❌ Giveaway not found.",
          ephemeral: true
        });
      }

      const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
      if (channel) {
        const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (message) await message.delete().catch(() => {});
      }

      deleteGiveaway(messageId);

      return interaction.reply({
        content: "🗑️ Giveaway deleted.",
        ephemeral: true
      });
    }

    if (sub === "edit") {
      const messageId = interaction.options.getString("message_id");
      const prize = interaction.options.getString("prize");
      const durationInput = interaction.options.getString("duration");
      const winners = interaction.options.getInteger("winners");

      const giveaway = getGiveaway(messageId);

      if (!giveaway) {
        return interaction.reply({
          content: "❌ Giveaway not found.",
          ephemeral: true
        });
      }

      const updates = {};

      if (prize) updates.prize = prize;
      if (typeof winners === "number") updates.winnerCount = winners;

      if (durationInput) {
        const duration = ms(durationInput);
        if (!duration || duration < 10000) {
          return interaction.reply({
            content: "❌ Invalid duration. Example: 10m, 1h, 2d",
            ephemeral: true
          });
        }
        updates.endAt = Date.now() + duration;
        updates.ended = false;
      }

      if (!Object.keys(updates).length) {
        return interaction.reply({
          content: "❌ Kuch edit karne ke liye option do.",
          ephemeral: true
        });
      }

      updateGiveaway(messageId, updates);
      await refreshGiveawayMessage(client, messageId);

      return interaction.reply({
        content: "✏️ Giveaway updated successfully.",
        ephemeral: true
      });
    }
  }
};
