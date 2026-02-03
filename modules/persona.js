import http from "k6/http";
import { check } from "k6";
import { SERVER_URL } from "../config.js";
import { trackError } from "./error-tracker.js";

/**
 * Persona 생성 요청만 전송 (폴링 없음, 요청 성공 시 바로 성공 처리)
 */
export function generatePersona(token, storyId) {
  if (!storyId) {
    console.log("❌ 스토리 ID가 없어서 Persona를 생성할 수 없습니다");
    return null;
  }

  // 1. 생성 요청
  const genResponse = http.post(
    `${SERVER_URL}/api/v1/persona/${storyId}/generate`,
    null,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const genSuccess = check(genResponse, {
    "✅ Persona 생성 요청 성공": (r) => r.status === 202,
  });

  if (!genSuccess) {
    console.log(`❌ Persona 생성 요청 실패: ${genResponse.status}`);
    trackError({
      stage: "persona_generate",
      storyId: storyId,
      statusCode: genResponse.status,
      errorMessage: `Persona 생성 요청 실패 (status: ${genResponse.status})`,
    });
    return null;
  }

  // 요청 성공 시 바로 성공 처리 (폴링 없음)
  return true;
}
