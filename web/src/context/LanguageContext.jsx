import { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    // Brand & Header
    centreTitle: 'Jankalyan Blood Centre, Pune',
    tag: 'RAKTDOOT TRACKER',
    puneLocation: 'Pune, Maharashtra',
    liveConnected: 'Live Connected',
    disconnected: 'Disconnected',
    harbingerPartner: 'Harbinger Group',

    // Sidebar Nav & Section Labels
    dispatchOps: 'Dispatch Operations',
    liveVehicleTracking: 'Vehicle Tracking',
    destinations: 'Destinations',
    notifications: 'Notifications',
    workLogs: 'Work Logs',
    completedWorkLogs: 'Completed Work Logs',
    issuesFeed: 'Issues Feed',
    reports: 'Reports & Analytics',
    reportsSubtitle: 'Generate, view, and download driver analytics and hospital delivery reports',
    driverPersonalReport: 'Driver Personal & Performance Report',
    hospitalDeliveryReport: 'Hospital / Destination Delivery Report',
    rejectionsReport: 'Declined / Rejected Requests Report',
    allUrgencies: 'All Urgencies',
    emergencyStat: 'Emergency STAT',
    urgent: 'Urgent',
    normal: 'Normal',
    downloadCSV: 'Download CSV',
    downloadJSON: 'Download JSON',
    printPDF: 'Print / Save PDF',
    generateReport: 'Generate Report',
    allDrivers: 'All Fleet Drivers',
    allHospitals: 'All Hospitals & Destinations',
    timeDuration: 'Time Duration',
    today: 'Today',
    yesterday: 'Yesterday',
    last7Days: 'Last 7 Days',
    last30Days: 'Last 30 Days',
    thisMonth: 'This Month',
    customRange: 'Custom Range',
    administration: 'Administration',
    userManagement: 'User Management',
    telemetry: 'System Health',
    systemHealth: 'System Health',
    system: 'System',
    settings: 'Settings',
    signOut: 'Sign out',

    // Destinations & Assignment
    destinationManagement: 'Destination & Geofence Management',
    destinationSubtitle: 'Define delivery hubs, adjust geofence boundaries, and assign drivers',
    addDestination: 'Add Destination',
    editDestination: 'Edit Destination',
    deleteDestination: 'Delete Destination',
    destinationName: 'Destination Name',
    address: 'Physical Address',
    radius: 'Geofence Radius (meters)',
    assignDriver: 'Assign Driver',
    assignedDriver: 'Assigned Driver',
    noDriverAssigned: 'No Driver Assigned',
    taskPending: 'Pending Acceptance',
    taskAccepted: 'Accepted',
    taskInProgress: 'In Progress (En Route)',
    taskCompleted: 'Completed',
    taskRejected: 'Rejected',
    taskCancelled: 'Cancelled',
    proximityAlerts: 'Proximity & Geofence Alerts',
    proximitySubtitle: 'Real-time arrival alerts when drivers enter delivery zones',
    markAllRead: 'Mark All Read',
    noNotifications: 'No geofence notifications yet',
    noDestinations: 'No delivery destinations configured yet',

    // Statuses
    active: 'Active',
    idle: 'Idle',
    issue: 'Issue',
    offline: 'Offline',
    all: 'All',

    // Manager Map Page
    liveBloodTransportTracking: 'Blood Transport Tracking',
    liveDispatchBadge: 'LIVE DISPATCH',
    mapSubtitle: 'Real-time cold-chain blood transport & vehicle GPS telemetry',
    bloodDeliveryVehicles: 'Blood Delivery Vehicles',
    live: 'Live',
    searchDriverPlaceholder: 'Search delivery vehicle or driver...',
    focusActiveVehicle: 'Focus Active Vehicle',
    viewAllVehicles: 'View All Vehicles',
    searchMapPlaceholder: 'Search vehicle, driver or location...',
    totalVehiclesTooltip: 'Total transport vehicles on system',
    exactLocation: 'Exact Physical Location',
    speed: 'Speed',
    heading: 'Heading',
    coordinates: 'Coordinates',

    // Manager Issues Page
    issuesTitle: 'Emergency Issues Feed',
    issuesSubtitle: 'Real-time cold chain incidents, vehicle breakdowns, and route delays',
    openIssues: 'Open Issues',
    resolvedIssues: 'Resolved',
    resolveBtn: 'Resolve Issue',
    issueResolvedBanner: 'Issue resolved successfully',
    priorityHigh: 'High Priority',
    priorityMedium: 'Medium Priority',
    priorityLow: 'Low Priority',

    // Admin Users Page
    userMgmtTitle: 'User Management',
    userMgmtSubtitle: 'Manage drivers, managers, and admin accounts',
    createUserBtn: 'Create User',
    editUserBtn: 'Edit User',
    fullName: 'Full Name',
    email: 'Email',
    phone: 'Phone',
    role: 'Role',
    status: 'Status',
    actions: 'Actions',

    // Admin Telemetry Page
    telemetryTitle: 'System Health',
    telemetrySubtitle: 'Live server health & infrastructure telemetry statistics',
    transportOpsSection: 'Transport & Dispatch Operations',
    socketClients: 'Socket Clients',
    activeVehicles: 'Active Vehicles',
    systemHealthSection: 'System Health',
    uptime: 'Uptime',
    totalUsers: 'Total Users',
    locationUpdates: 'Location Updates',
    memoryUsage: 'Memory Usage',
    refresh: 'Refresh',
    refreshing: 'Refreshing...',

    // Settings Page
    settingsTitle: 'Settings',
    languageSetting: 'Language / भाषा निवडा',
    backendUrl: 'Backend URL',

    // Login Page translations
    heroLine1: 'Safe Blood Supply &',
    heroLine2: 'Real-Time Blood Transport Tracking',
    loginSubtitle: 'Advanced digital platform for real-time monitoring of cold-chain blood transport and emergency hospital delivery across Pune.',
    helpline: '24x7 Helpline: 020-24449527, 020-24444502',
    signInTitle: 'Sign In',
    signInSub: 'Manager & Administrator Portal Access',
    portalRolesBadge: 'Manager & Admin Access Only',
    driverRestrictedError: 'Access denied: Only Managers and Administrators can log in to the web portal. Drivers must use the Driver Mobile App.',
    emailLabel: 'EMAIL ADDRESS / USER ID',
    passwordLabel: 'PASSWORD',
    submitBtn: 'Sign In',
    cards: [
      { title: 'Live GPS Tracking', desc: 'Accurate vehicle location & ETA updates' },
      { title: 'Cold-Chain Monitoring', desc: '+2°C to +6°C temperature control' },
      { title: '24x7 Emergency Response', desc: 'Zero-delay emergency blood delivery' },
      { title: 'NABH Quality Standard', desc: 'Accredited quality & patient safety' },
    ],
  },
  mr: {
    // Brand & Header
    centreTitle: 'जनकल्याण रक्तपेढी, पुणे',
    tag: 'रक्तदूत (RAKTDOOT TRACKER)',
    puneLocation: 'पुणे, महाराष्ट्र',
    liveConnected: 'लाईव्ह कनेक्टेड',
    disconnected: 'डिस्कनेक्टेड',
    harbingerPartner: 'हार्बिंजर ग्रुप (Harbinger Group)',

    // Sidebar Nav & Section Labels
    dispatchOps: 'प्रेषण ऑपरेशन्स (Dispatch Operations)',
    liveVehicleTracking: 'वाहन ट्रॅकिंग (Vehicle Tracking)',
    destinations: 'वितरण ठिकाणे (Destinations)',
    notifications: 'सूचना व अलर्ट्स (Notifications)',
    workLogs: 'कार्य नोंदी (Work Logs)',
    completedWorkLogs: 'पूर्ण झालेल्या कार्य नोंदी',
    issuesFeed: 'समस्या व अलर्ट्स (Issues Feed)',
    reports: 'अहवाल व विश्लेषण (Reports)',
    reportsSubtitle: 'चालक कामगिरी व रुग्णालय वितरण अहवाल तयार करा आणि डाउनलोड करा',
    driverPersonalReport: 'चालक वैयक्तिक व कामगिरी अहवाल',
    hospitalDeliveryReport: 'रुग्णालय वितरण अहवाल',
    rejectionsReport: 'नाकारलेल्या विनंत्यांचा अहवाल (Rejections Report)',
    allUrgencies: 'सर्व निकड स्तर (All Urgencies)',
    emergencyStat: 'तातडीची आणीबाणी (Emergency STAT)',
    urgent: 'तातडीचे (Urgent)',
    normal: 'सामान्य (Normal)',
    downloadCSV: 'CSV डाउनलोड',
    downloadJSON: 'JSON डाउनलोड',
    printPDF: 'प्रिंट / PDF सेव्ह करा',
    generateReport: 'अहवाल तयार करा',
    allDrivers: 'सर्व चालक',
    allHospitals: 'सर्व रुग्णालये व ठिकाणे',
    timeDuration: 'कालावधी',
    today: 'आज',
    yesterday: 'काल',
    last7Days: 'मागील ७ दिवस',
    last30Days: 'मागील ३० दिवस',
    thisMonth: 'या महिन्यात',
    customRange: 'सानुकूल तारीख',
    administration: 'प्रशासन (Administration)',
    userManagement: 'वापरकर्ता व्यवस्थापन (Users)',
    telemetry: 'सिस्टम आरोग्य (System Health)',
    systemHealth: 'सिस्टम आरोग्य (System Health)',
    system: 'प्रणाली (System)',
    settings: 'सेटिंग्ज (Settings)',
    signOut: 'बाहेर पडा (Sign Out)',

    // Destinations & Assignment
    destinationManagement: 'वितरण ठिकाण व जिओफेन्स व्यवस्थापन',
    destinationSubtitle: 'वितरण हब निश्चित करा, जिओफेन्स त्रिज्या बदला आणि चालक नियुक्त करा',
    addDestination: 'नवीन ठिकाण जोडा',
    editDestination: 'ठिकाण संपादित करा',
    deleteDestination: 'ठिकाण हटवा',
    destinationName: 'ठिकाणाचे नाव',
    address: 'पत्ता',
    radius: 'जिओफेन्स त्रिज्या (मीटर)',
    assignDriver: 'चालक नियुक्त करा',
    assignedDriver: 'नियुक्त चालक',
    noDriverAssigned: 'कोणताही चालक नियुक्त नाही',
    taskPending: 'स्वीकृती प्रलंबित',
    taskAccepted: 'स्वीकारले',
    taskInProgress: 'प्रवासात (En Route)',
    taskCompleted: 'पूर्ण झाले',
    taskRejected: 'नाकारले',
    taskCancelled: 'रद्द केले',
    proximityAlerts: 'जिओफेन्स व आगमन अलर्ट्स',
    proximitySubtitle: 'चालक वितरण क्षेत्रात प्रवेश करताच रिअल-टाईम सूचना',
    markAllRead: 'सर्व वाचले म्हणून नोंदवा',
    noNotifications: 'सध्या कोणतीही सूचना नाही',
    noDestinations: 'सध्या कोणतेही ठिकाण जोडलेले नाही',

    // Statuses
    active: 'सक्रिय (Active)',
    idle: 'प्रतीक्षेत (Idle)',
    issue: 'समस्या (Issue)',
    offline: 'ऑफलाईन (Offline)',
    all: 'सर्व (All)',

    // Manager Map Page
    liveBloodTransportTracking: 'रक्त वहन ट्रॅकिंग (Vehicle Tracking)',
    liveDispatchBadge: 'लाईव्ह प्रेषण',
    mapSubtitle: 'कोल्ड-चेन रक्त वहन व वाहन GPS टेलिमेट्री रिअल-टाईम मॉनिटरिंग',
    bloodDeliveryVehicles: 'रक्त वितरण वाहने',
    live: 'लाईव्ह',
    searchDriverPlaceholder: 'वाहन क्रमांक किंवा चालक शोधा...',
    focusActiveVehicle: 'सक्रिय वाहनावर लक्ष केंद्रित करा',
    viewAllVehicles: 'सर्व वाहने पहा',
    searchMapPlaceholder: 'वाहन, चालक किंवा ठिकाण शोधा...',
    totalVehiclesTooltip: 'सिस्टमवर एकूण नोंदणीकृत वाहने',
    exactLocation: 'अचूक सध्याचे ठिकाण',
    speed: 'वेग (Speed)',
    heading: 'दिशा (Heading)',
    coordinates: 'अक्षांश / रेखांश',

    // Manager Issues Page
    issuesTitle: 'आणीबाणी समस्या व अलर्ट्स',
    issuesSubtitle: 'कोल्ड चेन तापमान अडचण, वाहन बिघाड व वाहतूक कोंडी अलर्ट्स',
    openIssues: 'सक्रिय समस्या',
    resolvedIssues: 'निवारण झाले',
    resolveBtn: 'समस्या निवारण करा',
    issueResolvedBanner: 'समस्येचे यशस्वीरीत्या निवारण करण्यात आले',
    priorityHigh: 'अति महत्वाचे (High)',
    priorityMedium: 'मध्यम (Medium)',
    priorityLow: 'कमी (Low)',

    // Admin Users Page
    userMgmtTitle: 'वापरकर्ता व्यवस्थापन',
    userMgmtSubtitle: 'चालक, व्यवस्थापक आणि प्रशासक खाती व्यवस्थापित करा',
    createUserBtn: 'नवीन वापरकर्ता जोडा',
    editUserBtn: 'वापरकर्ता संपादित करा',
    fullName: 'पूर्ण नाव',
    email: 'ईमेल',
    phone: 'फोन',
    role: 'भूमिका (Role)',
    status: 'स्थिती (Status)',
    actions: 'क्रिया',

    // Admin Telemetry Page
    telemetryTitle: 'सिस्टम आरोग्य व कार्यक्षमता (System Health)',
    telemetrySubtitle: 'लाईव्ह सर्व्हर आरोग्य व सिस्टीम टेलिमेट्री आकडेवारी',
    transportOpsSection: 'वहन व प्रेषण ऑपरेशन्स',
    socketClients: 'सॉकेट कनेक्शन्स',
    activeVehicles: 'सक्रिय वाहने',
    systemHealthSection: 'सर्व्हर आरोग्य व कार्यक्षमता',
    uptime: 'अप-टाईम (Uptime)',
    totalUsers: 'एकूण वापरकर्ते',
    locationUpdates: 'स्थान अद्यतने (Location Updates)',
    memoryUsage: 'मेमरी वापर',
    refresh: 'रिफ्रेश करा',
    refreshing: 'रिफ्रेश करत आहे...',

    // Settings Page
    settingsTitle: 'सेटिंग्ज (Settings)',
    languageSetting: 'भाषा निवडा / Select Language',
    backendUrl: 'बॅकएंड URL',

    // Login Page translations
    heroLine1: 'सुरक्षित रक्त पुरवठा व',
    heroLine2: 'रियल-टाईम रक्त वहन ट्रॅकिंग',
    loginSubtitle: 'जनकल्याण रक्तपेढी, पुणे अंतर्गत आणीबाणीच्या प्रसंगी हॉस्पिटल व रुग्णांपर्यंत जलद, तापमान-नियंत्रित व सुरक्षित रक्त पिशव्या पोहोचवण्याची अद्ययावत डिजिटल प्रणाली.',
    helpline: '२४x७ आणीबाणी हेल्पलाइन: 020-24449527, 020-24444502',
    signInTitle: 'प्रवेश करा (Sign In)',
    signInSub: 'व्यवस्थापक व प्रशासक पोर्टल प्रवेश',
    portalRolesBadge: 'केवळ व्यवस्थापक व प्रशासक प्रवेश',
    driverRestrictedError: 'प्रवेश नाकारला: वेब पोर्टलवर फक्त व्यवस्थापक आणि प्रशासक प्रवेश करू शकतात. चालकांनी ड्रायव्हर मोबाईल ॲप वापरावे.',
    emailLabel: 'ईमेल पत्ता / वापरकर्ता आयडी',
    passwordLabel: 'संकेतशब्द (पासवर्ड)',
    submitBtn: 'प्रवेश करा (Sign In)',
    cards: [
      { title: 'लाईव्ह GPS ट्रॅकिंग', desc: 'वाहनांचे अचूक लाईव्ह लोकेशन व ETA ट्रॅकिंग' },
      { title: 'कोल्ड-चेन मॉनिटरिंग', desc: '+२°C ते +६°C सुरक्षित तापमान नियंत्रण' },
      { title: '२४x७ आणीबाणी पुरवठा', desc: 'शून्य विलंबाने आणीबाणी रक्त पुरवठा' },
      { title: 'NABH मान्यताप्राप्त', desc: 'रुग्ण सुरक्षा व गुणवत्ता मानकांचे पालन' },
    ],
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('app_lang') || 'en';
  });

  const setLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  const t = translations[lang] || translations.en;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, translations }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
