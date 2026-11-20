# 거리 측정

출발지와 도착지를 검색해 자동차 경로의 총거리와 예상 소요 시간을 확인하는 한국어 웹앱입니다.

## 실행

```bash
npm install
npm run dev
```

프로덕션 빌드는 `npm run build`로 생성됩니다. 출력 폴더는 `dist`입니다.

## Vercel 배포

GitHub에 저장소를 만든 뒤 Vercel에서 **Add New → Project**를 선택해 저장소를 가져오세요. Vite 프로젝트로 자동 감지되며 별도 환경변수 없이 배포할 수 있습니다.

## 데이터 제공

- 장소 검색: [Nominatim](https://nominatim.org/release-docs/latest/api/Search/) (OpenStreetMap)
- 자동차 경로 거리 및 예상 시간: [OSRM 공개 데모 서버](https://router.project-osrm.org/)
- 지도 링크: [OpenStreetMap](https://www.openstreetmap.org/)

공개 서버의 이용 정책과 사용량 제한에 따라 검색·경로 기능이 일시적으로 제한될 수 있습니다. 경로 거리는 자동차 기준 예상값이며 실제 이동 경로와 다를 수 있습니다.
