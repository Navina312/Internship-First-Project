
import { useState } from 'react';
import './App.css';

function App() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unit, setUnit] = useState('C');

  // Load saved search history
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('weatherSearchHistory') || '[]'
      );
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  // Convert Celsius to the selected temperature unit
  const convertTemperature = (celsius) => {
    if (celsius === undefined || celsius === null) return '--';

    return unit === 'C'
      ? Math.round(celsius)
      : Math.round((celsius * 9) / 5 + 32);
  };

  // Get weather and air quality
  // coordinates is used by the Use My Location feature
  const getWeather = async (searchCity = city, coordinates = null) => {
    if (!coordinates && !searchCity.trim()) {
      setError('Please enter a city name');
      return;
    }

    setLoading(true);
    setError('');
    setWeather(null);

    try {
      let latitude;
      let longitude;
      let name;
      let country;

      if (coordinates) {
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
        name = 'Your Location';
        country = '';
      } else {
        // Search city coordinates
        const geoResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchCity)}&count=1&language=en&format=json`
        );

        if (!geoResponse.ok) {
          throw new Error('Unable to search for city');
        }

        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
          throw new Error('City not found. Try another city.');
        }

        ({ latitude, longitude, name, country } = geoData.results[0]);
      }

      // Get current weather and 5-day forecast
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&forecast_days=5&timezone=auto`
      );

      if (!weatherResponse.ok) {
        throw new Error('Unable to get weather data');
      }

      const weatherData = await weatherResponse.json();

      // Get air quality information
      let airQuality = null;

      try {
        const airResponse = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide&timezone=auto`
        );

        if (airResponse.ok) {
          const airData = await airResponse.json();
          airQuality = airData.current || null;
        }
      } catch {
        airQuality = null;
      }

      // Save recently searched cities (not GPS locations)
      if (!coordinates) {
        let savedHistory = [];

        try {
          savedHistory = JSON.parse(
            localStorage.getItem('weatherSearchHistory') || '[]'
          );

          if (!Array.isArray(savedHistory)) {
            savedHistory = [];
          }
        } catch {
          savedHistory = [];
        }

        const updatedHistory = [
          { city: name, country: country },
          ...savedHistory.filter(
            (item) =>
              item.city.toLowerCase() !== name.toLowerCase()
          )
        ].slice(0, 5);

        localStorage.setItem(
          'weatherSearchHistory',
          JSON.stringify(updatedHistory)
        );

        setSearchHistory(updatedHistory);
      }

      // Update weather information
      setWeather({
        city: name,
        country: country,
        ...weatherData.current,
        daily: weatherData.daily,
        airQuality: airQuality
      });

      setCity(name);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Detect current location using browser geolocation
  const getMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        getWeather('', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (locationError) => {
        setLoading(false);

        if (locationError.code === 1) {
          setError('Location permission denied. Please allow location access in your browser.');
        } else if (locationError.code === 2) {
          setError('Your location could not be detected. Please try again.');
        } else {
          setError('Location request timed out. Please try again.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  // Weather description
  const getDescription = (code) => {
    if (code === 0) return 'Clear Sky';
    if ([1, 2, 3].includes(code)) return 'Partly Cloudy';
    if ([45, 48].includes(code)) return 'Foggy';
    if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rainy';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snowy';
    if ([95, 96, 99].includes(code)) return 'Thunderstorm';
    return 'Unknown Weather';
  };

  // Weather icons
  const getIcon = (code) => {
    if (code === 0) return '☀️';
    if ([1, 2, 3].includes(code)) return '⛅';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
    if ([95, 96, 99].includes(code)) return '⛈️';
    return '🌤️';
  };

  // Dynamic background
  const getTheme = () => {
    if (!weather) return 'default-theme';

    const code = weather.weather_code;

    if ([95, 96, 99].includes(code)) return 'stormy-theme';

    if (
      [51, 53, 55, 56, 57, 61, 63, 65,
        66, 67, 80, 81, 82].includes(code)
    ) {
      return 'rainy-theme';
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
      return 'snowy-theme';
    }

    if ([45, 48].includes(code)) return 'cloudy-theme';
    if (weather.is_day === 0) return 'night-theme';
    if (code === 0) return 'sunny-theme';
    if ([1, 2, 3].includes(code)) return 'cloudy-theme';

    return 'default-theme';
  };

  // Format sunrise, sunset and local time
  const formatLocalTime = (dateTime) => {
    if (!dateTime) return '--';

    const time = dateTime.split('T')[1];
    if (!time) return '--';

    const [hours, minutes] = time.split(':');
    const hour = Number(hours);

    return `${hour % 12 || 12}:${minutes} ${
      hour >= 12 ? 'PM' : 'AM'
    }`;
  };

  // Format the selected location's local date
  const formatLocalDate = (dateTime) => {
    if (!dateTime) return '--';

    const datePart = dateTime.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);

    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Wind direction
  const getWindDirection = (degrees) => {
    if (degrees === undefined || degrees === null) return '--';

    const directions = [
      'N', 'NE', 'E', 'SE',
      'S', 'SW', 'W', 'NW'
    ];

    const normalized = ((degrees % 360) + 360) % 360;
    const index = Math.round(normalized / 45) % 8;

    return `${Math.round(normalized)}° ${directions[index]}`;
  };

  // Air quality status
  const getAQIStatus = (aqi) => {
    if (aqi === undefined || aqi === null) {
      return { label: 'Unavailable', className: 'aqi-unknown' };
    }

    if (aqi <= 50) {
      return { label: 'Good', className: 'aqi-good' };
    }

    if (aqi <= 100) {
      return { label: 'Moderate', className: 'aqi-moderate' };
    }

    if (aqi <= 150) {
      return {
        label: 'Unhealthy for Sensitive Groups',
        className: 'aqi-sensitive'
      };
    }

    if (aqi <= 200) {
      return { label: 'Unhealthy', className: 'aqi-unhealthy' };
    }

    if (aqi <= 300) {
      return { label: 'Very Unhealthy', className: 'aqi-very-unhealthy' };
    }

    return { label: 'Hazardous', className: 'aqi-hazardous' };
  };

  // Generate weather alerts from current conditions
  const getWeatherAlerts = () => {
    if (!weather) return [];

    const alerts = [];
    const code = weather.weather_code;
    const temperature = weather.temperature_2m;
    const aqi = weather.airQuality?.us_aqi;

    if ([95, 96, 99].includes(code)) {
      alerts.push({
        icon: '⛈️',
        title: 'Thunderstorm Warning',
        message: 'Thunderstorm conditions are currently reported. Stay indoors when possible.'
      });
    }

    if ([65, 67, 82].includes(code)) {
      alerts.push({
        icon: '🌧️',
        title: 'Heavy Rain Alert',
        message: 'Heavy rainfall conditions are reported. Take care while travelling.'
      });
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
      alerts.push({
        icon: '❄️',
        title: 'Snow Alert',
        message: 'Snowfall conditions are reported. Travel carefully.'
      });
    }

    if (temperature >= 40) {
      alerts.push({
        icon: '🌡️',
        title: 'High Temperature Alert',
        message: 'Very high temperatures are reported. Stay hydrated and avoid prolonged outdoor exposure.'
      });
    }

    if (temperature <= 0) {
      alerts.push({
        icon: '🥶',
        title: 'Low Temperature Alert',
        message: 'Freezing temperatures are reported. Wear suitable warm clothing.'
      });
    }

    if (aqi !== undefined && aqi >= 151) {
      alerts.push({
        icon: '😷',
        title: 'Poor Air Quality Alert',
        message: 'Air quality is unhealthy. Consider reducing prolonged outdoor activity.'
      });
    }

    return alerts;
  };

  // Clear search history
  const clearHistory = () => {
    localStorage.removeItem('weatherSearchHistory');
    setSearchHistory([]);
  };

  return (
    <div className={`app ${getTheme()}`}>
      <div className="weather-card">

        <h1 className="app-title">Weather App</h1>
        <p>Check the weather in your city</p>

        {/* SEARCH SECTION */}
        <div className="search-box">
          <input
            type="text"
            placeholder="Enter city name..."
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') getWeather();
            }}
          />

          <button
            onClick={() => getWeather()}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* USE MY LOCATION */}
        <button
          className="location-button"
          onClick={getMyLocation}
          disabled={loading}
        >
          📍 {loading ? 'Getting location...' : 'Use My Location'}
        </button>

        {/* LOADING ANIMATION */}
        {loading && (
          <div className="loading-container">
            <div className="weather-loader">🌤️</div>
            <p>Getting weather updates...</p>
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <p className="error-message">{error}</p>
        )}

        {/* SEARCH HISTORY */}
        {searchHistory.length > 0 && (
          <div className="history-section">
            <div className="history-header">
              <h2>🕘 Recently Searched</h2>

              <button
                className="clear-history"
                onClick={clearHistory}
              >
                Clear History
              </button>
            </div>

            <div className="history-list">
              {searchHistory.map((item, index) => (
                <button
                  className="history-item"
                  key={`${item.city}-${index}`}
                  onClick={() => {
                    setCity(item.city);
                    getWeather(item.city);
                  }}
                  disabled={loading}
                >
                  <span>📍 {item.city}</span>
                  <small>{item.country}</small>
                  <span>↗</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CURRENT WEATHER */}
        {weather && (
          <>
            <div className="weather-info">

              <h2>
                {weather.city}{weather.country ? `, ${weather.country}` : ''}
              </h2>

              {/* LOCAL DATE AND TIME */}
              <div className="local-date-time">
                <p>📅 {formatLocalDate(weather.time)}</p>
                <p>🕒 Local time: {formatLocalTime(weather.time)}</p>
              </div>

              {/* TEMPERATURE UNIT TOGGLE */}
              <div className="temperature-toggle">
                <button
                  className={unit === 'C' ? 'active-unit' : ''}
                  onClick={() => setUnit('C')}
                >
                  °C
                </button>

                <button
                  className={unit === 'F' ? 'active-unit' : ''}
                  onClick={() => setUnit('F')}
                >
                  °F
                </button>
              </div>

              <h1>
                {convertTemperature(weather.temperature_2m)}°{unit}
              </h1>

              <h3>
                {getIcon(weather.weather_code)}{' '}
                {getDescription(weather.weather_code)}
              </h3>

              <div className="weather-details-grid">
                <div className="weather-detail-card">
                  🌡️ Feels Like: {convertTemperature(weather.apparent_temperature)}°{unit}
                </div>

                <div className="weather-detail-card">
                  💧 Humidity: {weather.relative_humidity_2m}%
                </div>

                <div className="weather-detail-card">
                  💨 Wind Speed: {weather.wind_speed_10m} km/h
                </div>

                <div className="weather-detail-card">
                  🌧️ Precipitation: {weather.precipitation} mm
                </div>
              </div>
            </div>

            {/* WEATHER ALERTS */}
            <div className="alerts-section">
              <h2>⚠️ Weather Alerts</h2>

              {getWeatherAlerts().length > 0 ? (
                <div className="alerts-list">
                  {getWeatherAlerts().map((alert, index) => (
                    <div className="alert-card" key={index}>
                      <h3>
                        {alert.icon} {alert.title}
                      </h3>
                      <p>{alert.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-alerts">
                  <span>✅</span>
                  <p>No major weather or air-quality warnings detected from the available readings.</p>
                </div>
              )}

              <small>
                These are app-generated condition warnings, not official emergency alerts.
              </small>
            </div>

            {/* AIR QUALITY */}
            <div className="air-quality-section">
              <h2>🌿 Air Quality Monitoring</h2>

              {weather.airQuality ? (
                <>
                  <div className="aqi-main-card">
                    <span>US Air Quality Index</span>

                    <h1>
                      {weather.airQuality.us_aqi ?? '--'}
                    </h1>

                    <span
                      className={`aqi-status ${
                        getAQIStatus(weather.airQuality.us_aqi).className
                      }`}
                    >
                      {getAQIStatus(weather.airQuality.us_aqi).label}
                    </span>
                  </div>

                  <div className="air-quality-grid">
                    <div className="air-quality-card">
                      <h3>PM2.5</h3>
                      <p>
                        {weather.airQuality.pm2_5 ?? '--'} µg/m³
                      </p>
                    </div>

                    <div className="air-quality-card">
                      <h3>PM10</h3>
                      <p>
                        {weather.airQuality.pm10 ?? '--'} µg/m³
                      </p>
                    </div>

                    <div className="air-quality-card">
                      <h3>Ozone</h3>
                      <p>
                        {weather.airQuality.ozone ?? '--'} µg/m³
                      </p>
                    </div>

                    <div className="air-quality-card">
                      <h3>Nitrogen Dioxide</h3>
                      <p>
                        {weather.airQuality.nitrogen_dioxide ?? '--'} µg/m³
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p>Air quality information is currently unavailable.</p>
              )}
            </div>

            {/* ADDITIONAL WEATHER DETAILS */}
            <div className="extra-weather-section">
              <h2>Additional Weather Details</h2>

              <div className="extra-weather-grid">
                <div className="extra-weather-card">
                  <span className="extra-weather-icon">🌅</span>
                  <h3>Sunrise</h3>
                  <p>
                    {formatLocalTime(weather.daily.sunrise[0])}
                  </p>
                </div>

                <div className="extra-weather-card">
                  <span className="extra-weather-icon">🌇</span>
                  <h3>Sunset</h3>
                  <p>
                    {formatLocalTime(weather.daily.sunset[0])}
                  </p>
                </div>

                <div className="extra-weather-card">
                  <span className="extra-weather-icon">🧭</span>
                  <h3>Wind Direction</h3>
                  <p>
                    {getWindDirection(weather.wind_direction_10m)}
                  </p>
                </div>
              </div>
            </div>

            {/* 5-DAY FORECAST */}
            <div className="forecast-section">
              <h2>5-Day Weather Forecast</h2>

              <div className="forecast-container">
                {weather.daily.time.map((day, index) => (
                  <div className="forecast-card" key={day}>
                    <h3>
                      {new Date(day + 'T12:00:00').toLocaleDateString(
                        'en-US',
                        { weekday: 'short' }
                      )}
                    </h3>

                    <div className="forecast-icon">
                      {getIcon(weather.daily.weather_code[index])}
                    </div>

                    <p className="forecast-condition">
                      {getDescription(
                        weather.daily.weather_code[index]
                      )}
                    </p>

                    <p className="forecast-temp">
                      {convertTemperature(
                        weather.daily.temperature_2m_max[index]
                      )}°{unit}
                      <span>
                        {' / '}
                        {convertTemperature(
                          weather.daily.temperature_2m_min[index]
                        )}°{unit}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default App;
