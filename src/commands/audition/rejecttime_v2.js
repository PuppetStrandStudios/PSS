import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { activeAuditions } from './store.js';

const NEW_TIME_MESSAGE = (newTime) =>
    `Thank you for your patience! Unfortunately that time doesn't quite work for us. Could you do **${newTime}** instead? Let us know if that works for you!`;

export default {
    data: new SlashCommandBuilder()
        .setName('rejecttime')
        .setDescription('Reject an applicant\'s time and suggest a new one')
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The applicant')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('newtime')
                .setDescription('Your suggested time e.g. "Wednesday 25th June at 6PM BST"')
                .setRequired(true)),
    category: 'Audition',

    async execute(interaction) {
        try {
            const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferSuccess) return;

            const target = interaction.options.getUser('user');
            const newTime = interaction.options.getString('newtime');
            const audition = activeAuditions.get(target.id);

            if (!audition) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({ title: 'Not Found', description: `❌ No active audition found for **${target.username}**`, color: 'error' })]
                });
            }

            audition.stage = 'waiting_for_applicant_confirmation';
            audition.proposedTime = newTime;
            activeAuditions.set(target.id, audition);

            await target.send(NEW_TIME_MESSAGE(newTime));

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed('New Time Suggested', `✅ Suggested **${newTime}** to **${target.username}**. Waiting for their response!`)]
            });
        } catch (error) {
            logger.error('Rejecttime command error:', error);
        }
    }
};
