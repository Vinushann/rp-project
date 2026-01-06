# Ayathma Module - Frontend

## Owner
**Ayathma**

## Description
Smart KPI Analyzer - An AI-powered KPI extraction and analysis tool that automatically identifies key metrics from uploaded datasets.

## Features
- **File Upload**: Drag-and-drop or click-to-upload CSV/Excel files
- **Smart Detection**: Automatically identifies measures, dimensions, and time columns
- **KPI Extraction**: Generates meaningful KPIs with statistical analysis
- **Factor Analysis**: Performs factor analysis on numeric data
- **Insight Cards**: Visual insights with bar charts and data tables
- **Data Profile**: Comprehensive view of column types and roles
- **Export**: Download results as JSON, CSV, or report format

## Files in this folder
- `AyathmaPage.jsx` - Main page component with state management
- `api.js` - API integration functions
- `components/` - UI components:
  - `FileUpload.jsx` - Drag-and-drop file upload
  - `AnalysisResults.jsx` - Tab-based results container
  - `KPISummary.jsx` - Key metrics tiles
  - `InsightCards.jsx` - Visual insight cards with charts
  - `DataProfile.jsx` - Dataset profile and column info
  - `FactorAnalysis.jsx` - Factor analysis visualization
  - `ExportButtons.jsx` - Download buttons
  - `LoadingSpinner.jsx` - Animated loading state
  - `index.js` - Component exports

## Route
Your module page is available at `/ayathma`

## API Endpoints
- `GET /api/v1/ayathma/ping` - Health check
- `POST /api/v1/ayathma/analyze` - Analyze a dataset (multipart form with file)
- `GET /api/v1/ayathma/download/{format}` - Download results (json/csv/report)

## Usage
```jsx
import { analyzeDataset, downloadResults, pingModule } from './api';

// Analyze a file
const result = await analyzeDataset(file, { measure_col: 'revenue' });

// Download results
const blob = await downloadResults('json');
```

## Notes
- All frontend code is isolated to this folder
- Uses shared Tailwind CSS classes from `src/index.css`
- No external charting libraries - uses pure CSS bar charts

