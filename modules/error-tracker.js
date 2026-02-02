/**
 * 에러 추적 모듈
 * - 테스트 중 발생한 에러를 수집
 * - 테스트 종료 후 JSON 파일로 저장
 */

// 전역 에러 저장소 (각 VU마다 독립적)
const errors = [];

/**
 * 에러 정보 기록
 * @param {Object} errorInfo - 에러 정보
 * @param {string} errorInfo.stage - 에러 발생 단계 (예: 'chat', 'summary', 'image')
 * @param {number} errorInfo.storyId - 스토리 ID (있는 경우)
 * @param {number} errorInfo.pageId - 페이지 ID (있는 경우)
 * @param {string} errorInfo.requestId - 요청 ID (있는 경우)
 * @param {number} errorInfo.statusCode - HTTP 상태 코드
 * @param {string} errorInfo.errorMessage - 에러 메시지
 * @param {string} errorInfo.timestamp - 발생 시각
 */
export function trackError(errorInfo) {
  const errorRecord = {
    timestamp: new Date().toISOString(),
    vuId: __VU,  // k6의 Virtual User ID
    iteration: __ITER,  // 현재 iteration 번호
    ...errorInfo
  };

  errors.push(errorRecord);

  // 콘솔에도 출력 (디버깅용)
  console.error(`[ERROR TRACKED] ${errorInfo.stage}: ${errorInfo.errorMessage}`);
  if (errorInfo.storyId) {
    console.error(`  └─ storyId: ${errorInfo.storyId}`);
  }
  if (errorInfo.pageId) {
    console.error(`  └─ pageId: ${errorInfo.pageId}`);
  }
  if (errorInfo.requestId) {
    console.error(`  └─ requestId: ${errorInfo.requestId}`);
  }
}

/**
 * 모든 에러 반환
 */
export function getErrors() {
  return errors;
}

/**
 * 에러 개수 반환
 */
export function getErrorCount() {
  return errors.length;
}

/**
 * 단계별 에러 통계
 */
export function getErrorStats() {
  const stats = {};

  errors.forEach(error => {
    const stage = error.stage;
    if (!stats[stage]) {
      stats[stage] = {
        count: 0,
        storyIds: new Set(),
        pageIds: new Set(),
        statusCodes: {}
      };
    }

    stats[stage].count++;

    if (error.storyId) {
      stats[stage].storyIds.add(error.storyId);
    }
    if (error.pageId) {
      stats[stage].pageIds.add(error.pageId);
    }
    if (error.statusCode) {
      stats[stage].statusCodes[error.statusCode] =
        (stats[stage].statusCodes[error.statusCode] || 0) + 1;
    }
  });

  // Set을 배열로 변환
  Object.keys(stats).forEach(stage => {
    stats[stage].storyIds = Array.from(stats[stage].storyIds);
    stats[stage].pageIds = Array.from(stats[stage].pageIds);
  });

  return stats;
}
