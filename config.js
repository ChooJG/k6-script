// ===================================
// 📋 테스트 설정 및 상수
// ===================================

export const SERVER_URL = "https://dev-api.dreamai.studio";

// export const SERVER_URL = 'http://localhost:8080';

export const TEST_USERS = [
  { username: "string1", password: "string" },
  { username: "string2", password: "string" },
  { username: "string3", password: "string" },
];

export const POLLING_CONFIG = {
  summary: {
    maxAttempts: 60,
    intervalMs: 2000,
    timeoutMs: 120000,
  },
  persona: {
    maxAttempts: 60,
    intervalMs: 2000,
    timeoutMs: 120000,
  },
  page: {
    maxAttempts: 90,
    intervalMs: 3000,
    timeoutMs: 180000,
  },
  image: {
    maxAttempts: 120,
    intervalMs: 500,
    timeoutMs: 300000,
  },
};

export const TEST_DATA = {
  messages: [
    "네, 좋아요!",
    "재미있을 것 같아요.",
    "그거 해보고 싶어요.",
    "다른 것도 있나요?",
    "계속 진행해주세요.",
    "좀 더 자세히 알려주세요.",
  ],
  genres: ["판타지", "로맨스", "미스터리", "모험", "SF"],
  themes: ["우정", "사랑", "성장", "모험", "꿈"],
  imageStyles: [
    "WATERCOLOR",
    "ANIME",
    "COMIC_BOOK",
    "FANTASY_ART",
    "PIXEL_ART",
  ],
};

export const IMAGE_GENERATION_CONFIG = {
  // 병렬 이미지 생성 설정
  // concurrentImages: 한 번에 동시에 생성 요청을 보낼 이미지 개수 (예: 5개의 서로 다른 페이지에 동시 요청)
  //                   0으로 설정하면 이미지 생성을 건너뜁니다.
  // repeatCount: 각 페이지에 대해 반복 요청할 횟수 (예: 2이면 동일한 페이지들에 총 2번 요청)
  concurrentImages: 5,
  repeatCount: 2,
};

export const LOAD_TEST_OPTIONS = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "3m", target: 100 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<15000"],
    http_req_failed: ["rate<0.15"],
    full_flow_duration: ["p(90)<300000"],
  },
  summaryTrendStats: [
    "avg",
    "min",
    "med",
    "max",
    "p(50)",
    "p(90)",
    "p(95)",
    "p(99)",
  ],
};
