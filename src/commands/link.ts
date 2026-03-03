import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import db from '../utils/db';
import { validateMinecraftUser } from '../utils/api';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('link')
    .setDescription('내 디스코드 계정과 마인크래프트 닉네임을 연동해요.')
    .addStringOption(option => 
        option.setName('username')
            .setDescription('마인크래프트 닉네임 (미입력시 연동을 해제해요.)')
            .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    const discordId = interaction.user.id;
    const username = interaction.options.getString('username');
    const existingUser = db.getUser(discordId)

    if (username) {
        await interaction.deferReply({ ephemeral: true });

        const mojangUser = await validateMinecraftUser(username);
        if (!mojangUser) {
            return interaction.editReply('⚠️ 존재하지 않는 플레이어에요.');
        }

        db.linkUser(discordId, mojangUser.name);
        logger.success('COMMAND', `${interaction.user.tag} 연동: ${mojangUser.name}`);
        return interaction.editReply(`✅ <@${discordId}>님의 마인크래프트 닉네임을 \`${mojangUser.name}\`(으)로 설정했어요!`);
    }

    if (existingUser) {
        const confirmBtn = new ButtonBuilder()
            .setCustomId('confirm_unlink')
            .setLabel('해제')
            .setStyle(ButtonStyle.Danger);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('cancel_unlink')
            .setLabel('취소')
            .setStyle(ButtonStyle.Secondary);
        
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

        const response = await interaction.reply({
            content: `⚠️ \`${existingUser.mcUsername}\` 닉네임과의 연동을 해제할까요?`,
            components: [row],
            ephemeral: true
        });

        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 15_000 
        });

        collector.on('collect', async (i) => {
            if (i.customId === 'confirm_unlink') {
                db.unlinkUser(discordId);
                logger.warn('COMMAND', `${interaction.user.tag} 연동 해제 완료`);
                await i.update({ content: `✅ 연동을 해제했어요.`, components: [] });
            } else {
                await i.update({ content: `❌ 연동 해제를 취소했어요.`, components: [] });
            }
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await interaction.editReply({ content: '❌ 응답 시간이 초과되어 취소했어요.', components: [] }).catch(() => {});
            }
        });

        return;
    }

    return interaction.reply({
        content: '⚠️ 연동할 닉네임을 입력해 주세요. (예: `/link [마인크래프트 닉네임]`)',
        ephemeral: true
    });
}