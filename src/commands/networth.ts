import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChatInputCommandInteraction, ComponentType } from 'discord.js';
import { logger } from '../utils/logger';
import { ProfileNetworthCalculator } from 'skyhelper-networth';
import { fetchSkyblockRawData, fetchProfileDetailData } from '../utils/api';
import { formatNumber, getTopItems } from '../utils/formatters';
import db from '../utils/db';

// 필터 조건(filterType)에 따라 가격을 unsoulboundTotal로 할지, 
// 귀속/치장품 아이템을 목록에서 뺄지 결정하는 진화된 병합 함수
function combineCategories(filterType: string, ...categories: any[]) {
    let total = 0;
    let items: any[] = [];
    
    const isUnsoulbound = filterType.includes('unsoulbound');
    const isNonCosmetic = filterType.includes('non_cosmetic');

    for (const cat of categories) {
        if (cat) {
            // 귀속 해제 필터가 켜져있으면 unsoulboundTotal을 더하고, 아니면 기본 total을 더함
            total += isUnsoulbound ? (cat.unsoulboundTotal || 0) : (cat.total || 0);
            
            if (cat.items && Array.isArray(cat.items)) {
                let filteredItems = cat.items;
                
                // 1. 귀속(Soulbound) 아이템 필터링
                if (isUnsoulbound) {
                    filteredItems = filteredItems.filter((i: any) => !i.soulbound);
                }
                
                // 2. 치장품(Cosmetic) 아이템 필터링
                if (isNonCosmetic) {
                    filteredItems = filteredItems.filter((i: any) => !i.cosmetic);
                }
                
                items = items.concat(filteredItems);
            }
        }
    }
    return { total, items };
}

function buildEmbedAndRow(cuteName: string, username: string, networthData: any, filterType: string, rankDisplay: string = "") {
    const isUnsoulbound = filterType.includes('unsoulbound');
    
    // 전체 넷워스 총합도 필터에 맞춰서 변경
    const totalNetworth = isUnsoulbound ? (networthData.unsoulboundNetworth || 0) : (networthData.networth || 0);
    
    // 지갑과 은행 잔고
    const purse = networthData.purse || 0;
    const bank = (networthData.bank || 0) + (networthData.personalBank || 0); // 은행 + 개인은행 합산
    
    // 에센스 (에센스는 단일 카테고리이므로 직접 처리)
    const essenceTotal = isUnsoulbound 
        ? (networthData.types?.essence?.unsoulboundTotal || 0) 
        : (networthData.types?.essence?.total || 0);

    // combineCategories를 사용하여 필터링된 총액과 아이템 배열을 가져옵니다.
    const combinedArmor = combineCategories(filterType, networthData.types?.armor, networthData.types?.wardrobe, networthData.types?.equipment);
    const combinedItems = combineCategories(filterType, networthData.types?.inventory, networthData.types?.enderchest, networthData.types?.storage, networthData.types?.personal_vault);
    const pets = combineCategories(filterType, networthData.types?.pets);
    const accessories = combineCategories(filterType, networthData.types?.accessories);
    const museum = combineCategories(filterType, networthData.types?.museum);

    const filterNames: Record<string, string> = {
        normal: '기본',
        non_cosmetic: '치장품 제외',
        unsoulbound: '귀속 해제',
        unsoulbound_non_cosmetic: '귀속 해제 & 치장품 제외'
    };
    const currentFilterName = filterNames[filterType] || '기본';

    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setAuthor({ name: `${username}(${cuteName}) 님의 넷워스 (${currentFilterName})`, iconURL: `https://mc-heads.net/avatar/${username}` })
        .setDescription(`**🪙 총 자산: ${totalNetworth.toLocaleString()} (${formatNumber(totalNetworth)})**${rankDisplay}`)
        .addFields(
            { name: '💸 지갑', value: `**${formatNumber(purse)}**`, inline: true },
            { name: '💰 은행', value: `**${formatNumber(bank)}**`, inline: true },
            { name: '🔮 에센스', value: `**${formatNumber(essenceTotal)}**`, inline: true },
            
            { name: `🛡️ 방어구 (${formatNumber(combinedArmor.total)})`, value: getTopItems(combinedArmor) },
            { name: `🗡️ 아이템 (${formatNumber(combinedItems.total)})`, value: getTopItems(combinedItems) },
            { name: `🐱 펫 (${formatNumber(pets.total)})`, value: getTopItems(pets) },
            { name: `💍 장신구 (${formatNumber(accessories.total)})`, value: getTopItems(accessories) },
            { name: `🏛️ 박물관 (${formatNumber(museum.total)})`, value: getTopItems(museum) }
        )
        .setFooter({ text: 'Powered by SkyHelper-Networth' })
        .setThumbnail('https://mc-heads.net/body/' + username);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('networth_filter')
        .setPlaceholder('필터를 선택해주세요.')
        .addOptions([
            { label: '기본 (Normal)', value: 'normal', description: '기본 넷워스를 계산해요.', default: filterType === 'normal' },
            { label: '치장품 제외 (Non-Cosmetic)', value: 'non_cosmetic', description: '스킨 및 치장품 가격을 제외해요.', default: filterType === 'non_cosmetic' },
            { label: '귀속 해제 (Unsoulbound)', value: 'unsoulbound', description: '소울바운드(귀속) 아이템을 제외해요.', default: filterType === 'unsoulbound' },
            { label: '귀속 해제 및 치장품 제외 (Unsoulbound Non-Cosmetic)', value: 'unsoulbound_non_cosmetic', description: '소울바운드 및 치장품을 제외해요.', default: filterType === 'unsoulbound_non_cosmetic' }
        ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    return { embed, row };
}

export const data = new SlashCommandBuilder()
    .setName('nw')
    .setDescription('유저의 하이픽셀 스카이블록 넷워스를 확인해요.')
    .addStringOption(option =>
        option.setName('username')
            .setDescription('마인크래프트 닉네임 (미입력시 내 닉네임을 확인해요.)')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('profile')
            .setDescription('프로필 이름 (미입력시 최근 프로필을 확인해요.)')
            .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    let username = interaction.options.getString('username')!;
    const profileNameInput = interaction.options.getString('profile');
    const discordId = interaction.user.id;
    const linkedUser = db.getUser(discordId);

    if (!username) {
        if (!linkedUser) {
            return interaction.editReply('⚠️ 연동된 마인크래프트 닉네임이 없어요. `/link`를 먼저 입력하시거나 닉네임을 직접 입력해 주세요.');
        }
        username = linkedUser.mcUsername;
    }

    try {
        const { uuid, correctedName, allProfiles } = await fetchSkyblockRawData(username);
        const targetUsername = correctedName;

        let activeProfile;
        if (profileNameInput) {
            activeProfile = allProfiles.find((p: any) => p.cute_name.toLowerCase() === profileNameInput.toLowerCase());
            if (!activeProfile) {
                return interaction.editReply(`⚠️ \`${targetUsername}\` 님에게 \`${profileNameInput}\` 프로필이 존재하지 않습니다.`);
            }
        } else {
            activeProfile = allProfiles.find((p: any) => p.selected) || allProfiles[0];
        }

        const profileId = activeProfile.profile_id;
        const cuteName = activeProfile.cute_name;

        const museumData = await fetchProfileDetailData(uuid, profileId);
        const profileData = activeProfile.members[uuid];
        const bankBalance = activeProfile.banking?.balance || 0;

        const networthManager = new ProfileNetworthCalculator(profileData, museumData, bankBalance);
        let currentNetworthData = await networthManager.getNetworth();
    
        const totalNetworth = currentNetworthData.networth || 0;
    
        // targetUsername이 DB에 연동되어 있는지 확인
        const targetDiscordId = db.getDiscordIdByUsername(targetUsername);

        let rankDisplay = "";
        if (targetDiscordId) {
            db.updateScore(targetDiscordId, targetUsername, totalNetworth);

            const targetRank = db.getRank(totalNetworth);
            rankDisplay = `\n🏆 **순위: ${targetRank}위**`;
        } else {
            rankDisplay = `\n🏆 *(순위 미등록)*`;
        }
    
        const { embed, row } = buildEmbedAndRow(cuteName, username, currentNetworthData, 'normal', rankDisplay);
        
        const response = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect,
            idle: 30_000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: '⚠️ 명령어를 사용한 사람만 필터를 바꿀 수 있어요.', ephemeral: true });
                return;
            }

            const selectedFilter = i.values[0];

            // 치장품 제외 로직
            if (selectedFilter.includes('non_cosmetic')) {
                currentNetworthData = await networthManager.getNonCosmeticNetworth();
            } else {
                currentNetworthData = await networthManager.getNetworth();
            }

            const updatedUI = buildEmbedAndRow(cuteName, username, currentNetworthData, selectedFilter, rankDisplay);

            await i.update({ embeds: [updatedUI.embed], components: [updatedUI.row] });
        });

        collector.on('end', async () => {
            // 30초 만료 시 드롭다운 메뉴 제거
            await interaction.editReply({ components: [] }).catch(() => {});
        });

    } catch (error: any) {
        if (error.message === 'API_KEY_MISSING') {
            await interaction.editReply('⚠️ 관리자에게 문의해주세요. \`API_KEY_MISSING\`');
        } else if (error.message === 'INVALID_USERNAME') {
            await interaction.editReply('⚠️ 존재하지 않는 플레이어에요.');
        } else if (error.message === 'NO_PROFILES') {
            await interaction.editReply('⚠️ 스카이블록 프로필이 없는 플레이어에요.');
        } else {
            logger.error('COMMAND', `/nw 실행 중 오류: ${error.message}`);
            await interaction.editReply('⚠️ 데이터를 불러오던 중 오류가 발생했어요.');
        }
    }
}