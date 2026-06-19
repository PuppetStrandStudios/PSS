// ============================================
// AUDITION DM SYSTEM FOR TITANBOT
// File goes in: src/commands/audition/audition.js
// ============================================

const { SlashCommandBuilder } = require('discord.js');

// ============================================
// CONFIGURATION — EDIT THESE TO YOUR LIKING
// ============================================

const YOUR_TIMEZONE = 'Europe/London';
const LOG_CHANNEL_NAME = 'audition-log';
const NOTIFY_ROLE_NAME = 'Director';

const OPENING_MESSAGE = (name, role) =>
    `Hello there! ${name} thank you so much for applying for ${role}! We would like to invite you for an interview with us. If you are still interested in the role and being part of our project, please let us know when the perfect time you can do your interview and we will try to arrange it!`;

const MISSING_INFO_MESSAGE =
    `Thank you for getting back to us! To make sure we get this right, could you please provide:\n📅 **Date** — e.g. Monday 23rd June\n🕐 **Time** — e.g. 3:00 PM\n🌍 **Timezone** — e.g. EST, PST, AEST\n\nThis helps us make sure the time works fairly for both of us! 😊`;

const APPROVED_MESSAGE = (time) =>
    `Great news! Your interview has been confirmed for **${time}**. We look forward to speaking with you! 😊`;

const NEW_TIME_MESSAGE = (newTime) =>
    `Thank you for your patience! Unfortunately that time doesn't quite work for us. Could you do **${newTime}** instead? Let us know if that works for you!`;

const CONTACT_MESSAGE =
    `No worries at all! Please feel free to DM us directly and we'll be happy to help sort out a time that works for you! 😊`;

// ============================================
// DO NOT EDIT BELOW THIS LINE
// ============================================

const activeAuditions = new Map();

// Helper — find the @Director role and return a mention string
async function getDirectorMention(guild) {
    const role = guild.roles.cache.find(r => r.name === NOTIFY_ROLE_NAME);
    return role ? `<@&${role.id}>` : `@${NOTIFY_ROLE_NAME}`;
}

// Helper — log to audition-log channel and ping @Director
async function logToChannel(guild, message) {
    try {
        const channel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);
        if (!channel) return;
        const directorMention = await getDirectorMention(guild);
        await channel.send(`${directorMention}\n${message}`);
    } catch {}
}

// ============================================
// MAIN AUDITION COMMAND — /audition @user role
// ============================================
module.exports = {
    data: new SlashCommandBuilder()
        .setName('audition')
        .setDescription('Send an audition interview request to a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to invite for audition')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('role')
                .setDescription('The role they applied for')
                .setRequired(true)),

    async execute(interaction) {
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
            await interaction.reply({
                content: `✅ Interview request sent to **${target.username}**! I'll notify you when they reply.`,
                ephemeral: true
            });
            await logToChannel(interaction.guild,
                `📨 **New Audition Request Sent**\n👤 Applicant: ${target} (${target.username})\n🎭 Role: **${role}**\n📋 Requested by: ${interaction.user}`
            );
        } catch (err) {
            await interaction.reply({
                content: `❌ I couldn't DM **${target.username}**. They may have DMs disabled.`,
                ephemeral: true
            });
        }
    },

    // ============================================
    // HANDLE DM REPLIES FROM APPLICANTS
    // ============================================
    async handleDMReply(client, message) {
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
                    `⏰ **Audition Time Proposed!**\n👤 Applicant: ${message.author.username}\n🎭 Role: **${audition.role}**\n🕐 Proposed time: **${message.content}**\n\nUse:\n✅ \`/approve\` + their username to confirm\n❌ \`/rejecttime\` + their username + new time to suggest another`;

                try { await staffMember.send(approvalMsg); } catch {}
                await logToChannel(guild, approvalMsg);
                await message.author.send(`Thank you! We've received your proposed time and will get back to you shortly to confirm. 😊`);

            } else {
                await message.author.send(MISSING_INFO_MESSAGE);
            }

        } else if (audition.stage === 'waiting_for_applicant_confirmation') {
            if (content.includes('yes') || content.includes('sure') || content.includes('ok') || content.includes('works') || content.includes('fine') || content.includes('good')) {
                await message.author.send(APPROVED_MESSAGE(audition.proposedTime));
                await logToChannel(guild,
                    `✅ **Audition Confirmed!**\n👤 ${message.author.username}\n🎭 Role: **${audition.role}**\n🕐 Time: **${audition.proposedTime}**`
                );
                activeAuditions.delete(userId);

            } else if (content.includes('no') || content.includes("can't") || content.includes('cannot') || content.includes("won't") || content.includes('help')) {
                await message.author.send(CONTACT_MESSAGE);
                await logToChannel(guild,
                    `⚠️ **Applicant needs assistance — please DM them directly!**\n👤 ${message.author.username}`
                );
                activeAuditions.delete(userId);

            } else {
                audition.proposedTime = message.content;
                audition.stage = 'waiting_for_approval';
                activeAuditions.set(userId, audition);
                await logToChannel(guild,
                    `🔄 **Applicant suggested a new time**\n👤 ${message.author.username}\n🕐 New time: **${message.content}**\n\nUse \`/approve\` or \`/rejecttime\` to respond`
                );
                await message.author.send(`Got it! We'll check if that works and get back to you shortly. 😊`);
            }
        }
    }
};

// ============================================
// APPROVE COMMAND — /approve @user
// ============================================
module.exports.approveCommand = {
    data: new SlashCommandBuilder()
        .setName('approve')
        .setDescription('Approve an applicant\'s proposed interview time')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The applicant to approve')
                .setRequired(true)),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const audition = activeAuditions.get(target.id);

        if (!audition) {
            return interaction.reply({ content: `❌ No active audition found for ${target.username}`, ephemeral: true });
        }

        await target.send(APPROVED_MESSAGE(audition.proposedTime));
        await logToChannel(interaction.guild,
            `✅ **Audition Approved!**\n👤 ${target.username}\n🎭 Role: **${audition.role}**\n🕐 Time: **${audition.proposedTime}**`
        );
        activeAuditions.delete(target.id);
        await interaction.reply({ content: `✅ Approved! **${target.username}** has been notified.`, ephemeral: true });
    }
};

// ============================================
// REJECT TIME COMMAND — /rejecttime @user [new time]
// ============================================
module.exports.rejectTimeCommand = {
    data: new SlashCommandBuilder()
        .setName('rejecttime')
        .setDescription('Reject an applicant\'s time and suggest a new one')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The applicant')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('newtime')
                .setDescription('Your suggested time e.g. "Wednesday 25th June at 6PM BST"')
                .setRequired(true)),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const newTime = interaction.options.getString('newtime');
        const audition = activeAuditions.get(target.id);

        if (!audition) {
            return interaction.reply({ content: `❌ No active audition found for ${target.username}`, ephemeral: true });
        }

        audition.stage = 'waiting_for_applicant_confirmation';
        audition.proposedTime = newTime;
        activeAuditions.set(target.id, audition);

        await target.send(NEW_TIME_MESSAGE(newTime));
        await interaction.reply({ content: `✅ Suggested **${newTime}** to **${target.username}**. Waiting for their response!`, ephemeral: true });
    }
};
