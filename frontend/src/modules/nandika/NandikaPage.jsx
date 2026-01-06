/**
 * Nandika Module Page
 * ===================
 *
 * OWNER: Nandika
 *
 * Multilingual Sentiment Analysis for Sri Lankan Reviews
 * - Supports Sinhala and English text
 * - Uses Translation-Based Transfer Learning with RoBERTa
 * - Two modes: Manual text input & Google Maps review scraping
 */

import { useState } from "react";
import { jsPDF } from "jspdf";

const MODULE_NAME = "nandika";
const API_BASE = "http://127.0.0.1:8000/api/v1/nandika";

function NandikaPage() {
  // State for active tab
  const [activeTab, setActiveTab] = useState("manual");

  // State for Manual Text Analysis
  const [manualText, setManualText] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResults, setManualResults] = useState(null);

  // State for Google Maps Scraper
  const [googleUrl, setGoogleUrl] = useState("");
  const [reviewLimit, setReviewLimit] = useState(10);
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperResults, setScraperResults] = useState(null);

  // State for errors
  const [error, setError] = useState("");

  // Generate PDF Report
  const generatePDF = (statistics, mode, additionalInfo = {}) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Sentiment Analysis Report", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 10;

    // Subtitle
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Multilingual Review Analyzer", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 10;

    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 15;

    // Mode info
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    if (mode === "manual") {
      doc.text("Analysis Mode: Manual Text Input", 20, yPos);
    } else {
      doc.text("Analysis Mode: Google Maps Review Scraper", 20, yPos);
      yPos += 7;
      doc.setFont("helvetica", "normal");
      if (additionalInfo.url) {
        doc.setFontSize(9);
        doc.text(`URL: ${additionalInfo.url.substring(0, 80)}...`, 20, yPos);
      }
      if (additionalInfo.totalScraped) {
        yPos += 5;
        doc.text(
          `Total Reviews Analyzed: ${additionalInfo.totalScraped}`,
          20,
          yPos
        );
      }
    }
    yPos += 15;

    // Summary Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary Statistics", 20, yPos);
    yPos += 10;

    const sentiments = ["Positive", "Negative", "Neutral", "Mixed"];
    const colors = {
      Positive: [34, 197, 94],
      Negative: [239, 68, 68],
      Neutral: [156, 163, 175],
      Mixed: [234, 179, 8],
    };

    // Draw score cards
    let xPos = 20;
    const cardWidth = 40;
    const cardHeight = 25;

    sentiments.forEach((sentiment) => {
      const data = statistics[sentiment];
      if (data) {
        // Card background
        doc.setFillColor(...colors[sentiment]);
        doc.roundedRect(xPos, yPos, cardWidth, cardHeight, 3, 3, "F");

        // Card text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(sentiment, xPos + cardWidth / 2, yPos + 8, {
          align: "center",
        });
        doc.setFontSize(14);
        doc.text(String(data.count), xPos + cardWidth / 2, yPos + 16, {
          align: "center",
        });
        doc.setFontSize(8);
        doc.text(data.percentage, xPos + cardWidth / 2, yPos + 22, {
          align: "center",
        });

        xPos += cardWidth + 5;
      }
    });

    doc.setTextColor(0, 0, 0);
    yPos += cardHeight + 15;

    // Detailed Reviews Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Detailed Review Analysis", 20, yPos);
    yPos += 10;

    sentiments.forEach((sentiment) => {
      const data = statistics[sentiment];
      if (data && data.reviews.length > 0) {
        // Check if we need a new page
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        // Sentiment header
        doc.setFillColor(...colors[sentiment]);
        doc.rect(20, yPos, pageWidth - 40, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`${sentiment} Reviews (${data.count})`, 25, yPos + 6);
        doc.setTextColor(0, 0, 0);
        yPos += 12;

        // Reviews
        data.reviews.forEach((review, idx) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(`Review ${idx + 1}:`, 20, yPos);
          yPos += 5;

          doc.setFont("helvetica", "normal");

          // Original text (with word wrap)
          const originalLines = doc.splitTextToSize(
            `Original: ${review.original_text}`,
            pageWidth - 45
          );
          originalLines.forEach((line) => {
            if (yPos > 280) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(line, 25, yPos);
            yPos += 4;
          });

          // Translated text if different
          if (
            review.translated_text &&
            review.translated_text !== review.original_text
          ) {
            const translatedLines = doc.splitTextToSize(
              `Translated: ${review.translated_text}`,
              pageWidth - 45
            );
            translatedLines.forEach((line) => {
              if (yPos > 280) {
                doc.addPage();
                yPos = 20;
              }
              doc.text(line, 25, yPos);
              yPos += 4;
            });
          }

          // Scores
          if (review.scores) {
            const scoresText = Object.entries(review.scores)
              .map(([label, score]) => `${label}: ${(score * 100).toFixed(1)}%`)
              .join(" | ");
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Scores: ${scoresText}`, 25, yPos);
            doc.setTextColor(0, 0, 0);
            yPos += 8;
          }
        });

        yPos += 5;
      }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount} | Generated by Multilingual Review Analyzer`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Save PDF
    const filename = `sentiment_analysis_${mode}_${
      new Date().toISOString().split("T")[0]
    }.pdf`;
    doc.save(filename);
  };

  // Analyze single text
  const handleAnalyzeText = async () => {
    if (!manualText.trim()) {
      setError("Please enter some text to analyze");
      return;
    }

    setError("");
    setManualLoading(true);
    setManualResults(null);

    try {
      const response = await fetch(`${API_BASE}/analyze_text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: manualText }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Analysis failed");
      }

      const data = await response.json();
      setManualResults(data);
    } catch (err) {
      setError(err.message || "Failed to analyze text");
    } finally {
      setManualLoading(false);
    }
  };

  // Scrape and analyze Google Maps reviews
  const handleScrapeReviews = async () => {
    if (!googleUrl.trim()) {
      setError("Please enter a Google Maps URL");
      return;
    }

    setError("");
    setScraperLoading(true);
    setScraperResults(null);

    try {
      const response = await fetch(`${API_BASE}/analyze_reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: googleUrl, limit: reviewLimit }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Scraping failed");
      }

      const data = await response.json();
      setScraperResults(data);
    } catch (err) {
      setError(err.message || "Failed to scrape reviews");
    } finally {
      setScraperLoading(false);
    }
  };

  // Render sentiment statistics
  const renderStatistics = (statistics) => {
    if (!statistics) return null;

    const sentiments = ["Positive", "Negative", "Neutral", "Mixed"];
    const colors = {
      Positive: "bg-green-500",
      Negative: "bg-red-500",
      Neutral: "bg-gray-400",
      Mixed: "bg-yellow-500",
    };
    const bgColors = {
      Positive: "bg-green-50 border-green-200",
      Negative: "bg-red-50 border-red-200",
      Neutral: "bg-gray-50 border-gray-200",
      Mixed: "bg-yellow-50 border-yellow-200",
    };

    return (
      <div className="space-y-4">
        {/* Summary Bars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {sentiments.map((sentiment) => {
            const data = statistics[sentiment];
            if (!data) return null;
            return (
              <div
                key={sentiment}
                className={`p-4 rounded-lg border ${bgColors[sentiment]}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-3 h-3 rounded-full ${colors[sentiment]}`}
                  ></div>
                  <span className="font-medium text-gray-700">{sentiment}</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {data.count}
                </div>
                <div className="text-sm text-gray-500">{data.percentage}</div>
              </div>
            );
          })}
        </div>

        {/* Detailed Reviews */}
        <div className="space-y-3">
          {sentiments.map((sentiment) => {
            const data = statistics[sentiment];
            if (!data || data.reviews.length === 0) return null;

            return (
              <div
                key={sentiment}
                className="border rounded-lg overflow-hidden"
              >
                <div
                  className={`px-4 py-2 ${colors[sentiment]} text-white font-medium`}
                >
                  {sentiment} Reviews ({data.count})
                </div>
                <div className="divide-y max-h-64 overflow-y-auto">
                  {data.reviews.map((review, idx) => (
                    <div key={idx} className="p-3 bg-white hover:bg-gray-50">
                      <p className="text-gray-800 text-sm mb-2">
                        <span className="font-medium">Original:</span>{" "}
                        {review.original_text}
                      </p>
                      {review.translated_text !== review.original_text && (
                        <p className="text-gray-600 text-sm mb-2">
                          <span className="font-medium">Translated:</span>{" "}
                          {review.translated_text}
                        </p>
                      )}
                      <div className="flex gap-2 text-xs">
                        {Object.entries(review.scores || {}).map(
                          ([label, score]) => (
                            <span
                              key={label}
                              className="px-2 py-1 bg-gray-100 rounded"
                            >
                              {label}: {(score * 100).toFixed(1)}%
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
            N
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Sentiment Analysis
            </h1>
            <p className="text-gray-500">Multilingual Review Analyzer</p>
          </div>
        </div>
        <p className="text-gray-600 mt-3">
          Analyze sentiment of reviews in Sinhala or English using
          Translation-Based Transfer Learning with RoBERTa.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => {
              setActiveTab("manual");
              setError("");
            }}
            className={`px-6 py-3 font-medium text-sm transition-all border-b-2 -mb-px ${
              activeTab === "manual"
                ? "border-purple-500 text-purple-600 bg-purple-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Manual Text Analysis
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("scraper");
              setError("");
            }}
            className={`px-6 py-3 font-medium text-sm transition-all border-b-2 -mb-px ${
              activeTab === "scraper"
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Google Maps Scraper
            </span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mb-8">
        {/* Mode 1: Manual Text Input */}
        {activeTab === "manual" && (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg
                className="w-6 h-6 text-purple-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-gray-800">
                Manual Text Analysis
              </h2>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Enter a review in Sinhala or English to analyze its sentiment.
            </p>

            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Enter text to analyze...&#10;&#10;Examples:&#10;• මේක ගොඩාක් ලස්සන තැනක්&#10;• This place was terrible, very disappointing"
              className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-800"
            />

            <button
              onClick={handleAnalyzeText}
              disabled={manualLoading}
              className="mt-4 w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {manualLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Analyze Sentiment"
              )}
            </button>

            {/* Manual Results */}
            {manualResults && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    Analysis Results
                  </h3>
                  <button
                    onClick={() =>
                      generatePDF(manualResults.statistics, "manual")
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:from-red-600 hover:to-pink-600 transition-all shadow-md"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Download PDF
                  </button>
                </div>
                {renderStatistics(manualResults.statistics)}
              </div>
            )}
          </div>
        )}

        {/* Mode 2: Google Maps Scraper */}
        {activeTab === "scraper" && (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg
                className="w-6 h-6 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-gray-800">
                Google Maps Review Scraper
              </h2>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Scrape and analyze reviews from any Google Maps location (hotels,
              restaurants, attractions).
            </p>

            <input
              type="url"
              value={googleUrl}
              onChange={(e) => setGoogleUrl(e.target.value)}
              placeholder="Paste Google Maps URL here..."
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
            />

            <div className="mt-4 flex items-center gap-4">
              <label className="text-gray-600 text-sm">
                Number of reviews:
              </label>
              <input
                type="number"
                value={reviewLimit}
                onChange={(e) =>
                  setReviewLimit(Math.max(1, parseInt(e.target.value) || 10))
                }
                min="1"
                max="100"
                className="w-20 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center"
              />
            </div>

            <button
              onClick={handleScrapeReviews}
              disabled={scraperLoading}
              className="mt-4 w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {scraperLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Scraping & Analyzing...
                </span>
              ) : (
                "Scrape & Analyze Reviews"
              )}
            </button>

            {/* Scraper Results */}
            {scraperResults && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    Analysis Results
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({scraperResults.total_scraped} reviews analyzed)
                    </span>
                  </h3>
                  <button
                    onClick={() =>
                      generatePDF(scraperResults.statistics, "scraper", {
                        url: googleUrl,
                        totalScraped: scraperResults.total_scraped,
                      })
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:from-red-600 hover:to-pink-600 transition-all shadow-md"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Download PDF
                  </button>
                </div>
                {renderStatistics(scraperResults.statistics)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-100">
          <h3 className="font-semibold text-purple-800 mb-2">
            🌐 Multilingual Support
          </h3>
          <p className="text-sm text-purple-600">
            Supports Sinhala and English text with automatic translation.
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-100">
          <h3 className="font-semibold text-blue-800 mb-2">🤖 AI-Powered</h3>
          <p className="text-sm text-blue-600">
            Uses RoBERTa transformer model with translation-based transfer
            learning.
          </p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
          <h3 className="font-semibold text-green-800 mb-2">
            📊 Smart Analysis
          </h3>
          <p className="text-sm text-green-600">
            Detects Positive, Negative, Neutral, and Mixed sentiments with
            confidence scores.
          </p>
        </div>
      </div>
    </div>
  );
}

export default NandikaPage;
