import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Image, Animated, StatusBar,
} from 'react-native';
import { DEFAULT_SERVER_URL, PRESET_SERVER_URLS } from '../config/constants';
import {
  loginDriver, registerDriver,
  storeAuth, storeServerUrl, getStoredServerUrl,
} from '../services/api';

const omDropImg    = require('../../assets/om_blood_drop_logo.jpg');
const nabhBadgeImg = require('../../assets/nabh_badge_logo.jpg');

export default function LoginScreen({ onLoginSuccess }) {
  const [activeTab, setActiveTab]               = useState('signin');
  const [serverUrl, setServerUrl]               = useState(DEFAULT_SERVER_URL);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [loading, setLoading]                   = useState(false);
  const [errorMsg, setErrorMsg]                 = useState('');
  const [regErrorMsg, setRegErrorMsg]           = useState('');
  const [regSuccessData, setRegSuccessData]     = useState(null);
  const [isEmailAlreadyExists, setIsEmailAlreadyExists] = useState(false);

  const [siEmail, setSiEmail]       = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siShowPass, setSiShowPass] = useState(false);
  const [siEmailFocused, setSiEmailFocused] = useState(false);
  const [siPassFocused,  setSiPassFocused]  = useState(false);

  const [rgName,     setRgName]     = useState('');
  const [rgEmail,    setRgEmail]    = useState('');
  const [rgPhone,    setRgPhone]    = useState('');
  const [rgVehicleType, setRgVehicleType] = useState('two_wheeler');
  const [rgVehicleNumber, setRgVehicleNumber] = useState('');
  const [rgVehicleFocused, setRgVehicleFocused] = useState(false);
  const [rgPassword, setRgPassword] = useState('');
  const [rgConfirm,  setRgConfirm]  = useState('');
  const [rgShowPass,    setRgShowPass]    = useState(false);
  const [rgShowConfirm, setRgShowConfirm] = useState(false);
  const [rgNameFocused,  setRgNameFocused]  = useState(false);
  const [rgEmailFocused, setRgEmailFocused] = useState(false);
  const [rgPhoneFocused, setRgPhoneFocused] = useState(false);
  const [rgPassFocused,  setRgPassFocused]  = useState(false);
  const [rgConfFocused,  setRgConfFocused]  = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const tabSlide  = useRef(new Animated.Value(0)).current;
  const btnScale  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getStoredServerUrl(DEFAULT_SERVER_URL).then(url => { if (url) setServerUrl(url); });
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setErrorMsg('');
    setRegErrorMsg('');
    setIsEmailAlreadyExists(false);
    Animated.spring(tabSlide, {
      toValue: tab === 'signin' ? 0 : 1,
      useNativeDriver: false,
      tension: 80,
      friction: 10,
    }).start();
  };

  const pressIn  = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  const handleLogin = async (overrideEmail, overridePassword) => {
    const emailToUse = (overrideEmail !== undefined ? overrideEmail : siEmail).trim();
    const passwordToUse = overridePassword !== undefined ? overridePassword : siPassword;

    setErrorMsg('');
    if (!emailToUse || !passwordToUse) {
      const msg = 'Please enter email and password.';
      setErrorMsg(msg);
      Alert.alert('Required', msg);
      return;
    }
    try {
      setLoading(true);
      await storeServerUrl(serverUrl);
      const authData = await loginDriver(serverUrl, emailToUse, passwordToUse);
      await storeAuth(authData);
      onLoginSuccess(authData, serverUrl);
    } catch (err) {
      const msg = err.message || 'Login failed. Please check network or credentials.';
      setErrorMsg(msg);
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const name  = rgName.trim();
    const email = rgEmail.trim();
    const phone = rgPhone.trim();
    setRegErrorMsg('');
    setIsEmailAlreadyExists(false);

    if (!name || !email || !rgPassword) {
      const msg = 'Full name, email, and password are required.';
      setRegErrorMsg(msg);
      Alert.alert('Required', msg);
      return;
    }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email)) {
      const msg = 'Please enter a valid email address.';
      setRegErrorMsg(msg);
      Alert.alert('Invalid Email', msg);
      return;
    }
    if (phone && !/^\+?[0-9\s\-()]{7,15}$/.test(phone)) {
      const msg = 'Please enter a valid phone number.';
      setRegErrorMsg(msg);
      Alert.alert('Invalid Phone', msg);
      return;
    }
    if (rgPassword.length < 6) {
      const msg = 'Password must be at least 6 characters.';
      setRegErrorMsg(msg);
      Alert.alert('Weak Password', msg);
      return;
    }
    if (rgPassword !== rgConfirm) {
      const msg = 'Password and confirm password do not match.';
      setRegErrorMsg(msg);
      Alert.alert('Passwords Mismatch', msg);
      return;
    }
    const vehicleNumber = rgVehicleNumber.trim().toUpperCase();
    if (!vehicleNumber) {
      const msg = 'Please enter your vehicle registration number (e.g. MH 12 AB 1234).';
      setRegErrorMsg(msg);
      Alert.alert('Vehicle Required', msg);
      return;
    }
    try {
      setLoading(true);
      await storeServerUrl(serverUrl);
      const authData = await registerDriver(serverUrl, {
        name,
        email,
        password: rgPassword,
        phone,
        vehicle_type: rgVehicleType,
        vehicle_number: vehicleNumber,
      });
      await storeAuth(authData);
      setRegSuccessData({
        user: authData.user,
        authData,
        vehicleType: rgVehicleType === 'four_wheeler' ? 'Four Wheeler' : 'Two Wheeler',
        vehicleNumber,
      });
      try {
        Alert.alert(
          'Account Created!',
          `Welcome, ${authData.user.name}! Your driver account has been created successfully with ${rgVehicleType === 'four_wheeler' ? 'Four Wheeler' : 'Two Wheeler'} (${vehicleNumber}).`,
          [{ text: 'Continue', onPress: () => onLoginSuccess(authData, serverUrl) }]
        );
      } catch (_) {}
    } catch (err) {
      const errMsg = err.message || 'Registration failed. Please try again.';
      if (errMsg.toLowerCase().includes('already')) {
        setIsEmailAlreadyExists(true);
        setRegErrorMsg('Account already exists for this email! Please sign in with your password.');
      } else {
        setIsEmailAlreadyExists(false);
        setRegErrorMsg(errMsg);
      }
      try {
        Alert.alert(errMsg.toLowerCase().includes('already') ? 'Account Already Exists' : 'Registration Failed', errMsg);
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  const indicatorLeft = useRef(
    tabSlide.interpolate({
      inputRange: [0, 1],
      outputRange: ['2%', '50%'],
    })
  ).current;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080910" />
      <View style={s.glowTL} pointerEvents="none" />
      <View style={s.glowBR} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[s.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          <View style={s.logoBlock}>
            <View style={s.logosRow}>
              <Image source={omDropImg}    style={s.omDropImg}    resizeMode="contain" />
              <Image source={nabhBadgeImg} style={s.nabhBadgeImg} resizeMode="cover" />
            </View>
            <Text style={s.centreName}>Jankalyan Blood Centre</Text>
            <Text style={s.centreNameMr}>जनकल्याण रक्तपेढी, पुणे</Text>
            <View style={s.pill}>
              <Text style={s.pillText}>RAKTDOOT TRACKER</Text>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.tabBar}>
              <Animated.View style={[s.tabIndicator, { left: indicatorLeft }]} />
              <TouchableOpacity style={s.tabBtn} onPress={() => switchTab('signin')} activeOpacity={0.8}>
                <Text style={[s.tabLabel, activeTab === 'signin' && s.tabLabelActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.tabBtn} onPress={() => switchTab('register')} activeOpacity={0.8}>
                <Text style={[s.tabLabel, activeTab === 'register' && s.tabLabelActive]}>Create Account</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'signin' && (
              <View style={s.formSection}>
                <Text style={s.cardTitle}>Welcome Back</Text>
                <Text style={s.cardSub}>Enter your credentials to access the Raktdoot Portal</Text>

                {errorMsg ? (
                  <View style={s.errorBanner}>
                    <Text style={s.errorBannerText}>⚠️ {errorMsg}</Text>
                  </View>
                ) : null}

                <Text style={s.label}>EMAIL ADDRESS / USER ID</Text>
                <View style={[s.inputRow, siEmailFocused && s.inputRowFocused]}>
                  <TextInput style={s.input} placeholder="Enter your email" placeholderTextColor="#94a3b8"
                    value={siEmail} onChangeText={setSiEmail} autoCapitalize="none"
                    keyboardType="email-address" autoCorrect={false}
                    autoComplete="off" importantForAutofill="no"
                    onFocus={() => setSiEmailFocused(true)} onBlur={() => setSiEmailFocused(false)} />
                </View>

                <Text style={s.label}>PASSWORD</Text>
                <View style={[s.inputRow, siPassFocused && s.inputRowFocused]}>
                  <TextInput style={[s.input, { flex: 1 }]} placeholder="Enter your password" placeholderTextColor="#94a3b8"
                    value={siPassword} onChangeText={setSiPassword} secureTextEntry={!siShowPass}
                    autoCorrect={false} autoComplete="off" importantForAutofill="no"
                    onFocus={() => setSiPassFocused(true)} onBlur={() => setSiPassFocused(false)} />
                  <TouchableOpacity onPress={() => setSiShowPass(v => !v)} style={s.eyeBtn} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
                    <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: '600' }}>{siShowPass ? 'HIDE' : 'SHOW'}</Text>
                  </TouchableOpacity>
                </View>

                <ServerConfig serverUrl={serverUrl} setServerUrl={setServerUrl} show={showServerConfig} setShow={setShowServerConfig} />

                <Animated.View style={[{ transform: [{ scale: btnScale }] }, s.btnWrap]}>
                  <TouchableOpacity style={[s.submitBtn, loading && { opacity: 0.65 }]}
                    onPress={() => handleLogin()} onPressIn={pressIn} onPressOut={pressOut} disabled={loading} activeOpacity={0.9}>
                    {loading ? <ActivityIndicator color="white" size="small" /> : <Text style={s.submitText}>Sign In</Text>}
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity onPress={() => switchTab('register')} style={s.switchLink}>
                  <Text style={s.switchLinkText}>New driver? <Text style={s.switchLinkHighlight}>Create an account</Text></Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'register' && (
              <View style={s.formSection}>
                <Text style={s.cardTitle}>Join as Driver</Text>
                <Text style={s.cardSub}>Fill in your details to create your driver account</Text>

                {regSuccessData ? (
                  <View style={s.successCard}>
                    <Text style={s.successIcon}>🎉</Text>
                    <Text style={s.successTitle}>Account Created Successfully!</Text>
                    <Text style={s.successSub}>
                      Welcome, <Text style={{ color: '#34d399', fontWeight: '800' }}>{regSuccessData.user.name}</Text>! Your driver account has been created with {regSuccessData.vehicleType} ({regSuccessData.vehicleNumber}).
                    </Text>
                    <TouchableOpacity
                      style={[s.submitBtn, s.submitBtnGreen, { width: '100%', marginTop: 14 }]}
                      onPress={() => onLoginSuccess(regSuccessData.authData, serverUrl)}
                      activeOpacity={0.9}
                    >
                      <Text style={s.submitText}>🚀 Continue to Driver Dashboard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.switchLink, { marginTop: 10 }]}
                      onPress={() => {
                        setSiEmail(regSuccessData.user.email);
                        setRegSuccessData(null);
                        switchTab('signin');
                      }}
                    >
                      <Text style={s.switchLinkText}>Or <Text style={s.switchLinkHighlight}>Sign In Manually</Text></Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {regErrorMsg ? (
                  <View style={s.errorBanner}>
                    <Text style={s.errorBannerText}>⚠️ {regErrorMsg}</Text>
                    {isEmailAlreadyExists && (
                      <TouchableOpacity
                        style={s.bannerActionBtn}
                        onPress={() => {
                          setSiEmail(rgEmail.trim());
                          switchTab('signin');
                        }}
                      >
                        <Text style={s.bannerActionText}>👉 Click here to Sign In with this email</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}

                <Text style={s.label}>FULL NAME *</Text>
                <View style={[s.inputRow, rgNameFocused && s.inputRowFocused]}>
                  <Text style={s.inputIcon}>👤</Text>
                  <TextInput style={s.input} placeholder="Full Name" placeholderTextColor="#94a3b8"
                    value={rgName} onChangeText={setRgName} autoCorrect={false}
                    autoComplete="off" importantForAutofill="no"
                    onFocus={() => setRgNameFocused(true)} onBlur={() => setRgNameFocused(false)} />
                </View>

                <Text style={s.label}>EMAIL ADDRESS *</Text>
                <View style={[s.inputRow, rgEmailFocused && s.inputRowFocused]}>
                  <Text style={s.inputIcon}>📧</Text>
                  <TextInput style={s.input} placeholder="Enter your email" placeholderTextColor="#94a3b8"
                    value={rgEmail} onChangeText={setRgEmail} autoCapitalize="none"
                    keyboardType="email-address" autoCorrect={false}
                    autoComplete="off" importantForAutofill="no"
                    onFocus={() => setRgEmailFocused(true)} onBlur={() => setRgEmailFocused(false)} />
                </View>

                <Text style={s.label}>PHONE NUMBER</Text>
                <View style={[s.inputRow, rgPhoneFocused && s.inputRowFocused]}>
                  <Text style={s.inputIcon}>📞</Text>
                  <TextInput style={s.input} placeholder="+91 98765 43210" placeholderTextColor="#94a3b8"
                    value={rgPhone} onChangeText={setRgPhone} keyboardType="phone-pad" autoCorrect={false}
                    autoComplete="off" importantForAutofill="no"
                    onFocus={() => setRgPhoneFocused(true)} onBlur={() => setRgPhoneFocused(false)} />
                </View>

                <Text style={s.label}>VEHICLE TYPE *</Text>
                <View style={s.vehicleTypeRow}>
                  <TouchableOpacity
                    style={[s.vehicleTypeBtn, rgVehicleType === 'two_wheeler' && s.vehicleTypeBtnActive]}
                    onPress={() => setRgVehicleType('two_wheeler')}
                    activeOpacity={0.8}
                  >
                    <Text style={s.vehicleTypeIcon}>🛵</Text>
                    <Text style={[s.vehicleTypeLabel, rgVehicleType === 'two_wheeler' && s.vehicleTypeLabelActive]}>
                      Two Wheeler
                    </Text>
                    <Text style={s.vehicleTypeSub}>Bike / Scooter</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.vehicleTypeBtn, rgVehicleType === 'four_wheeler' && s.vehicleTypeBtnActive]}
                    onPress={() => setRgVehicleType('four_wheeler')}
                    activeOpacity={0.8}
                  >
                    <Text style={s.vehicleTypeIcon}>🚐</Text>
                    <Text style={[s.vehicleTypeLabel, rgVehicleType === 'four_wheeler' && s.vehicleTypeLabelActive]}>
                      Four Wheeler
                    </Text>
                    <Text style={s.vehicleTypeSub}>Van / Car</Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.label}>VEHICLE REGISTRATION NUMBER *</Text>
                <View style={[s.inputRow, rgVehicleFocused && s.inputRowFocused]}>
                  <Text style={s.inputIcon}>🔢</Text>
                  <TextInput
                    style={[s.input, { fontWeight: '700', letterSpacing: 1 }]}
                    placeholder="MH 12 AB 1234"
                    placeholderTextColor="#94a3b8"
                    value={rgVehicleNumber}
                    onChangeText={setRgVehicleNumber}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoComplete="off"
                    importantForAutofill="no"
                    onFocus={() => setRgVehicleFocused(true)}
                    onBlur={() => setRgVehicleFocused(false)}
                  />
                </View>

                <Text style={s.label}>PASSWORD *</Text>
                <View style={[s.inputRow, rgPassFocused && s.inputRowFocused]}>
                  <Text style={s.inputIcon}>🔒</Text>
                  <TextInput style={[s.input, { flex: 1 }]} placeholder="Min. 6 characters" placeholderTextColor="#94a3b8"
                    value={rgPassword} onChangeText={setRgPassword} secureTextEntry={!rgShowPass}
                    autoCorrect={false} autoComplete="off" importantForAutofill="no"
                    onFocus={() => setRgPassFocused(true)} onBlur={() => setRgPassFocused(false)} />
                  <TouchableOpacity onPress={() => setRgShowPass(v => !v)} style={s.eyeBtn} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
                    <Text style={s.eyeIcon}>{rgShowPass ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.label}>CONFIRM PASSWORD *</Text>
                <View style={[s.inputRow, rgConfFocused && s.inputRowFocused, rgConfirm && rgPassword !== rgConfirm && s.inputRowError]}>
                  <Text style={s.inputIcon}>🔐</Text>
                  <TextInput style={[s.input, { flex: 1 }]} placeholder="Re-enter password" placeholderTextColor="#94a3b8"
                    value={rgConfirm} onChangeText={setRgConfirm} secureTextEntry={!rgShowConfirm}
                    autoCorrect={false} autoComplete="off" importantForAutofill="no"
                    onFocus={() => setRgConfFocused(true)} onBlur={() => setRgConfFocused(false)} />
                  <TouchableOpacity onPress={() => setRgShowConfirm(v => !v)} style={s.eyeBtn} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
                    <Text style={s.eyeIcon}>{rgShowConfirm ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
                {rgConfirm.length > 0 && rgPassword !== rgConfirm && (
                  <Text style={s.errorHint}>⚠️ Passwords do not match</Text>
                )}


                <View style={s.infoRow}>
                  <Text style={s.infoText}>🔵 Role: <Text style={s.infoHighlight}>Driver</Text>{'   '}🔵 Access: <Text style={s.infoHighlight}>Raktdoot App</Text></Text>
                </View>

                <ServerConfig serverUrl={serverUrl} setServerUrl={setServerUrl} show={showServerConfig} setShow={setShowServerConfig} />

                <Animated.View style={[{ transform: [{ scale: btnScale }] }, s.btnWrap]}>
                  <TouchableOpacity style={[s.submitBtn, s.submitBtnGreen, loading && { opacity: 0.65 }]}
                    onPress={handleRegister} onPressIn={pressIn} onPressOut={pressOut} disabled={loading} activeOpacity={0.9}>
                    {loading ? <ActivityIndicator color="white" size="small" /> : <Text style={s.submitText}>🚀  Create Account</Text>}
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity onPress={() => switchTab('signin')} style={s.switchLink}>
                  <Text style={s.switchLinkText}>Already have an account? <Text style={s.switchLinkHighlight}>Sign in</Text></Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={s.footer}>
            <Image source={require('../../assets/harbinger_logo.png')} style={s.harbingerLogo} resizeMode="contain" />
            <Text style={s.copyright}>© 2026 Jankalyan Blood Centre, Pune</Text>
          </View>

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ServerConfig({ serverUrl, setServerUrl, show, setShow }) {
  return (
    <>
      <TouchableOpacity style={s.serverToggle} onPress={() => setShow(v => !v)}>
        <Text style={s.serverToggleText}>⚙️  Server: <Text style={s.serverUrlValue}>{serverUrl}</Text> <Text style={s.chevron}>{show ? '▲' : '▼'}</Text></Text>
      </TouchableOpacity>
      {show && (
        <View style={s.serverPanel}>
          <Text style={s.serverPanelLabel}>API SERVER ENDPOINT</Text>
          <TextInput style={s.serverInput} value={serverUrl} onChangeText={setServerUrl}
            autoCapitalize="none" placeholder="http://10.0.2.2:5000" placeholderTextColor="#374151" />
          {PRESET_SERVER_URLS.map(p => (
            <TouchableOpacity key={p.url} style={[s.presetBtn, serverUrl === p.url && s.presetBtnActive]} onPress={() => setServerUrl(p.url)}>
              <Text style={[s.presetLabel, serverUrl === p.url && s.presetLabelActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080910' },
  glowTL: { position: 'absolute', top: -60, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(180,20,20,0.16)' },
  glowBR: { position: 'absolute', bottom: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(99,102,241,0.08)' },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: Platform.OS === 'android' ? 24 : 40, paddingBottom: 60 },
  inner: { alignItems: 'center', gap: 20 },
  logoBlock: { alignItems: 'center', gap: 6 },
  logosRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  omDropImg: { width: 72, height: 88, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.55, shadowRadius: 14, elevation: 10 },
  nabhBadgeImg: { width: 80, height: 80 },
  centreName: { fontSize: 20, fontWeight: '800', color: '#ffffff', textAlign: 'center', letterSpacing: 0.2 },
  centreNameMr: { fontSize: 13, color: '#ffffff', textAlign: 'center', fontWeight: '500' },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(220,38,38,0.14)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.35)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4, gap: 5 },
  pillHeart: { fontSize: 11 },
  pillText: { color: '#ffffff', fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  card: { width: '100%', backgroundColor: '#0e0f18', borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(220,38,38,0.42)', overflow: 'hidden', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.28, shadowRadius: 24, elevation: 12 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', margin: 14, borderRadius: 12, padding: 4, position: 'relative', height: 44 },
  tabIndicator: { position: 'absolute', top: 4, width: '48%', height: 36, backgroundColor: '#DC2626', borderRadius: 9, shadowColor: '#DC2626', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 4 },
  tabBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  tabLabel: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  tabLabelActive: { color: '#ffffff', fontWeight: '800' },
  formSection: { paddingHorizontal: 20, paddingBottom: 22 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 4 },
  cardSub: { fontSize: 12, color: '#ffffff', textAlign: 'center', marginBottom: 18, lineHeight: 17 },
  label: { fontSize: 11, fontWeight: '700', color: '#ffffff', letterSpacing: 0.9, marginBottom: 7, textTransform: 'uppercase' },
  vehicleTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  vehicleTypeBtn: { flex: 1, backgroundColor: '#090a11', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  vehicleTypeBtnActive: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.12)' },
  vehicleTypeIcon: { fontSize: 24, marginBottom: 4 },
  vehicleTypeLabel: { fontSize: 12.5, fontWeight: '700', color: '#94a3b8' },
  vehicleTypeLabelActive: { color: '#ffffff', fontWeight: '800' },
  vehicleTypeSub: { fontSize: 10, color: '#64748b', marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#090a11', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 11, paddingHorizontal: 12, marginBottom: 14, minHeight: 48 },
  inputRowFocused: { borderColor: '#ef4444' },
  inputRowError: { borderColor: 'rgba(251,113,133,0.6)' },
  inputIcon: { fontSize: 15, marginRight: 9, color: '#ffffff' },
  input: { flex: 1, color: '#ffffff', fontSize: 14, paddingVertical: 10 },
  eyeBtn: { paddingLeft: 8 },
  eyeIcon: { fontSize: 17 },
  errorHint: { fontSize: 11, color: '#f87171', marginTop: -10, marginBottom: 10, marginLeft: 4 },
  infoRow: { backgroundColor: 'rgba(185,28,28,0.08)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(220,38,38,0.2)' },
  infoText: { fontSize: 11, color: '#ffffff', textAlign: 'center' },
  infoHighlight: { color: '#fca5a5', fontWeight: '700' },
  serverToggle: { paddingVertical: 6 },
  serverToggleText: { fontSize: 11, color: '#ffffff' },
  serverUrlValue: { color: '#fca5a5' },
  chevron: { color: '#ffffff', fontSize: 9 },
  serverPanel: { backgroundColor: '#090a11', borderRadius: 11, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)' },
  serverPanelLabel: { fontSize: 9.5, fontWeight: '700', color: '#f87171', letterSpacing: 0.8, marginBottom: 8 },
  serverInput: { backgroundColor: '#0e0f18', borderRadius: 8, padding: 9, fontSize: 12, color: '#ffffff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 8 },
  presetBtn: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 7, marginBottom: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
  presetBtnActive: { backgroundColor: 'rgba(185,28,28,0.25)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.5)' },
  presetLabel: { fontSize: 11, color: '#ffffff' },
  presetLabelActive: { color: '#ffffff', fontWeight: '700' },
  btnWrap: { marginTop: 14 },
  submitBtn: { backgroundColor: '#DC2626', borderRadius: 13, paddingVertical: 15, alignItems: 'center', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.48, shadowRadius: 14, elevation: 8 },
  submitBtnGreen: { backgroundColor: '#059669', shadowColor: '#059669' },
  submitText: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },
  switchLink: { marginTop: 14, alignItems: 'center' },
  switchLinkText: { fontSize: 13, color: '#ffffff' },
  switchLinkHighlight: { color: '#fca5a5', fontWeight: '700' },
  errorBanner: { backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 14 },
  errorBannerText: { color: '#fca5a5', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  bannerActionBtn: { marginTop: 8, backgroundColor: 'rgba(239, 68, 68, 0.3)', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center' },
  bannerActionText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  successCard: { backgroundColor: 'rgba(16, 185, 129, 0.16)', borderWidth: 1.5, borderColor: '#10b981', borderRadius: 14, padding: 16, marginBottom: 16, alignItems: 'center' },
  successIcon: { fontSize: 32, marginBottom: 6 },
  successTitle: { fontSize: 16, fontWeight: '800', color: '#34d399', textAlign: 'center', marginBottom: 6 },
  successSub: { fontSize: 12.5, color: '#e2e8f0', textAlign: 'center', lineHeight: 18 },
  footer: { alignItems: 'center', gap: 8, marginTop: 16 },
  harbingerLogo: { width: 160, height: 34, opacity: 0.95 },
  copyright: { fontSize: 11, color: '#ffffff', textAlign: 'center' },
});
