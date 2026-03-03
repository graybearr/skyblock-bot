import Database from 'better-sqlite3';
import path from 'path';
import { logger } from './logger';

const dbPath = path.resolve(process.cwd(), 'leaderboard.db');
const _db = new Database(dbPath);

try {
    _db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        discordId TEXT PRIMARY KEY,
        mcUsername TEXT,
        score INTEGER DEFAULT 0
      )
    `);
    logger.success('DATABASE', 'SQLite 테이블 확인 및 초기화 완료');
} catch (err: any) {
    logger.error('DATABASE', `테이블 초기화 실패: ${err.message}`);
}

const db = {
    getUser: (discordId: string) => {
        try {
            const result = _db.prepare('SELECT * FROM users WHERE discordId = ?').get(discordId) as any;
            return result;
        } catch (err: any) {
            logger.error('DATABASE', `유저 (${discordId}) 조회 중 오류: ${err.message}`);
            return undefined;
        }
    },

    linkUser: (discordId: string, mcUsername: string) => {
        try {
            const stmt = _db.prepare(`
                INSERT INTO users (discordId, mcUsername) 
                VALUES (?, ?) 
                ON CONFLICT(discordId) DO UPDATE SET mcUsername = excluded.mcUsername
            `);
            const info = stmt.run(discordId, mcUsername);
            logger.success('DATABASE', `연동 정보 저장: <@${discordId}> -> ${mcUsername}`);
            return info;
        } catch (err: any) {
            logger.error('DATABASE', `연동 실패 (${mcUsername}): ${err.message}`);
            throw err;
        }
    },

    unlinkUser: (discordId: string) => {
        try {
            const stmt = _db.prepare('DELETE FROM users WHERE discordId = ?');
            const result = stmt.run(discordId);
            if (result.changes > 0) {
                logger.warn('DATABASE', `연동 데이터 삭제 완료: Discord ID ${discordId}`);
                return true;
            }
            return false;
        } catch (err: any) {
            logger.error('DATABASE', `연동 해제 중 오류: ${err.message}`);
            return false;
        }
    },

    getDiscordIdByUsername: (mcUsername: string): string | undefined => {
        try {
            const result = _db.prepare('SELECT discordId FROM users WHERE mcUsername = ?').get(mcUsername) as { discordId: string } | undefined;
            return result?.discordId;
        } catch (err: any) {
            logger.error('DATABASE', `연동 조회 중 오류: ${err.message}`);
            return undefined;
        }
    },

    updateScore: (discordId: string, mcUsername: string, score: number) => {
        try {
            const user = db.getUser(discordId);
            if (user && user.mcUsername?.toLowerCase() === mcUsername.toLowerCase()) {
                const stmt = _db.prepare('UPDATE users SET score = ? WHERE discordId = ?');
                stmt.run(score, discordId);
                logger.success('DATABASE', `점수 업데이트: ${mcUsername} (${score.toLocaleString()})`);
                return true;
            }
            return false;
        } catch (err: any) {
            logger.error('DATABASE', `점수 업데이트 실패 (${mcUsername}): ${err.message}`);
            return false;
        }
    },

    getRank: (score: number) => {
        try {
            if (score <= 0) return 0;
            const result = _db.prepare(`
                SELECT COUNT(*) + 1 AS rank FROM users 
                WHERE score > ? AND mcUsername IS NOT NULL
            `).get(score) as { rank: number };
            return result.rank;
        } catch (err: any) {
            logger.error('DATABASE', `순위 계산 중 오류: ${err.message}`);
            return 0;
        }
    },

    getTop10: () => {
        try {
            return _db.prepare(`
                SELECT discordId, mcUsername, score FROM users 
                WHERE mcUsername IS NOT NULL AND score > 0 
                ORDER BY score DESC LIMIT 10
            `).all() as any[];
        } catch (err: any) {
            logger.error('DATABASE', `리더보드 데이터 로드 실패: ${err.message}`);
            return [];
        }
    }
};

export default db;