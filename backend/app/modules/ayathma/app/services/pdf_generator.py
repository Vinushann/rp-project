"""
PDF Report Generator
====================

Generates professional PDF reports with:
- Executive summary
- Data quality overview
- Key KPIs with visualizations
- Insights and recommendations
- Anomaly alerts

Uses reportlab for PDF generation.
"""

from __future__ import annotations
from typing import Dict, List, Any, Optional
from io import BytesIO
from datetime import datetime
import base64

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        PageBreak, Image, HRFlowable
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def _format_number(value: Any, kind: str = "number") -> str:
    """Format a number for display."""
    if value is None:
        return "N/A"
    try:
        value = float(value)
        if kind == "money":
            return f"${value:,.2f}"
        elif kind == "percent":
            return f"{value:.1f}%"
        elif kind == "int":
            return f"{int(value):,}"
        else:
            return f"{value:,.2f}"
    except (ValueError, TypeError):
        return str(value)


def _get_grade_color(grade: str) -> tuple:
    """Get color for quality grade."""
    colors_map = {
        'A': (0.2, 0.7, 0.3),  # Green
        'B': (0.5, 0.8, 0.3),  # Light green
        'C': (0.9, 0.8, 0.2),  # Yellow
        'D': (0.9, 0.5, 0.2),  # Orange
        'F': (0.9, 0.3, 0.2),  # Red
    }
    return colors_map.get(grade, (0.5, 0.5, 0.5))


def generate_pdf_report(
    results: Dict[str, Any],
    data_quality: Optional[Dict[str, Any]] = None,
    anomalies: Optional[Dict[str, Any]] = None,
    comparison: Optional[Dict[str, Any]] = None,
    include_sections: Optional[List[str]] = None
) -> bytes:
    """
    Generate a comprehensive PDF report.
    
    Args:
        results: Main analysis results
        data_quality: Data quality assessment results
        anomalies: Anomaly detection results
        comparison: Comparative analysis results
        include_sections: Which sections to include (default: all)
        
    Returns:
        PDF file as bytes
    """
    if not REPORTLAB_AVAILABLE:
        raise ImportError("reportlab is required for PDF generation. Install with: pip install reportlab")
    
    # Default sections
    if include_sections is None:
        include_sections = ['summary', 'quality', 'kpis', 'insights', 'anomalies', 'recommendations']
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1*cm,
        leftMargin=1*cm,
        topMargin=1.5*cm,
        bottomMargin=1.5*cm
    )
    
    # Styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        textColor=colors.HexColor('#1a1a1a'),
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#2d2d2d')
    )
    
    subheading_style = ParagraphStyle(
        'CustomSubHeading',
        parent=styles['Heading3'],
        fontSize=12,
        spaceBefore=15,
        spaceAfter=8,
        textColor=colors.HexColor('#444444')
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        textColor=colors.HexColor('#333333')
    )
    
    elements = []
    
    # === Title Page ===
    dataset_name = results.get('dataset_name', 'Dataset')
    elements.append(Spacer(1, 2*inch))
    elements.append(Paragraph("KPI Analysis Report", title_style))
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph(f"<b>{dataset_name}</b>", ParagraphStyle(
        'DatasetName',
        parent=styles['Normal'],
        fontSize=14,
        alignment=TA_CENTER
    )))
    elements.append(Spacer(1, 0.3*inch))
    elements.append(Paragraph(
        f"Generated on {datetime.now().strftime('%B %d, %Y at %H:%M')}",
        ParagraphStyle('DateStyle', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.gray)
    ))
    
    # Profile summary
    profile = results.get('profile', {})
    elements.append(Spacer(1, 1*inch))
    
    profile_data = [
        ['Dataset Overview', ''],
        ['Total Rows', _format_number(profile.get('rows'), 'int')],
        ['Total Columns', _format_number(profile.get('cols'), 'int')],
    ]
    
    profile_table = Table(profile_data, colWidths=[2.5*inch, 2*inch])
    profile_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f97316')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#fef3e8')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#fed7aa')),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    elements.append(profile_table)
    
    elements.append(PageBreak())
    
    # === Data Quality Section ===
    if 'quality' in include_sections and data_quality:
        elements.append(Paragraph("Data Quality Assessment", heading_style))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e5e7eb')))
        
        grade = data_quality.get('grade', 'N/A')
        grade_label = data_quality.get('grade_label', '')
        overall_score = data_quality.get('overall_score', 0)
        
        # Quality grade box
        grade_text = f"<b>Quality Grade: {grade}</b> ({grade_label}) - Score: {overall_score}/100"
        elements.append(Paragraph(grade_text, ParagraphStyle(
            'GradeStyle',
            parent=styles['Normal'],
            fontSize=14,
            spaceBefore=10,
            spaceAfter=10
        )))
        
        # Quality metrics table
        quality_data = [
            ['Metric', 'Score', 'Status'],
            ['Completeness', f"{data_quality.get('completeness_score', 0):.1f}", '✓' if data_quality.get('completeness_score', 0) >= 80 else '⚠'],
            ['Validity', f"{data_quality.get('validity_score', 0):.1f}", '✓' if data_quality.get('validity_score', 0) >= 80 else '⚠'],
            ['Uniqueness', f"{data_quality.get('uniqueness_score', 0):.1f}", '✓' if data_quality.get('uniqueness_score', 0) >= 80 else '⚠'],
            ['Consistency', f"{data_quality.get('consistency_score', 0):.1f}", '✓' if data_quality.get('consistency_score', 0) >= 80 else '⚠'],
        ]
        
        quality_table = Table(quality_data, colWidths=[2.5*inch, 1.5*inch, 1*inch])
        quality_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#374151')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ]))
        elements.append(quality_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Issues
        issues = data_quality.get('issues', [])
        if issues:
            elements.append(Paragraph("Issues Detected:", subheading_style))
            for issue in issues[:10]:
                severity = issue.get('severity', 'low')
                icon = '🔴' if severity == 'high' else ('🟡' if severity == 'medium' else '🟢')
                msg = issue.get('message', '')
                elements.append(Paragraph(f"  {icon} {msg}", body_style))
        
        elements.append(Spacer(1, 0.3*inch))
    
    # === KPI Summary Section ===
    if 'kpis' in include_sections:
        elements.append(Paragraph("Key Performance Indicators", heading_style))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e5e7eb')))
        
        kpi_summary = results.get('insights', {}).get('kpi_summary', {})
        tiles = kpi_summary.get('tiles', [])
        
        if tiles:
            kpi_data = [['KPI', 'Value']]
            for tile in tiles:
                kpi_data.append([tile.get('label', ''), tile.get('value', 'N/A')])
            
            kpi_table = Table(kpi_data, colWidths=[3*inch, 2.5*inch])
            kpi_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f97316')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#fed7aa')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fff7ed')]),
            ]))
            elements.append(kpi_table)
        
        elements.append(Spacer(1, 0.3*inch))
    
    # === Insights Section ===
    if 'insights' in include_sections:
        elements.append(Paragraph("Key Insights", heading_style))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e5e7eb')))
        
        cards = results.get('insights', {}).get('cards', [])
        
        for i, card in enumerate(cards[:8]):  # Limit to 8 insights
            title = card.get('title', f'Insight {i+1}')
            why = card.get('why', '')
            
            elements.append(Paragraph(f"<b>{i+1}. {title}</b>", subheading_style))
            if why:
                elements.append(Paragraph(why, body_style))
            
            # Include table data if available
            table_data = card.get('table', [])
            if table_data and len(table_data) > 0:
                # Get column names from first row
                cols = list(table_data[0].keys())[:4]  # Limit columns
                
                display_data = [[c for c in cols]]
                for row in table_data[:5]:  # Limit rows
                    display_data.append([str(row.get(c, ''))[:20] for c in cols])
                
                if len(display_data) > 1:
                    insight_table = Table(display_data, colWidths=[1.5*inch] * len(cols))
                    insight_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e5e7eb')),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, -1), 8),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
                        ('TOPPADDING', (0, 0), (-1, -1), 4),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ]))
                    elements.append(insight_table)
            
            elements.append(Spacer(1, 0.2*inch))
    
    # === Anomalies Section ===
    if 'anomalies' in include_sections and anomalies:
        elements.append(PageBreak())
        elements.append(Paragraph("Anomaly Detection", heading_style))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e5e7eb')))
        
        anomaly_score = anomalies.get('anomaly_score', 100)
        total_anomalies = anomalies.get('total_anomalies', 0)
        
        elements.append(Paragraph(
            f"<b>Anomaly Score:</b> {anomaly_score}/100 (higher is better)",
            body_style
        ))
        elements.append(Paragraph(
            f"<b>Total Anomalies Detected:</b> {total_anomalies}",
            body_style
        ))
        
        severity_counts = anomalies.get('severity_counts', {})
        if any(severity_counts.values()):
            sev_text = ", ".join([f"{k}: {v}" for k, v in severity_counts.items() if v > 0])
            elements.append(Paragraph(f"<b>By Severity:</b> {sev_text}", body_style))
        
        elements.append(Spacer(1, 0.2*inch))
        
        # List anomalies
        anomaly_list = anomalies.get('anomalies', [])
        for anom in anomaly_list[:10]:
            severity = anom.get('severity', 'low')
            icon = '🔴' if severity in ['critical', 'high'] else ('🟡' if severity == 'medium' else '🟢')
            desc = anom.get('description', '')
            elements.append(Paragraph(f"  {icon} {desc}", body_style))
    
    # === Recommendations Section ===
    if 'recommendations' in include_sections:
        elements.append(Spacer(1, 0.3*inch))
        elements.append(Paragraph("Recommendations", heading_style))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e5e7eb')))
        
        recommendations = []
        
        # From data quality
        if data_quality:
            recommendations.extend(data_quality.get('recommendations', []))
        
        # Generate additional recommendations based on results
        insights = results.get('insights', {})
        kpi_summary = insights.get('kpi_summary', {})
        
        if not recommendations:
            recommendations.append("Continue monitoring your key metrics regularly.")
            recommendations.append("Consider setting up alerts for anomaly detection.")
        
        for i, rec in enumerate(recommendations[:10], 1):
            elements.append(Paragraph(f"{i}. {rec}", body_style))
    
    # === Footer ===
    elements.append(Spacer(1, 0.5*inch))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e5e7eb')))
    elements.append(Paragraph(
        "Generated by Smart KPI Analyzer",
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.gray, alignment=TA_CENTER)
    ))
    
    # Build PDF
    doc.build(elements)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes


def generate_pdf_base64(
    results: Dict[str, Any],
    data_quality: Optional[Dict[str, Any]] = None,
    anomalies: Optional[Dict[str, Any]] = None,
    **kwargs
) -> str:
    """
    Generate PDF and return as base64 encoded string.
    
    Useful for API responses.
    """
    pdf_bytes = generate_pdf_report(results, data_quality, anomalies, **kwargs)
    return base64.b64encode(pdf_bytes).decode('utf-8')
