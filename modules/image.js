import http from "k6/http";
import { check, sleep } from "k6";
import { SERVER_URL, TEST_DATA } from "../config.js";
import { trackError } from "./error-tracker.js";

/**
 * Image 생성 요청만 전송 (폴링 없음, 요청 성공 시 바로 성공 처리)
 */
export function generateImage(token, pageId) {
  if (!pageId) {
    console.log("❌ 페이지 ID가 없어서 Image를 생성할 수 없습니다");
    return null;
  }

  const imageStyle =
    TEST_DATA.imageStyles[
      Math.floor(Math.random() * TEST_DATA.imageStyles.length)
    ];

  const imageData = {
    prompt: "동화책 한 장면",
    imageStyle: imageStyle,
    isDefaultStyle: true,
    personaIds: [],
  };

  // 생성 요청
  const genResponse = http.post(
    `${SERVER_URL}/api/v1/images/${pageId}/generate`,
    JSON.stringify(imageData),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const genSuccess = check(genResponse, {
    "✅ Image 생성 요청 성공": (r) => r.status === 200,
  });

  if (!genSuccess) {
    console.log(`❌ Image 생성 요청 실패: ${genResponse.status}`);
    trackError({
      stage: "image_generate",
      pageId: pageId,
      statusCode: genResponse.status,
      errorMessage: `Image 생성 요청 실패 (status: ${genResponse.status})`,
    });
    return null;
  }

  // 요청 성공 시 바로 성공 처리 (폴링 없음)
  try {
    const genResult = JSON.parse(genResponse.body);
    return { requestId: genResult.requestId };
  } catch (e) {
    console.log("❌ Image 생성 응답 파싱 실패");
    return null;
  }
}

/**
 * 이미지 생성 요청만 보내고 requestId 반환 (폴링 제외)
 */
function requestImageGeneration(token, pageId) {
  if (!pageId) {
    console.log("❌ 페이지 ID가 없어서 Image를 생성할 수 없습니다");
    return null;
  }

  const imageStyle =
    TEST_DATA.imageStyles[
      Math.floor(Math.random() * TEST_DATA.imageStyles.length)
    ];

  const imageData = {
    prompt: "동화책 한 장면",
    imageStyle: imageStyle,
    isDefaultStyle: true,
    personaIds: [],
  };

  const genResponse = http.post(
    `${SERVER_URL}/api/v1/images/${pageId}/generate`,
    JSON.stringify(imageData),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const genSuccess = check(genResponse, {
    "✅ Image 생성 요청 성공": (r) => r.status === 200,
  });

  if (!genSuccess) {
    console.log(
      `❌ Image 생성 요청 실패 (pageId: ${pageId}): ${genResponse.status}`
    );
    trackError({
      stage: "image_generate",
      pageId: pageId,
      statusCode: genResponse.status,
      errorMessage: `Image 생성 요청 실패 (status: ${genResponse.status})`,
    });
    return null;
  }

  try {
    const genResult = JSON.parse(genResponse.body);
    return {
      requestId: genResult.requestId,
      pageId: pageId,
    };
  } catch (e) {
    console.log("❌ Image 생성 응답 파싱 실패");
    return null;
  }
}

/**
 * 여러 이미지를 병렬로 생성 요청만 전송 (폴링 없음, 요청 성공 시 바로 성공 처리)
 * @param {string} token - 인증 토큰
 * @param {Array} pages - 페이지 목록 (각 페이지는 pageId를 가져야 함)
 * @param {number} concurrentCount - 한 번에 동시에 요청할 개수
 * @param {number} repeatCount - 성공한 페이지에 대해 반복 요청할 횟수
 */
export function generateImagesParallel(
  token,
  pages,
  concurrentCount,
  repeatCount
) {
  if (!pages || pages.length === 0) {
    console.log("❌ 페이지가 없어서 이미지를 생성할 수 없습니다");
    return [];
  }

  // 실제 생성할 페이지 수 계산
  const actualCount = Math.min(concurrentCount, pages.length);
  const targetPages = pages.slice(0, actualCount);

  const results = [];

  // repeatCount만큼 반복
  for (let round = 0; round < repeatCount; round++) {
    // 모든 페이지에 대해 생성 요청을 빠르게 연속으로 보냄
    const requests = [];
    for (let i = 0; i < targetPages.length; i++) {
      const page = targetPages[i];

      const requestInfo = requestImageGeneration(token, page.pageId);
      if (requestInfo) {
        requests.push(requestInfo);
      }

      // 요청 사이에 아주 짧은 간격 (서버 부하 분산)
      if (i < targetPages.length - 1) {
        sleep(0.1);
      }
    }

    if (requests.length === 0) {
      console.log("❌ 모든 생성 요청이 실패했습니다");
      continue;
    }

    // 요청 성공 시 바로 성공 처리 (폴링 없음)
    requests.forEach((req) => {
      results.push({
        pageId: req.pageId,
        requestId: req.requestId,
        round: round + 1,
      });
    });

    // 다음 라운드 전에 대기
    if (round < repeatCount - 1) {
      sleep(2);
    }
  }

  return results;
}
