import { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { activeAuditions } from '../../utils/store.js';
import { logToChannel } from './audition.js';

const APPROVED_MESSAGE = (time) =>
    `Great news! Your interview has been confirmed for **${time}**. We look forward to speaking with you! 😊`;

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
            const target = interaction.options.getUser('user');
            const audition = activeAuditions.get(target.id);

            if (!audition) {
                return await interaction.reply({
                    embeds: [createEmbed({ title: 'Not Found', description: `❌ No active audition found for **${target.username}**`, color: 'error' })],
                    flags: MessageFlags.Ephemeral
                });
            }

            // Send the confirmation DM now, store the rest for after day selection
            await target.send(APPROVED_MESSAGE(audition.proposedTime));
            await logToChannel(interaction.guild,
                `✅ **Audition Confirmed!**\n👤 ${target.username}\n🎭 Role: **${audition.role}**\n🕐 Time: **${audition.proposedTime}**`
            );

            // Ask: today or another day?
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`audition_today_${target.id}`)
                    .setLabel('Today')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`audition_otherday_${target.id}`)
                    .setLabel('Another day')
                    .setStyle(ButtonStyle.Secondary)
            );

            return await interaction.reply({
                content: `✅ **${target.username}** has been notified! \n\nWhen is this interview happening, so I can schedule the reminder?`,
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            logger.error('Approve command error:', error);
        }
    }
};
