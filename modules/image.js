import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { SERVER_URL, POLLING_CONFIG, TEST_DATA, IMAGE_GENERATION_CONFIG } from '../config.js';
import { trackError } from './error-tracker.js';

const imageGenerationDuration = new Trend('image_generation_duration');

/**
 * Image 생성 요청 + 폴링
 */
export function generateImage(token, pageId) {
  if (!pageId) {
    console.log('❌ 페이지 ID가 없어서 Image를 생성할 수 없습니다');
    return null;
  }

  const imageStyle = TEST_DATA.imageStyles[Math.floor(Math.random() * TEST_DATA.imageStyles.length)];

  const imageData = {
    prompt: "동화책 한 장면",
    imageStyle: imageStyle,
    isDefaultStyle: true,
    personaIds: []
  };

  // 1. 생성 요청
  const genResponse = http.post(
    `${SERVER_URL}/api/v1/images/${pageId}/generate`,
    JSON.stringify(imageData),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const genSuccess = check(genResponse, {
    '✅ Image 생성 요청 성공': (r) => r.status === 200,
  });

  if (!genSuccess) {
    console.log(`❌ Image 생성 요청 실패: ${genResponse.status}`);
    trackError({
      stage: 'image_generate',
      pageId: pageId,
      statusCode: genResponse.status,
      errorMessage: `Image 생성 요청 실패 (status: ${genResponse.status})`
    });
    return null;
  }

  let requestId = null;
  try {
    const genResult = JSON.parse(genResponse.body);
    requestId = genResult.requestId;
    console.log(`🖼️ Image 생성 요청 완료 (requestId: ${requestId}), 폴링 시작...`);
  } catch (e) {
    console.log('❌ Image 생성 응답 파싱 실패');
    return null;
  }

  // 2. 폴링
  const startTime = Date.now();
  let attempts = 0;

  while (attempts < POLLING_CONFIG.image.maxAttempts) {
    sleep(POLLING_CONFIG.image.intervalMs / 1000);

    const pollResponse = http.get(
      `${SERVER_URL}/api/v1/images/status/${requestId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (pollResponse.status === 200) {
      try {
        const data = JSON.parse(pollResponse.body);

        if (data.isCompleted) {
          const duration = Date.now() - startTime;
          imageGenerationDuration.add(duration);
          console.log(`✅ Image 생성 완료 (${duration}ms, ${attempts}번 시도)`);
          return data;
        }

        if (data.isFailed) {
          console.log(`❌ Image 생성 실패: ${data.errorMessage}`);
          trackError({
            stage: 'image_generation_failed',
            pageId: pageId,
            requestId: requestId,
            statusCode: null,
            errorMessage: data.errorMessage || 'Image 생성 실패'
          });
          return null;
        }
      } catch (e) {
        console.log(`⚠️ Image 응답 파싱 실패 (시도 ${attempts})`);
      }
    }

    attempts++;
  }

  console.log('❌ Image 생성 타임아웃');
  trackError({
    stage: 'image_polling',
    pageId: pageId,
    requestId: requestId,
    statusCode: null,
    errorMessage: `Image 폴링 타임아웃 (${attempts}번 시도)`
  });
  return null;
}

/**
 * 이미지 생성 요청만 보내고 requestId 반환 (폴링 제외)
 */
function requestImageGeneration(token, pageId) {
  if (!pageId) {
    console.log('❌ 페이지 ID가 없어서 Image를 생성할 수 없습니다');
    return null;
  }

  const imageStyle = TEST_DATA.imageStyles[Math.floor(Math.random() * TEST_DATA.imageStyles.length)];

  const imageData = {
    prompt: "동화책 한 장면",
    imageStyle: imageStyle,
    isDefaultStyle: true,
    personaIds: []
  };

  const genResponse = http.post(
    `${SERVER_URL}/api/v1/images/${pageId}/generate`,
    JSON.stringify(imageData),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const genSuccess = check(genResponse, {
    '✅ Image 생성 요청 성공': (r) => r.status === 200,
  });

  if (!genSuccess) {
    console.log(`❌ Image 생성 요청 실패 (pageId: ${pageId}): ${genResponse.status}`);
    trackError({
      stage: 'image_generate',
      pageId: pageId,
      statusCode: genResponse.status,
      errorMessage: `Image 생성 요청 실패 (status: ${genResponse.status})`
    });
    return null;
  }

  try {
    const genResult = JSON.parse(genResponse.body);
    return {
      requestId: genResult.requestId,
      pageId: pageId,
      startTime: Date.now()
    };
  } catch (e) {
    console.log('❌ Image 생성 응답 파싱 실패');
    return null;
  }
}

/**
 * 여러 이미지를 병렬로 생성 (서로 다른 페이지에 동시 요청)
 * @param {string} token - 인증 토큰
 * @param {Array} pages - 페이지 목록 (각 페이지는 pageId를 가져야 함)
 * @param {number} concurrentCount - 한 번에 동시에 요청할 개수
 * @param {number} repeatCount - 성공한 페이지에 대해 반복 요청할 횟수
 */
export function generateImagesParallel(token, pages, concurrentCount, repeatCount) {
  if (!pages || pages.length === 0) {
    console.log('❌ 페이지가 없어서 이미지를 생성할 수 없습니다');
    return [];
  }

  // 실제 생성할 페이지 수 계산
  const actualCount = Math.min(concurrentCount, pages.length);
  const targetPages = pages.slice(0, actualCount);

  console.log(`🚀 병렬 이미지 생성 시작: ${actualCount}개 페이지, ${repeatCount}번 반복`);

  const results = [];
  const pageRequestCounts = {}; // 각 페이지별 요청 횟수 추적

  // 페이지별 요청 횟수 초기화
  targetPages.forEach(page => {
    pageRequestCounts[page.pageId] = 0;
  });

  // repeatCount만큼 반복
  for (let round = 0; round < repeatCount; round++) {
    console.log(`\n📍 라운드 ${round + 1}/${repeatCount}`);

    // 1단계: 모든 페이지에 대해 생성 요청을 빠르게 연속으로 보냄
    const requests = [];
    for (let i = 0; i < targetPages.length; i++) {
      const page = targetPages[i];
      console.log(`  📤 페이지 ${i + 1}/${targetPages.length} 생성 요청 (pageId: ${page.pageId})`);

      const requestInfo = requestImageGeneration(token, page.pageId);
      if (requestInfo) {
        requests.push(requestInfo);
        pageRequestCounts[page.pageId]++;
      }

      // 요청 사이에 아주 짧은 간격 (서버 부하 분산)
      if (i < targetPages.length - 1) {
        sleep(0.1);
      }
    }

    if (requests.length === 0) {
      console.log('❌ 모든 생성 요청이 실패했습니다');
      continue;
    }

    console.log(`  ✅ ${requests.length}개 요청 전송 완료, 폴링 시작...`);

    // 2단계: 모든 요청을 동시에 폴링
    const activeRequests = [...requests];
    let pollingAttempt = 0;

    while (activeRequests.length > 0 && pollingAttempt < POLLING_CONFIG.image.maxAttempts) {
      sleep(POLLING_CONFIG.image.intervalMs / 1000);

      // 각 활성 요청에 대해 상태 확인
      for (let i = activeRequests.length - 1; i >= 0; i--) {
        const req = activeRequests[i];

        const pollResponse = http.get(
          `${SERVER_URL}/api/v1/images/status/${req.requestId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (pollResponse.status === 200) {
          try {
            const data = JSON.parse(pollResponse.body);

            if (data.isCompleted) {
              const duration = Date.now() - req.startTime;
              imageGenerationDuration.add(duration);
              console.log(`  ✅ 이미지 생성 완료 (pageId: ${req.pageId}, ${duration}ms, 라운드 ${round + 1})`);

              results.push({
                pageId: req.pageId,
                requestId: req.requestId,
                duration: duration,
                round: round + 1,
                data: data
              });

              // 완료된 요청은 목록에서 제거
              activeRequests.splice(i, 1);
            } else if (data.isFailed) {
              console.log(`  ❌ 이미지 생성 실패 (pageId: ${req.pageId}): ${data.errorMessage}`);
              trackError({
                stage: 'image_generation_failed',
                pageId: req.pageId,
                requestId: req.requestId,
                statusCode: null,
                errorMessage: data.errorMessage || 'Image 생성 실패'
              });

              // 실패한 요청은 목록에서 제거
              activeRequests.splice(i, 1);
            }
            // 아직 진행 중이면 계속 폴링
          } catch (e) {
            console.log(`  ⚠️ 응답 파싱 실패 (pageId: ${req.pageId})`);
          }
        }
      }

      pollingAttempt++;

      if (activeRequests.length > 0) {
        console.log(`  ⏳ 폴링 중... (남은 요청: ${activeRequests.length}개, 시도: ${pollingAttempt}/${POLLING_CONFIG.image.maxAttempts})`);
      }
    }

    // 타임아웃된 요청 처리
    if (activeRequests.length > 0) {
      console.log(`  ⚠️ ${activeRequests.length}개 요청이 타임아웃되었습니다`);
      activeRequests.forEach(req => {
        trackError({
          stage: 'image_polling',
          pageId: req.pageId,
          requestId: req.requestId,
          statusCode: null,
          errorMessage: `Image 폴링 타임아웃 (${pollingAttempt}번 시도)`
        });
      });
    }

    // 다음 라운드 전에 대기
    if (round < repeatCount - 1) {
      console.log(`  ⏸️ 다음 라운드까지 대기...`);
      sleep(2);
    }
  }

  console.log(`\n🎉 병렬 이미지 생성 완료: 총 ${results.length}개 성공`);

  // 페이지별 요청 횟수 출력
  console.log('\n📊 페이지별 요청 통계:');
  Object.keys(pageRequestCounts).forEach(pageId => {
    const count = pageRequestCounts[pageId];
    const successCount = results.filter(r => r.pageId === pageId).length;
    console.log(`  - pageId ${pageId}: ${successCount}/${count} 성공`);
  });

  return results;
}
