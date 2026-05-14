# 🗺️ 탐험 퀴즈 게임

교회 수련회용 GPS 탐험 퀴즈 웹앱입니다.  
앱 설치 없이 스마트폰 브라우저만으로 바로 플레이할 수 있어요.

## 기능

- 📍 GPS로 장소에 직접 이동해야 퀴즈 오픈
- ❓ 4지선다 퀴즈 (오답 시 1회 재도전)
- 📷 QR코드 스캔으로 포인트 획득
- 🛒 포인트로 상점에서 상품 구매
- 🏆 실시간 리더보드
- 🔧 관리자 페이지 (장소/QR/상품/문제은행 관리)

## 기술 스택

- HTML / CSS / JavaScript (프레임워크 없음)
- Firebase Firestore (실시간 DB)
- Leaflet.js (지도)
- html5-qrcode (QR 스캔)
- Cloudflare Pages / GitHub Pages (호스팅)

## 설정 방법

1. `js/config.js` 파일에 Firebase 프로젝트 정보 입력
2. Firebase 콘솔에서 Firestore 규칙 설정
3. GitHub Pages 또는 Cloudflare Pages로 배포

## 참가 규모

- 참가자 최대 50명 (Firebase 무료 플랜)
- 관리자 최대 10명 동시 접속
