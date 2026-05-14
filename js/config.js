// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Firebase 설정  ← Firebase 콘솔에서 복사해서 붙여넣기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDekjC6CZL-b5uIHlY6ELjrK0umgRHvTmc",
  authDomain:        "summer-retreat-game.firebaseapp.com",
  projectId:         "summer-retreat-game",
  storageBucket:     "summer-retreat-game.firebasestorage.app",
  messagingSenderId: "1059808018355",
  appId:             "1:1059808018355:web:c6fe8fb085e57d99be15c6",
  measurementId:     "G-0JK8BVXC84"
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  게임 설정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const GAME_CONFIG = {
  // 지도 기본 중심 좌표 (행사 장소로 변경하세요)
  MAP_CENTER: [37.5665, 126.9780],   // 기본값: 서울 시청
  MAP_ZOOM: 16,

  // GPS 인식 범위 (미터) - 장소에 이 거리 내로 들어오면 퀴즈 열림
  LOCATION_RADIUS: 30,

  // 관리자 비밀번호 (변경하세요!)
  ADMIN_PASSWORD: "admin1234",

  // 사이트 기본 URL (QR코드 생성에 사용)
  SITE_URL: window.location.origin + window.location.pathname.replace(/[^/]*$/, ''),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Firebase 초기화 (테스트 모드에서는 건너뜀)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if (!window.MOCK_MODE && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY') {
  firebase.initializeApp(FIREBASE_CONFIG);
  window.db = firebase.firestore();

  // 느린 네트워크/오프라인 대비: 로컬 캐시 활성화
  db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    // 이미 다른 탭에서 열려있거나 시크릿모드면 캐시 비활성화 (무시해도 됨)
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
      console.warn('Firestore persistence error:', err);
    }
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공통 유틸리티
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getNickname() {
  return localStorage.getItem('quiz_nickname') || null;
}

function setNickname(name) {
  localStorage.setItem('quiz_nickname', name);
}

function clearNickname() {
  localStorage.removeItem('quiz_nickname');
}

// Haversine 거리 계산 (미터)
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2
    + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180)
    * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// 토스트 메시지
function showToast(msg, duration = 2500) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// 고유 ID 생성 (10명 동시 생성 시 충돌 방지)
function genId() {
  const t = Date.now().toString(36);
  const r1 = Math.random().toString(36).slice(2, 9);
  const r2 = Math.random().toString(36).slice(2, 6);
  return `${t}-${r1}${r2}`;
}

// 오프라인 감지 (현장 WiFi 불안정 대비)
(function setupOfflineDetect() {
  let offlineToast = null;
  function showOffline() {
    if (offlineToast) return;
    offlineToast = document.createElement('div');
    offlineToast.textContent = '⚠️ 인터넷 연결이 끊겼어요. 데이터가 저장되지 않을 수 있어요.';
    Object.assign(offlineToast.style, {
      position: 'fixed', bottom: '80px', left: '50%',
      transform: 'translateX(-50%)',
      background: '#ef4444', color: '#fff',
      padding: '10px 18px', borderRadius: '12px',
      fontSize: '13px', fontWeight: '600',
      zIndex: '9999', maxWidth: '90vw', textAlign: 'center',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
    });
    document.body.appendChild(offlineToast);
  }
  function hideOffline() {
    if (offlineToast) { offlineToast.remove(); offlineToast = null; }
    showToast('✅ 인터넷 연결됐어요!');
  }
  window.addEventListener('offline', showOffline);
  window.addEventListener('online', hideOffline);
  if (!navigator.onLine) showOffline();
})();
