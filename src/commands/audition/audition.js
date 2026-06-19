import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { activeAuditions } from '../../utils/store.js';

// ============================================
// CONFIGURATION — EDIT THESE TO YOUR LIKING
// ============================================

const LOG_CHANNEL_NAME = 'audition-log';
const NOTIFY_ROLE_NAME = 'Director';

const OPENING_MESSAGE = (name, role) =>
    `Hello there! ${name} thank you so much for applying for ${role}! We would like to invite you for an interview with us. If you are still interested in the role and being part of our project, please let us know when the perfect time you can do your interview and we will try to arrange it!`;

const MISSING_INFO_MESSAGE =
    `Thank you for getting back to us! To make sure we get this right, could you please provide:\n📅 **Date** — e.g. Monday 23rd June\n🕐 **Time** — e.g. 3:00 PM\n🌍 **Timezone** — e.g. EST, PST, AEST\n\nThis helps us make sure the time works fairly for both of us! 😊`;

// ============================================
// HELPERS
// ============================================

async function getDirectorMention(guild) {
    const role = guild.roles.cache.find(r => r.name === NOTIFY_ROLE_NAME);
    return role ? `<@&${role.id}>` : `@${NOTIFY_ROLE_NAME}`;
}

export async function logToChannel(guild, message) {
    try {
        const channel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);
        if (!channel) return;
        const directorMention = await getDirectorMention(guild);
        await channel.send(`${directorMention}\n${message}`);
    } catch (err) {
        logger.error('Audition log error:', err);
    }
}

export async function handleAuditionDMReply(client, message) {
    if (message.guild) return;
    if (message.author.bot) return;

    const userId = message.author.id;
    const audition = activeAuditions.get(userId);
    if (!audition) return;

    const content = message.content.toLowerCase();
    const guild = client.guilds.cache.get(audition.guildId);

    if (audition.stage === 'waiting_for_time') {
        const hasDate = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(st|nd|rd|th)?|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})\b/i.test(message.content);
        const hasTime = /\b(\d{1,2}(:\d{2})?\s*(am|pm)|(\d{1,2}:\d{2}))\b/i.test(message.content);
        const hasTimezone = /\b(gmt|bst|est|pst|cst|mst|aest|aedt|cet|ist|jst|utc|[+-]\d{1,2})\b/i.test(message.content);

        if (hasDate && hasTime && hasTimezone) {
            audition.stage = 'waiting_for_approval';
            audition.proposedTime = message.content;
            activeAuditions.set(userId, audition);

            const staffMember = await client.users.fetch(audition.requestedBy);
            const approvalMsg =
                `⏰ **Audition Time Proposed!**\n👤 Applicant: ${message.author.username}\n🎭 Role: **${audition.role}**\n🕐 Proposed time: **${message.content}**\n\nUse:\n✅ \`/approve\` to confirm\n❌ \`/rejecttime\` to suggest another time`;

            try { await staffMember.send(approvalMsg); } catch {}
            if (guild) await logToChannel(guild, approvalMsg);
            await message.author.send(`Thank you! We've received your proposed time and will get back to you shortly to confirm. 😊`);

        } else {
            await message.author.send(MISSING_INFO_MESSAGE);
        }

    } else if (audition.stage === 'waiting_for_applicant_confirmation') {
        const APPROVED_MESSAGE = (time) => `Great news! Your interview has been confirmed for **${time}**. We look forward to speaking with you! 😊`;
        const CONTACT_MESSAGE = `No worries at all! Please feel free to DM us directly and we'll be happy to help sort out a time that works for you! 😊`;

        if (content.includes('yes') || content.includes('sure') || content.includes('ok') || content.includes('works') || content.includes('fine') || content.includes('good')) {
            await message.author.send(APPROVED_MESSAGE(audition.proposedTime));
            if (guild) await logToChannel(guild, `✅ **Audition Confirmed!**\n👤 ${message.author.username}\n🎭 Role: **${audition.role}**\n🕐 Time: **${audition.proposedTime}**`);
            activeAuditions.delete(userId);

        } else if (content.includes('no') || content.includes("can't") || content.includes('cannot') || content.includes("won't") || content.includes('help')) {
            await message.author.send(CONTACT_MESSAGE);
            if (guild) await logToChannel(guild, `⚠️ **Applicant needs assistance — please DM them directly!**\n👤 ${message.author.username}`);
            activeAuditions.delete(userId);

        } else {
            audition.proposedTime = message.content;
            audition.stage = 'waiting_for_approval';
            activeAuditions.set(userId, audition);
            if (guild) await logToChannel(guild, `🔄 **Applicant suggested a new time**\n👤 ${message.author.username}\n🕐 New time: **${message.content}**\n\nUse \`/approve\` or \`/rejecttime\` to respond`);
            await message.author.send(`Got it! We'll check if that works and get back to you shortly. 😊`);
        }
    }
}

// ============================================
// /audition COMMAND
// ============================================

export default {
    data: new SlashCommandBuilder()
        .setName('audition')
        .setDescription('Send an audition interview request to a user')
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to invite for audition')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('role')
                .setDescription('The role they applied for e.g. Vocalist')
                .setRequired(true)),
    category: 'Audition',

    async execute(interaction) {
        try {
            const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferSuccess) return;

            const target = interaction.options.getUser('user');
            const role = interaction.options.getString('role');

            activeAuditions.set(target.id, {
                role,
                stage: 'waiting_for_time',
                proposedTime: null,
                guildId: interaction.guildId,
                requestedBy: interaction.user.id
            });

            try {
                await target.send(OPENING_MESSAGE(target.displayName || target.username, role));
                await logToChannel(interaction.guild,
                    `📨 **New Audition Request Sent**\n👤 Applicant: ${target} (${target.username})\n🎭 Role: **${role}**\n📋 Requested by: ${interaction.user}`
                );
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('Audition Request Sent', `Interview request sent to **${target.username}**! I'll notify you when they reply.`)]
                });
            } catch (err) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({ title: 'Error', description: `❌ I couldn't DM **${target.username}**. They may have DMs disabled.`, color: 'error' })]
                });
            }
        } catch (error) {
            logger.error('Audition command error:', error);
        }
    }
};
