const API_KEY = '102d1da5215c19790de6469a5fc2c134';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// DOM elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const errorMessage = document.getElementById('error-message');
const loading = document.getElementById('loading');
const currentWeatherSection = document.getElementById('current-weather');
const forecastSection = document.getElementById('forecast');

// Event listeners
searchBtn.addEventListener('click', searchCity);
cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchCity();
});

function searchCity() {
    const city = cityInput.value.trim();
    if (!city) return;

    hideError();
    showLoading();
    currentWeatherSection.classList.add('hidden');
    forecastSection.classList.add('hidden');

    Promise.all([
        fetchCurrentWeather(city),
        fetchForecast(city)
    ])
    .then(([currentData, forecastData]) => {
        renderCurrentWeather(currentData);
        renderForecast(forecastData);
        hideLoading();
    })
    .catch((err) => {
        hideLoading();
        showError(err.message);
    });
}

async function fetchCurrentWeather(city) {
    const url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 404) throw new Error(`City "${city}" not found. Please check the name and try again.`);
        if (res.status === 401) throw new Error('Invalid API key. Please check your API key in app.js.');
        throw new Error('Failed to fetch weather data. Please try again later.');
    }
    return res.json();
}

async function fetchForecast(city) {
    const url = `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 404) throw new Error(`City "${city}" not found.`);
        if (res.status === 401) throw new Error('Invalid API key.');
        throw new Error('Failed to fetch forecast data.');
    }
    return res.json();
}

function renderCurrentWeather(data) {
    document.getElementById('city-name').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}°C`;
    document.getElementById('description').textContent = data.weather[0].description;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    document.getElementById('weather-icon').alt = data.weather[0].description;
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('wind').textContent = `${data.wind.speed} m/s`;
    document.getElementById('feels-like').textContent = `${Math.round(data.main.feels_like)}°C`;
    currentWeatherSection.classList.remove('hidden');
}

function renderForecast(data) {
    // Filter to one entry per day (noon readings)
    const dailyForecasts = getDailyForecasts(data.list);
    const forecastGrid = document.getElementById('forecast-grid');
    forecastGrid.innerHTML = '';

    dailyForecasts.forEach((day) => {
        const card = document.createElement('div');
        card.className = 'forecast-card';

        const date = new Date(day.entries[0].dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        card.innerHTML = `
            <div class="day">${dayName}</div>
            <img src="https://openweathermap.org/img/wn/${day.entries[0].weather[0].icon}@2x.png"
                 alt="${day.entries[0].weather[0].description}" width="50" height="50">
            <div class="temp-range">
                ${Math.round(day.high)}° <span class="low">${Math.round(day.low)}°</span>
            </div>
            <div class="forecast-desc">${day.entries[0].weather[0].description}</div>
        `;
        forecastGrid.appendChild(card);
    });

    forecastSection.classList.remove('hidden');
}

function getDailyForecasts(list) {
    const days = {};
    const today = new Date().toDateString();

    list.forEach((item) => {
        const date = new Date(item.dt * 1000);
        const dateStr = date.toDateString();

        // Skip today
        if (dateStr === today) return;

        if (!days[dateStr]) {
            days[dateStr] = { entries: [], high: -Infinity, low: Infinity };
        }
        days[dateStr].entries.push(item);
        days[dateStr].high = Math.max(days[dateStr].high, item.main.temp_max);
        days[dateStr].low = Math.min(days[dateStr].low, item.main.temp_min);
    });

    return Object.values(days).slice(0, 5);
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function showLoading() {
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}
