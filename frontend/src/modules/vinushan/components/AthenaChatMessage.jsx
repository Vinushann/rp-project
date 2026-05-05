import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ResponsiveContainer,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend,
  Area, AreaChart,
} from 'recharts';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
  '#f472b6', '#fb7185', '#f97316', '#facc15',
  '#34d399', '#22d3ee', '#60a5fa', '#818cf8',
];

function ChartGradients() {
  return (
    <defs>
      {CHART_COLORS.map((color, i) => (
        <linearGradient key={i} id={`athena-gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.8} />
          <stop offset="100%" stopColor={color} stopOpacity={0.15} />
        </linearGradient>
      ))}
    </defs>
  );
}

const CustomChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="athena-chart-tooltip">
      <p className="athena-chart-tooltip-label">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || CHART_COLORS[i % CHART_COLORS.length] }}>
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

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

function IconSpeaker() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" />
      <path d="M15 9.5c1.2 1.2 1.2 3.8 0 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M17.7 7c2.7 2.8 2.7 7.2 0 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M8.5 11.5L12 15l3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="6.5" width="17" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M4.5 8l7.5 5 7.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg className="icon-spin" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="12 20" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function IconExport() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M8.5 10.5L12 14l3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function IconFilePdf() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.4z" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M8.5 15.5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 18h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconFileWord() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.4z" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M8.5 14l1.3 4 1.2-3 1.2 3 1.3-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// Transform Chart.js data format to Recharts format
function transformChartData(chartData) {
  const { labels, datasets } = chartData;
  return labels.map((label, i) => {
    const point = { name: label };
    datasets.forEach((ds) => {
      point[ds.label] = ds.data[i];
    });
    return point;
  });
}

// Modern chart rendering with Recharts
function renderSimpleChart(chart) {
  if (!chart?.chart_data || !chart.chart_data.labels || !chart.chart_data.datasets?.length) return null;

  const { chart_type, datasets } = chart.chart_data;
  const data = transformChartData(chart.chart_data);
  const dataKeys = datasets.map((ds) => ds.label);

  if (chart_type === 'pie') {
    const pieData = data.map((d) => ({ name: d.name, value: d[dataKeys[0]] || 0 }));
    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
            animationBegin={0}
            animationDuration={800}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <RechartsTooltip content={<CustomChartTooltip />} />
          <RechartsLegend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={10}
            wrapperStyle={{ fontSize: '0.8rem', color: '#94a3b8' }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart_type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <ChartGradients />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <RechartsTooltip content={<CustomChartTooltip />} />
          <RechartsLegend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '0.8rem', color: '#94a3b8' }}
          />
          {dataKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2.5}
              fill={`url(#athena-gradient-${i})`}
              dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length], strokeWidth: 0 }}
              activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
              animationDuration={800}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar chart
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <ChartGradients />
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
        <XAxis
          dataKey="name"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <RechartsTooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
        <RechartsLegend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '0.8rem', color: '#94a3b8' }}
        />
        {dataKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            radius={[6, 6, 0, 0]}
            animationDuration={800}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function AthenaChatMessage({ message, charts = [], isLast = false, onDelete = null, messageIndex, userQuestion = '' }) {
  const isUser = message.role === 'user';
  const ragCitations = message.ragCitations || null;
  const ragSources = message.ragSources || null;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [citationsExpanded, setCitationsExpanded] = useState(false);
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
    <div className={`athena-msg ${isUser ? 'user-msg' : 'assistant-msg'}`}>
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div className="athena-msg-header">
          <span className="athena-msg-role">
            {isUser ? 'You' : 'ATHENA'}
          </span>
          <div className="athena-msg-actions">
            {/* Action Buttons for Assistant Messages */}
            {!isUser && (
              <>
                <button
                  className={`msg-action-btn ${isSpeaking ? 'active' : ''}`}
                  onClick={handleSpeak}
                  disabled={isLoadingAudio}
                  title={isLoadingAudio ? 'Loading audio...' : isSpeaking ? 'Stop speaking' : 'Read aloud'}
                >
                  {isLoadingAudio ? <IconSpinner /> : isSpeaking ? <IconStop /> : <IconSpeaker />}
                </button>
                <button
                  className="msg-action-btn"
                  onClick={() => setShowExportModal(true)}
                  title="Export response"
                >
                  <IconDownload />
                </button>
                <button
                  className={`msg-action-btn send-email`}
                  onClick={handleSendToManager}
                  disabled={isLoadingEmail}
                  title={isLoadingEmail ? 'Generating email...' : 'Send to Manager'}
                >
                  {isLoadingEmail ? (
                    <IconSpinner />
                  ) : (
                    <>
                      <IconMail />
                      <span className="btn-label">Send</span>
                    </>
                  )}
                </button>
              </>
            )}
            {/* Delete Button */}
            {onDelete && (
              <button
                className="msg-action-btn delete"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete this Q&A pair"
              >
                <IconClose />
              </button>
            )}
            <span className="athena-msg-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Charts */}
        {!isUser && charts?.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            {charts.map((chart, idx) => (
              <div key={idx} className="chart-container">
                {chart.title && (
                  <h4 className="chart-title">
                    📊 {chart.title}
                  </h4>
                )}
                {chart.chart_data ? (
                  <div style={{ height: '280px' }}>
                    {renderSimpleChart(chart)}
                  </div>
                ) : (chart.image || chart.image_base64) ? (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center',
                    padding: '8px',
                  }}>
                    <img
                      src={`data:image/png;base64,${chart.image || chart.image_base64}`}
                      alt={chart.title || 'Chart'}
                      style={{ maxWidth: '100%', height: 'auto', borderRadius: '6px' }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Message Text */}
        <div className="athena-msg-content">
          {isUser ? (
            <p style={{ margin: 0 }}>{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 style={{ 
                    fontSize: '1.3em', fontWeight: 700, marginTop: '20px', marginBottom: '12px',
                    paddingBottom: '8px', borderBottom: '2px solid var(--athena-primary)',
                    color: 'var(--athena-primary-light)',
                  }}>{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 style={{ fontSize: '1.15em', fontWeight: 600, marginTop: '16px', marginBottom: '10px' }}>{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 style={{ fontSize: '1.05em', fontWeight: 600, marginTop: '14px', marginBottom: '8px' }}>{children}</h3>
                ),
                strong: ({ children }) => (
                  <strong style={{ fontWeight: 600, color: 'var(--athena-primary-light)' }}>{children}</strong>
                ),
                ul: ({ children }) => (<ul style={{ margin: '8px 0', paddingLeft: '24px' }}>{children}</ul>),
                ol: ({ children }) => (<ol style={{ margin: '8px 0', paddingLeft: '24px' }}>{children}</ol>),
                li: ({ children }) => (<li style={{ marginBottom: '4px' }}>{children}</li>),
                code: ({ inline, children }) => (
                  inline ? (
                    <code style={{ background: 'var(--athena-bg)', padding: '2px 6px', borderRadius: '4px', fontFamily: "'SF Mono', Monaco, Menlo, monospace", fontSize: '0.88em' }}>{children}</code>
                  ) : (
                    <pre style={{ background: '#0d0d12', color: '#e2e8f0', padding: '14px 18px', borderRadius: '10px', overflow: 'auto', margin: '12px 0', border: '1px solid var(--athena-border)' }}>
                      <code style={{ fontFamily: "'SF Mono', Monaco, Menlo, monospace" }}>{children}</code>
                    </pre>
                  )
                ),
                blockquote: ({ children }) => (
                  <blockquote style={{ borderLeft: '3px solid var(--athena-primary)', margin: '12px 0', paddingLeft: '16px', color: 'var(--athena-text-secondary)', background: 'var(--athena-accent-light)', padding: '8px 16px', borderRadius: '0 8px 8px 0' }}>{children}</blockquote>
                ),
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88em' }}>{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th style={{ background: 'var(--athena-surface)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, border: '1px solid var(--athena-border)', fontSize: '0.9em' }}>{children}</th>
                ),
                td: ({ children }) => (
                  <td style={{ padding: '10px 14px', border: '1px solid var(--athena-border)' }}>{children}</td>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}

          {/* RAG Citations - Expandable */}
          {ragSources && ragSources.length > 0 && (
            <div className="rag-citations-section">
              <div 
                className="rag-citations-header"
                onClick={() => setCitationsExpanded(!citationsExpanded)}
              >
                <span className="rag-citations-label">
                  📚 Sources ({ragSources.length})
                </span>
                <span className={`rag-citations-toggle ${citationsExpanded ? 'expanded' : ''}`}>
                  ▼
                </span>
              </div>
              {citationsExpanded && (
                <div className="rag-citations-body">
                  {ragSources.map((source, idx) => (
                    <span key={idx} className="rag-source-pill">
                      {source}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title modal-title-with-icon">
              <span className="modal-title-icon" aria-hidden="true"><IconExport /></span>
              <span>Export Response</span>
            </h3>
            <p className="modal-subtitle">Choose your preferred format:</p>
            <div className="modal-actions">
              <button className="modal-btn-primary pdf" onClick={exportToPDF}>
                <span className="modal-btn-icon" aria-hidden="true"><IconFilePdf /></span>
                <div style={{ textAlign: 'left' }}>
                  <div>Export as PDF</div>
                  <div className="modal-btn-text-sub">Best for printing & sharing</div>
                </div>
              </button>
              <button className="modal-btn-primary word" onClick={exportToWord}>
                <span className="modal-btn-icon" aria-hidden="true"><IconFileWord /></span>
                <div style={{ textAlign: 'left' }}>
                  <div>Export as Word</div>
                  <div className="modal-btn-text-sub">Best for editing & reports</div>
                </div>
              </button>
            </div>
            <button className="modal-btn-cancel" onClick={() => setShowExportModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">🗑️ Delete Message</h3>
            <p className="modal-subtitle">
              This will delete both the question and its answer. This action cannot be undone.
            </p>
            <div className="modal-delete-actions">
              <button className="modal-btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                className="modal-btn-delete"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  if (onDelete) onDelete();
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
