import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { SERVER_URL, POLLING_CONFIG } from '../config.js';
import { trackError } from './error-tracker.js';

const summaryGenerationDuration = new Trend('summary_generation_duration');

/**
 * Summary 생성 요청 + 폴링
 */
export function generateSummary(token, storyId) {
  if (!storyId) {
    console.log('❌ 스토리 ID가 없어서 Summary를 생성할 수 없습니다');
    return null;
  }

  // 1. 생성 요청
  const genResponse = http.post(
    `${SERVER_URL}/api/v1/summaries/${storyId}/generate`,
    null,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const genSuccess = check(genResponse, {
    '✅ Summary 생성 요청 성공': (r) => r.status === 202,
  });

  if (!genSuccess) {
    console.log(`❌ Summary 생성 요청 실패: ${genResponse.status}`);
    trackError({
      stage: 'summary_generate',
      storyId: storyId,
      statusCode: genResponse.status,
      errorMessage: `Summary 생성 요청 실패 (status: ${genResponse.status})`
    });
    return null;
  }

  console.log(`📝 Summary 생성 요청 완료, 폴링 시작...`);

  // 2. 폴링
  const startTime = Date.now();
  let attempts = 0;

  while (attempts < POLLING_CONFIG.summary.maxAttempts) {
    sleep(POLLING_CONFIG.summary.intervalMs / 1000);

    const pollResponse = http.get(
      `${SERVER_URL}/api/v1/summaries/${storyId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (pollResponse.status === 200) {
      try {
        const data = JSON.parse(pollResponse.body);

        // 생성 완료 체크: 모든 필드가 존재하는지 확인
        if (data && data.exposition && data.development &&
            data.crisis && data.climax && data.conclusion) {
          const duration = Date.now() - startTime;
          summaryGenerationDuration.add(duration);
          console.log(`✅ Summary 생성 완료 (${duration}ms, ${attempts}번 시도)`);
          return data;
        }
      } catch (e) {
        console.log(`⚠️ Summary 응답 파싱 실패 (시도 ${attempts})`);
      }
    }

    attempts++;
  }

  console.log('❌ Summary 생성 타임아웃');
  trackError({
    stage: 'summary_polling',
    storyId: storyId,
    statusCode: null,
    errorMessage: `Summary 폴링 타임아웃 (${attempts}번 시도)`
  });
  return null;
}
