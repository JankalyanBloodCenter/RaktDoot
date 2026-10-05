import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import harbingerLogo from '../assets/harbinger_logo_actual.png';
import omBloodDropIcon from '../assets/om_blood_drop.svg';
import nabhBadgeIcon from '../assets/nabh_accredited_badge_real.png';
import Footer from '../components/layout/Footer';
import {
  Truck, Thermometer, Clock, Award,
  Mail, Lock, Eye, EyeOff, Zap, Phone, Shield
} from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';
import LanguageToggle from '../components/common/LanguageToggle';

export default function LoginPage() {
  const { user, login, loading, error, clearError } = useAuth();
  const { lang, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [localErr, setLocalErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setLocalErr('');
    if (!email || !password) {
      setLocalErr(lang === 'en' ? 'Please enter email and password.' : 'कृपया ईमेल व पासवर्ड प्रविष्ट करा.');
      return;
    }
    // Block driver logins on the web portal
    if (email.trim().toLowerCase().startsWith('driver')) {
      setLocalErr(t.driverRestrictedError);
      return;
    }
    try {
      await login(email.trim(), password);
    } catch (_) {}
  };

  if (user) {
    return <Navigate to="/" replace />;
  }

  const displayError = error || localErr;

  return (
    <div className="brand-login-page">
      {/* Background glow effects */}
      <div className="brand-login-bg-glow" />

      {/* Top Header — Harbinger logo only */}
      <header className="brand-login-header">
        <div className="harbinger-brand">
          <img src={harbingerLogo} alt="Harbinger Group" className="harbinger-logo-img" />
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="brand-login-container">
        {/* Left Branding Column */}
        <section className="brand-info-section">
          {/* Header Badge Icons */}
          <div className="brand-badges-row">
            <div className="om-badge-circle" title="Jankalyan Blood Centre">
              <img src={omBloodDropIcon} alt="Jankalyan Om Blood Drop Emblem" className="brand-badge-img om-badge-img" />
            </div>

            <div className="nabh-badge-circle" title="NABH Accredited">
              <img src={nabhBadgeIcon} alt="NABH Accredited Quality Badge" className="brand-badge-img nabh-badge-img nabh-real-img" />
            </div>
          </div>

          {/* Title & Pill */}
          <h1 className="centre-title">{t.centreTitle}</h1>
          <div className="raktdoot-pill">
            <span className="heart-icon">❤️</span> {t.tag}
          </div>

          {/* Headline & Description */}
          <h2 className="hero-headline">
            {t.heroLine1}
            <span className="highlight-red"> {t.heroLine2}</span>
          </h2>
          <p className="hero-subtitle">{t.loginSubtitle || t.subtitle}</p>

          {/* 4 Feature Cards */}
          <div className="feature-cards-grid">
            <div className="feature-card">
              <div className="feature-icon-box icon-red">
                <Truck size={18} />
              </div>
              <div className="feature-text">
                <div className="feature-card-title">{t.cards[0].title}</div>
                <div className="feature-card-desc">{t.cards[0].desc}</div>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box icon-cyan">
                <Thermometer size={18} />
              </div>
              <div className="feature-text">
                <div className="feature-card-title">{t.cards[1].title}</div>
                <div className="feature-card-desc">{t.cards[1].desc}</div>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box icon-green">
                <Clock size={18} />
              </div>
              <div className="feature-text">
                <div className="feature-card-title">{t.cards[2].title}</div>
                <div className="feature-card-desc">{t.cards[2].desc}</div>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box icon-gold">
                <Award size={18} />
              </div>
              <div className="feature-text">
                <div className="feature-card-title">{t.cards[3].title}</div>
                <div className="feature-card-desc">{t.cards[3].desc}</div>
              </div>
            </div>
          </div>

          {/* Helpline Tag */}
          <div className="helpline-pill">
            <Phone size={13} className="helpline-icon" />
            <span>{t.helpline}</span>
          </div>
        </section>

        {/* Right Sign In Form Card */}
        <section className="brand-signin-section">
          {/* Language Selector — sits right above the card */}
          <LanguageToggle className="signin-lang-selector" />
          <div className="brand-signin-card">
            <div className="login-role-badge-wrap">
              <span className="login-role-badge">
                <Shield size={12} /> {t.portalRolesBadge}
              </span>
            </div>

            <h2 className="signin-title">{t.signInTitle}</h2>
            <p className="signin-subtitle">{t.signInSub}</p>

            {/* Error Message */}
            {displayError && (
              <div className="signin-error-banner">
                {displayError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="signin-form">
              {/* Email Input */}
              <div className="form-group-custom">
                <label className="form-label-custom">{t.emailLabel}</label>
                <div className="input-wrap-custom">
                  <Mail size={16} className="input-icon-left" />
                  <input
                    id="login-email"
                    type="email"
                    className="input-field-custom"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tracker@jankalyan.com or raktdoot@jankalyan.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="form-group-custom">
                <label className="form-label-custom">{t.passwordLabel}</label>
                <div className="input-wrap-custom">
                  <Lock size={16} className="input-icon-left" />
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    className="input-field-custom input-field-pass"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="pass-toggle-btn"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                className="brand-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="loading-span">
                    <span className="spinner-dot" />
                    Signing in...
                  </span>
                ) : (
                  <span className="btn-content">
                    <Zap size={16} className="zap-icon" /> {t.submitBtn}
                  </span>
                )}
              </button>
            </form>

            {/* Driver Portal & Registration Link */}
            <div className="driver-portal-card-link" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                Are you a <strong style={{ color: '#ef4444' }}>Raktdoot Delivery Driver</strong>?
              </p>
              <a
                href={`${import.meta.env.VITE_API_URL || 'https://raktdoot-backend-g8fz.onrender.com'}/driver`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#fca5a5',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                }}
              >
                <Truck size={14} /> Open Driver Portal / Register Driver Account &rarr;
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Global Page Footer */}
      <Footer className="login-footer" />
    </div>
  );
}
