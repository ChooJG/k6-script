import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { SERVER_URL, TEST_USERS } from '../config.js';

const loginDuration = new Trend('login_duration');

/**
 * 로그인 수행
 * @returns {string|null} 성공 시 JWT 토큰, 실패 시 null
 */
export function login() {
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];

  const loginData = {
    username: user.username,
    password: user.password
  };

  const response = http.post(
    `${SERVER_URL}/api/v1/auth/normal/login`,
    JSON.stringify(loginData),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );

  const success = check(response, {
    '✅ 로그인 성공': (r) => r.status === 200,
  });

  loginDuration.add(response.timings.duration);

  if (success) {
    const authHeader = response.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log(`✅ 로그인 성공: ${user.username}`);
      return token;
    } else {
      console.log(`❌ 토큰 추출 실패`);
      return null;
    }
  } else {
    console.log(`❌ 로그인 실패: ${response.status}`);
    return null;
  }
}
