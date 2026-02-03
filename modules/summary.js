import http from "k6/http";
import { check } from "k6";
import { SERVER_URL } from "../config.js";
import { trackError } from "./error-tracker.js";

/**
 * Summary 생성 요청만 전송 (폴링 없음, 요청 성공 시 바로 성공 처리)
 */
export function generateSummary(token, storyId) {
  if (!storyId) {
    console.log("❌ 스토리 ID가 없어서 Summary를 생성할 수 없습니다");
    return null;
  }

  // 1. 생성 요청
  const genResponse = http.post(
    `${SERVER_URL}/api/v1/summaries/${storyId}/generate`,
    null,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const genSuccess = check(genResponse, {
    "✅ Summary 생성 요청 성공": (r) => r.status === 202,
  });

  if (!genSuccess) {
    console.log(`❌ Summary 생성 요청 실패: ${genResponse.status}`);
    trackError({
      stage: "summary_generate",
      storyId: storyId,
      statusCode: genResponse.status,
      errorMessage: `Summary 생성 요청 실패 (status: ${genResponse.status})`,
    });
    return null;
  }

  // 요청 성공 시 바로 성공 처리 (폴링 없음)
  return true;
}
