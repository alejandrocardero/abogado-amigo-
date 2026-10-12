import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Jurisdiction, UserProfile, AccountRecord } from '../types';
import { Logo } from './Logo';
import { hashPassword, randomSalt, secureContextAvailable } from '../lib/crypto';
import { getAccount, saveAccount, setUser, buildProfileFromAccount } from '../lib/db';
import { VALID_EMAIL_DOMAINS, COUNTRY_CONFIG } from '../lib/appConfig';

interface AuthScreenProps {
  onAuthenticated: (profile: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');

  // Form fields
  const [userName, setUserName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [country, setCountry] = useState<Jurisdiction>('MX');
  const [currency, setCurrency] = useState<string>('MXN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // UI states
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isInlineTermsExpanded, setIsInlineTermsExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync currency when country changes
  const handleSelectCountry = (newCountry: Jurisdiction) => {
    setCountry(newCountry);
    setCurrency(COUNTRY_CONFIG[newCountry].defaultCurrency);
  };

  // Validate Email Domain (gmail.com, yahoo.com, outlook.com, etc.)
  const emailValidation = useMemo(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return { isValid: false, isTyped: false, domain: '', message: '' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return {
        isValid: false,
        isTyped: true,
        domain: '',
        message: 'Ingresa un formato de correo válido (ej. usuario@gmail.com)',
      };
    }
    const domain = trimmed.split('@')[1] || '';
    const isAllowedDomain = VALID_EMAIL_DOMAINS.includes(domain);
    if (!isAllowedDomain) {
      return {
        isValid: false,
        isTyped: true,
        domain,
        message: `El dominio "@${domain}" no está permitido. Usa un proveedor verificado.`,
      };
    }
    return {
      isValid: true,
      isTyped: true,
      domain,
      message: `Proveedor verificado (@${domain})`,
    };
  }, [email]);

  // Evaluate Password Strength
  const passwordStrength = useMemo(() => {
    const checks = {
      minLength: password.length >= 8,
      mixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]]/.test(password),
    };

    const score = Object.values(checks).filter(Boolean).length;

    let label = 'Sin ingresar';
    let colorClass = 'bg-outline-variant/40';
    let textClass = 'text-on-surface-variant';
    let badgeBg = 'bg-surface-container';

    if (password.length > 0) {
      if (score <= 1) {
        label = 'Débil · Riesgo Alto';
        colorClass = 'bg-error';
        textClass = 'text-error';
        badgeBg = 'bg-error-container/50';
      } else if (score === 2) {
        label = 'Regular · Vulnerable';
        colorClass = 'bg-amber-500';
        textClass = 'text-amber-700';
        badgeBg = 'bg-amber-100';
      } else if (score === 3) {
        label = 'Buena · Segura';
        colorClass = 'bg-secondary';
        textClass = 'text-secondary';
        badgeBg = 'bg-secondary-fixed';
      } else {
        label = 'Fuerte · Blindaje Óptimo';
        colorClass = 'bg-[#059669]';
        textClass = 'text-[#065F46]';
        badgeBg = 'bg-[#ECFDF5]';
      }
    }

    return { checks, score, label, colorClass, textClass, badgeBg };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!emailValidation.isValid) {
      setErrorMessage(
        emailValidation.message ||
          'Ingresa un correo válido con un proveedor verificado.'
      );
      return;
    }

    if (mode === 'register') {
      if (!userName.trim()) {
        setErrorMessage('Por favor ingresa tu nombre completo o de representante.');
        return;
      }
      if (!businessName.trim()) {
        setErrorMessage('Por favor ingresa el nombre de tu negocio.');
        return;
      }
      if (passwordStrength.score < 3) {
        setErrorMessage(
          'La contraseña debe tener nivel "Buena" o "Fuerte" (al menos 3 de los 4 requisitos de seguridad).'
        );
        return;
      }
      if (!acceptedTerms) {
        setErrorMessage(
          'Debes leer y aceptar los Términos y Condiciones Legales para crear tu cuenta.'
        );
        return;
      }
      if (!secureContextAvailable()) {
        setErrorMessage('Tu navegador no soporta cifrado seguro (requiere HTTPS o localhost)');
        return;
      }
      if (getAccount(email.trim().toLowerCase())) {
        setErrorMessage('Ya existe una cuenta con este email. Inicia sesión.');
        return;
      }
    } else {
      if (password.length < 1) {
        setErrorMessage('Ingresa tu contraseña.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const selectedCountryObj = COUNTRY_CONFIG[country];
      const selectedCurrencyObj =
        selectedCountryObj.currencies.find((c) => c.code === currency) ||
        selectedCountryObj.currencies[0];

      if (mode === 'register') {
        const salt = randomSalt();
        const passwordHash = await hashPassword(password, salt);
        const account: AccountRecord = {
          email: email.trim().toLowerCase(),
          passwordHash,
          salt,
          userName: userName.trim(),
          businessName: businessName.trim(),
          country,
          countryName: selectedCountryObj.name,
          currency: selectedCurrencyObj.code,
          currencySymbol: selectedCurrencyObj.symbol,
          createdAt: new Date().toISOString(),
          acceptedTermsAt: new Date().toLocaleDateString('es-MX'),
        };
        saveAccount(account);
        setUser(account.email);
        onAuthenticated(buildProfileFromAccount(account));
      } else {
        const account = getAccount(email.trim().toLowerCase());
        if (!account) {
          setErrorMessage(
            'Credenciales inválidas: no existe ninguna cuenta registrada con este email. Regístrate primero.'
          );
          return;
        }
        const hash = await hashPassword(password, account.salt);
        if (hash !== account.passwordHash) {
          setErrorMessage('Email o contraseña incorrectos.');
          return;
        }
        setUser(account.email);
        onAuthenticated(buildProfileFromAccount(account));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9ff] text-on-surface flex flex-col justify-between relative overflow-x-hidden py-6 px-4">
      {/* Subtle Top Institutional Header */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between pb-4">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-auto object-contain" />
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight leading-none font-semibold">
              Abogado Amigo
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Inteligencia Legal
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2.5 py-1 rounded-full border border-outline-variant/25 shadow-xs">
          <span className="material-symbols-outlined text-[14px] text-secondary fill-1">
            verified
          </span>
          <span className="font-label-sm text-label-sm text-on-surface">Sovereign RAG</span>
        </div>
      </div>

      {/* Main Authentication Card */}
      <motion.div
        initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md mx-auto bg-surface-container-lowest rounded-2xl p-5 sm:p-6 card-elevated border border-outline-variant/25 flex flex-col gap-5"
      >
        {/* Mode Switcher Tabs (Registro / Iniciar Sesión) */}
        <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl border border-outline-variant/20 relative">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`relative py-2.5 px-3 rounded-lg font-label-md text-label-md font-bold cursor-pointer z-10 flex items-center justify-center gap-1.5 ${
              mode === 'register' ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {mode === 'register' && (
              <motion.span
                layoutId="authModeActiveTab"
                className="absolute inset-0 rounded-lg bg-primary shadow-sm -z-10"
                transition={{ type: 'spring', stiffness: 440, damping: 32 }}
              />
            )}
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            <span>Registro</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`relative py-2.5 px-3 rounded-lg font-label-md text-label-md font-bold cursor-pointer z-10 flex items-center justify-center gap-1.5 ${
              mode === 'login' ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {mode === 'login' && (
              <motion.span
                layoutId="authModeActiveTab"
                className="absolute inset-0 rounded-lg bg-primary shadow-sm -z-10"
                transition={{ type: 'spring', stiffness: 440, damping: 32 }}
              />
            )}
            <span className="material-symbols-outlined text-[16px]">login</span>
            <span>Iniciar Sesión</span>
          </button>
        </div>

        {/* Editorial Title */}
        <div className="space-y-1">
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-bold">
            {mode === 'register' ? 'Alta de Tenant Empresarial' : 'Acceso al Portal Jurídico'}
          </span>
          <h1 className="font-headline-md text-headline-md text-on-surface font-semibold leading-snug">
            {mode === 'register'
              ? 'Configura el blindaje legal de tu negocio'
              : 'Bienvenido de nuevo a tu despacho digital'}
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {mode === 'register'
              ? 'Indexación directa con el Diario Oficial (DOF México, Gaceta de Cuba y República Dominicana).'
              : 'Ingresa con tu correo verificado para consultar tus dictámenes y monitores de gaceta.'}
          </p>
        </div>

        {/* Error Alert Banner */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="p-3 rounded-xl bg-error-container/70 border border-error/30 text-on-error-container text-xs flex items-start gap-2"
            >
              <span className="material-symbols-outlined text-error text-[18px] flex-shrink-0 mt-0.5">
                error
              </span>
              <span className="font-medium leading-relaxed">{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <AnimatePresence mode="popLayout">
            {mode === 'register' && (
              <motion.div
                key="register-extra-fields"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-3.5"
              >
                {/* Nombre del Usuario */}
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center justify-between">
                    <span>Nombre del Usuario / Representante</span>
                    <span className="text-[10px] text-secondary font-bold">Obligatorio</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[19px]">
                      badge
                    </span>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Ej. Alejandro Lázaro"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/70 focus:outline-none focus:border-secondary focus:bg-surface-container-lowest transition-colors"
                    />
                  </div>
                </div>

                {/* Nombre del Negocio */}
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center justify-between">
                    <span>Nombre del Negocio</span>
                    <span className="text-[10px] text-secondary font-bold">Obligatorio</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[19px]">
                      storefront
                    </span>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Ej. Cafetería Especialidad CDMX S.A.S."
                      className="w-full pl-10 pr-3.5 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/70 focus:outline-none focus:border-secondary focus:bg-surface-container-lowest transition-colors"
                    />
                  </div>
                </div>

                {/* País y Moneda del País */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* País */}
                  <div className="flex flex-col gap-1">
                    <label className="font-label-md text-label-md text-on-surface font-semibold">
                      País / Jurisdicción
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/25">
                      {(['MX', 'CU', 'DO'] as Jurisdiction[]).map((code) => {
                        const cfg = COUNTRY_CONFIG[code];
                        const isSelected = country === code;
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => handleSelectCountry(code)}
                            className={`py-2 px-1.5 rounded-lg font-label-sm text-label-sm flex items-center justify-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-primary text-on-primary font-bold shadow-xs'
                                : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            <span className="text-sm">{cfg.flag}</span>
                            <span>{code}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Moneda del País */}
                  <div className="flex flex-col gap-1">
                    <label className="font-label-md text-label-md text-on-surface font-semibold">
                      Moneda del País
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-secondary text-[18px]">
                        payments
                      </span>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-on-surface font-label-md text-label-md focus:outline-none focus:border-secondary cursor-pointer"
                      >
                        {COUNTRY_CONFIG[country].currencies.map((curr) => (
                          <option key={curr.code} value={curr.code}>
                            {curr.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Active Country Gazette Info Strip */}
                <div className="px-3 py-2 rounded-xl bg-surface-container-low/80 border border-outline-variant/20 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span>{COUNTRY_CONFIG[country].flag}</span>
                    <span className="text-on-surface-variant">
                      Gaceta vinculada:{' '}
                      <strong className="text-on-surface">
                        {COUNTRY_CONFIG[country].gazette}
                      </strong>
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-secondary font-bold">
                    {currency}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Correo Electrónico (Solo proveedores válidos: gmail.com, yahoo.com, etc.) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md text-on-surface font-semibold">
                Correo Electrónico Oficial
              </label>
              <span className="text-[10px] text-on-surface-variant font-mono">
                gmail.com · yahoo.com · outlook.com
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[19px]">
                mail
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@gmail.com o @yahoo.com"
                className={`w-full pl-10 pr-9 py-2.5 bg-surface-container-low rounded-xl border text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/70 focus:outline-none focus:bg-surface-container-lowest transition-colors ${
                  !emailValidation.isTyped
                    ? 'border-outline-variant/30 focus:border-secondary'
                    : emailValidation.isValid
                    ? 'border-[#059669] focus:border-[#059669]'
                    : 'border-error focus:border-error'
                }`}
              />
              {emailValidation.isTyped && (
                <span
                  className={`material-symbols-outlined absolute right-3 text-[19px] ${
                    emailValidation.isValid ? 'text-[#059669]' : 'text-error'
                  }`}
                >
                  {emailValidation.isValid ? 'check_circle' : 'cancel'}
                </span>
              )}
            </div>

            {/* Domain Validation Status Pill */}
            {emailValidation.isTyped && (
              <div
                className={`flex items-center gap-1.5 text-[11px] font-medium pt-0.5 ${
                  emailValidation.isValid ? 'text-[#065F46]' : 'text-error'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {emailValidation.isValid ? 'verified_user' : 'warning'}
                </span>
                <span>{emailValidation.message}</span>
              </div>
            )}
          </div>

          {/* Contraseña + Medidor de Fortaleza (Password Strength) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md text-on-surface font-semibold">
                Contraseña de Seguridad
              </label>
              {mode === 'register' && password.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-bold ${passwordStrength.badgeBg} ${passwordStrength.textClass}`}
                >
                  {passwordStrength.label}
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[19px]">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres, mayúscula, número y símbolo"
                className="w-full pl-10 pr-10 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/70 focus:outline-none focus:border-secondary focus:bg-surface-container-lowest transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                aria-label="Mostrar u ocultar contraseña"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>

            {mode === 'register' && (
              <>
                {/* 4-Bar Animated Password Strength Meter */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[1, 2, 3, 4].map((level) => {
                const isActive = password.length > 0 && passwordStrength.score >= level;
                return (
                  <div
                    key={level}
                    className="h-1.5 rounded-full bg-surface-container-high overflow-hidden"
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: isActive ? '100%' : '0%' }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full rounded-full ${passwordStrength.colorClass}`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Live Password Requirements Checklist */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {[
                { key: 'minLength', label: 'Mín. 8 caracteres', met: passwordStrength.checks.minLength },
                { key: 'mixedCase', label: 'Mayúscula y minúscula', met: passwordStrength.checks.mixedCase },
                { key: 'hasNumber', label: 'Al menos 1 número', met: passwordStrength.checks.hasNumber },
                { key: 'hasSpecial', label: 'Símbolo (!@#$%)', met: passwordStrength.checks.hasSpecial },
              ].map((req) => (
                <div
                  key={req.key}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors ${
                    req.met
                      ? 'bg-[#ECFDF5] text-[#065F46] font-semibold'
                      : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {req.met ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span>{req.label}</span>
                </div>
              ))}
                </div>
              </>
            )}
          </div>

          {mode === 'register' && (
          <div className="bg-surface-container-low rounded-xl p-3.5 border border-outline-variant/25 flex flex-col gap-2.5 mt-1">
            <div className="flex items-start justify-between gap-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none flex-1">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-secondary rounded cursor-pointer"
                />
                <span className="font-body-sm text-body-sm text-on-surface leading-snug">
                  Acepto los{' '}
                  <strong className="text-secondary font-semibold">
                    Términos y Condiciones de Uso
                  </strong>
                  , el Aviso de Alcance Normativo y la Política de Privacidad Sovereign RAG.
                </span>
              </label>
            </div>

            {/* Action Buttons for Terms & Conditions */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setIsInlineTermsExpanded(!isInlineTermsExpanded)}
                className="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/25 text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px] text-secondary">
                  {isInlineTermsExpanded ? 'expand_less' : 'expand_more'}
                </span>
                <span>{isInlineTermsExpanded ? 'Ocultar Resumen' : 'Ver Resumen Legal'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTermsModalOpen(true)}
                className="px-3 py-1 rounded-lg bg-secondary-fixed text-secondary font-label-sm text-label-sm font-bold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">gavel</span>
                <span>Leer Términos y Condiciones</span>
              </button>
            </div>

            {/* Inline Expandable Terms & Conditions Section */}
            <AnimatePresence>
              {isInlineTermsExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20 space-y-2 text-xs text-on-surface-variant mt-1">
                    <div className="flex items-center gap-1.5 text-on-surface font-bold">
                      <span className="material-symbols-outlined text-secondary text-[16px]">
                        policy
                      </span>
                      <span>Sección de Términos y Condiciones (Síntesis Ejecutiva)</span>
                    </div>
                    <p className="font-legal-quote text-[13px] italic pl-2.5 border-l-2 border-secondary/40 text-on-surface">
                      "1. Los dictámenes generados por Abogado Amigo se fundamentan en legislación oficial indexada (DOF México, Gaceta Oficial de Cuba y Gaceta Dominicana), teniendo carácter estrictamente orientativo y preventivo para pymes."
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      <li>
                        <strong>Aislamiento de Datos (Sovereign Tenant):</strong> Los contratos, nóminas y documentos subidos al indexador LangGraph se almacenan en colecciones privadas por empresa.
                      </li>
                      <li>
                        <strong>Exactitud Monetaria y Jurisdiccional:</strong> Los cálculos patronales (IMSS, ONAT, TSS) se ajustan a la moneda y país declarados en el registro.
                      </li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          )}

          {/* Primary Submit CTA */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-primary btn-lift-primary text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                isSubmitting ? 'animate-spin' : ''
              }`}
            >
              {isSubmitting ? 'sync' : mode === 'register' ? 'verified_user' : 'login'}
            </span>
            <span>
              {isSubmitting
                ? 'Verificando Credenciales y Jurisdicción...'
                : mode === 'register'
                ? 'Crear Cuenta e Ingresar'
                : 'Iniciar Sesión en Abogado Amigo'}
            </span>
          </button>

        </form>
      </motion.div>

      {/* Footer Legal Note */}
      <div className="w-full max-w-md mx-auto pt-4 text-center">
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          Abogado Amigo v2.4 · Cifrado TLS 1.3 · Jurisdicciones: 🇲🇽 MX · 🇨🇺 CU · 🇩🇴 DO
        </p>
      </div>

      {/* Full Terms & Conditions Modal */}
      <AnimatePresence>
        {isTermsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsTermsModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-outline-variant/25 overflow-hidden flex flex-col max-h-[86vh]"
            >
              {/* Modal Header */}
              <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-secondary/25 border border-secondary/40 flex items-center justify-center">
                    <span className="material-symbols-outlined text-secondary-fixed text-[20px]">
                      gavel
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-white leading-tight">
                      Términos y Condiciones de Uso
                    </h3>
                    <span className="font-label-sm text-label-sm text-white/70">
                      Marco Contractual Sovereign-RAG · MiPyMEs
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-on-surface">
                <div className="p-3.5 bg-surface-container-low rounded-xl border-l-4 border-secondary">
                  <p className="font-legal-quote text-legal-quote text-on-surface italic">
                    "El presente instrumento regula el acceso y uso de la plataforma de inteligencia jurídica Abogado Amigo por parte de titulares, representantes y administradores de Micro, Pequeñas y Medianas Empresas."
                  </p>
                </div>

                <div className="space-y-3 text-xs leading-relaxed text-on-surface-variant">
                  <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20">
                    <h4 className="font-label-md text-label-md text-on-surface font-bold mb-1">
                      1. Naturaleza Informativa y Alcance Legal
                    </h4>
                    <p>
                      Los dictámenes, correlaciones GraphRAG y simulaciones de costos patronales se emiten con base en los textos publicados en el Diario Oficial de la Federación (México), la Gaceta Oficial de la República de Cuba y la Gaceta Oficial de la República Dominicana. No sustituyen el patrocinio letrado presencial ante tribunales.
                    </p>
                  </div>

                  <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20">
                    <h4 className="font-label-md text-label-md text-on-surface font-bold mb-1">
                      2. Verificación de Identidad y Correo Electrónico
                    </h4>
                    <p>
                      Para garantizar la trazabilidad de los dictámenes descargados y las alertas de derogación, el registro exige proveedores de correo electrónico verificados (incluyendo gmail.com, yahoo.com, outlook.com, icloud.com) y contraseñas con alto nivel de entropía.
                    </p>
                  </div>

                  <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20">
                    <h4 className="font-label-md text-label-md text-on-surface font-bold mb-1">
                      3. Soberanía de Documentos e Indexación LangGraph
                    </h4>
                    <p>
                      Los documentos empresariales cargados en el módulo Indexador Universal (PDF, DOCX, JSON, MD, XML) son procesados dentro del espacio vectorial exclusivo del Tenant MiPyME registrado, sin ser compartidos con terceros.
                    </p>
                  </div>

                  <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20">
                    <h4 className="font-label-md text-label-md text-on-surface font-bold mb-1">
                      4. Configuración de Jurisdicción y Moneda Oficial
                    </h4>
                    <p>
                      El usuario declara el país de operación principal y su moneda de curso legal ({currency}) para la parametrización de multas, cuotas de seguridad social y retenciones tributarias.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-surface-container-low flex items-center justify-between border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant font-label-sm text-label-sm font-semibold cursor-pointer"
                >
                  Cerrar Vista
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAcceptedTerms(true);
                    setIsTermsModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-secondary btn-lift-secondary text-white font-label-sm text-label-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Aceptar Términos y Condiciones</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
