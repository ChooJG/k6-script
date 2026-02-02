import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { SERVER_URL, POLLING_CONFIG } from '../config.js';
import { trackError } from './error-tracker.js';

const pageGenerationDuration = new Trend('page_generation_duration');

/**
 * Page 생성 요청 + 폴링
 */
export function generatePages(token, storyId) {
  if (!storyId) {
    console.log('❌ 스토리 ID가 없어서 Page를 생성할 수 없습니다');
    return null;
  }

  // 1. 생성 요청
  const genResponse = http.post(
    `${SERVER_URL}/api/v1/pages/${storyId}`,
    null,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const genSuccess = check(genResponse, {
    '✅ Page 생성 요청 성공': (r) => r.status === 202,
  });

  if (!genSuccess) {
    console.log(`❌ Page 생성 요청 실패: ${genResponse.status}`);
    trackError({
      stage: 'page_generate',
      storyId: storyId,
      statusCode: genResponse.status,
      errorMessage: `Page 생성 요청 실패 (status: ${genResponse.status})`
    });
    return null;
  }

  console.log(`📄 Page 생성 요청 완료, 폴링 시작...`);

  // 2. 폴링
  const startTime = Date.now();
  let attempts = 0;

  while (attempts < POLLING_CONFIG.page.maxAttempts) {
    sleep(POLLING_CONFIG.page.intervalMs / 1000);

    const pollResponse = http.get(
      `${SERVER_URL}/api/v1/pages/${storyId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (pollResponse.status === 200) {
      try {
        const data = JSON.parse(pollResponse.body);

        // 생성 완료 체크: pageContentDtoList에 데이터가 있는지 확인
        if (data && data.pageContentDtoList && data.pageContentDtoList.length > 0) {
          const duration = Date.now() - startTime;
          pageGenerationDuration.add(duration);
          console.log(`✅ Page 생성 완료 (${duration}ms, ${data.pageContentDtoList.length}개 페이지, ${attempts}번 시도)`);
          return data;
        }
      } catch (e) {
        console.log(`⚠️ Page 응답 파싱 실패 (시도 ${attempts})`);
      }
    }

    attempts++;
  }

  console.log('❌ Page 생성 타임아웃');
  trackError({
    stage: 'page_polling',
    storyId: storyId,
    statusCode: null,
    errorMessage: `Page 폴링 타임아웃 (${attempts}번 시도)`
  });
  return null;
}
