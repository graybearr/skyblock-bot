import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import { logger } from './utils/logger';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { deployCommands } from './utils/deploy-commands';

dotenv.config();

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds],
    presence: {
        status: 'dnd',
        activities: [{
            name: '잠시만 기다려주세요...',
            type: ActivityType.Playing,
        }]
    }
});
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

client.once('clientReady', async () => {
    logger.info('SYSTEM', `봇 클라이언트에 로그인합니다: ${client.user?.tag}`);
    
    if (process.env.CLIENT_ID && process.env.DISCORD_TOKEN) {
        await deployCommands(process.env.CLIENT_ID, process.env.DISCORD_TOKEN);
    } else {
        logger.error('ERROR', '.env 파일 내 필수 환경변수가 존재하지 않습니다.');
    }

    client.user?.setPresence({
        status: 'online',
        activities: [{
            name: 'Skyblock',
            type: ActivityType.Playing
        }]
    });
    
    logger.info('SYSTEM', '이제 봇을 사용할 수 있어요.');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '명령어 실행 중 오류가 발생했습니다.', ephemeral: true });
        } else {
            await interaction.reply({ content: '명령어 실행 중 오류가 발생했습니다.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

declare module 'discord.js' {
    export interface Client {
        commands: Collection<unknown, any>;
    }
}