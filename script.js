const STORE_KEY = "ppExpenseTracker:v1";
const AUTH_KEY = "ppExpenseTrackerAuth:v1";
const KEY_SESSION_KEY = "ppExpenseTrackerCryptoKey:v1";
if (new URLSearchParams(window.location.search).has("reset")) {
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(KEY_SESSION_KEY);
  sessionStorage.removeItem(KEY_SESSION_KEY);
  window.history.replaceState({}, "", window.location.pathname);
}
const currencies = {
  EUR: { symbol: "€", label: "Euro", rateToEur: 1 },
  MKD: { symbol: "мкд", label: "Macedonian Denar", rateToEur: 1 / 61.5 },
  USD: { symbol: "$", label: "US Dollar", rateToEur: 0.92 },
};
const expenseCategories = [
  "Groceries",
  "Leisure",
  "Home",
  "Recurring",
  "Transport",
  "Shopping",
  "Health",
  "Travel",
  "Other",
];
const incomeCategories = ["Salary", "Business", "Investments Income", "Extra Income", "Loan", "Other"];
const palette = ["#eec643", "#001740", "#dd785e", "#3277b8", "#2f8f68", "#8b6fcb", "#d85f73", "#7f8c4f"];

let authSession = loadAuthSession();
const state = loadState(Boolean(authSession?.access_token && storedCryptoRawKey()));
applyStoredRates();
let selectedExpenseCategory = expenseCategories.includes(state.lastExpenseCategory) ? state.lastExpenseCategory : "Groceries";
let selectedIncomeCategory = state.lastIncomeCategory || "Salary";
let calculatorDirty = false;
let editingEntryId = null;
let dashboardRange = "month";
let expenseCurrencyFilter = "";
let incomeCurrencyFilter = "";
let intendedAuthMode = "signin";
let appConfig = { supabaseUrl: "", supabaseAnonKey: "" };
let passwordRecoveryToken = null;
const localSupabaseConfig = {
  supabaseUrl: "https://eswnalbfbzaynwbhqrqj.supabase.co",
  supabaseAnonKey: "sb_publishable_Q19XlDPC84wG0sFzht4xog_gGoFQ_Bj",
};

const today = new Date();
const todayIso = toIsoDate(today);
const currentMonthKey = monthKey(today);

const els = {
  settingsButton: document.querySelector("#settings-button"),
  authButton: document.querySelector("#auth-button"),
  authDialog: document.querySelector("#auth-dialog"),
  authForm: document.querySelector("#auth-form"),
  authClose: document.querySelector("#auth-close"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  authRecoveryCopy: document.querySelector("#auth-recovery-copy"),
  forgotPasswordButton: document.querySelector("#forgot-password-button"),
  authStatus: document.querySelector("#auth-status"),
  settingsDialog: document.querySelector("#settings-dialog"),
  baseCurrency: document.querySelector("#base-currency"),
  dashboardKicker: document.querySelector("#dashboard-kicker"),
  dashboardThisMonth: document.querySelector("#dashboard-this-month"),
  dashboardAllTime: document.querySelector("#dashboard-all-time"),
  trackerRefreshButton: document.querySelector("#tracker-refresh-button"),
  monthLabel: document.querySelector("#month-label"),
  metricIncome: document.querySelector("#metric-income"),
  metricExpenses: document.querySelector("#metric-expenses"),
  metricSaved: document.querySelector("#metric-saved"),
  metricRate: document.querySelector("#metric-rate"),
  dashboardAddIncome: document.querySelector("#dashboard-add-income"),
  dashboardAddExpense: document.querySelector("#dashboard-add-expense"),
  expenseForm: document.querySelector("#expense-form"),
  incomeForm: document.querySelector("#income-form"),
  expenseCategories: document.querySelector("#expense-categories"),
  incomeCategories: document.querySelector("#income-categories"),
  expenseList: document.querySelector("#expense-list"),
  incomeList: document.querySelector("#income-list"),
  pastExpenseList: document.querySelector("#past-expense-list"),
  pastIncomeList: document.querySelector("#past-income-list"),
  expenseDateFilter: document.querySelector("#expense-date-filter"),
  expenseCategoryFilter: document.querySelector("#expense-category-filter"),
  expenseSort: document.querySelector("#expense-sort"),
  expenseCurrencyGroups: document.querySelector("#expense-currency-groups"),
  incomeDateFilter: document.querySelector("#income-date-filter"),
  incomeCategoryFilter: document.querySelector("#income-category-filter"),
  incomeSort: document.querySelector("#income-sort"),
  incomeCurrencyGroups: document.querySelector("#income-currency-groups"),
  expenseStatus: document.querySelector("#expense-status"),
  incomeStatus: document.querySelector("#income-status"),
  calculatorForm: document.querySelector("#calculator-form"),
  resultYears: document.querySelector("#result-years"),
  resultTotal: document.querySelector("#result-total"),
  resultsTable: document.querySelector("#results-table"),
  savingsChart: document.querySelector("#savings-chart"),
  categoryChart: document.querySelector("#category-chart"),
  trendChart: document.querySelector("#trend-chart"),
  insightsList: document.querySelector("#insights-list"),
  topExpenses: document.querySelector("#top-expenses"),
  resetCalculator: document.querySelector("#compound-reset-button"),
};

function loadState(includeEntries = true) {
  const fallback = { entries: [], baseCurrency: "EUR", customExpenseCategories: [] };
  try {
    const saved = { ...fallback, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
    return includeEntries ? saved : { ...saved, entries: [] };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function loadAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

function saveAuthSession(session) {
  authSession = session;
  if (session) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(KEY_SESSION_KEY);
    sessionStorage.removeItem(KEY_SESSION_KEY);
  }
}

function storedCryptoRawKey() {
  const raw = localStorage.getItem(KEY_SESSION_KEY) || sessionStorage.getItem(KEY_SESSION_KEY);
  if (raw && !localStorage.getItem(KEY_SESSION_KEY)) {
    localStorage.setItem(KEY_SESSION_KEY, raw);
    sessionStorage.removeItem(KEY_SESSION_KEY);
  }
  return raw;
}

function saveCryptoRawKey(raw) {
  localStorage.setItem(KEY_SESSION_KEY, raw);
  sessionStorage.removeItem(KEY_SESSION_KEY);
}

function setAuthStatus(message, isError = false) {
  if (!els.authStatus) return;
  els.authStatus.textContent = message;
  els.authStatus.style.color = isError ? "var(--warm)" : "var(--green)";
}

function hasSupabaseConfig() {
  return Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);
}

function authRedirectUrl() {
  return window.location.protocol === "file:"
    ? "https://pp-expense-tracker.vercel.app/"
    : `${window.location.origin}${window.location.pathname}`;
}

function appBasePath() {
  return window.location.pathname.endsWith("/") ? window.location.pathname : `${window.location.pathname}/`;
}

async function loadAppConfig() {
  try {
    const response = await fetch(`${appBasePath()}api/config`);
    if (!response.ok) throw new Error("Config endpoint unavailable");
    appConfig = await response.json();
  } catch {
    appConfig = ["localhost", "127.0.0.1"].includes(window.location.hostname) || window.location.protocol === "file:" ? localSupabaseConfig : { supabaseUrl: "", supabaseAnonKey: "" };
  }
}

function applyStoredRates() {
  Object.entries(state.exchangeRates || {}).forEach(([code, rateToEur]) => {
    if (currencies[code] && Number.isFinite(rateToEur) && rateToEur > 0) {
      currencies[code].rateToEur = rateToEur;
    }
  });
}

async function refreshExchangeRates() {
  const lastUpdated = state.exchangeRatesUpdatedAt || 0;
  const oneDay = 24 * 60 * 60 * 1000;
  if (Date.now() - lastUpdated < oneDay) return;

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/EUR");
    if (!response.ok) throw new Error("Exchange rate refresh failed");
    const data = await response.json();
    const nextRates = {};
    Object.keys(currencies).forEach((code) => {
      if (code === "EUR") {
        nextRates.EUR = 1;
      } else if (Number.isFinite(data.rates?.[code]) && data.rates[code] > 0) {
        nextRates[code] = 1 / data.rates[code];
      }
    });
    state.exchangeRates = nextRates;
    state.exchangeRatesUpdatedAt = Date.now();
    applyStoredRates();
    saveState();
    render();
  } catch {
    // Fallback rates keep the tracker usable when offline or when the rates API is unavailable.
  }
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function deriveRawKey(email, password) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(`pp-expense-tracker:${email.toLowerCase()}`),
      iterations: 210000,
    },
    material,
    256
  );
  return bytesToBase64(bits);
}

async function getCryptoKey() {
  const raw = storedCryptoRawKey();
  if (!raw) throw new Error("Log in again to unlock this device.");
  return crypto.subtle.importKey("raw", base64ToBytes(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptEntry(entry) {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(entry)));
  return {
    id: entry.id,
    encrypted_payload: bytesToBase64(encrypted),
    iv: bytesToBase64(iv),
  };
}

async function decryptEntry(row) {
  const key = await getCryptoKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(row.iv) }, key, base64ToBytes(row.encrypted_payload));
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date) {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(key) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function convertToBase(amount, currency = state.baseCurrency) {
  const source = currencies[currency] || currencies.EUR;
  const target = currencies[state.baseCurrency] || currencies.EUR;
  return (amount * source.rateToEur) / target.rateToEur;
}

function money(value, options = {}) {
  const currency = currencies[state.baseCurrency];
  const amount = Number(value) || 0;
  const digits = options.whole ? 0 : 2;
  if (state.baseCurrency === "MKD") {
    return `${new Intl.NumberFormat("mk-MK", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(amount)} ${currency.symbol}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: state.baseCurrency,
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(amount);
}

function moneyInCurrency(value, currencyCode, options = {}) {
  const currency = currencies[currencyCode] || currencies.EUR;
  const amount = Number(value) || 0;
  const digits = options.whole ? 0 : 2;
  if (currencyCode === "MKD") {
    return `${new Intl.NumberFormat("mk-MK", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(amount)} ${currency.symbol}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(amount);
}

function allExpenseCategories() {
  return expenseCategories;
}

function entryAmount(entry) {
  return convertToBase(entry.amount, entry.currency);
}

function entriesFor(type, month = currentMonthKey) {
  return state.entries.filter((entry) => entry.type === type && monthKey(entry.date) === month);
}

function totalsFor(month = currentMonthKey) {
  const relevantEntries = month ? state.entries.filter((entry) => monthKey(entry.date) === month) : state.entries;
  const income = relevantEntries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entryAmount(entry), 0);
  const expenses = relevantEntries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entryAmount(entry), 0);
  const saved = income - expenses;
  return {
    income,
    expenses,
    saved,
    rate: income > 0 ? (saved / income) * 100 : 0,
  };
}

function averagePositiveSavings() {
  const months = [...new Set(state.entries.map((entry) => monthKey(entry.date)))].sort();
  if (!months.length) return Math.max(0, totalsFor().saved);
  return (
    months.reduce((sum, key) => {
      const saved = totalsFor(key).saved;
      return sum + Math.max(0, saved);
    }, 0) / months.length
  );
}

function calculateSavings({ initialInvestment, monthlyContribution, years, interestRate, frequency }) {
  const annualRate = interestRate / 100;
  const periods = Math.max(1, Math.round(frequency));
  const contributionPerPeriod = (monthlyContribution * 12) / periods;
  const rows = [{ year: 0, contributions: initialInvestment, futureValue: initialInvestment }];
  let balance = initialInvestment;
  for (let period = 1; period <= years * periods; period += 1) {
    balance = balance * (1 + annualRate / periods) + contributionPerPeriod;
    if (period % periods === 0) {
      const year = period / periods;
      rows.push({
        year,
        contributions: initialInvestment + monthlyContribution * 12 * year,
        futureValue: balance,
      });
    }
  }
  return rows;
}

function setupCurrencySelects() {
  const options = Object.entries(currencies)
    .map(([code, item]) => `<option value="${code}">${item.symbol} ${code}</option>`)
    .join("");
  document.querySelectorAll('select[name="currency"], #base-currency').forEach((select) => {
    select.innerHTML = options;
    select.value = state.baseCurrency;
  });
}

function renderCategoryButtons(container, categories, selected, type) {
  container.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-chip${category === selected ? " is-active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      if (type === "expense") {
        selectedExpenseCategory = category;
      } else {
        selectedIncomeCategory = category;
      }
      render();
    });
    container.append(button);
  });
}

function setStatus(type, message) {
  const node = type === "expense" ? els.expenseStatus : els.incomeStatus;
  node.textContent = message;
  window.clearTimeout(node._timer);
  node._timer = window.setTimeout(() => {
    node.textContent = "";
  }, 2600);
}

function addEntry(type, form, category) {
  if (!form.reportValidity()) return;
  if (!category) {
    setStatus(type, "Choose a category first.");
    return;
  }
  const data = new FormData(form);
  const amount = Number(data.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    setStatus(type, "Enter an amount above 0.");
    return;
  }
  const currency = data.get("currency") || state.baseCurrency;
  const date = data.get("date") || todayIso;
  const entry = {
    id: uid(),
    type,
    category,
    amount,
    currency,
    date,
    note: String(data.get("note") || "").trim(),
    createdAt: Date.now(),
  };
  state.entries.push(entry);
  if (type === "expense") state.lastExpenseCategory = category;
  if (type === "income") state.lastIncomeCategory = category;
  form.reset();
  form.elements.date.value = todayIso;
  form.elements.currency.value = state.baseCurrency;
  saveState();
  calculatorDirty = false;
  render();
  setStatus(type, `${type === "expense" ? "Expense" : "Income"} added.`);
  syncToCloudSoon();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function optionsHtml(options, selected) {
  return options
    .map((option) => `<option value="${escapeHtml(option)}"${option === selected ? " selected" : ""}>${escapeHtml(option)}</option>`)
    .join("");
}

function currencyOptionsHtml(selected) {
  return Object.entries(currencies)
    .map(([code, item]) => `<option value="${code}"${code === selected ? " selected" : ""}>${item.symbol} ${code}</option>`)
    .join("");
}

function updateEntryFromForm(id, form) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return false;
  const data = new FormData(form);
  const amount = Number(data.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return false;

  Object.assign(entry, {
    category: String(data.get("category") || entry.category).trim() || entry.category,
    amount,
    currency: data.get("currency") || entry.currency,
    date: data.get("date") || entry.date,
    note: String(data.get("note") || "").trim(),
  });
  saveState();
  calculatorDirty = false;
  syncToCloudSoon();
  return true;
}

function renderDynamicSections() {
  renderDashboard();
  renderCalculator();
  renderInsights();
}

async function supabaseRequest(path, options = {}) {
  if (!hasSupabaseConfig()) throw new Error("Supabase is not configured yet.");
  const { skipAuthRetry, ...requestOptions } = options;
  const makeRequest = async () => {
    const headers = {
      apikey: appConfig.supabaseAnonKey,
      "Content-Type": "application/json",
      ...requestOptions.headers,
    };
    if (authSession?.access_token && !headers.Authorization) {
      headers.Authorization = `Bearer ${authSession.access_token}`;
    }
    return fetch(`${appConfig.supabaseUrl}${path}`, {
      ...requestOptions,
      headers,
    });
  };

  let response = await makeRequest();
  if (response.status === 401 && authSession?.refresh_token && !skipAuthRetry) {
    await refreshAuthSession();
    response = await makeRequest();
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.msg || body?.message || body?.error_description || "Request failed.");
  }
  return body;
}

async function refreshAuthSession() {
  if (!authSession?.refresh_token) throw new Error("Log in again to continue syncing.");
  const response = await fetch(`${appConfig.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: appConfig.supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: authSession.refresh_token }),
  });
  const text = await response.text();
  const session = text ? JSON.parse(text) : null;
  if (!response.ok) {
    saveAuthSession(null);
    state.entries = [];
    saveState();
    render();
    throw new Error(session?.msg || session?.message || "Log in again to continue syncing.");
  }
  const accessToken = session.access_token || session.session?.access_token;
  const refreshToken = session.refresh_token || session.session?.refresh_token || authSession.refresh_token;
  const user = session.user || session.session?.user || authSession.user;
  if (!accessToken) throw new Error("Log in again to continue syncing.");
  saveAuthSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    user: user ? { id: user.id, email: user.email } : authSession.user,
  });
}

async function signInOrCreateAccount(mode, email, password) {
  if (!hasSupabaseConfig()) {
    throw new Error("Accounts are ready in the app, but Supabase environment variables still need to be added in Vercel.");
  }
  const redirectUrl = authRedirectUrl();
  const path =
    mode === "signup"
      ? `/auth/v1/signup?redirect_to=${encodeURIComponent(redirectUrl)}`
      : "/auth/v1/token?grant_type=password";
  const session = await supabaseRequest(path, {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuthRetry: true,
  });
  const accessToken = session.access_token || session.session?.access_token;
  const user = session.user || session.session?.user;
  if (!accessToken || !user) {
    if (mode === "signup") {
      saveCryptoRawKey(await deriveRawKey(email, password));
      throw new Error("Check your email to confirm the account. If you open the link on this device, sync should turn on automatically.");
    }
    throw new Error("Check your email to confirm the account, then log in.");
  }
  saveAuthSession({
    access_token: accessToken,
    refresh_token: session.refresh_token || session.session?.refresh_token || "",
    user: { id: user.id, email: user.email },
  });
  saveCryptoRawKey(await deriveRawKey(email, password));
  await syncToCloud();
}

async function requestPasswordReset(email) {
  if (!hasSupabaseConfig()) {
    throw new Error("Password reset is not connected yet. Try the live Expense Tracker page.");
  }
  const redirectUrl = authRedirectUrl();
  await supabaseRequest(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectUrl)}`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

async function updateRecoveredPassword(password) {
  if (!passwordRecoveryToken) throw new Error("Open the latest password reset email link first.");
  await supabaseRequest("/auth/v1/user", {
    method: "PUT",
    headers: { Authorization: `Bearer ${passwordRecoveryToken}` },
    body: JSON.stringify({ password }),
  });
  passwordRecoveryToken = null;
  saveAuthSession(null);
  state.entries = [];
  saveState();
}

async function userForAccessToken(accessToken) {
  return supabaseRequest("/auth/v1/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
    skipAuthRetry: true,
  });
}

async function handleAuthRedirect() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const searchParams = new URLSearchParams(window.location.search);
  const type = hashParams.get("type") || searchParams.get("type");
  const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token") || searchParams.get("refresh_token");

  if (type === "recovery" && accessToken) {
    passwordRecoveryToken = accessToken;
    window.history.replaceState({}, "", window.location.pathname + window.location.search);
    setAuthMode("recovery");
    setAuthStatus("If you forget your password, saved tracker data may not be recoverable.", true);
    els.authDialog.showModal();
    return true;
  }

  if (accessToken && ["signup", "email_change", "magiclink", "invite"].includes(type)) {
    window.history.replaceState({}, "", window.location.pathname + window.location.search);
    if (!storedCryptoRawKey()) {
      saveAuthSession(null);
      setAuthMode("signin");
      setAuthStatus("Email confirmed. Log in once to unlock encrypted sync.", false);
      els.authDialog.showModal();
      return true;
    }

    try {
      const user = await userForAccessToken(accessToken);
      saveAuthSession({
        access_token: accessToken,
        refresh_token: refreshToken || "",
        user: user ? { id: user.id, email: user.email } : authSession?.user,
      });
      setAuthStatus("Email confirmed. Encrypted sync is active.");
      await loadFromCloud();
      render();
    } catch (error) {
      saveAuthSession(null);
      setAuthMode("signin");
      setAuthStatus("Email confirmed. Log in once to finish syncing.", false);
      els.authDialog.showModal();
    }
    return true;
  }

  if (searchParams.get("error_description") || hashParams.get("error_description")) {
    const message = searchParams.get("error_description") || hashParams.get("error_description");
    window.history.replaceState({}, "", window.location.pathname);
    setAuthMode("signin");
    setAuthStatus(message, true);
    els.authDialog.showModal();
    return true;
  }

  return false;
}

async function syncToCloud() {
  if (!authSession?.access_token || !hasSupabaseConfig()) return;
  const rows = await Promise.all(state.entries.map(encryptEntry));
  if (rows.length) {
    await supabaseRequest("/rest/v1/expense_records?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    });
  }
  await loadFromCloud();
  setAuthStatus("Encrypted sync is active.");
}

async function loadFromCloud(options = {}) {
  if (!authSession?.access_token || !hasSupabaseConfig()) return;
  const rows = await supabaseRequest("/rest/v1/expense_records?select=id,encrypted_payload,iv,updated_at&order=updated_at.asc", {
    method: "GET",
  });
  const cloudEntries = [];
  for (const row of rows || []) {
    try {
      cloudEntries.push(await decryptEntry(row));
    } catch {
      setAuthStatus("Some encrypted records could not be unlocked with this password.", true);
    }
  }
  if (options.replaceLocal) {
    state.entries = cloudEntries;
  } else {
    const byId = new Map([...state.entries, ...cloudEntries].map((entry) => [entry.id, entry]));
    state.entries = Array.from(byId.values());
  }
  saveState();
  render();
}

async function deleteCloudEntry(id) {
  if (!authSession?.access_token || !hasSupabaseConfig()) return;
  await supabaseRequest(`/rest/v1/expense_records?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

function syncToCloudSoon() {
  if (!authSession?.access_token || !storedCryptoRawKey()) return;
  window.clearTimeout(syncToCloudSoon.timer);
  syncToCloudSoon.timer = window.setTimeout(() => {
    syncToCloud().catch((error) => setAuthStatus(error.message, true));
  }, 350);
}

function saveEntryEdit(id, form) {
  if (!form.reportValidity()) return;
  if (!updateEntryFromForm(id, form)) return;
  editingEntryId = null;
  render();
}

function deleteEntry(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  if (editingEntryId === id) editingEntryId = null;
  saveState();
  calculatorDirty = false;
  render();
  if (authSession?.access_token) {
    deleteCloudEntry(id)
      .then(() => loadFromCloud())
      .catch((error) => setAuthStatus(error.message, true));
  }
}

function renderEntryList(container, entries, type) {
  if (!entries.length) {
    container.innerHTML = `<article class="entry-item"><div><strong>No entries yet</strong><span>Add one when you're ready.</span></div></article>`;
    return;
  }
  container.innerHTML = "";
  entries.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "entry-item";
    const note = entry.note ? ` · ${entry.note}` : "";
    const categories = type === "expense" ? allExpenseCategories() : incomeCategories;
    const editForm =
      editingEntryId === entry.id
        ? `
          <form class="entry-edit-form" data-entry-edit="${entry.id}">
            <div class="entry-edit-fields">
              <label class="field">
                <span>Category</span>
                <select name="category">${optionsHtml(categories, entry.category)}</select>
              </label>
              <label class="field">
                <span>Amount</span>
                <input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" value="${escapeHtml(entry.amount)}" required />
              </label>
              <label class="field">
                <span>Note</span>
                <input name="note" type="text" maxlength="90" value="${escapeHtml(entry.note || "")}" />
              </label>
              <label class="field">
                <span>Currency</span>
                <select name="currency">${currencyOptionsHtml(entry.currency)}</select>
              </label>
              <label class="field">
                <span>Date</span>
                <input name="date" type="date" value="${escapeHtml(entry.date)}" />
              </label>
            </div>
            <div class="entry-actions">
              <button type="submit">Save</button>
              <button type="button" data-action="cancel">Cancel</button>
            </div>
          </form>
        `
        : "";
    item.innerHTML = `
      <div>
        <strong>${money(entryAmount(entry))} · ${escapeHtml(entry.category)}</strong>
        <span>${escapeHtml(entry.date)}${escapeHtml(note)}</span>
      </div>
      <div class="entry-actions">
        <button type="button" data-action="edit">${editingEntryId === entry.id ? "Editing" : "Edit"}</button>
        <button type="button" data-action="delete">Delete</button>
      </div>
      ${editForm}
    `;
    item.querySelector('[data-action="edit"]').addEventListener("click", () => {
      editingEntryId = editingEntryId === entry.id ? null : entry.id;
      renderLists();
    });
    item.querySelector('[data-action="delete"]').addEventListener("click", () => deleteEntry(entry.id));
    item.querySelector("[data-action='cancel']")?.addEventListener("click", () => {
      editingEntryId = null;
      renderLists();
    });
    item.querySelector(".entry-edit-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      saveEntryEdit(entry.id, event.currentTarget);
    });
    item.querySelector(".entry-edit-form")?.addEventListener("input", (event) => {
      if (updateEntryFromForm(entry.id, event.currentTarget)) {
        renderDynamicSections();
      }
    });
    item.querySelector(".entry-edit-form")?.addEventListener("change", (event) => {
      if (updateEntryFromForm(entry.id, event.currentTarget)) {
        renderDynamicSections();
      }
    });
    container.append(item);
  });
}

function sortEntries(entries, sortValue) {
  return [...entries].sort((a, b) => {
    if (sortValue === "amount-desc") return entryAmount(b) - entryAmount(a);
    if (sortValue === "amount-asc") return entryAmount(a) - entryAmount(b);
    if (sortValue === "currency") return a.currency.localeCompare(b.currency) || new Date(b.date) - new Date(a.date);
    return new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt;
  });
}

function filteredEntries(type, month, category) {
  let entries = entriesFor(type, month);
  if (category !== "all") entries = entries.filter((entry) => entry.category === category);
  return entries;
}

function renderCurrencyGroups(container, entries, selectedCurrency, type) {
  if (!container) return;
  if (!entries.length) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  const groups = new Map();
  entries.forEach((entry) => {
    const group = groups.get(entry.currency) || { amount: 0, count: 0 };
    group.amount += Number(entry.amount) || 0;
    group.count += 1;
    groups.set(entry.currency, group);
  });
  container.hidden = false;
  container.innerHTML = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, group]) => {
      const active = selectedCurrency === currency ? " is-active" : "";
      const label = `${moneyInCurrency(group.amount, currency)} · ${group.count} ${group.count === 1 ? "entry" : "entries"}`;
      return `<button class="currency-total${active}" type="button" data-currency="${currency}"><b>${currency}</b><span>${label}</span></button>`;
    })
    .join("");
  container.querySelectorAll("[data-currency]").forEach((button) => {
    button.addEventListener("click", () => {
      if (type === "expense") {
        expenseCurrencyFilter = expenseCurrencyFilter === button.dataset.currency ? "" : button.dataset.currency;
      } else {
        incomeCurrencyFilter = incomeCurrencyFilter === button.dataset.currency ? "" : button.dataset.currency;
      }
      renderLists();
    });
  });
}

function renderPastMonthGroups(container, entries, type) {
  if (!container) return;
  const groups = new Map();
  entries.forEach((entry) => {
    const key = monthKey(entry.date);
    const group = groups.get(key) || [];
    group.push(entry);
    groups.set(key, group);
  });
  if (!groups.size) {
    container.innerHTML = `<article class="entry-item"><div><strong>No past months yet</strong><span>Older records will appear here.</span></div></article>`;
    return;
  }
  container.innerHTML = "";
  [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([key, monthEntries]) => {
      const details = document.createElement("details");
      details.className = "month-group";
      const total = monthEntries.reduce((sum, entry) => sum + entryAmount(entry), 0);
      details.innerHTML = `
        <summary>
          <strong>${formatMonth(key)}</strong>
          <span>Total: ${money(total)}</span>
        </summary>
        <div class="entry-list"></div>
      `;
      renderEntryList(details.querySelector(".entry-list"), sortEntries(monthEntries, "newest"), type);
      container.append(details);
    });
}

function renderLedgerList(type) {
  const isExpense = type === "expense";
  const dateFilter = isExpense ? els.expenseDateFilter : els.incomeDateFilter;
  const categoryFilter = isExpense ? els.expenseCategoryFilter : els.incomeCategoryFilter;
  const sortControl = isExpense ? els.expenseSort : els.incomeSort;
  const list = isExpense ? els.expenseList : els.incomeList;
  const pastList = isExpense ? els.pastExpenseList : els.pastIncomeList;
  const currencyGroups = isExpense ? els.expenseCurrencyGroups : els.incomeCurrencyGroups;
  const selectedCurrency = isExpense ? expenseCurrencyFilter : incomeCurrencyFilter;
  const filterMonth = dateFilter.value || currentMonthKey;
  const category = categoryFilter.value || "all";
  const sortValue = sortControl.value || "newest";
  let entries = filteredEntries(type, filterMonth, category);

  if (sortValue === "currency") {
    renderCurrencyGroups(currencyGroups, entries, selectedCurrency, type);
    if (selectedCurrency) entries = entries.filter((entry) => entry.currency === selectedCurrency);
    entries = sortEntries(entries, "newest");
  } else {
    if (isExpense) expenseCurrencyFilter = "";
    else incomeCurrencyFilter = "";
    if (currencyGroups) {
      currencyGroups.hidden = true;
      currencyGroups.innerHTML = "";
    }
    entries = sortEntries(entries, sortValue);
  }

  const pastEntries = state.entries.filter((entry) => entry.type === type && monthKey(entry.date) !== currentMonthKey);
  renderEntryList(list, entries, type);
  renderPastMonthGroups(pastList, pastEntries, type);
}

function renderLists() {
  renderLedgerList("expense");
  renderLedgerList("income");
}

function renderDashboard() {
  const isAllTime = dashboardRange === "all";
  const totals = totalsFor(isAllTime ? null : currentMonthKey);
  els.dashboardKicker.textContent = isAllTime ? "All Time" : "This Month";
  els.monthLabel.textContent = isAllTime ? "Total Balance" : formatMonth(currentMonthKey);
  els.dashboardThisMonth.classList.toggle("is-active", !isAllTime);
  els.dashboardAllTime.classList.toggle("is-active", isAllTime);
  els.metricIncome.textContent = money(totals.income, { whole: true });
  els.metricExpenses.textContent = money(totals.expenses, { whole: true });
  els.metricSaved.textContent = money(totals.saved, { whole: true });
  els.metricRate.textContent = `${totals.rate.toFixed(1)}%`;
  els.metricSaved.style.color = totals.saved >= 0 ? "var(--green)" : "var(--warm)";
  els.metricRate.style.color = totals.rate >= 0 ? "var(--green)" : "var(--warm)";
  els.settingsButton.textContent = currencies[state.baseCurrency].symbol;
  els.authButton.textContent = authSession?.access_token ? "Log out" : "Log in";
}

function setAuthMode(mode = "signin") {
  const isRecovery = mode === "recovery";
  const primaryAuthButton = els.authForm.querySelector(".primary-button");
  const signupAuthButton = els.authForm.querySelector(".secondary-button");
  intendedAuthMode = mode;
  els.authPassword.setCustomValidity("");
  els.authForm.dataset.mode = mode;
  els.authDialog.querySelector("h2").textContent = isRecovery ? "Set New Password" : "Account";
  els.authEmail.required = !isRecovery;
  els.authEmail.closest(".field").hidden = isRecovery;
  els.authPassword.value = "";
  els.authPassword.placeholder = isRecovery ? "New password" : "At least 8 characters";
  els.authPassword.autocomplete = isRecovery ? "new-password" : "current-password";
  els.authRecoveryCopy.hidden = !isRecovery;
  primaryAuthButton.textContent = isRecovery ? "Save new password" : "Log in";
  primaryAuthButton.dataset.authMode = isRecovery ? "recovery" : "signin";
  signupAuthButton.dataset.authMode = "signup";
  signupAuthButton.hidden = isRecovery;
  els.forgotPasswordButton.hidden = isRecovery;
}

function renderFilters() {
  [
    { type: "expense", element: els.expenseCategoryFilter },
    { type: "income", element: els.incomeCategoryFilter },
  ].forEach(({ type, element }) => {
    const categories = ["all", ...new Set(state.entries.filter((entry) => entry.type === type).map((entry) => entry.category))];
    const previous = element.value || "all";
    element.innerHTML = categories.map((cat) => `<option value="${cat}">${cat === "all" ? "All categories" : cat}</option>`).join("");
    element.value = categories.includes(previous) ? previous : "all";
  });
}

function renderCalculator() {
  const contribution = averagePositiveSavings();
  if (!calculatorDirty) {
    els.calculatorForm.elements.monthlyContribution.value = contribution.toFixed(2);
  }
  const input = {
    initialInvestment: Number(els.calculatorForm.elements.initialInvestment.value) || 0,
    monthlyContribution: Number(els.calculatorForm.elements.monthlyContribution.value) || 0,
    years: Math.max(1, Math.round(Number(els.calculatorForm.elements.years.value) || 20)),
    interestRate: Number(els.calculatorForm.elements.interestRate.value) || 9,
    frequency: Number(els.calculatorForm.elements.frequency.value) || 1,
  };
  const rows = calculateSavings(input);
  const last = rows[rows.length - 1];
  els.resultYears.textContent = input.years;
  els.resultTotal.textContent = money(last.futureValue);
  els.resultsTable.innerHTML = rows
    .map((row) => `<tr><td>${row.year}</td><td>${money(row.contributions)}</td><td>${money(row.futureValue)}</td></tr>`)
    .join("");
  drawLineChart(els.savingsChart, rows, [
    { key: "futureValue", label: "Future Value", color: "#eec643" },
    { key: "contributions", label: "Total Contributions", color: "#001740" },
  ]);
}

function monthlySeries() {
  const keys = [...new Set([...state.entries.map((entry) => monthKey(entry.date)), currentMonthKey])].sort().slice(-6);
  return keys.map((key) => ({ key, ...totalsFor(key) }));
}

function categoryTotals(month = currentMonthKey) {
  return entriesFor("expense", month)
    .reduce((items, entry) => {
      const found = items.find((item) => item.category === entry.category);
      if (found) found.value += entryAmount(entry);
      else items.push({ category: entry.category, value: entryAmount(entry) });
      return items;
    }, [])
    .sort((a, b) => b.value - a.value);
}

function renderInsights() {
  const totals = totalsFor();
  const cats = categoryTotals();
  const top = cats[0];
  const recurring = cats.find((item) => item.category === "Recurring")?.value || 0;
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthCats = categoryTotals(monthKey(lastMonthDate));
  const leisureNow = cats.find((item) => item.category === "Leisure")?.value || 0;
  const leisureBefore = lastMonthCats.find((item) => item.category === "Leisure")?.value || 0;
  const investmentRows = calculateSavings({
    initialInvestment: 0,
    monthlyContribution: Math.max(0, totals.saved),
    years: 20,
    interestRate: 8,
    frequency: 1,
  });
  const cards = [
    ["Savings rate", `You saved ${totals.rate.toFixed(1)}% of your income this month.`],
    ["Investment potential", `If you invested this month's savings of ${money(Math.max(0, totals.saved))} for 20 years at 8%, it could become around ${money(investmentRows.at(-1).futureValue, { whole: true })}.`],
  ];
  if (top) cards.push(["Largest category", `${top.category} is your biggest category this month at ${money(top.value)}.`]);
  if (recurring) cards.push(["Recurring watch", `Recurring costs are ${money(recurring)}/month, or ${money(recurring * 12, { whole: true })}/year.`]);
  if (leisureBefore > 0 && leisureNow > leisureBefore) {
    const diff = leisureNow - leisureBefore;
    cards.push(["Small improvement", `Leisure spending is ${money(diff)} higher than last month. Consider testing a ${money(50, { whole: true })}/month reduction and investing the difference.`]);
  } else {
    cards.push(["Small improvement", "Consider one small recurring change. Even a modest monthly difference can become meaningful over 20 years."]);
  }
  els.insightsList.innerHTML = cards
    .map(([title, text]) => `<article class="insight-card"><b>${title}</b><p>${text}</p></article>`)
    .join("");
  const topExpenses = entriesFor("expense")
    .sort((a, b) => entryAmount(b) - entryAmount(a))
    .slice(0, 5);
  els.topExpenses.innerHTML = topExpenses.length
    ? topExpenses.map((entry) => `<li>${money(entryAmount(entry))} · ${entry.category} · ${entry.date}</li>`).join("")
    : "<li>No expenses yet.</li>";
  drawPieChart(els.categoryChart, cats);
  drawTrendChart(els.trendChart, monthlySeries());
}

function drawLineChart(canvas, rows, lines) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.width;
  const height = Math.max(280, width * 0.55);
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const pad = { top: 24, right: 16, bottom: 42, left: 54 };
  const maxValue = Math.max(100, ...rows.flatMap((row) => lines.map((line) => row[line.key])));
  const maxYear = Math.max(1, rows.at(-1).year);
  ctx.strokeStyle = "#e4e9f0";
  ctx.fillStyle = "#676b73";
  ctx.font = "700 12px Inter";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (height - pad.top - pad.bottom) * (1 - i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText(money((maxValue * i) / 4, { whole: true }), 4, y + 4);
  }
  lines.forEach((line) => {
    ctx.beginPath();
    rows.forEach((row, index) => {
      const x = pad.left + (row.year / maxYear) * (width - pad.left - pad.right);
      const y = pad.top + (height - pad.top - pad.bottom) * (1 - row[line.key] / maxValue);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}

function drawPieChart(canvas, items) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.width;
  const height = 320;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total) {
    ctx.fillStyle = "#676b73";
    ctx.font = "800 16px Inter";
    ctx.fillText("No expenses yet", 20, 40);
    return;
  }
  let start = -Math.PI / 2;
  const radius = Math.min(width, height) * 0.28;
  const cx = width * 0.34;
  const cy = height * 0.48;
  items.slice(0, 8).forEach((item, index) => {
    const end = start + (item.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = palette[index % palette.length];
    ctx.fill();
    start = end;
    ctx.fillRect(width * 0.64, 34 + index * 28, 12, 12);
    ctx.fillStyle = "#101418";
    ctx.font = "700 12px Inter";
    ctx.fillText(`${item.category} ${Math.round((item.value / total) * 100)}%`, width * 0.64 + 18, 45 + index * 28);
  });
}

function drawTrendChart(canvas, series) {
  const rows = series.map((item, index) => ({ year: index, income: item.income, expenses: item.expenses, saved: Math.max(0, item.saved) }));
  drawLineChart(canvas, rows, [
    { key: "income", color: "#2f8f68" },
    { key: "expenses", color: "#dd785e" },
    { key: "saved", color: "#001740" },
  ]);
}

function render() {
  setupCurrencySelects();
  renderCategoryButtons(els.expenseCategories, allExpenseCategories(), selectedExpenseCategory, "expense");
  renderCategoryButtons(els.incomeCategories, incomeCategories, selectedIncomeCategory, "income");
  renderDashboard();
  renderFilters();
  renderLists();
  renderCalculator();
  renderInsights();
}

document.querySelectorAll(".pillar-trigger").forEach((button) => {
  button.addEventListener("click", () => {
    const body = button.nextElementSibling;
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    body.hidden = expanded;
    if (!expanded) window.setTimeout(render, 60);
  });
});

function openPillarForm(type) {
  const pillar = document.querySelector(type === "income" ? "#income-pillar" : "#expenses-pillar");
  const trigger = pillar?.querySelector(".pillar-trigger");
  const body = pillar?.querySelector(".pillar-body");
  const form = type === "income" ? els.incomeForm : els.expenseForm;
  if (!pillar || !trigger || !body || !form) return;
  trigger.setAttribute("aria-expanded", "true");
  body.hidden = false;
  window.setTimeout(() => {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.amount?.focus({ preventScroll: true });
    render();
  }, 80);
}

els.dashboardAddExpense.addEventListener("click", () => openPillarForm("expense"));
els.dashboardAddIncome.addEventListener("click", () => openPillarForm("income"));

[els.expenseForm, els.incomeForm].forEach((form) => {
  form.elements.date.value = todayIso;
  form.elements.currency.value = state.baseCurrency;
});

els.expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addEntry("expense", els.expenseForm, selectedExpenseCategory);
});

els.incomeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addEntry("income", els.incomeForm, selectedIncomeCategory);
});

[els.expenseDateFilter, els.expenseCategoryFilter, els.expenseSort, els.incomeDateFilter, els.incomeCategoryFilter, els.incomeSort].forEach((control) => {
  control.addEventListener("input", renderLists);
});

els.dashboardThisMonth.addEventListener("click", () => {
  dashboardRange = "month";
  renderDashboard();
});

els.dashboardAllTime.addEventListener("click", () => {
  dashboardRange = "all";
  renderDashboard();
});

els.trackerRefreshButton.addEventListener("click", async () => {
  els.trackerRefreshButton.classList.add("is-refreshing");
  try {
    if (authSession?.access_token && storedCryptoRawKey()) {
      await loadFromCloud({ replaceLocal: true });
      setAuthStatus("Tracker refreshed.");
    } else {
      render();
    }
    refreshExchangeRates();
  } catch (error) {
    setAuthStatus(error.message, true);
  } finally {
    els.trackerRefreshButton.classList.remove("is-refreshing");
  }
});

els.calculatorForm.addEventListener("input", () => {
  calculatorDirty = true;
  renderCalculator();
});

els.resetCalculator.addEventListener("click", () => {
  calculatorDirty = false;
  els.calculatorForm.elements.initialInvestment.value = 0;
  els.calculatorForm.elements.years.value = 20;
  els.calculatorForm.elements.interestRate.value = 9;
  els.calculatorForm.elements.frequency.value = 1;
  renderCalculator();
});

els.settingsButton.addEventListener("click", () => {
  els.baseCurrency.value = state.baseCurrency;
  els.settingsDialog.showModal();
});

els.baseCurrency.addEventListener("change", () => {
  state.baseCurrency = els.baseCurrency.value;
  saveState();
  calculatorDirty = false;
  render();
});

els.authButton.addEventListener("click", () => {
  if (authSession?.access_token) {
    saveAuthSession(null);
    state.entries = [];
    saveState();
    setAuthStatus("");
    render();
    return;
  }
  setAuthMode("signin");
  setAuthStatus("");
  els.authDialog.showModal();
});

els.authClose.addEventListener("click", () => {
  if (!passwordRecoveryToken) setAuthMode("signin");
  els.authDialog.close();
});

els.forgotPasswordButton.addEventListener("click", async () => {
  const email = els.authEmail.value.trim();
  if (!email) {
    setAuthStatus("Enter your email first, then press Forgot password.", true);
    els.authEmail.focus();
    return;
  }
  setAuthStatus("Sending password reset email...");
  try {
    await requestPasswordReset(email);
    setAuthStatus("Password reset email sent. Check your inbox.");
  } catch (error) {
    setAuthStatus(error.message, true);
  }
});

els.authForm.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    intendedAuthMode = button.dataset.authMode || els.authForm.dataset.mode || "signin";
    els.authPassword.setCustomValidity("");
    if (!els.authPassword.value) {
      setAuthStatus(
        intendedAuthMode === "signup" ? "Enter a password with at least 8 characters, then press Create account." : "Enter your password, then press Log in.",
        true
      );
    }
  });
});

els.authEmail.addEventListener("input", () => setAuthStatus(""));

els.authPassword.addEventListener("input", () => {
  els.authPassword.setCustomValidity("");
  setAuthStatus("");
});

els.authPassword.addEventListener("invalid", () => {
  const mode = intendedAuthMode || els.authForm.dataset.mode || "signin";
  if (!els.authPassword.value) {
    els.authPassword.setCustomValidity(mode === "signup" ? "Enter a password to create your account." : "Enter your password to log in.");
  } else if (els.authPassword.validity.tooShort) {
    els.authPassword.setCustomValidity("Use at least 8 characters.");
  }
});

els.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  const mode = submitter?.dataset.authMode || els.authForm.dataset.mode || "signin";
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  setAuthStatus(mode === "signup" ? "Creating account..." : mode === "recovery" ? "Saving new password..." : "Logging in...");
  try {
    if (mode === "recovery") {
      await updateRecoveredPassword(password);
      setAuthStatus("Password updated. Log in with the new password.");
      setAuthMode("signin");
      els.authPassword.value = "";
      return;
    }
    await signInOrCreateAccount(mode, email, password);
    els.authDialog.close();
    els.authForm.reset();
    setAuthStatus("Encrypted sync is active.");
    render();
  } catch (error) {
    setAuthStatus(error.message, true);
    renderDashboard();
  }
});

window.addEventListener("resize", renderCalculator);
els.expenseDateFilter.value = currentMonthKey;
els.incomeDateFilter.value = currentMonthKey;
loadAppConfig().finally(async () => {
  render();
  let handledAuthRedirect = false;
  try {
    handledAuthRedirect = await handleAuthRedirect();
  } catch (error) {
    setAuthMode("signin");
    setAuthStatus(error.message, true);
    els.authDialog.showModal();
    handledAuthRedirect = true;
  }
  if (!handledAuthRedirect && authSession?.access_token && storedCryptoRawKey()) {
    loadFromCloud().catch((error) => setAuthStatus(error.message, true));
  }
  refreshExchangeRates();
});
