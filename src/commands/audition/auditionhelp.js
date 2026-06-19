import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from '../../utils/embeds.js';
import { activeAuditions } from '../../utils/store.js';

export default {
    data: new SlashCommandBuilder()
        .setName('auditionhelp')
        .setDescription('Shows how to use all the audition commands')
        .setDMPermission(false),
    category: 'Audition',

    async execute(interaction) {
        try {
            const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferSuccess) return;

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    createEmbed({
                        title: '📋 Audition Commands Guide',
                        description: 'Here\'s how each audition command works:',
                        fields: [
                            {
                                name: '🎬 /audition',
                                value: '`/audition user:@person role:Vocalist`\nSends the opening DM to an applicant, asking when they\'re free for their interview. Use this first when you want to invite someone.',
                                inline: false
                            },
                            {
                                name: '✅ /approve',
                                value: '`/approve user:@person`\nUse this once an applicant has proposed a time and you\'re happy with it. It confirms the time with them automatically.',
                                inline: false
                            },
                            {
                                name: '🔄 /rejecttime',
                                value: '`/rejecttime user:@person newtime:Friday 27th June at 6PM BST`\nUse this if the proposed time doesn\'t work for you. It sends the applicant your suggested alternative time instead.',
                                inline: false
                            },
                            {
                                name: '❓ /auditionhelp',
                                value: 'Shows this guide! Use it anytime you forget how something works.',
                                inline: false
                            },
                            {
                                name: '💡 How It Works',
                                value: 'Once you run `/audition`, the bot handles the back-and-forth automatically — asking for date/time/timezone, and pinging the audition-log channel whenever you need to approve or reject a time. You\'ll always get notified before anything is confirmed!',
                                inline: false
                            }
                        ],
                        color: 'primary'
                    })
                ]
            });
        } catch (error) {
            logger.error('Auditionhelp command error:', error);
        }
    }
};
