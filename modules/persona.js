import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { SERVER_URL, POLLING_CONFIG } from '../config.js';
import { trackError } from './error-tracker.js';

const personaGenerationDuration = new Trend('persona_generation_duration');

/**
 * Persona 생성 요청 + 폴링
 */
export function generatePersona(token, storyId) {
  if (!storyId) {
    console.log('❌ 스토리 ID가 없어서 Persona를 생성할 수 없습니다');
    return null;
  }

  // 1. 생성 요청
  const genResponse = http.post(
    `${SERVER_URL}/api/v1/persona/${storyId}/generate`,
    null,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const genSuccess = check(genResponse, {
    '✅ Persona 생성 요청 성공': (r) => r.status === 202,
  });

  if (!genSuccess) {
    console.log(`❌ Persona 생성 요청 실패: ${genResponse.status}`);
    trackError({
      stage: 'persona_generate',
      storyId: storyId,
      statusCode: genResponse.status,
      errorMessage: `Persona 생성 요청 실패 (status: ${genResponse.status})`
    });
    return null;
  }

  console.log(`👥 Persona 생성 요청 완료, 폴링 시작...`);

  // 2. 폴링
  const startTime = Date.now();
  let attempts = 0;

  while (attempts < POLLING_CONFIG.persona.maxAttempts) {
    sleep(POLLING_CONFIG.persona.intervalMs / 1000);

    const pollResponse = http.get(
      `${SERVER_URL}/api/v1/persona/${storyId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (pollResponse.status === 200) {
      try {
        const data = JSON.parse(pollResponse.body);

        // 생성 완료 체크: 배열에 데이터가 있는지 확인
        if (Array.isArray(data) && data.length > 0) {
          const duration = Date.now() - startTime;
          personaGenerationDuration.add(duration);
          console.log(`✅ Persona 생성 완료 (${duration}ms, ${data.length}개, ${attempts}번 시도)`);
          return data;
        }
      } catch (e) {
        console.log(`⚠️ Persona 응답 파싱 실패 (시도 ${attempts})`);
      }
    }

    attempts++;
  }

  console.log('❌ Persona 생성 타임아웃');
  trackError({
    stage: 'persona_polling',
    storyId: storyId,
    statusCode: null,
    errorMessage: `Persona 폴링 타임아웃 (${attempts}번 시도)`
  });
  return null;
}
