import React, { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { getStatistics, getTrendStatistics, getWeather, getHolidays } from '../../../lib/api';
import './StatsPage.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Professional Filter Dropdown Component
const FilterDropdown = ({ value, onChange, options }) => (
  <div className="filter-select-wrapper">
    <select 
      className="filter-select" 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    <svg className="filter-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6"/>
    </svg>
  </div>
);

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [revenuePeriod, setRevenuePeriod] = useState('monthly');
  const [salesPeriod, setSalesPeriod] = useState('weekly');
  const [weatherForecast, setWeatherForecast] = useState('current');
  const [holidayMonth, setHolidayMonth] = useState('all');
  
  // Weather & Holidays state
  const [weather, setWeather] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    fetchData();
    fetchWeatherAndHolidays();
  }, []);

  useEffect(() => {
    fetchTrendData();
  }, [revenuePeriod]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const statsRes = await getStatistics();
      setStats(statsRes);
      await fetchTrendData();
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendData = async () => {
    try {
      const limit = revenuePeriod === 'daily' ? 30 : revenuePeriod === 'weekly' ? 12 : 12;
      const trendRes = await getTrendStatistics(revenuePeriod, limit);
      setTrendData(trendRes);
    } catch (err) {
      console.error('Failed to fetch trend data:', err);
    }
  };

  const fetchWeatherAndHolidays = async () => {
    try {
      setWeatherLoading(true);
      const [weatherRes, holidaysRes] = await Promise.all([
        getWeather('Katunayake'),
        getHolidays(2026)
      ]);
      setWeather(weatherRes);
      setHolidays(holidaysRes?.holidays || []);
    } catch (err) {
      console.error('Weather/Holidays fetch error:', err);
      // Set fallback data
      setWeather({
        current: { temperature: 28, humidity: 75, condition: 'Clouds', wind_speed: 12 }
      });
    } finally {
      setWeatherLoading(false);
    }
  };

  // Filter holidays by month
  const filteredHolidays = useMemo(() => {
    if (holidayMonth === 'all') return holidays.slice(0, 5);
    return holidays.filter(h => {
      const month = new Date(h.date).getMonth();
      return month === parseInt(holidayMonth);
    }).slice(0, 6);
  }, [holidays, holidayMonth]);

  // Weather forecast data
  const weatherDisplay = useMemo(() => {
    if (!weather) return null;
    if (weatherForecast === 'current') {
      return weather.current;
    }
    return weather.forecast?.slice(0, parseInt(weatherForecast)) || [];
  }, [weather, weatherForecast]);

  const months = [
    { value: 'all', label: 'All Months' },
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' },
  ];

  const getWeatherIcon = (condition) => {
    const icons = {
      'Clear': '☀️',
      'Sunny': '☀️',
      'Clouds': '☁️',
      'Partly cloudy': '⛅',
      'Rain': '🌧️',
      'Drizzle': '🌦️',
      'Thunderstorm': '⛈️',
      'Snow': '❄️',
      'Mist': '🌫️',
      'Fog': '🌫️',
    };
    return icons[condition] || '🌤️';
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">
          <div className="loader">
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
          </div>
          <p>Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-error">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <h3>Something went wrong</h3>
            <p>{error}</p>
            <button className="btn-primary" onClick={fetchData}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Extract data from the correct API structure
  const overview = stats?.overview || {};
  const productsData = stats?.products?.top_by_quantity || { labels: [], values: [] };
  const calendarData = stats?.calendar?.day_of_week || { labels: [], revenue: [] };
  const weatherImpact = stats?.weather || {};
  const orderTypesData = stats?.order_types?.distribution || { labels: [], orders: [] };

  // Revenue Trend Chart Configuration - uses labels and revenue arrays from API
  const revenueTrendData = {
    labels: trendData?.labels || [],
    datasets: [{
      label: revenuePeriod === 'daily' ? 'Daily Revenue' : revenuePeriod === 'weekly' ? 'Weekly Revenue' : 'Monthly Revenue',
      data: trendData?.revenue || [],
      borderColor: '#3b82f6',
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 280);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.01)');
        return gradient;
      },
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#3b82f6',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointHoverRadius: 7,
      pointHoverBorderWidth: 3,
    }]
  };

  // Sales by Day Chart - use calendar data from API
  const dayLabels = calendarData.labels?.map(d => d?.slice(0, 3)) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayData = calendarData.revenue || [];
  
  const salesByDayData = {
    labels: dayLabels,
    datasets: [{
      label: 'Revenue',
      data: dayData,
      backgroundColor: (context) => {
        const colors = [
          'rgba(59, 130, 246, 0.85)',
          'rgba(16, 185, 129, 0.85)',
          'rgba(245, 158, 11, 0.85)',
          'rgba(239, 68, 68, 0.85)',
          'rgba(139, 92, 246, 0.85)',
          'rgba(6, 182, 212, 0.85)',
          'rgba(236, 72, 153, 0.85)'
        ];
        return colors[context.dataIndex % colors.length];
      },
      borderRadius: 10,
      borderSkipped: false,
      barThickness: 32,
    }]
  };

  // Top Products Chart - use products data from API
  const topProductsData = {
    labels: productsData.labels?.slice(0, 5).map(p => p?.length > 14 ? p.slice(0, 14) + '...' : p) || [],
    datasets: [{
      label: 'Units Sold',
      data: productsData.values?.slice(0, 5) || [],
      backgroundColor: [
        'rgba(59, 130, 246, 0.85)',
        'rgba(16, 185, 129, 0.85)',
        'rgba(245, 158, 11, 0.85)',
        'rgba(139, 92, 246, 0.85)',
        'rgba(236, 72, 153, 0.85)'
      ],
      borderRadius: 8,
      borderSkipped: false,
      barThickness: 24,
    }]
  };

  // Order Distribution Chart - use order types data from API
  const orderDistData = {
    labels: ['Delivery', 'Dine-in', 'Takeaway'],
    datasets: [{
      data: orderTypesData.orders || [8641, 6998, 5190],
      backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
      borderWidth: 0,
      hoverOffset: 10,
    }]
  };

  // Weather Impact Chart - use weather data from API
  const weatherChartData = {
    labels: weatherImpact.labels || ['Sunny', 'Rainy'],
    datasets: [{
      label: 'Avg Daily Revenue',
      data: weatherImpact.revenue || [11500, 9800],
      backgroundColor: ['rgba(245, 158, 11, 0.85)', 'rgba(59, 130, 246, 0.85)'],
      borderRadius: 10,
      barThickness: 50,
    }]
  };

  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleFont: { size: 13, weight: '600', family: "'Inter', sans-serif" },
        bodyFont: { size: 12, family: "'Inter', sans-serif" },
        padding: 14,
        cornerRadius: 10,
        displayColors: false,
        boxPadding: 6,
      }
    },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { 
          color: '#64748b', 
          font: { size: 11, family: "'Inter', sans-serif" } 
        }
      },
      y: { 
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        border: { display: false },
        ticks: { 
          color: '#64748b', 
          font: { size: 11, family: "'Inter', sans-serif" },
          callback: (value) => '$' + (value >= 1000 ? (value/1000).toFixed(0) + 'K' : value)
        }
      }
    }
  };

  const barOptions = {
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      tooltip: {
        ...baseChartOptions.plugins.tooltip,
        callbacks: {
          label: (context) => `$${context.raw?.toLocaleString() || 0}`
        }
      }
    }
  };

  const horizontalBarOptions = {
    ...barOptions,
    indexAxis: 'y',
    scales: {
      ...barOptions.scales,
      x: {
        ...barOptions.scales.x,
        ticks: {
          ...barOptions.scales.x.ticks,
          callback: (value) => value >= 1000 ? (value/1000).toFixed(0) + 'K' : value
        }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { 
          usePointStyle: true, 
          padding: 20,
          font: { size: 12, family: "'Inter', sans-serif" }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        padding: 14,
        cornerRadius: 10,
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
      }
    },
    cutout: '72%',
  };

  return (
    <div className="dashboard-container">
      {/* Quick Overview Section */}
      <div className="section-header">
        <h2 className="section-title">📊 Quick Overview</h2>
        <p className="section-subtitle">Key performance metrics at a glance</p>
      </div>
      <section className="kpi-section">
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{overview.total_transactions?.toLocaleString() || '0'}</span>
            <span className="kpi-label">Total Orders</span>
          </div>
          <span className="kpi-badge success">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
            12.5%
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-value">${((overview.total_revenue || 0) / 1000000).toFixed(2)}M</span>
            <span className="kpi-label">Total Revenue</span>
          </div>
          <span className="kpi-badge success">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
            8.2%
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{overview.total_qty?.toLocaleString() || '0'}</span>
            <span className="kpi-label">Items Sold</span>
          </div>
          <span className="kpi-badge success">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
            5.1%
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-value">${overview.avg_order_value?.toFixed(0) || '0'}</span>
            <span className="kpi-label">Avg Order Value</span>
          </div>
          <span className="kpi-badge danger">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5H7z"/></svg>
            2.3%
          </span>
        </div>
      </section>

      {/* Real-time Insights Section */}
      <div className="section-header">
        <h2 className="section-title">🌍 Real-time Insights</h2>
        <p className="section-subtitle">Live weather and upcoming holidays</p>
      </div>
      <section className="insights-row">
        {/* Live Weather - Katunayake */}
        <div className="card card-weather">
          <div className="card-header">
            <div className="card-title-group">
              <h3>🌤️ Live Weather</h3>
              <p>Katunayake, Sri Lanka</p>
            </div>
            <FilterDropdown
              value={weatherForecast}
              onChange={setWeatherForecast}
              options={[
                { value: 'current', label: 'Current' },
                { value: '3', label: '3-Day' },
                { value: '5', label: '5-Day' },
              ]}
            />
          </div>
          <div className="weather-content">
            {weatherLoading ? (
              <div className="weather-loading">
                <div className="mini-loader"></div>
                <span>Fetching weather...</span>
              </div>
            ) : weatherForecast === 'current' && weather?.current ? (
              <div className="weather-current">
                <div className="weather-main">
                  <span className="weather-icon-lg">{getWeatherIcon(weather.current.condition)}</span>
                  <div className="weather-temp-group">
                    <span className="weather-temp">{weather.current.temperature}°C</span>
                    <span className="weather-condition">{weather.current.condition}</span>
                  </div>
                </div>
                <div className="weather-stats">
                  <div className="weather-stat">
                    <span className="stat-icon">💧</span>
                    <span className="stat-value">{weather.current.humidity}%</span>
                    <span className="stat-label">Humidity</span>
                  </div>
                  <div className="weather-stat">
                    <span className="stat-icon">💨</span>
                    <span className="stat-value">{weather.current.wind_speed} km/h</span>
                    <span className="stat-label">Wind</span>
                  </div>
                </div>
              </div>
            ) : Array.isArray(weatherDisplay) && weatherDisplay.length > 0 ? (
              <div className="weather-forecast">
                {weatherDisplay.map((day, idx) => (
                  <div key={idx} className="forecast-day">
                    <span className="forecast-name">{day.day}</span>
                    <span className="forecast-icon">{getWeatherIcon(day.condition)}</span>
                    <span className="forecast-temps">{day.temp_high}° / {day.temp_low}°</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="weather-empty">
                <span className="weather-icon-lg">🌤️</span>
                <p>Weather data unavailable</p>
              </div>
            )}
          </div>
        </div>

        {/* Sri Lankan Holidays */}
        <div className="card card-holidays">
          <div className="card-header">
            <div className="card-title-group">
              <h3>🗓️ Sri Lankan Holidays</h3>
              <p>2026 Public Holidays</p>
            </div>
            <FilterDropdown
              value={holidayMonth}
              onChange={setHolidayMonth}
              options={months}
            />
          </div>
          <div className="holidays-content">
            {holidays.length === 0 ? (
              <div className="holidays-loading">
                <div className="mini-loader"></div>
                <span>Loading holidays...</span>
              </div>
            ) : filteredHolidays.length === 0 ? (
              <div className="holidays-empty">
                <span>📅</span>
                <p>No holidays this month</p>
              </div>
            ) : (
              <div className="holidays-list">
                {filteredHolidays.map((holiday, idx) => (
                  <div key={idx} className="holiday-item">
                    <div className="holiday-date-badge">
                      <span className="holiday-day">{new Date(holiday.date).getDate()}</span>
                      <span className="holiday-month">{new Date(holiday.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                    </div>
                    <div className="holiday-details">
                      <span className="holiday-name">{holiday.name}</span>
                      <span className="holiday-type">{holiday.type || 'Public Holiday'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Analytics & Charts Section */}
      <div className="section-header">
        <h2 className="section-title">📈 Analytics & Charts</h2>
        <p className="section-subtitle">Detailed performance analysis</p>
      </div>

      {/* Main Dashboard Grid */}
      <section className="dashboard-grid">
        {/* Revenue Trend - Span 2 columns */}
        <div className="card card-revenue">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Revenue Trend</h3>
              <p>Track revenue performance over time</p>
            </div>
            <FilterDropdown
              value={revenuePeriod}
              onChange={setRevenuePeriod}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          </div>
          <div className="card-chart-lg">
            <Line data={revenueTrendData} options={baseChartOptions} />
          </div>
        </div>

        {/* Order Distribution */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Order Distribution</h3>
              <p>By order type</p>
            </div>
          </div>
          <div className="card-chart donut-chart">
            <Doughnut data={orderDistData} options={doughnutOptions} />
          </div>
        </div>

        {/* Sales by Day */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Sales by Day</h3>
              <p>Weekly breakdown</p>
            </div>
            <FilterDropdown
              value={salesPeriod}
              onChange={setSalesPeriod}
              options={[
                { value: 'weekly', label: 'This Week' },
                { value: 'monthly', label: 'This Month' },
              ]}
            />
          </div>
          <div className="card-chart">
            <Bar data={salesByDayData} options={barOptions} />
          </div>
        </div>

        {/* Top Products */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Top Products</h3>
              <p>Best selling items</p>
            </div>
          </div>
          <div className="card-chart">
            <Bar data={topProductsData} options={horizontalBarOptions} />
          </div>
        </div>

        {/* Weather Impact */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Weather Impact</h3>
              <p>Revenue by weather</p>
            </div>
          </div>
          <div className="card-chart">
            <Bar data={weatherChartData} options={barOptions} />
          </div>
        </div>
      </section>
    </div>
  );
}
