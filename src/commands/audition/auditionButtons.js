// ============================================
// AUDITION BUTTON & MENU HANDLER
// File goes in: src/commands/audition/auditionButtons.js
//
// This handles the "Today" / "Another day" buttons and
// the day-picker dropdown that show up after /approve.
// It needs to be wired into interactionCreate.js — see
// the comment block at the bottom of this file.
// ============================================

import { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { activeAuditions } from '../../utils/store.js';
import { scheduleReminder } from './reminders.js';

const LOG_CHANNEL_NAME = 'audition-log';
const NOTIFY_ROLE_NAME = 'Director';

async function logToChannel(guild, message) {
    try {
        const channel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);
        if (!channel) return;
        const role = guild.roles.cache.find(r => r.name === NOTIFY_ROLE_NAME);
        const mention = role ? `<@&${role.id}>` : `@${NOTIFY_ROLE_NAME}`;
        await channel.send(`${mention}\n${message}`);
    } catch (err) {
        logger.error('Audition log error:', err);
    }
}

function buildDayOptions() {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
        const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        options.push({
            label,
            value: d.toISOString().split('T')[0] // YYYY-MM-DD
        });
    }
    return options;
}

// Pending approvals waiting on a time-of-day after day is picked
const pendingTimeEntry = new Map();

export async function handleAuditionComponent(interaction) {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return false;

    const id = interaction.customId;
    if (!id.startsWith('audition_')) return false;

    // ----- "Today" button -----
    if (id.startsWith('audition_today_')) {
        const userId = id.replace('audition_today_', '');
        const today = new Date().toISOString().split('T')[0];
        await finalizeReminder(interaction, userId, today);
        return true;
    }

    // ----- "Another day" button -> show dropdown -----
    if (id.startsWith('audition_otherday_')) {
        const userId = id.replace('audition_otherday_', '');
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`audition_daypick_${userId}`)
            .setPlaceholder('Choose a day')
            .addOptions(buildDayOptions());

        const row = new ActionRowBuilder().addComponents(menu);
        await interaction.update({ content: 'Which day is the interview?', components: [row] });
        return true;
    }

    // ----- Day picked from dropdown -----
    if (id.startsWith('audition_daypick_')) {
        const userId = id.replace('audition_daypick_', '');
        const chosenDate = interaction.values[0]; // YYYY-MM-DD
        await finalizeReminder(interaction, userId, chosenDate);
        return true;
    }

    return false;
}

async function finalizeReminder(interaction, userId, dateStr) {
    const audition = activeAuditions.get(userId);

    if (!audition) {
        await interaction.update({ content: '⚠️ Could not find that audition anymore — it may have already been processed.', components: [] });
        return;
    }

    // Try to pull a time like "5pm" / "17:00" out of their original message
    const timeMatch = audition.proposedTime.match(/\b(\d{1,2})(:(\d{2}))?\s*(am|pm)?\b/i);
    let hour = 18; // sensible fallback: 6PM
    let minute = 0;

    if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        minute = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
        const meridiem = timeMatch[4]?.toLowerCase();
        if (meridiem === 'pm' && hour < 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const interviewDate = new Date(Date.UTC(year, month - 1, day, hour, minute));

    scheduleReminder(interaction.client, {
        userId,
        guildId: interaction.guildId,
        role: audition.role,
        proposedTime: audition.proposedTime,
        interviewTimestamp: interviewDate.getTime()
    });

    if (interaction.guild) {
        await logToChannel(interaction.guild,
            `🔔 **Reminder scheduled**\n👤 <@${userId}>\n📅 ${dateStr} around ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} UK time`
        );
    }

    activeAuditions.delete(userId);

    await interaction.update({
        content: `✅ Reminder scheduled for **${dateStr}** at approximately **${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} UK time** (1hr before).`,
        components: []
    });
}

/*
============================================
WIRING INSTRUCTIONS — IMPORTANT
============================================
This file needs to be called from src/events/interactionCreate.js
so the buttons/dropdown actually respond when clicked.

Near the top of interactionCreate.js, add this import:

    import { handleAuditionComponent } from '../commands/audition/auditionButtons.js';

Then, early in the execute() function — BEFORE it tries to handle
normal slash commands — add this:

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const handled = await handleAuditionComponent(interaction);
      if (handled) return;
    }

This lets our audition buttons/dropdown get handled first, then
falls through to TitanBot's normal handling for everything else.
*/
