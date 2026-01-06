import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

/**
 * Chat Message Component for ATHENA
 * Clean, modern design with chart rendering, text-to-speech, and export features
 */

// Parse markdown to plain text for TTS
function markdownToPlainText(markdown) {
  return markdown
    .replace(/#{1,6}\s?/g, '') // Remove headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
    .replace(/\*(.+?)\*/g, '$1') // Italic
    .replace(/`(.+?)`/g, '$1') // Inline code
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
    .replace(/^\s*[-*+]\s/gm, '') // List items
    .replace(/^\s*\d+\.\s/gm, '') // Numbered lists
    .replace(/>\s?/g, '') // Blockquotes
    .replace(/\|.*\|/g, '') // Tables
    .replace(/---+/g, '') // Horizontal rules
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines
    .trim();
}

// Parse markdown to formatted content for export
function parseMarkdownForExport(markdown) {
  const lines = markdown.split('\n');
  const sections = [];
  
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;
    
    // Headers
    if (trimmedLine.startsWith('### ')) {
      sections.push({ type: 'h3', text: trimmedLine.replace('### ', '') });
    } else if (trimmedLine.startsWith('## ')) {
      sections.push({ type: 'h2', text: trimmedLine.replace('## ', '') });
    } else if (trimmedLine.startsWith('# ')) {
      sections.push({ type: 'h1', text: trimmedLine.replace('# ', '') });
    }
    // Bold text
    else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
      sections.push({ type: 'bold', text: trimmedLine.replace(/\*\*/g, '') });
    }
    // List items
    else if (trimmedLine.match(/^[-*+]\s/)) {
      sections.push({ type: 'bullet', text: trimmedLine.replace(/^[-*+]\s/, '') });
    }
    else if (trimmedLine.match(/^\d+\.\s/)) {
      sections.push({ type: 'number', text: trimmedLine.replace(/^\d+\.\s/, '') });
    }
    // Regular paragraph
    else {
      // Clean up markdown formatting
      const cleanText = trimmedLine
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1');
      sections.push({ type: 'paragraph', text: cleanText });
    }
  });
  
  return sections;
}

// Simple chart rendering function
function renderSimpleChart(chart) {
  if (!chart?.chart_data || !chart.chart_data.labels || !chart.chart_data.datasets?.length) return null;

  const { chart_type, labels, datasets } = chart.chart_data;
  
  const colors = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
  const bgColors = [
    'rgba(14, 165, 233, 0.7)', 
    'rgba(34, 197, 94, 0.7)', 
    'rgba(245, 158, 11, 0.7)', 
    'rgba(239, 68, 68, 0.7)', 
    'rgba(139, 92, 246, 0.7)',
  ];
  
  const themedDatasets = datasets.map((ds, idx) => ({
    ...ds,
    borderColor: colors[idx % colors.length],
    backgroundColor: chart_type === 'line' 
      ? 'rgba(14, 165, 233, 0.1)' 
      : bgColors[idx % bgColors.length],
    pointBackgroundColor: colors[idx % colors.length],
    tension: 0.3,
  }));

  const data = { labels, datasets: themedDatasets };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top',
        labels: { color: '#94a3b8' }
      },
      tooltip: { 
        enabled: true,
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
      },
    },
    scales: chart_type === 'pie' ? {} : {
      x: { 
        ticks: { color: '#94a3b8', maxTicksLimit: 10 },
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
      },
      y: { 
        beginAtZero: true,
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
      },
    },
  };

  if (chart_type === 'pie') {
    return <Pie data={data} options={options} />;
  }
  if (chart_type === 'line') {
    return <Line data={data} options={options} />;
  }
  return <Bar data={data} options={options} />;
}

function AthenaChatMessage({ message, charts = [], isLast = false, onDelete = null, messageIndex, userQuestion = '' }) {
  const isUser = message.role === 'user';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const audioRef = useRef(null);

  // Handle Send to Manager - Call AI to generate email and open Gmail directly
  const handleSendToManager = async () => {
    if (isLoadingEmail) return;
    
    setIsLoadingEmail(true);
    
    // Get manager email and name from settings
    let managerEmail = 'manager@example.com';
    let managerName = 'Manager';
    try {
      const settings = JSON.parse(localStorage.getItem('athena-settings') || '{}');
      if (settings.managerEmail) {
        managerEmail = settings.managerEmail;
      }
      if (settings.managerName) {
        managerName = settings.managerName;
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    
    try {
      // Call backend to generate email using ChatGPT
      const response = await fetch('/api/v1/vinushan/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userQuestion || 'ATHENA Analysis Request',
          answer: message.content,
          manager_email: managerEmail,
          manager_name: managerName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate email');
      }

      const emailData = await response.json();
      
      // Create Gmail compose URL
      const gmailUrl = new URL('https://mail.google.com/mail/?view=cm&fs=1');
      gmailUrl.searchParams.set('to', emailData.to_email);
      gmailUrl.searchParams.set('su', emailData.subject);
      gmailUrl.searchParams.set('body', emailData.body);
      
      // Open Gmail in new tab
      window.open(gmailUrl.toString(), '_blank');
      
    } catch (error) {
      console.error('Error generating email:', error);
      // Fallback: open Gmail with basic content
      const gmailUrl = new URL('https://mail.google.com/mail/?view=cm&fs=1');
      gmailUrl.searchParams.set('to', managerEmail);
      gmailUrl.searchParams.set('su', `ATHENA Report: ${userQuestion?.substring(0, 50) || 'Analysis'}`);
      gmailUrl.searchParams.set('body', `Dear ${managerName},\n\nPlease find the ATHENA analysis below:\n\n${message.content.substring(0, 1000)}\n\nBest regards,\nATHENA System`);
      window.open(gmailUrl.toString(), '_blank');
    } finally {
      setIsLoadingEmail(false);
    }
  };

  // Listen for keyboard shortcut events (only for last assistant message)
  useEffect(() => {
    if (!isLast || isUser) return;

    const handleSpeakerShortcut = () => {
      handleSpeak();
    };

    const handleExportShortcut = () => {
      setShowExportModal(true);
    };

    window.addEventListener('athena-shortcut-speaker', handleSpeakerShortcut);
    window.addEventListener('athena-shortcut-export', handleExportShortcut);

    return () => {
      window.removeEventListener('athena-shortcut-speaker', handleSpeakerShortcut);
      window.removeEventListener('athena-shortcut-export', handleExportShortcut);
    };
  }, [isLast, isUser]);

  // Text-to-Speech Handler using OpenAI TTS API
  const handleSpeak = async () => {
    // If already speaking, stop
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
      return;
    }

    setIsLoadingAudio(true);
    
    try {
      const plainText = markdownToPlainText(message.content);
      
      // Call the backend TTS endpoint
      const response = await fetch('/api/v1/vinushan/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: plainText,
          voice: 'nova', // Warm, natural female voice
        }),
      });

      if (!response.ok) {
        throw new Error('TTS request failed');
      }

      // Create audio blob and play
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Clean up previous audio
      if (audioRef.current) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsLoadingAudio(false);
        URL.revokeObjectURL(audioUrl);
      };

      setIsSpeaking(true);
      setIsLoadingAudio(false);
      await audio.play();
      
    } catch (error) {
      console.error('TTS Error:', error);
      setIsLoadingAudio(false);
      setIsSpeaking(false);
      
      // Fallback to browser speech synthesis if API fails
      const plainText = markdownToPlainText(message.content);
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = 0.9;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(14, 165, 233); // Primary color
    doc.text('ATHENA Response', margin, yPos);
    yPos += 10;

    // Timestamp
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date(message.timestamp).toLocaleString()}`, margin, yPos);
    yPos += 15;

    // Divider line
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // Content
    const sections = parseMarkdownForExport(message.content);
    
    sections.forEach(section => {
      // Check if we need a new page
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      switch (section.type) {
        case 'h1':
          doc.setFontSize(16);
          doc.setTextColor(30, 41, 59);
          doc.setFont(undefined, 'bold');
          yPos += 5;
          doc.text(section.text, margin, yPos);
          yPos += 10;
          break;
        case 'h2':
          doc.setFontSize(14);
          doc.setTextColor(30, 41, 59);
          doc.setFont(undefined, 'bold');
          yPos += 4;
          doc.text(section.text, margin, yPos);
          yPos += 8;
          break;
        case 'h3':
          doc.setFontSize(12);
          doc.setTextColor(30, 41, 59);
          doc.setFont(undefined, 'bold');
          yPos += 3;
          doc.text(section.text, margin, yPos);
          yPos += 7;
          break;
        case 'bold':
          doc.setFontSize(11);
          doc.setTextColor(30, 41, 59);
          doc.setFont(undefined, 'bold');
          doc.text(section.text, margin, yPos);
          yPos += 6;
          break;
        case 'bullet':
          doc.setFontSize(11);
          doc.setTextColor(30, 41, 59);
          doc.setFont(undefined, 'normal');
          const bulletLines = doc.splitTextToSize(`• ${section.text}`, maxWidth - 5);
          doc.text(bulletLines, margin + 5, yPos);
          yPos += bulletLines.length * 5 + 2;
          break;
        case 'number':
          doc.setFontSize(11);
          doc.setTextColor(30, 41, 59);
          doc.setFont(undefined, 'normal');
          const numLines = doc.splitTextToSize(section.text, maxWidth - 10);
          doc.text(numLines, margin + 10, yPos);
          yPos += numLines.length * 5 + 2;
          break;
        default:
          doc.setFontSize(11);
          doc.setTextColor(51, 65, 85);
          doc.setFont(undefined, 'normal');
          const paraLines = doc.splitTextToSize(section.text, maxWidth);
          doc.text(paraLines, margin, yPos);
          yPos += paraLines.length * 5 + 3;
      }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`ATHENA - Context-Aware Forecasting System | Page ${i} of ${pageCount}`, margin, 285);
    }

    doc.save(`athena-response-${Date.now()}.pdf`);
    setShowExportModal(false);
  };

  // Export to Word
  const exportToWord = async () => {
    const sections = parseMarkdownForExport(message.content);
    const docChildren = [];

    // Title
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'ATHENA Response',
            bold: true,
            size: 36,
            color: '0EA5E9',
          }),
        ],
        spacing: { after: 200 },
      })
    );

    // Timestamp
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated: ${new Date(message.timestamp).toLocaleString()}`,
            size: 20,
            color: '64748B',
          }),
        ],
        spacing: { after: 400 },
      })
    );

    // Content
    sections.forEach(section => {
      switch (section.type) {
        case 'h1':
          docChildren.push(
            new Paragraph({
              text: section.text,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 300, after: 150 },
            })
          );
          break;
        case 'h2':
          docChildren.push(
            new Paragraph({
              text: section.text,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 250, after: 120 },
            })
          );
          break;
        case 'h3':
          docChildren.push(
            new Paragraph({
              text: section.text,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 },
            })
          );
          break;
        case 'bold':
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: section.text,
                  bold: true,
                  size: 24,
                }),
              ],
              spacing: { after: 120 },
            })
          );
          break;
        case 'bullet':
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: section.text,
                  size: 22,
                }),
              ],
              bullet: { level: 0 },
              spacing: { after: 80 },
            })
          );
          break;
        case 'number':
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: section.text,
                  size: 22,
                }),
              ],
              numbering: { reference: 'default', level: 0 },
              spacing: { after: 80 },
            })
          );
          break;
        default:
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: section.text,
                  size: 22,
                }),
              ],
              spacing: { after: 120 },
            })
          );
      }
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `athena-response-${Date.now()}.docx`);
    setShowExportModal(false);
  };

  return (
    <div 
      className={`athena-message ${isUser ? 'user' : 'assistant'}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 20px',
        borderRadius: '6px',
        marginBottom: '12px',
        background: isUser 
          ? 'var(--athena-surface)' 
          : 'var(--athena-card)',
        border: '1px solid var(--athena-border)',
        marginLeft: isUser ? '60px' : '0',
        marginRight: isUser ? '0' : '60px',
        borderLeft: !isUser ? '3px solid var(--athena-primary)' : '1px solid var(--athena-border)',
      }}
    >
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px' 
        }}>
          <span style={{ 
            fontWeight: 600, 
            fontSize: '0.85rem',
            color: 'var(--athena-text)',
          }}>
            {isUser ? 'You' : 'Assistant'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Action Buttons for Assistant Messages */}
            {!isUser && (
              <>
                <button
                  onClick={handleSpeak}
                  disabled={isLoadingAudio}
                  title={isLoadingAudio ? 'Loading audio...' : isSpeaking ? 'Stop speaking' : 'Read aloud (AI Voice)'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    border: '1px solid var(--athena-border)',
                    background: isSpeaking ? 'var(--athena-primary)' : isLoadingAudio ? 'var(--athena-surface)' : 'transparent',
                    color: isSpeaking ? 'white' : 'var(--athena-text-secondary)',
                    cursor: isLoadingAudio ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '0.85rem',
                    opacity: isLoadingAudio ? 0.7 : 1,
                  }}
                >
                  {isLoadingAudio ? '⏳' : isSpeaking ? '⏹️' : '🔊'}
                </button>
                <button
                  onClick={() => setShowExportModal(true)}
                  title="Export response"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid var(--athena-border)',
                    background: 'transparent',
                    color: 'var(--athena-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '0.85rem',
                  }}
                >
                  📥
                </button>
                {!isUser && (
                  <button
                    onClick={handleSendToManager}
                    disabled={isLoadingEmail}
                    title={isLoadingEmail ? 'Generating email...' : 'Send to Manager via Gmail'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '28px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(34, 197, 94, 0.5)',
                      background: isLoadingEmail ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.1)',
                      color: '#22c55e',
                      cursor: isLoadingEmail ? 'wait' : 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      gap: '4px',
                      opacity: isLoadingEmail ? 0.7 : 1,
                    }}
                    onMouseOver={(e) => {
                      if (!isLoadingEmail) e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)';
                    }}
                    onMouseOut={(e) => {
                      if (!isLoadingEmail) e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)';
                    }}
                  >
                    {isLoadingEmail ? '⏳ Preparing...' : '📧 Send'}
                  </button>
                )}
              </>
            )}
            {/* Delete Button - for both user and assistant messages */}
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete this Q&A pair"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  border: '1px solid var(--athena-border)',
                  background: 'transparent',
                  color: 'var(--athena-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '0.8rem',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--athena-border)';
                  e.currentTarget.style.color = 'var(--athena-text-secondary)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                ✕
              </button>
            )}
            <span style={{ 
              fontSize: '0.75rem', 
              color: 'var(--athena-text-secondary)' 
            }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Charts */}
        {!isUser && charts?.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {charts.map((chart, idx) => (
              <div 
                key={idx} 
                style={{
                  background: 'var(--athena-bg)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '12px',
                  border: '1px solid var(--athena-border)',
                }}
              >
                {chart.title && (
                  <h4 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--athena-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    📊 {chart.title}
                  </h4>
                )}
                {chart.chart_data ? (
                  <div style={{ height: '300px' }}>
                    {renderSimpleChart(chart)}
                  </div>
                ) : (chart.image || chart.image_base64) ? (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center',
                    background: '#fafafa',
                    borderRadius: '8px',
                    padding: '12px',
                  }}>
                    <img
                      src={`data:image/png;base64,${chart.image || chart.image_base64}`}
                      alt={chart.title || 'Chart'}
                      style={{ 
                        maxWidth: '100%', 
                        height: 'auto',
                        borderRadius: '6px',
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Message Text */}
        <div 
          className="athena-message-content"
          style={{
            lineHeight: 1.7,
            color: 'var(--athena-text)',
            fontSize: '0.95rem',
          }}
        >
          {isUser ? (
            <p style={{ margin: 0 }}>{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 style={{ 
                    fontSize: '1.4em', 
                    fontWeight: 700,
                    marginTop: '20px',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid var(--athena-primary)',
                    color: 'var(--athena-primary)',
                  }}>{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 style={{ 
                    fontSize: '1.2em', 
                    fontWeight: 600,
                    marginTop: '16px',
                    marginBottom: '10px',
                  }}>{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 style={{ 
                    fontSize: '1.1em', 
                    fontWeight: 600,
                    marginTop: '14px',
                    marginBottom: '8px',
                  }}>{children}</h3>
                ),
                strong: ({ children }) => (
                  <strong style={{ fontWeight: 600, color: 'var(--athena-primary)' }}>
                    {children}
                  </strong>
                ),
                ul: ({ children }) => (
                  <ul style={{ margin: '8px 0', paddingLeft: '24px' }}>{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ margin: '8px 0', paddingLeft: '24px' }}>{children}</ol>
                ),
                li: ({ children }) => (
                  <li style={{ marginBottom: '4px' }}>{children}</li>
                ),
                code: ({ inline, children }) => (
                  inline ? (
                    <code style={{
                      background: 'var(--athena-bg)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontFamily: 'Monaco, Menlo, monospace',
                      fontSize: '0.9em',
                    }}>{children}</code>
                  ) : (
                    <pre style={{
                      background: '#1e293b',
                      color: '#f1f5f9',
                      padding: '14px 18px',
                      borderRadius: '10px',
                      overflow: 'auto',
                      margin: '12px 0',
                    }}>
                      <code style={{ fontFamily: 'Monaco, Menlo, monospace' }}>{children}</code>
                    </pre>
                  )
                ),
                blockquote: ({ children }) => (
                  <blockquote style={{
                    borderLeft: '4px solid var(--athena-primary)',
                    margin: '12px 0',
                    paddingLeft: '16px',
                    color: 'var(--athena-text-secondary)',
                    fontStyle: 'italic',
                  }}>{children}</blockquote>
                ),
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.9em',
                    }}>{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th style={{
                    background: 'var(--athena-bg)',
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    border: '1px solid var(--athena-border)',
                  }}>{children}</th>
                ),
                td: ({ children }) => (
                  <td style={{
                    padding: '10px 14px',
                    border: '1px solid var(--athena-border)',
                  }}>{children}</td>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowExportModal(false)}
        >
          <div 
            style={{
              background: 'var(--athena-card)',
              borderRadius: '16px',
              padding: '24px',
              minWidth: '320px',
              maxWidth: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              animation: 'fadeInUp 0.3s ease',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--athena-text)',
            }}>
              📥 Export Response
            </h3>
            <p style={{ 
              margin: '0 0 20px 0', 
              fontSize: '0.9rem',
              color: 'var(--athena-text-secondary)',
            }}>
              Choose your preferred format:
            </p>
            
            <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
              <button
                onClick={exportToPDF}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 20px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>📄</span>
                <div style={{ textAlign: 'left' }}>
                  <div>Export as PDF</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 400 }}>
                    Best for printing & sharing
                  </div>
                </div>
              </button>
              
              <button
                onClick={exportToWord}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 20px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>📝</span>
                <div style={{ textAlign: 'left' }}>
                  <div>Export as Word</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 400 }}>
                    Best for editing & reports
                  </div>
                </div>
              </button>
            </div>
            
            <button
              onClick={() => setShowExportModal(false)}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '12px',
                background: 'var(--athena-bg)',
                color: 'var(--athena-text-secondary)',
                border: '1px solid var(--athena-border)',
                borderRadius: '10px',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            style={{
              background: 'var(--athena-card)',
              borderRadius: '16px',
              padding: '24px',
              minWidth: '320px',
              maxWidth: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              animation: 'fadeInUp 0.3s ease',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--athena-text)',
            }}>
              🗑️ Delete Message
            </h3>
            <p style={{ 
              margin: '0 0 20px 0', 
              fontSize: '0.9rem',
              color: 'var(--athena-text-secondary)',
            }}>
              This will delete both the question and its answer. This action cannot be undone.
            </p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--athena-bg)',
                  color: 'var(--athena-text-secondary)',
                  border: '1px solid var(--athena-border)',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  if (onDelete) onDelete();
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AthenaChatMessage;
