/** @type {Record<string, Record<string, string>>} */
export const STRINGS = {
  en: {
    title: "Live Regional Alerts",
    tagline: "Public sources only — Israel, Lebanon, Iran",
    enableAlerts: "Enable browser alerts",
    disclaimer:
      "This tool merges open feeds (UN News, GDACS, USGS, optional Home Front JSON). It cannot show real-time military strikes, jamming polygons, or complete casualty totals unless those numbers appear in the linked institutional reports. For evacuation orders, follow your national civil defence and official government channels.",
    countryIsrael: "Israel",
    countryLebanon: "Lebanon",
    countryIran: "Iran",
    layersTitle: "Map layers",
    layerGdacs: "GDACS hazards (floods, cyclones, droughts, quakes)",
    layerUsgs: "USGS earthquakes (M2.5+, 30 days)",
    layerFeed: "Aggregated feed points (from data/live.json)",
    alertsTitle: "Alerts & reports",
    liveUpdating: "Live",
    liveError: "Partial load",
    lastSync: "Last merged sync:",
    noAlerts: "No items in view for this country right now. Widen layers or run the data updater workflow.",
    supportTitle: "Support this project",
    supportBody: "If this map is useful, you can send support via Wise using the reference below.",
    supportWise: "Open Wise",
    copyRef: "Copy reference",
    copied: "Copied",
    sourcesTitle: "Data sources",
    footer:
      "Open source layout; you are responsible for how you use public information. Jamming areas and classified tracks are not available as trustworthy open data on this site.",
    legendTitle: "Legend",
    legendGdacs: "GDACS hazard centroid",
    legendUsgs: "Earthquake",
    legendFeed: "Feed / report link",
    notifyGranted: "Desktop alerts enabled for new items",
    notifyDenied: "Notifications blocked — check browser settings",
  },
  ar: {
    title: "تنبيهات إقليمية مباشرة",
    tagline: "مصادر عامة فقط — إسرائيل، لبنان، إيران",
    enableAlerts: "تفعيل تنبيهات المتصفح",
    disclaimer:
      "تجمع هذه الأداة تغذيات مفتوحة (أخبار الأمم المتحدة، GDACS، USGS، وملف اختياري للجبهة الداخلية). لا يمكنها عرض ضربات عسكرية لحظية أو مضلعات تشويش إلكتروني أو إجماليات ضحايا كاملة إلا إذا وردت الأرقام في التقارير المؤسسية المرتبطة. لأوامر الإخلاء، اتبع الدفاع المدني الرسمي والقنوات الحكومية في بلدك.",
    countryIsrael: "إسرائيل",
    countryLebanon: "لبنان",
    countryIran: "إيران",
    layersTitle: "طبقات الخريطة",
    layerGdacs: "مخاطر GDACS (فيضانات، أعاصير، جفاف، زلازل)",
    layerUsgs: "زلازل USGS (قوة 2.5+، 30 يومًا)",
    layerFeed: "نقاط التغذية المجمّعة (من data/live.json)",
    alertsTitle: "تنبيهات وتقارير",
    liveUpdating: "مباشر",
    liveError: "تحميل جزئي",
    lastSync: "آخر دمج للبيانات:",
    noAlerts: "لا توجد عناصر لهذا البلد الآن. فعّل المزيد من الطبقات أو شغّل سير عمل تحديث البيانات.",
    supportTitle: "ادعم هذا المشروع",
    supportBody: "إذا كانت الخريطة مفيدة، يمكنك الإرسال عبر Wise باستخدام المرجع أدناه.",
    supportWise: "فتح Wise",
    copyRef: "نسخ المرجع",
    copied: "تم النسخ",
    sourcesTitle: "مصادر البيانات",
    footer:
      "تخطيط مفتوح المصدر؛ أنت مسؤول عن استخدام المعلومات العامة. مناطق التشويش والمسارات المصنفة غير متاحة كبيانات مفتوحة موثوقة هنا.",
    legendTitle: "مفتاح",
    legendGdacs: "مركز خطر GDACS",
    legendUsgs: "زلزال",
    legendFeed: "رابط التغذية / التقرير",
    notifyGranted: "تم تفعيل تنبيهات سطح المكتب للعناصر الجديدة",
    notifyDenied: "تم حظر الإشعارات — راجع إعدادات المتصفح",
  },
};

/**
 * @param {string} lang
 * @param {string} key
 */
export function t(lang, key) {
  const pack = STRINGS[lang] || STRINGS.en;
  return pack[key] ?? STRINGS.en[key] ?? key;
}

/**
 * @param {string} lang
 */
export function applyI18n(lang) {
  const isAr = lang === "ar";
  document.documentElement.lang = isAr ? "ar" : "en";
  document.documentElement.dir = isAr ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key && el instanceof HTMLElement) {
      el.textContent = t(lang, key);
    }
  });
}
