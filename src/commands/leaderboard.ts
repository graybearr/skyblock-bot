import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import db from '../utils/db';
import { formatNumber } from '../utils/formatters';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('유저들의 넷워스 순위를 확인해요.');

    export async function execute(interaction: ChatInputCommandInteraction) {
        const topUsers = db.getTop10(); 
        const embed = new EmbedBuilder()
            .setTitle('🏆 넷워스 순위')
            .setColor('Gold')
            .setDescription(
                topUsers.length > 0 
                ? topUsers.map((user, i) => `**${i + 1}위** | <@${user.discordId}> (\`${user.mcUsername}\`): ${formatNumber(user.score)}`).join('\n')
                : "아직 집계된 순위가 없어요."
            )
            .setFooter({ text: '연동된 닉네임만 순위에 표시돼요.' });
    
        await interaction.reply({ embeds: [embed] });
    }