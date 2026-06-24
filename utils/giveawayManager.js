const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const {
  getAllGiveaways,
  getGiveaway,
  updateGiveaway
} = require("./database");

function formatDuration(ms) {
  if (ms <= 0) return "Ended";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds && days === 0) parts.push(`${seconds}s`);

  return parts.join(" ") || "0s";
}

function buildGiveawayEmbed(giveaway) {
  const remaining = giveaway.endAt - Date.now();

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🎉 AS GAMING GIVEAWAY")
    .setDescription(
      [
        `**Prize:** ${giveaway.prize}`,
        `**Winners:** ${giveaway.winnerCount}`,
        `**Hosted by:** <@${giveaway.hostId}>`,
        `**Ends in:** ${giveaway.ended ? "Ended" : formatDuration(remaining)}`,
        `**Entries:** ${giveaway.participants.length}`,
        "",
        `Click **Enter Giveaway** to join.`
      ].join("\n")
    )
    .setFooter({
      text: giveaway.ended
        ? "Giveaway Ended"
        : giveaway.paused
        ? "Giveaway Paused"
        : "AS GAMING GIVEAWAYS"
    })
    .setTimestamp(giveaway.endAt);
}

function buildGiveawayComponents(giveaway) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gw_enter_${giveaway.messageId}`)
        .setLabel(giveaway.ended ? "Giveaway Ended" : "Enter Giveaway")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(giveaway.ended || giveaway.paused)
    )
  ];
}

function pickWinners(participants, winnerCount) {
  const pool = [...participants];
  const winners = [];

  while (pool.length > 0 && winners.length < winnerCount) {
    const index = Math.floor(Math.random() * pool.length);
    winners.push(pool[index]);
    pool.splice(index, 1);
  }

  return winners;
}

async function endGiveaway(client, messageId, reroll = false) {
  const giveaway = getGiveaway(messageId);
  if (!giveaway) return;

  if (giveaway.ended && !reroll) return;

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!message) return;

  const winners = pickWinners(giveaway.participants, giveaway.winnerCount);

  if (!reroll) {
    updateGiveaway(messageId, {
      ended: true,
      winners
    });
  } else {
    updateGiveaway(messageId, {
      winners
    });
  }

  const fresh = getGiveaway(messageId);

  await message.edit({
    embeds: [buildGiveawayEmbed(fresh)],
    components: buildGiveawayComponents(fresh)
  });

  if (winners.length === 0) {
    await channel.send(`No valid entries for **${giveaway.prize}**.`);
    return;
  }

  await channel.send(
    reroll
      ? `🔄 New winner(s) for **${giveaway.prize}**: ${winners.map((id) => `<@${id}>`).join(", ")}`
      : `🎉 Congratulations ${winners.map((id) => `<@${id}>`).join(", ")}! You won **${giveaway.prize}**`
  );
}

async function refreshGiveawayMessage(client, messageId) {
  const giveaway = getGiveaway(messageId);
  if (!giveaway) return;

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!message) return;

  await message.edit({
    embeds: [buildGiveawayEmbed(giveaway)],
    components: buildGiveawayComponents(giveaway)
  });
}

function startGiveawayWatcher(client) {
  setInterval(async () => {
    const giveaways = getAllGiveaways();

    for (const giveaway of giveaways) {
      if (giveaway.ended || giveaway.paused) continue;
      if (Date.now() >= giveaway.endAt) {
        await endGiveaway(client, giveaway.messageId).catch(() => {});
      }
    }
  }, 5000);
}

module.exports = {
  buildGiveawayEmbed,
  buildGiveawayComponents,
  endGiveaway,
  refreshGiveawayMessage,
  startGiveawayWatcher
};
