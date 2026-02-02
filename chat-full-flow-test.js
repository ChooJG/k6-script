import { sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { SERVER_URL, LOAD_TEST_OPTIONS, IMAGE_GENERATION_CONFIG } from './config.js';
import { login } from './modules/auth.js';
import { startChat, setGenre, setTheme, sendMessage } from './modules/chat.js';
import { generateSummary } from './modules/summary.js';
import { generatePersona } from './modules/persona.js';
import { generatePages } from './modules/page.js';
import { generateImage, generateImagesParallel } from './modules/image.js';
import { getErrors, getErrorStats } from './modules/error-tracker.js';

// ===================================
// 📊 전체 플로우 메트릭
// ===================================
const fullFlowDuration = new Trend('full_flow_duration');

// ===================================
// ⚙️ 테스트 설정
// ===================================
export const options = LOAD_TEST_OPTIONS;

// ===================================
// 🔐 전역 상태
// ===================================
let userToken = '';
let currentStoryId = null;

// ===================================
// 🎯 메인 테스트 함수
// ===================================
export default function() {
  const flowStartTime = Date.now();

  // 1. 로그인
  if (!userToken) {
    userToken = login();
    if (!userToken) {
      console.log('❌ 로그인 실패로 테스트 중단');
      return;
    }
    sleep(1);
  }

  // 2. 채팅 시작
  if (!currentStoryId) {
    currentStoryId = startChat(userToken);
    if (!currentStoryId) {
      console.log('❌ 채팅 시작 실패로 테스트 중단');
      return;
    }
    sleep(1);
  }

  // 3. 장르 설정
  if (!setGenre(userToken, currentStoryId)) {
    console.log('❌ 장르 설정 실패로 테스트 중단');
    return;
  }
  sleep(1);

  // 4. 주제 설정
  if (!setTheme(userToken, currentStoryId)) {
    console.log('❌ 주제 설정 실패로 테스트 중단');
    return;
  }
  sleep(1);

  // 5. 메시지 전송 (6회)
  for (let i = 0; i < 6; i++) {
    if (!sendMessage(userToken, currentStoryId)) {
      console.log(`❌ 메시지 전송 실패 (${i + 1}회차)`);
      return;
    }
    sleep(1 + Math.random() * 2); // 1-3초 랜덤 대기
  }

  // 6. Summary 생성 + 폴링
  const summaryData = generateSummary(userToken, currentStoryId);
  if (!summaryData) {
    console.log('❌ Summary 생성 실패로 테스트 중단');
    return;
  }

  // 7. Persona 생성 + 폴링
  const personaData = generatePersona(userToken, currentStoryId);
  if (!personaData) {
    console.log('❌ Persona 생성 실패로 테스트 중단');
    return;
  }

  // 8. Page 생성 + 폴링
  const pageData = generatePages(userToken, currentStoryId);
  if (!pageData) {
    console.log('❌ Page 생성 실패로 테스트 중단');
    return;
  }

  // 9. Image 생성 + 폴링 (병렬 처리)
  if (pageData.pageContentDtoList && pageData.pageContentDtoList.length > 0) {
    const totalPages = pageData.pageContentDtoList.length;
    const concurrentCount = IMAGE_GENERATION_CONFIG.concurrentImages || 0;
    const repeatCount = IMAGE_GENERATION_CONFIG.repeatCount || 1;

    // 0이면 이미지 생성 건너뛰기
    if (concurrentCount === 0) {
      console.log('⏭️ 이미지 생성 건너뛰기 (설정: concurrentImages = 0)');
    } else {
      console.log(`🖼️ 병렬 이미지 생성 시작 (전체 ${totalPages}개 페이지 중)`);
      console.log(`   - 동시 요청 개수: ${concurrentCount}`);
      console.log(`   - 반복 횟수: ${repeatCount}`);

      const results = generateImagesParallel(
        userToken,
        pageData.pageContentDtoList,
        concurrentCount,
        repeatCount
      );

      console.log(`✅ 이미지 생성 완료: ${results.length}개 성공`);
    }
  }

  // 전체 플로우 완료!
  const flowDuration = Date.now() - flowStartTime;
  fullFlowDuration.add(flowDuration);
  console.log(`🎉 전체 플로우 완료! (${flowDuration}ms 소요)`);

  // 다음 스토리를 위해 리셋
  currentStoryId = null;
  sleep(3);
}

// ===================================
// 🚀 테스트 시작 전 안내
// ===================================
export function setup() {
  console.log('🚀 전체 플로우 부하테스트 시작!');
  console.log(`📍 서버: ${SERVER_URL}`);
  console.log(`📊 최대 동시 사용자: ${Math.max(...options.stages.map(s => s.target))}명`);
  console.log(`🖼️ 이미지 생성 설정:`);
  console.log(`   - 동시 요청 개수: ${IMAGE_GENERATION_CONFIG.concurrentImages}개`);
  console.log(`   - 반복 횟수: ${IMAGE_GENERATION_CONFIG.repeatCount}번`);
  console.log('📝 테스트 플로우:');
  console.log('   1. 로그인');
  console.log('   2. 채팅 시작');
  console.log('   3. 장르 설정');
  console.log('   4. 주제 설정');
  console.log('   5. 메시지 6회 전송');
  console.log('   6. Summary 생성 + 폴링');
  console.log('   7. Persona 생성 + 폴링');
  console.log('   8. Page 생성 + 폴링');
  console.log(`   9. Image 병렬 생성 + 폴링 (${IMAGE_GENERATION_CONFIG.concurrentImages}개 동시, ${IMAGE_GENERATION_CONFIG.repeatCount}번 반복)`);
  console.log('─'.repeat(50));
}

// ===================================
// 🏁 테스트 완료 후 정리
// ===================================
export function teardown() {
  console.log('─'.repeat(50));
  console.log('🏁 전체 플로우 테스트 완료!');
  console.log('📊 결과를 확인하세요:');
  console.log('   - 전체 플로우 소요 시간');
  console.log('   - 각 단계별 응답 시간');
  console.log('   - 실패율 및 타임아웃 발생 여부');

  // 에러 통계 출력
  const errorStats = getErrorStats();
  const errorCount = Object.keys(errorStats).reduce(
    (sum, stage) => sum + errorStats[stage].count, 0
  );

  if (errorCount > 0) {
    console.log('\n⚠️ 에러 발생 통계:');
    console.log(`   총 에러: ${errorCount}건`);
    Object.keys(errorStats).forEach(stage => {
      const stat = errorStats[stage];
      console.log(`   - ${stage}: ${stat.count}건`);
      if (stat.storyIds.length > 0) {
        console.log(`     └─ storyIds: ${stat.storyIds.join(', ')}`);
      }
      if (stat.pageIds.length > 0) {
        console.log(`     └─ pageIds: ${stat.pageIds.join(', ')}`);
      }
    });
    console.log('\n💾 에러 상세 정보는 error-report.json 파일을 확인하세요');
  } else {
    console.log('\n✅ 에러 없이 테스트 완료!');
  }
}

// ===================================
// 📄 테스트 결과 커스터마이징
// ===================================
export function handleSummary(data) {
  const errors = getErrors();
  const errorStats = getErrorStats();

  // 에러 리포트 생성
  const errorReport = {
    summary: {
      totalErrors: errors.length,
      testDuration: data.metrics.http_req_duration?.values?.avg || 0,
      totalRequests: data.metrics.http_reqs?.values?.count || 0,
      failedRequests: data.metrics.http_req_failed?.values?.passes || 0,
      timestamp: new Date().toISOString()
    },
    errorsByStage: errorStats,
    detailedErrors: errors
  };

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'error-report.json': JSON.stringify(errorReport, null, 2)
  };
}

// textSummary helper (k6 기본 제공)
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
