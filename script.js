// 1. 전역 상태 관리
let countryData = {}; // countries.json에서 불러온 데이터를 저장할 객체
let currentTheme = 'dark';
let currentMeal = null;
let currentTranslatedTitle = "";

// 2. 지도 초기화
const map = L.map('map').setView([20, 0], 2);
let tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

// 지구 모양(🌐) 커스텀 아이콘 설정
const globeIcon = L.divIcon({
    html: '<div class="globe-icon">🌐</div>',
    className: 'custom-globe-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

// 3. 핵심 기능: 데이터 로드 및 초기화
window.onload = async () => {
    try {
        // countries.json 파일을 불러와서 countryData에 할당
        const response = await fetch('countries.json');
        if (!response.ok) throw new Error("네트워크 응답에 문제가 있습니다.");
        countryData = await response.json();
        
        // 데이터 로드 완료 후 마커 생성 및 보관함 렌더링
        initMarkers();
        renderCollection();
    } catch (error) {
        console.error("국가 데이터를 불러오는 중 오류 발생:", error);
        // 로컬 파일 실행 시 fetch가 차단될 경우를 대비한 최소한의 알림
        alert("JSON 데이터를 불러올 수 없습니다. 웹 서버(Live Server 등) 환경에서 실행해주세요.");
    }
};

// 4. 지도 마커 생성
function initMarkers() {
    Object.entries(countryData).forEach(([countryName, data]) => {
        const marker = L.marker(data.coords, { icon: globeIcon }).addTo(map);
        
        // 마커 클릭 시 해당 국가 음식 랜덤 조회
        marker.on('click', () => {
            fetchFoodByCountry(countryName);
            map.flyTo(data.coords, 4);
        });

        // 호버 시 국가 이름 표시
        marker.bindTooltip(countryName, { direction: 'top', offset: [0, -10] });
    });
}

// 5. API 통신: 특정 국가 음식 리스트 가져오기
async function fetchFoodByCountry(area) {
    try {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?a=${area}`);
        const data = await res.json();
        
        if (data.meals && data.meals.length > 0) {
            const randomMeal = data.meals[Math.floor(Math.random() * data.meals.length)];
            viewSavedMeal(randomMeal.idMeal);
        }
    } catch (err) {
        console.error("국가별 음식 호출 실패:", err);
    }
}

// 6. API 통신: 상세 정보 조회 (보관함/마커 클릭 공용)
async function viewSavedMeal(mealId) {
    try {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${mealId}`);
        const data = await res.json();
        currentMeal = data.meals[0];
        document.getElementById('info-card').style.display = 'block';
        await renderResult(currentMeal);
    } catch (err) {
        alert("음식 정보를 가져오는 데 실패했습니다.");
    }
}

// 7. API 통신: 한글 번역 (Google Translate 무료 API)
async function translateToKorean(text) {
    try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`);
        const data = await res.json();
        return data[0].map(item => item[0]).join('');
    } catch (error) { return text; }
}

// 8. 메인 로직: 음식 룰렛 실행
async function startRoulette() {
    const btn = document.getElementById('roll-btn');
    const img = document.getElementById('food-img');
    btn.disabled = true;
    img.classList.add('spinning');
    
    const tempImgs = [
        "https://www.themealdb.com/images/ingredients/Chicken-Small.png",
        "https://www.themealdb.com/images/ingredients/Beef-Small.png",
        "https://www.themealdb.com/images/ingredients/Rice-Small.png"
    ];
    let i = 0;
    const interval = setInterval(() => { img.src = tempImgs[i % 3]; i++; }, 80);

    try {
        const res = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
        const data = await res.json();
        currentMeal = data.meals[0];

        setTimeout(async () => {
            clearInterval(interval);
            img.classList.remove('spinning');
            btn.disabled = false;
            document.getElementById('info-card').style.display = 'block';
            await renderResult(currentMeal);
        }, 1200);
    } catch (err) {
        clearInterval(interval);
        btn.disabled = false;
    }
}

// 9. 결과 출력: 상세 정보 UI 업데이트
async function renderResult(meal) {
    document.getElementById('food-title').innerText = meal.strMeal;
    document.getElementById('food-img').src = meal.strMealThumb;
    document.getElementById('food-area').innerText = `📍 ${meal.strArea}`;
    document.getElementById('yt-link').href = meal.strYoutube || "#";

    // 국기 표시 로직 (JSON 데이터 기반)
    const flagImg = document.getElementById('country-flag');
    const countryInfo = countryData[meal.strArea];

    if (countryInfo) {
        flagImg.src = `https://flagcdn.com/w80/${countryInfo.code}.png`;
        flagImg.style.display = 'inline-block';
        map.flyTo(countryInfo.coords, 5);
    } else {
        flagImg.style.display = 'none';
    }

    document.getElementById('translated-title').innerText = "번역 중...";
    document.getElementById('recipe').innerText = "레시피 번역 중...";

    currentTranslatedTitle = await translateToKorean(meal.strMeal);
    const translatedRecipe = await translateToKorean(meal.strInstructions);

    document.getElementById('translated-title').innerText = `(한글명: ${currentTranslatedTitle})`;
    document.getElementById('recipe').innerText = translatedRecipe;

    // 상세 카드로 부드럽게 스크롤 이동
    window.scrollTo({ top: document.getElementById('info-card').offsetTop - 20, behavior: 'smooth' });
}

// 10. 보관함 관리 (LocalStorage)
function saveToCollection() {
    if (!currentMeal) return;
    let storage = JSON.parse(localStorage.getItem('food_box')) || [];
    if (storage.some(item => item.id === currentMeal.idMeal)) return alert("이미 보관함에 있습니다.");
    
    storage.push({ 
        id: currentMeal.idMeal, 
        title: currentTranslatedTitle || currentMeal.strMeal, 
        img: currentMeal.strMealThumb 
    });
    localStorage.setItem('food_box', JSON.stringify(storage));
    renderCollection();
}

function renderCollection() {
    const list = document.getElementById('collection-list');
    const storage = JSON.parse(localStorage.getItem('food_box')) || [];
    list.innerHTML = storage.map(item => `
        <div class="collection-item" onclick="viewSavedMeal('${item.id}')">
            <button class="delete-btn" onclick="event.stopPropagation(); removeItem('${item.id}')">×</button>
            <img src="${item.img}">
            <p><b>${item.title}</b></p>
        </div>
    `).join('');
}

function removeItem(id) {
    let storage = JSON.parse(localStorage.getItem('food_box')) || [];
    localStorage.setItem('food_box', JSON.stringify(storage.filter(i => i.id !== id)));
    renderCollection();
}

// 11. 부가 기능: 테마 변경 및 주변 식당 찾기
function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', currentTheme);
    map.removeLayer(tileLayer);
    tileLayer = L.tileLayer(currentTheme === 'dark' 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
}

function orderFood() {
    if (!currentMeal) return;
    const query = encodeURIComponent((currentTranslatedTitle || currentMeal.strMeal) + " 주변 식당");
    window.open(`https://www.google.com/maps/search/${query}`, '_blank');
}