import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";
import { SERVER_URL, TEST_DATA } from "../config.js";

const chatStartDuration = new Trend("chat_start_duration");
const genreSetDuration = new Trend("genre_set_duration");
const themeSetDuration = new Trend("theme_set_duration");
const messageStandDuration = new Trend("message_send_duration");

/**
 * 채팅 시작
 */
export function startChat(token) {
  const chatData = {
    firstMessage: "안녕하세요! 새로운 이야기를 시작해볼까요?",
    secondMessage: "어떤 종류의 이야기를 만들고 싶으세요?",
    chatBranch: "READY",
    bookType: "KOREAN",
    secondaryLanguage: "KOREAN",
    storyId: null,
  };

  const response = http.post(
    `${SERVER_URL}/api/v1/chats`,
    JSON.stringify(chatData),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const success = check(response, {
    "✅ 채팅 시작 성공": (r) => r.status === 200,
  });

  chatStartDuration.add(response.timings.duration);

  if (success) {
    try {
      const result = JSON.parse(response.body);
      const storyId = result.storyId;
      return storyId;
    } catch (e) {
      console.log("❌ 채팅 시작 응답 파싱 실패");
      return null;
    }
  } else {
    console.log(`❌ 채팅 시작 실패: ${response.status}`);
    return null;
  }
}

/**
 * 장르 설정
 */
export function setGenre(token, storyId) {
  if (!storyId) {
    console.log("❌ 스토리 ID가 없어서 장르를 설정할 수 없습니다");
    return false;
  }

  const genre =
    TEST_DATA.genres[Math.floor(Math.random() * TEST_DATA.genres.length)];

  const genreData = {
    content: genre,
    isDirectInput: false,
  };

  const response = http.post(
    `${SERVER_URL}/api/v1/chats/${storyId}/genre`,
    JSON.stringify(genreData),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const success = check(response, {
    "✅ 장르 설정 성공": (r) => r.status === 200,
  });

  genreSetDuration.add(response.timings.duration);

  if (success) {
    return true;
  } else {
    console.log(`❌ 장르 설정 실패: ${response.status}`);
    return false;
  }
}

/**
 * 주제 설정
 */
export function setTheme(token, storyId) {
  if (!storyId) {
    console.log("❌ 스토리 ID가 없어서 주제를 설정할 수 없습니다");
    return false;
  }

  const theme =
    TEST_DATA.themes[Math.floor(Math.random() * TEST_DATA.themes.length)];

  const themeData = {
    content: theme,
    isDirectInput: false,
  };

  const response = http.post(
    `${SERVER_URL}/api/v1/chats/${storyId}/theme`,
    JSON.stringify(themeData),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const success = check(response, {
    "✅ 주제 설정 성공": (r) => r.status === 200,
  });

  themeSetDuration.add(response.timings.duration);

  if (success) {
    return true;
  } else {
    console.log(`❌ 주제 설정 실패: ${response.status}`);
    return false;
  }
}

/**
 * 채팅 메시지 전송
 */
export function sendMessage(token, storyId) {
  if (!storyId) {
    console.log("❌ 스토리 ID가 없어서 메시지를 보낼 수 없습니다");
    return false;
  }

  const message =
    TEST_DATA.messages[Math.floor(Math.random() * TEST_DATA.messages.length)];

  const messageData = {
    content: message,
    isSkip: false,
  };

  const response = http.post(
    `${SERVER_URL}/api/v1/chats/${storyId}`,
    JSON.stringify(messageData),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const success = check(response, {
    "✅ 메시지 전송 성공": (r) => r.status === 200,
  });

  messageStandDuration.add(response.timings.duration);

  if (success) {
    return true;
  } else {
    console.log(`❌ 메시지 전송 실패: ${response.status}`);
    return false;
  }
}
