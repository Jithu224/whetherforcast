const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const MAX_RECENT = 5;

// Weather code to description & icon mapping
const WEATHER_CODES = {
    0: { desc: 'Clear sky', icon: '☀️' },
    1: { desc: 'Mainly clear', icon: '🌤️' },
    2: { desc: 'Partly cloudy', icon: '⛅' },
    3: { desc: 'Overcast', icon: '☁️' },
    45: { desc: 'Foggy', icon: '🌫️' },
    48: { desc: 'Freezing fog', icon: '🌫️' },
    51: { desc: 'Light drizzle', icon: '🌦️' },
    53: { desc: 'Moderate drizzle', icon: '🌦️' },
    55: { desc: 'Dense drizzle', icon: '🌧️' },
    61: { desc: 'Slight rain', icon: '🌧️' },
    63: { desc: 'Moderate rain', icon: '🌧️' },
    65: { desc: 'Heavy rain', icon: '🌧️' },
    71: { desc: 'Slight snow', icon: '🌨️' },
    73: { desc: 'Moderate snow', icon: '🌨️' },
    75: { desc: 'Heavy snow', icon: '❄️' },
    80: { desc: 'Slight showers', icon: '🌦️' },
    81: { desc: 'Moderate showers', icon: '🌧️' },
    82: { desc: 'Violent showers', icon: '🌧️' },
    95: { desc: 'Thunderstorm', icon: '⛈️' },
    96: { desc: 'Thunderstorm with hail', icon: '⛈️' },
    99: { desc: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

// State
let useCelsius = true;
let lastWeatherData = null;
let lastLocation = null;

// DOM elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const unitToggle = document.getElementById('unit-toggle');
const errorMessage = document.getElementById('error-message');
const loading = document.getElementById('loading');
const currentWeatherSection = document.getElementById('current-weather');
const forecastSection = document.getElementById('forecast');
const hourlySection = document.getElementById('hourly-forecast');
const recentSection = document.getElementById('recent-searches');
const recentList = document.getElementById('recent-list');

// Event listeners
searchBtn.addEventListener('click', searchCity);
cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchCity();
});
locationBtn.addEventListener('click', useMyLocation);
unitToggle.addEventListener('click', toggleUnit);

// Init
loadRecentSearches();

// --- Temperature Unit Toggle ---

function toggleUnit() {
    useCelsius = !useCelsius;
    unitToggle.textContent = useCelsius ? '°C' : '°F';
    if (lastWeatherData && lastLocation) {
        renderCurrentWeather(lastWeatherData, lastLocation);
        renderHourlyForecast(lastWeatherData);
        renderForecast(lastWeatherData);
    }
}

function toDisplayTemp(celsius) {
    if (useCelsius) return `${Math.round(celsius)}°C`;
    return `${Math.round(celsius * 9 / 5 + 32)}°F`;
}

// --- Current Location ---

function useMyLocation() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser.');
        return;
    }
    hideError();
    showLoading();
    currentWeatherSection.classList.add('hidden');
    forecastSection.classList.add('hidden');
    hourlySection.classList.add('hidden');

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            try {
                const { latitude, longitude } = pos.coords;
                const weather = await fetchWeather(latitude, longitude);
                // Reverse geocode to get city name
                const location = await reverseGeocode(latitude, longitude);
                lastWeatherData = weather;
                lastLocation = location;
                saveRecentSearch(location.name);
                renderCurrentWeather(weather, location);
                renderHourlyForecast(weather);
                renderForecast(weather);
                hideLoading();
            } catch (err) {
                hideLoading();
                showError(err.message);
            }
        },
        () => {
            hideLoading();
            showError('Location access denied. Please allow location access or search by city name.');
        }
    );
}

async function reverseGeocode(lat, lon) {
    const url = `${GEOCODE_URL}?name=_&count=1&language=en`;
    // Open-Meteo doesn't have reverse geocoding, so we use a fallback
    return { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: '' };
}

// --- Recent Searches ---

function getRecentSearches() {
    try {
        return JSON.parse(localStorage.getItem('recentSearches')) || [];
    } catch {
        return [];
    }
}

function saveRecentSearch(city) {
    let recent = getRecentSearches();
    recent = recent.filter((c) => c.toLowerCase() !== city.toLowerCase());
    recent.unshift(city);
    recent = recent.slice(0, MAX_RECENT);
    localStorage.setItem('recentSearches', JSON.stringify(recent));
    loadRecentSearches();
}

function loadRecentSearches() {
    const recent = getRecentSearches();
    if (recent.length === 0) {
        recentSection.classList.add('hidden');
        return;
    }
    recentList.innerHTML = '';
    recent.forEach((city) => {
        const chip = document.createElement('button');
        chip.className = 'recent-chip';
        chip.textContent = city;
        chip.addEventListener('click', () => {
            cityInput.value = city;
            searchCity();
        });
        recentList.appendChild(chip);
    });
    recentSection.classList.remove('hidden');
}

// --- Search & Fetch ---

async function searchCity() {
    const city = cityInput.value.trim();
    if (!city) return;

    hideError();
    showLoading();
    currentWeatherSection.classList.add('hidden');
    forecastSection.classList.add('hidden');
    hourlySection.classList.add('hidden');

    try {
        const location = await geocodeCity(city);
        const weather = await fetchWeather(location.latitude, location.longitude);
        lastWeatherData = weather;
        lastLocation = location;
        saveRecentSearch(location.name);
        renderCurrentWeather(weather, location);
        renderHourlyForecast(weather);
        renderForecast(weather);
        hideLoading();
    } catch (err) {
        hideLoading();
        showError(err.message);
    }
}

async function geocodeCity(city) {
    const url = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to search for city. Please try again.');
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
        throw new Error(`City "${city}" not found. Please check the name and try again.`);
    }
    return data.results[0];
}

async function fetchWeather(lat, lon) {
    const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=6`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch weather data. Please try again.');
    return res.json();
}

function getWeatherInfo(code) {
    return WEATHER_CODES[code] || { desc: 'Unknown', icon: '🌡️' };
}

// --- Render ---

function renderCurrentWeather(data, location) {
    const current = data.current;
    const weather = getWeatherInfo(current.weather_code);
    const countryStr = location.country ? `, ${location.country}` : '';

    document.getElementById('city-name').textContent = `${location.name}${countryStr}`;
    document.getElementById('temperature').textContent = toDisplayTemp(current.temperature_2m);
    document.getElementById('description').textContent = weather.desc;
    document.getElementById('weather-icon').textContent = weather.icon;
    document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
    document.getElementById('wind').textContent = `${current.wind_speed_10m} km/h`;
    document.getElementById('feels-like').textContent = toDisplayTemp(current.apparent_temperature);
    currentWeatherSection.classList.remove('hidden');
}

function renderHourlyForecast(data) {
    const hourlyScroll = document.getElementById('hourly-scroll');
    hourlyScroll.innerHTML = '';

    const now = new Date();
    const hourlyTimes = data.hourly.time;
    let startIndex = 0;

    // Find the first hour that is >= current time
    for (let i = 0; i < hourlyTimes.length; i++) {
        if (new Date(hourlyTimes[i]) >= now) {
            startIndex = i;
            break;
        }
    }

    // Show next 24 hours
    for (let i = startIndex; i < startIndex + 24 && i < hourlyTimes.length; i++) {
        const time = new Date(hourlyTimes[i]);
        const weather = getWeatherInfo(data.hourly.weather_code[i]);
        const temp = data.hourly.temperature_2m[i];

        const card = document.createElement('div');
        card.className = 'hourly-card';
        card.innerHTML = `
            <div class="hour">${time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}</div>
            <span class="hourly-emoji">${weather.icon}</span>
            <div class="hourly-temp">${toDisplayTemp(temp)}</div>
        `;
        hourlyScroll.appendChild(card);
    }

    hourlySection.classList.remove('hidden');
}

function renderForecast(data) {
    const forecastGrid = document.getElementById('forecast-grid');
    forecastGrid.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const date = new Date(data.daily.time[i]);
        const weather = getWeatherInfo(data.daily.weather_code[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="day">${dayName}</div>
            <div class="weather-emoji">${weather.icon}</div>
            <div class="temp-range">
                ${toDisplayTemp(data.daily.temperature_2m_max[i])} <span class="low">${toDisplayTemp(data.daily.temperature_2m_min[i])}</span>
            </div>
            <div class="forecast-desc">${weather.desc}</div>
        `;
        forecastGrid.appendChild(card);
    }

    forecastSection.classList.remove('hidden');
}

// --- Helpers ---

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
