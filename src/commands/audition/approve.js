import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { activeAuditions } from './audition.js';

const LOG_CHANNEL_NAME = 'audition-log';
const NOTIFY_ROLE_NAME = 'Director';

const APPROVED_MESSAGE = (time) =>
    `Great news! Your interview has been confirmed for **${time}**. We look forward to speaking with you! 😊`;

async function getDirectorMention(guild) {
    const role = guild.roles.cache.find(r => r.name === NOTIFY_ROLE_NAME);
    return role ? `<@&${role.id}>` : `@${NOTIFY_ROLE_NAME}`;
}

async function logToChannel(guild, message) {
    try {
        const channel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);
        if (!channel) return;
        const directorMention = await getDirectorMention(guild);
        await channel.send(`${directorMention}\n${message}`);
    } catch (err) {
        logger.error('Approve log error:', err);
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('approve')
        .setDescription('Approve an applicant\'s proposed interview time')
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The applicant to approve')
                .setRequired(true)),
    category: 'Audition',

    async execute(interaction) {
        try {
            const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferSuccess) return;

            const target = interaction.options.getUser('user');
            const audition = activeAuditions.get(target.id);

            if (!audition) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({ title: 'Not Found', description: `❌ No active audition found for **${target.username}**`, color: 'error' })]
                });
            }

            await target.send(APPROVED_MESSAGE(audition.proposedTime));
            await logToChannel(interaction.guild,
                `✅ **Audition Approved!**\n👤 ${target.username}\n🎭 Role: **${audition.role}**\n🕐 Time: **${audition.proposedTime}**`
            );
            activeAuditions.delete(target.id);

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed('Audition Approved', `✅ **${target.username}** has been notified of their confirmed time!`)]
            });
        } catch (error) {
            logger.error('Approve command error:', error);
        }
    }
};
