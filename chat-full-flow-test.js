import { sleep } from "k6";
import { Trend } from "k6/metrics";
import {
  SERVER_URL,
  LOAD_TEST_OPTIONS,
  IMAGE_GENERATION_CONFIG,
} from "./config.js";
import { login } from "./modules/auth.js";
import { startChat, setGenre, setTheme, sendMessage } from "./modules/chat.js";
import { generateSummary } from "./modules/summary.js";
import { generatePersona } from "./modules/persona.js";
import { generatePages } from "./modules/page.js";
import { generateImage, generateImagesParallel } from "./modules/image.js";
import { getErrors, getErrorStats } from "./modules/error-tracker.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

const fullFlowDuration = new Trend("full_flow_duration");
export const options = LOAD_TEST_OPTIONS;

let userToken = "";
let currentStoryId = null;

// ===================================
// 🔇 메인 함수 (No Logs, Pure Logic)
// ===================================
export default function () {
  const flowStartTime = Date.now();

  // 1. 로그인
  if (!userToken) {
    userToken = login();
    if (!userToken) return; // 실패 시 조용히 종료 (에러 트래커가 기록함)
    sleep(1);
  }

  // 2. 채팅 시작
  if (!currentStoryId) {
    currentStoryId = startChat(userToken);
    if (!currentStoryId) return;
    sleep(1);
  }

  // 3. 장르 & 4. 주제 설정
  if (!setGenre(userToken, currentStoryId)) return;
  sleep(1);
  if (!setTheme(userToken, currentStoryId)) return;
  sleep(1);

  // 5. 메시지 전송 (6회)
  for (let i = 0; i < 6; i++) {
    if (!sendMessage(userToken, currentStoryId)) return;
    sleep(1 + Math.random() * 2);
  }

  // 6 ~ 8. 생성 요청만 전송 (Summary, Persona, Page) - 폴링 없음
  if (!generateSummary(userToken, currentStoryId)) return;
  if (!generatePersona(userToken, currentStoryId)) return;

  const pageData = generatePages(userToken, currentStoryId);
  if (!pageData) return;

  // 9. 이미지 병렬 생성 요청만 전송 (폴링 없음)
  const { concurrentImages, repeatCount } = IMAGE_GENERATION_CONFIG;
  if ((concurrentImages || 0) > 0) {
    // 더미 페이지 데이터 생성 (실제 pageId는 서버에서 생성되므로 임시 값 사용)
    const dummyPages = Array.from({ length: concurrentImages }, (_, i) => ({
      pageId: `dummy-${currentStoryId}-${i}`,
    }));
    generateImagesParallel(
      userToken,
      dummyPages,
      concurrentImages,
      repeatCount || 1
    );
  }

  fullFlowDuration.add(Date.now() - flowStartTime);
  currentStoryId = null;

  // 프로세스 완료 후 1분 대기 후 다음 iteration 시작
  sleep(60);
}

// ===================================
// ℹ️ 시작/종료 시에만 최소 출력
// ===================================
export function setup() {
  console.log(
    `🚀 부하 테스트 시작 (VUS: ${Math.max(
      ...options.stages.map((s) => s.target)
    )})`
  );
}

export function teardown() {
  const errorStats = getErrorStats();
  const totalErrors = Object.values(errorStats).reduce(
    (sum, s) => sum + s.count,
    0
  );

  console.log("🏁 테스트 완료.");
  if (totalErrors > 0) {
    console.log(
      `⚠️ 총 에러: ${totalErrors}건 (상세 내용은 error-report.json 참고)`
    );
  } else {
    console.log("✅ 에러 없음.");
  }
}

export function handleSummary(data) {
  const errors = getErrors();
  const errorReport = {
    summary: {
      totalErrors: errors.length,
      timestamp: new Date().toISOString(),
    },
    errorsByStage: getErrorStats(),
    detailedErrors: errors,
  };

  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "error-report.json": JSON.stringify(errorReport, null, 2),
  };
}
