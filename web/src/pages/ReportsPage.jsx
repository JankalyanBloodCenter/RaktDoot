import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Calendar, RefreshCw,
  Users, Building2, ChevronDown, Check, ArrowDownToLine,
  Filter, Sparkles, XCircle, AlertTriangle
} from 'lucide-react';
import api, { API_URL } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import LanguageToggle from '../components/common/LanguageToggle';
import harbingerLogo from '../assets/harbinger_logo_actual.png';
import DriverReportView from '../components/reports/DriverReportView';
import HospitalReportView from '../components/reports/HospitalReportView';
import RejectionsReportView from '../components/reports/RejectionsReportView';

const PERIODS = [
  { id: 'today', labelKey: 'today', defaultLabel: 'Today' },
  { id: 'yesterday', labelKey: 'yesterday', defaultLabel: 'Yesterday' },
  { id: 'last_7_days', labelKey: 'last7Days', defaultLabel: 'Last 7 Days' },
  { id: 'last_30_days', labelKey: 'last30Days', defaultLabel: 'Last 30 Days' },
  { id: 'this_month', labelKey: 'thisMonth', defaultLabel: 'This Month' },
  { id: 'custom', labelKey: 'customRange', defaultLabel: 'Custom Range' },
];

export default function ReportsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState('driver'); // 'driver' | 'hospital' | 'rejections'
  const [period, setPeriod] = useState('last_30_days');
  const [selectedDriverId, setSelectedDriverId] = useState('all');
  const [selectedHospitalId, setSelectedHospitalId] = useState('all');
  const [selectedUrgency, setSelectedUrgency] = useState('all');

  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(thirtyDaysAgoStr);
  const [customEnd, setCustomEnd] = useState(todayStr);

  const [driverReportData, setDriverReportData] = useState(null);
  const [hospitalReportData, setHospitalReportData] = useState(null);
  const [rejectionsReportData, setRejectionsReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch report data
  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'driver') {
        const params = {
          driverId: selectedDriverId,
          period,
        };
        if (period === 'custom') {
          params.startDate = customStart;
          params.endDate = customEnd;
        }
        const res = await api.get('/reports/driver', { params });
        if (res.data?.success) {
          setDriverReportData(res.data.data);
        }
      } else if (activeTab === 'hospital') {
        const params = {
          destinationId: selectedHospitalId,
          period,
        };
        if (period === 'custom') {
          params.startDate = customStart;
          params.endDate = customEnd;
        }
        const res = await api.get('/reports/hospital', { params });
        if (res.data?.success) {
          setHospitalReportData(res.data.data);
        }
      } else if (activeTab === 'rejections') {
        const params = {
          driverId: selectedDriverId,
          destinationId: selectedHospitalId,
          urgency: selectedUrgency,
          period,
        };
        if (period === 'custom') {
          params.startDate = customStart;
          params.endDate = customEnd;
        }
        const res = await api.get('/reports/rejections', { params });
        if (res.data?.success) {
          setRejectionsReportData(res.data.data);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, period, selectedDriverId, selectedHospitalId, selectedUrgency, customStart, customEnd]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Export CSV Handler
  const handleDownloadCSV = () => {
    const targetType = activeTab;
    let url = `${API_URL}/api/reports/export/csv?type=${targetType}&period=${period}`;
    if (activeTab === 'driver') {
      url += `&driverId=${selectedDriverId}`;
    } else if (activeTab === 'hospital') {
      url += `&destinationId=${selectedHospitalId}`;
    } else if (activeTab === 'rejections') {
      url += `&driverId=${selectedDriverId}&destinationId=${selectedHospitalId}&urgency=${selectedUrgency}`;
    }
    if (period === 'custom') {
      url += `&startDate=${customStart}&endDate=${customEnd}`;
    }

    // Trigger download with auth token
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `raktdoot-${targetType}-report-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      })
      .catch(err => {
        alert('CSV Export failed: ' + err.message);
      });
  };

  const driversList = rejectionsReportData?.driversList || driverReportData?.driversList || [];
  const hospitalsList = rejectionsReportData?.hospitalsList || hospitalReportData?.hospitalsList || [];

  return (
    <div className="page-content-full reports-page-container">
      {/* Top Bar */}
      <div className="topbar no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={18} style={{ color: 'var(--color-primary)' }} />
          <div>
            <div className="topbar-title">{t.reports || 'Reports & Analytics'}</div>
            <div className="topbar-subtitle">{t.reportsSubtitle || 'Driver analytics, hospital delivery, and task rejection reports'}</div>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <LanguageToggle />
          <div style={{ height: 24, width: 1, background: 'var(--border-default)' }} />
          <img
            src={harbingerLogo}
            alt="Harbinger Group"
            style={{ height: 26, objectFit: 'contain', display: 'block' }}
            title="Harbinger Group"
          />
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Printable Header (Visible only when printing) */}
        <div className="print-only" style={{ display: 'none', marginBottom: 20 }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #b91c1c', paddingBottom: 10 }}>
            <h1 style={{ fontSize: 20, margin: 0, color: '#b91c1c' }}>JANKALYAN BLOOD CENTRE PUNE</h1>
            <p style={{ margin: '4px 0', fontSize: 12 }}>RAKTDOOT COLD-CHAIN FLEET MANAGEMENT SYSTEM</p>
            <p style={{ margin: 0, fontSize: 11, color: '#666' }}>
              Official Dispatch Report · Generated on {new Date().toLocaleString()}
            </p>
          </div>
        </div>

        {/* Tab Selector & Export Actions Row */}
        <div className="no-print" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: 'var(--bg-card)',
          padding: '12px 16px',
          borderRadius: 14,
          border: '1px solid var(--border-default)',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              id="tab-driver-report"
              className={`btn ${activeTab === 'driver' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('driver')}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Users size={15} />
              <span>{t.driverPersonalReport || 'Driver Performance Report'}</span>
            </button>

            <button
              id="tab-hospital-report"
              className={`btn ${activeTab === 'hospital' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('hospital')}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Building2 size={15} />
              <span>{t.hospitalDeliveryReport || 'Hospital Delivery Report'}</span>
            </button>

            <button
              id="tab-rejections-report"
              className={`btn ${activeTab === 'rejections' ? 'btn-danger' : 'btn-ghost'}`}
              onClick={() => setActiveTab('rejections')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: activeTab === 'rejections' ? '#b91c1c' : undefined,
                color: activeTab === 'rejections' ? '#ffffff' : '#f87171',
                borderColor: activeTab === 'rejections' ? '#ef4444' : 'rgba(239, 68, 68, 0.3)',
              }}
            >
              <XCircle size={15} style={{ color: activeTab === 'rejections' ? '#ffffff' : '#ef4444' }} />
              <span>{t.rejectionsReport || 'Declined & Rejected Requests'}</span>
            </button>
          </div>

          {/* Export Action Button - CSV Only */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              id="btn-download-csv"
              className="btn"
              onClick={handleDownloadCSV}
              title="Download Excel / CSV spreadsheet report"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: '8px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
                e.currentTarget.style.borderColor = '#10b981';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
              }}
            >
              <ArrowDownToLine size={16} style={{ color: '#10b981' }} />
              <span>{t.downloadCSV || 'Download CSV'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="no-print" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '12px 16px',
          borderRadius: 12,
          border: '1px solid var(--border-subtle)',
        }}>
          {/* Driver Selector */}
          {(activeTab === 'driver' || activeTab === 'rejections') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Driver:
              </span>
              <select
                id="select-driver-filter"
                className="select"
                style={{ width: 200, fontSize: 12.5 }}
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
              >
                <option value="all">{t.allDrivers || 'All Fleet Drivers'}</option>
                {driversList.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.vehicle_type === 'four_wheeler' ? '🚐 4W' : '🛵 2W'}{d.vehicle_number ? ` · ${d.vehicle_number}` : ''})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Hospital Selector */}
          {(activeTab === 'hospital' || activeTab === 'rejections') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Hospital:
              </span>
              <select
                id="select-hospital-filter"
                className="select"
                style={{ width: 220, fontSize: 12.5 }}
                value={selectedHospitalId}
                onChange={(e) => setSelectedHospitalId(e.target.value)}
              >
                <option value="all">{t.allHospitals || 'All Hospitals & Centers'}</option>
                {hospitalsList.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Urgency Selector (on Rejections tab) */}
          {activeTab === 'rejections' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Urgency:
              </span>
              <select
                id="select-urgency-filter"
                className="select"
                style={{ width: 140, fontSize: 12.5 }}
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value)}
              >
                <option value="all">{t.allUrgencies || 'All Urgencies'}</option>
                <option value="emergency">🚨 Emergency STAT</option>
                <option value="urgent">⚠️ Urgent</option>
                <option value="normal">Normal Routine</option>
              </select>
            </div>
          )}

          {/* Duration Preset Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t.timeDuration || 'Duration'}:
            </span>
            <select
              id="select-period-filter"
              className="select"
              style={{ width: 140, fontSize: 12.5 }}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {PERIODS.map(p => (
                <option key={p.id} value={p.id}>
                  {t[p.labelKey] || p.defaultLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Range Inputs */}
          {period === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date"
                className="input"
                style={{ width: 135, fontSize: 12 }}
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="input"
                style={{ width: 135, fontSize: 12 }}
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          )}

          {/* Refresh Button */}
          <button
            id="btn-refresh-report"
            className="btn btn-ghost btn-sm"
            onClick={loadReport}
            disabled={loading}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{t.generateReport || 'Refresh'}</span>
          </button>
        </div>

        {/* Error notice */}
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, padding: 12, color: 'var(--color-danger)', fontSize: 12.5 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Main Content View */}
        {activeTab === 'driver' && (
          <DriverReportView data={driverReportData} loading={loading} />
        )}
        {activeTab === 'hospital' && (
          <HospitalReportView data={hospitalReportData} loading={loading} />
        )}
        {activeTab === 'rejections' && (
          <RejectionsReportView data={rejectionsReportData} loading={loading} />
        )}
      </div>
    </div>
  );
}
