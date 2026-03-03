import { logger } from '../utils/logger';
import axios from 'axios';

export async function validateMinecraftUser(username: string) {
    try {
        const res = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        if (res.status === 200 && res.data) {
            return {
                uuid: res.data.id,
                name: res.data.name // 대소문자가 교정된 실제 닉네임
            };
        }
        return null;
    } catch (error: any) {
        if (error.response?.status === 404) return null;
        logger.error('API', `모장 API 확인 중 오류: ${error.message}`);
        throw new Error('MOJANG_API_ERROR');
    }
}

export async function fetchSkyblockRawData(username: string) {
    const apiKey = process.env.HYPIXEL_API_KEY;
    if (!apiKey) throw new Error('API_KEY_MISSING');

    // 모장 API 검증
    const mojangUser = await validateMinecraftUser(username);
    if (!mojangUser) throw new Error('INVALID_USERNAME');
    const { uuid } = mojangUser;

    // 하이픽셀 프로필 목록 가져오기
    const hypixelRes = await axios.get(`https://api.hypixel.net/v2/skyblock/profiles?key=${apiKey}&uuid=${uuid}`).catch(() => null);
    const profiles = hypixelRes?.data?.profiles;
    if (!profiles || profiles.length === 0) throw new Error('NO_PROFILES');

    return {
        uuid,
        correctedName: mojangUser.name, // 대소문자 교정된 이름
        allProfiles: profiles // 전체 프로필 리스트 반환
    };
}

export async function fetchProfileDetailData(uuid: string, profileId: string) {
    const apiKey = process.env.HYPIXEL_API_KEY;
    let museumData = null;

    try {
        const museumRes = await axios.get(`https://api.hypixel.net/v2/skyblock/museum?key=${apiKey}&profile=${profileId}`);
        if (museumRes.data && museumRes.data.members) {
            museumData = museumRes.data.members[uuid];
        }
    } catch (error) {
        logger.warn('SYSTEM', `Museum 데이터를 가져오지 못했습니다. (Profile ID: ${profileId})`);
    }

    return museumData;
}