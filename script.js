const storageKey = "agente-financeiro-state";

const categories = [
  "Condominio",
  "Luz",
  "Gas",
  "Compra",
  "Transporte",
  "Internet",
  "Delivery",
  "Jogos",
  "Roupas",
  "Streaming",
  "Passeios",
  "ReservaEmergencia"
];

const categoryLabels = {
  Condominio: "Condominio",
  Luz: "Luz",
  Gas: "Gas",
  Compra: "Compra",
  Transporte: "Transporte",
  Internet: "Internet",
  Delivery: "Delivery",
  Jogos: "Jogos",
  Roupas: "Roupas",
  Streaming: "Streaming",
  Passeios: "Passeios",
  ReservaEmergencia: "Reserva de emergencia",
  Moradia: "Moradia",
  Alimentacao: "Alimentacao",
  Saude: "Saude",
  Educacao: "Educacao",
  Reserva: "Economia/Investimentos",
  Outros: "Outros",
  Lazer: "Lazer"
};

const legacyCategoryGroups = {
  Moradia: "needs",
  Alimentacao: "needs",
  Saude: "needs",
  Educacao: "savings",
  Reserva: "savings",
  Lazer: "wants",
  Outros: "wants"
};

const ruleGroups = [
  {
    key: "needs",
    title: "50% Necessidades",
    description: "Condominio, luz, gas, compra, transporte e internet",
    percentage: 0.5,
    categories: ["Condominio", "Luz", "Gas", "Compra", "Transporte", "Internet"]
  },
  {
    key: "wants",
    title: "30% Desejos",
    description: "Delivery, jogos, roupas, streaming e passeios",
    percentage: 0.3,
    categories: ["Delivery", "Jogos", "Roupas", "Streaming", "Passeios"]
  },
  {
    key: "savings",
    title: "20% Economia",
    description: "Reserva de emergencia",
    percentage: 0.2,
    categories: ["ReservaEmergencia"]
  }
];

const supabaseClient = createSupabaseClient();
let state = loadState();
let currentUser = null;
let saveTimer = null;
let authInProgress = false;

const elements = {
  authForm: document.querySelector("#authForm"),
  authCpf: document.querySelector("#authCpf"),
  authPassword: document.querySelector("#authPassword"),
  authStatus: document.querySelector("#authStatus"),
  accountLabel: document.querySelector("#accountLabel"),
  logoutButton: document.querySelector("#logoutButton"),
  incomeForm: document.querySelector("#incomeForm"),
  monthlyIncome: document.querySelector("#monthlyIncome"),
  mealVoucher: document.querySelector("#mealVoucher"),
  ruleIncomeTotal: document.querySelector("#ruleIncomeTotal"),
  monthFilter: document.querySelector("#monthFilter"),
  expenseForm: document.querySelector("#expenseForm"),
  expenseName: document.querySelector("#expenseName"),
  expenseAmount: document.querySelector("#expenseAmount"),
  expenseDate: document.querySelector("#expenseDate"),
  expenseCategory: document.querySelector("#expenseCategory"),
  resetDemo: document.querySelector("#resetDemo"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  spentTotal: document.querySelector("#spentTotal"),
  spentStatus: document.querySelector("#spentStatus"),
  ruleBaseTotal: document.querySelector("#ruleBaseTotal"),
  ruleBaseStatus: document.querySelector("#ruleBaseStatus"),
  savingsTargetTotal: document.querySelector("#savingsTargetTotal"),
  savingsTargetStatus: document.querySelector("#savingsTargetStatus"),
  agentHeadline: document.querySelector("#agentHeadline"),
  agentMessage: document.querySelector("#agentMessage"),
  alertsList: document.querySelector("#alertsList"),
  categoryList: document.querySelector("#categoryList"),
  transactionsList: document.querySelector("#transactionsList"),
  monthsList: document.querySelector("#monthsList"),
  ruleGrid: document.querySelector("#ruleGrid")
};

initialize();

function initialize() {
  const today = new Date();
  const currentMonth = toMonthValue(today);

  document.body.classList.add("auth-locked");
  elements.monthFilter.value = state.selectedMonth || currentMonth;
  elements.expenseDate.value = toDateValue(today);
  setIncomeFields(elements.monthFilter.value);

  elements.authForm.addEventListener("submit", handleAuth);
  elements.logoutButton.addEventListener("click", logout);
  elements.incomeForm.addEventListener("submit", saveIncome);
  [elements.monthlyIncome, elements.mealVoucher].forEach((input) => {
    input.addEventListener("input", updateIncomePreview);
  });
  elements.expenseForm.addEventListener("submit", addExpense);
  elements.monthFilter.addEventListener("change", () => {
    state.selectedMonth = elements.monthFilter.value;
    setIncomeFields(state.selectedMonth);
    saveState();
    render();
  });
  elements.resetDemo.addEventListener("click", resetData);
  elements.exportData.addEventListener("click", exportData);
  elements.importData.addEventListener("change", importData);
  document.addEventListener("visibilitychange", lockWhenHidden);
  window.addEventListener("pagehide", lockSession);

  elements.transactionsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-id]");
    if (!button) return;

    state.expenses = state.expenses.filter((expense) => expense.id !== button.dataset.removeId);
    saveState();
    render();
  });

  elements.monthsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-month]");
    if (!button) return;

    state.selectedMonth = button.dataset.month;
    elements.monthFilter.value = state.selectedMonth;
    setIncomeFields(state.selectedMonth);
    saveState();
    render();
  });

  bootstrapAuth();
}

function createSupabaseClient() {
  const config = window.AGENTE_SUPABASE || {};
  const isConfigured = config.url
    && config.anonKey
    && !config.url.includes("COLE_AQUI")
    && !config.anonKey.includes("COLE_AQUI");

  if (!isConfigured || !window.supabase) {
    return null;
  }

  return window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

async function bootstrapAuth() {
  if (!supabaseClient) {
    document.body.classList.remove("auth-locked");
    elements.accountLabel.textContent = "Modo local sem login";
    elements.logoutButton.style.display = "none";
    render();
    return;
  }

  setAuthStatus("Entre ou crie sua conta para salvar os dados no banco.");
}

async function handleAuth(event) {
  event.preventDefault();
  const action = event.submitter?.dataset.authAction || "login";
  const cpf = cleanCpf(elements.authCpf.value);
  const password = elements.authPassword.value;

  if (!supabaseClient) {
    setAuthStatus("Supabase ainda não foi configurado.");
    return;
  }

  if (cpf.length !== 11) {
    setAuthStatus("Digite um CPF com 11 números.");
    return;
  }

  if (password.length < 6) {
    setAuthStatus("A senha precisa ter pelo menos 6 caracteres.");
    return;
  }

  setAuthStatus(action === "signup" ? "Criando conta..." : "Entrando...");

  authInProgress = true;
  try {
    if (action === "signup") {
      await signup(cpf, password);
      return;
    }

    await login(cpf, password);
  } finally {
    authInProgress = false;
  }
}

async function signup(cpf, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email: cpfToEmail(cpf),
    password
  });

  if (error) {
    setAuthStatus(getAuthErrorMessage(error.message));
    return;
  }

  const user = data.user;
  if (!user) {
    setAuthStatus("Conta criada. Se o Supabase pedir confirmação de e-mail, desative essa opção no painel.");
    return;
  }

  await supabaseClient.from("profiles").upsert({ id: user.id, cpf });
  await supabaseClient.from("finance_data").upsert({
    user_id: user.id,
    data: createEmptyState()
  });

  await openAccount(user);
}

async function login(cpf, password) {
  const attempts = [cpfToEmail(cpf), cpfToLegacyEmail(cpf)];
  let lastError = null;

  for (const email of attempts) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (!error) {
      await openAccount(data.user);
      return;
    }

    lastError = error;
    if (!isInvalidCredentials(error.message)) {
      break;
    }
  }

  setAuthStatus(getAuthErrorMessage(lastError?.message));
}

async function logout() {
  await lockSession();
  setAuthStatus("Você saiu da conta.");
}

async function lockWhenHidden() {
  if (authInProgress) return;

  if (document.visibilityState === "hidden") {
    await lockSession();
  }
}

async function lockSession() {
  if (supabaseClient) {
    await saveCloudState();
    await supabaseClient.auth.signOut();
  }

  currentUser = null;
  state = createEmptyState();
  elements.authPassword.value = "";
  document.body.classList.add("auth-locked");
}

async function openAccount(user) {
  currentUser = user;
  await loadCloudState();

  elements.accountLabel.textContent = `Conta ${emailToCpf(user.email)}`;
  elements.logoutButton.style.display = "";
  document.body.classList.remove("auth-locked");
  elements.monthFilter.value = state.selectedMonth || toMonthValue(new Date());
  setIncomeFields(elements.monthFilter.value);
  render();
}

async function loadCloudState() {
  const { data, error } = await supabaseClient
    .from("finance_data")
    .select("data")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    setAuthStatus(getAuthErrorMessage(error.message));
    return;
  }

  if (data?.data) {
    state = normalizeState(data.data);
    return;
  }

  state = createEmptyState();
  await saveCloudState();
}

async function saveCloudState() {
  if (!supabaseClient || !currentUser) return;

  await supabaseClient.from("finance_data").upsert({
    user_id: currentUser.id,
    data: state,
    updated_at: new Date().toISOString()
  });
}

function scheduleCloudSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCloudState, 500);
}

function setAuthStatus(message) {
  elements.authStatus.textContent = message;
}

function getAuthErrorMessage(message = "") {
  const normalized = message.toLowerCase();

  if (normalized.includes("failed to fetch") || normalized.includes("network") || normalized.includes("fetch")) {
    return "Nao consegui conectar ao Supabase. Confira a URL do projeto no arquivo supabase-config.js.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "CPF ou senha invalidos. Confira se voce ja criou a conta e digitou a senha certa.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Conta criada, mas o Supabase ainda esta exigindo confirmacao de e-mail.";
  }

  if (normalized.includes("rate limit")) {
    return "Muitas tentativas seguidas. Aguarde um pouco e tente novamente.";
  }

  return message ? `Erro no login: ${message}` : "Nao consegui concluir o login agora.";
}

function isInvalidCredentials(message = "") {
  return message.toLowerCase().includes("invalid login credentials");
}

function loadState() {
  const fallback = createEmptyState();

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return normalizeState(saved || fallback);
  } catch {
    return fallback;
  }
}

function createEmptyState() {
  return {
    monthlyIncomes: {},
    monthlyIncomeDetails: {},
    selectedMonth: "",
    expenses: []
  };
}

function normalizeState(saved) {
  if (!saved || !Array.isArray(saved.expenses)) return createEmptyState();

  return {
    ...createEmptyState(),
    ...saved,
    monthlyIncomes: normalizeIncomes(saved),
    monthlyIncomeDetails: normalizeIncomeDetails(saved)
  };
}

function normalizeIncomes(saved) {
  if (saved.monthlyIncomes && typeof saved.monthlyIncomes === "object") {
    return saved.monthlyIncomes;
  }

  if (saved.monthlyIncome && saved.selectedMonth) {
    return {
      [saved.selectedMonth]: Number(saved.monthlyIncome) || 0
    };
  }

  return {};
}

function normalizeIncomeDetails(saved) {
  if (saved.monthlyIncomeDetails && typeof saved.monthlyIncomeDetails === "object") {
    return Object.fromEntries(Object.entries(saved.monthlyIncomeDetails).map(([month, details]) => [
      month,
      normalizeIncomeDetail(details)
    ]));
  }

  return {};
}

function normalizeIncomeDetail(details = {}) {
  const mealVoucher = Number(details.mealVoucher) || 0;
  const transportDiscount = Number(details.transportDiscount) || 0;
  const grossSalary = Number(details.grossSalary) || 0;
  const legacyNetSalary = Math.max(grossSalary - transportDiscount, 0);
  const netSalary = Number(details.netSalary) || Number(details.salary) || legacyNetSalary || 0;
  const ruleIncome = netSalary + mealVoucher;

  return {
    netSalary,
    mealVoucher,
    ruleIncome
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  scheduleCloudSave();
}

function saveIncome(event) {
  event.preventDefault();
  const month = elements.monthFilter.value || toMonthValue(new Date());
  const details = getIncomeFormDetails();

  state.monthlyIncomeDetails[month] = details;
  state.monthlyIncomes[month] = details.ruleIncome;
  elements.monthlyIncome.value = details.ruleIncome || "";

  saveState();
  render();
}

function addExpense(event) {
  event.preventDefault();

  const amount = Number(elements.expenseAmount.value);
  if (!amount || amount <= 0) return;

  state.expenses.unshift({
    id: crypto.randomUUID(),
    name: elements.expenseName.value.trim(),
    amount,
    category: elements.expenseCategory.value,
    date: elements.expenseDate.value
  });

  elements.expenseForm.reset();
  elements.expenseDate.value = toDateValue(new Date());
  saveState();
  render();
}

function resetData() {
  state.monthlyIncomes = {};
  state.monthlyIncomeDetails = {};
  state.selectedMonth = toMonthValue(new Date());
  state.expenses = [];
  elements.monthFilter.value = state.selectedMonth;
  setIncomeFields(state.selectedMonth);
  saveState();
  render();
}

function exportData() {
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    app: "agente-financeiro",
    data: state
  }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `agente-financeiro-${toDateValue(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(reader.result);
      const data = imported.data || imported;
      if (!data || !Array.isArray(data.expenses)) {
        throw new Error("Arquivo inválido");
      }

      state.monthlyIncomes = normalizeIncomes(data);
      state.monthlyIncomeDetails = normalizeIncomeDetails(data);
      state.selectedMonth = data.selectedMonth || toMonthValue(new Date());
      state.expenses = data.expenses;
      elements.monthFilter.value = state.selectedMonth;
      setIncomeFields(state.selectedMonth);
      saveState();
      render();
    } catch {
      alert("Não consegui importar esse arquivo. Confira se ele foi exportado pelo Agente Financeiro.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function render() {
  const month = elements.monthFilter.value;
  const monthlyExpenses = state.expenses.filter((expense) => expense.date.startsWith(month));
  const totalSpent = sum(monthlyExpenses.map((expense) => expense.amount));
  const income = getIncomeForMonth(month);
  const incomeDetails = getIncomeDetails(month);
  const ruleTotals = getRuleTotals(monthlyExpenses);
  const savingsTarget = income * 0.2;
  const savingsUsed = ruleTotals.savings || 0;
  const savingsRemaining = savingsTarget - savingsUsed;

  elements.spentTotal.textContent = formatCurrency(totalSpent);
  elements.ruleBaseTotal.textContent = formatCurrency(income);
  elements.savingsTargetTotal.textContent = formatCurrency(savingsTarget);

  elements.spentStatus.textContent = monthlyExpenses.length
    ? `${monthlyExpenses.length} gasto${monthlyExpenses.length === 1 ? "" : "s"} registrado${monthlyExpenses.length === 1 ? "" : "s"} neste mes.`
    : "Nenhum gasto registrado neste mes.";

  elements.ruleBaseStatus.textContent = income > 0
    ? "Regra 50/30/20 ativa para este mes."
    : "Informe salario liquido e VR para ativar.";

  elements.savingsTargetStatus.textContent = savingsTarget > 0
    ? (savingsRemaining > 0 ? `${formatCurrency(savingsRemaining)} para completar.` : "Reserva do mes completa.")
    : "Aguardando renda do mes.";

  renderAgent(monthlyExpenses, income, ruleTotals);
  renderAlerts(monthlyExpenses, income, ruleTotals);
  renderCategories(monthlyExpenses, totalSpent);
  renderTransactions(monthlyExpenses);
  renderRule(monthlyExpenses, income, incomeDetails);
  renderMonths();
}
function renderAgent(expenses, income, ruleTotals) {
  if (!income) {
    elements.agentHeadline.textContent = "Informe sua renda para eu organizar.";
    elements.agentMessage.textContent = "Com salario liquido e VR, eu calculo automaticamente os limites 50/30/20.";
    return;
  }

  const summaries = getRuleGroupSummaries(income, ruleTotals);
  const overGroup = summaries.find((group) => group.status === "danger");
  if (overGroup) {
    elements.agentHeadline.textContent = `${overGroup.title} passou do limite.`;
    elements.agentMessage.textContent = `Essa parte ficou ${formatCurrency(Math.abs(overGroup.remaining))} acima do recomendado.`;
    return;
  }

  const savings = summaries.find((group) => group.key === "savings");
  if (savings && savings.remaining > 0) {
    elements.agentHeadline.textContent = "Reserva ainda incompleta.";
    elements.agentMessage.textContent = `Faltam ${formatCurrency(savings.remaining)} para bater os 20% de reserva do mes.`;
    return;
  }

  elements.agentHeadline.textContent = "Regra 50/30/20 em ordem.";
  elements.agentMessage.textContent = expenses.length
    ? "Seus gastos estao dentro dos limites cadastrados para este mes."
    : "Registre os gastos do mes para eu acompanhar cada categoria.";
}

function renderAlerts(expenses, income, ruleTotals) {
  const alerts = [];
  const categoryTotals = getCategoryTotals(expenses);
  const highestCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  if (!income) {
    alerts.push({
      level: "warn",
      label: "Renda",
      title: "Informe sua renda do mes",
      text: "Sem salario liquido e VR, eu listo gastos, mas ainda nao calculo os limites 50/30/20."
    });
  } else {
    getRuleGroupSummaries(income, ruleTotals).forEach((group) => {
      alerts.push({
        level: group.status,
        label: group.badge,
        title: group.alertTitle,
        text: group.alertText
      });
    });
  }

  if (highestCategory) {
    const totalSpent = sum(expenses.map((expense) => expense.amount));
    const categoryShare = totalSpent > 0 ? Math.round((highestCategory[1] / totalSpent) * 100) : 0;
    alerts.push({
      level: categoryShare >= 50 ? "warn" : "ok",
      label: "Padrao",
      title: `${getCategoryLabel(highestCategory[0])} concentra seus gastos`,
      text: `Essa categoria representa ${categoryShare}% do total do mes.`
    });
  }

  elements.alertsList.innerHTML = alerts.map((alert) => `
    <article class="alert-item">
      <div>
        <strong>${alert.title}</strong>
        <p>${alert.text}</p>
      </div>
      <span class="alert-badge ${alert.level}">${alert.label}</span>
    </article>
  `).join("");
}

function renderCategories(expenses, totalSpent) {
  if (!expenses.length) {
    elements.categoryList.innerHTML = `<div class="empty-state">Registre gastos para visualizar a distribuição por categoria.</div>`;
    return;
  }

  const totals = getCategoryTotals(expenses);
  elements.categoryList.innerHTML = categories.map((category) => {
    const amount = totals[category] || 0;
    const percent = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;

    return `
      <article class="category-item">
        <div class="category-row">
          <div>
            <strong>${getCategoryLabel(category)}</strong>
            <p>${percent}% do mês</p>
          </div>
          <strong>${formatCurrency(amount)}</strong>
        </div>
        <div class="category-bar"><span style="width: ${percent}%"></span></div>
      </article>
    `;
  }).join("");
}

function renderTransactions(expenses) {
  if (!expenses.length) {
    elements.transactionsList.innerHTML = `<div class="empty-state">Nenhum gasto neste mês. Quando você adicionar uma despesa, ela aparece aqui.</div>`;
    return;
  }

  elements.transactionsList.innerHTML = expenses.map((expense) => `
    <article class="transaction-item">
      <div>
        <strong>${escapeHtml(expense.name)}</strong>
        <p>${getCategoryLabel(expense.category)} • ${formatDate(expense.date)}</p>
      </div>
      <div>
        <strong>${formatCurrency(expense.amount)}</strong>
      </div>
      <button type="button" aria-label="Remover ${escapeHtml(expense.name)}" data-remove-id="${expense.id}">×</button>
    </article>
  `).join("");
}

function renderRule(expenses, income, incomeDetails) {
  if (!income) {
    elements.ruleGrid.innerHTML = `<div class="empty-state">Informe seu salário do mês para calcular automaticamente os limites da regra 50/30/20.</div>`;
    return;
  }

  const totals = getRuleTotals(expenses);
  elements.ruleGrid.innerHTML = ruleGroups.map((group) => {
    const target = income * group.percentage;
    const used = totals[group.key] || 0;
    const percent = target > 0 ? Math.round((used / target) * 100) : 0;
    const remaining = target - used;
    const isSavings = group.key === "savings";
    const needsVoucherNote = group.key === "needs" && incomeDetails.mealVoucher > 0
      ? `<div class="rule-note">VR dentro dos 50%: ${formatCurrency(incomeDetails.mealVoucher)}. Do salario, tente usar ate ${formatCurrency(Math.max(target - incomeDetails.mealVoucher, 0))} em necessidades.</div>`
      : "";
    const status = isSavings
      ? (used >= target ? "ok" : "warn")
      : (used <= target ? "ok" : "danger");
    const statusText = isSavings
      ? (used >= target ? "Meta batida" : `${formatCurrency(Math.abs(remaining))} para guardar`)
      : (remaining >= 0 ? `${formatCurrency(remaining)} livres` : `${formatCurrency(Math.abs(remaining))} acima`);

    return `
      <article class="rule-card ${status}">
        <div class="rule-card-header">
          <div>
            <strong>${group.title}</strong>
            <p>${group.description}</p>
          </div>
          <span>${statusText}</span>
        </div>
        <div class="rule-amounts">
          <div><small>Ideal</small><strong>${formatCurrency(target)}</strong></div>
          <div><small>${isSavings ? "Guardado" : "Usado"}</small><strong>${formatCurrency(used)}</strong></div>
        </div>
        ${needsVoucherNote}
        <div class="rule-track"><span style="width: ${Math.min(percent, 100)}%"></span></div>
      </article>
    `;
  }).join("");
}

function renderMonths() {
  const months = getSavedMonths();
  if (!months.length) {
    elements.monthsList.innerHTML = `<div class="empty-state">Os meses aparecem aqui quando voce salva renda ou adiciona gastos.</div>`;
    return;
  }

  elements.monthsList.innerHTML = months.map((month) => {
    const expenses = state.expenses.filter((expense) => expense.date.startsWith(month));
    const totalSpent = sum(expenses.map((expense) => expense.amount));
    const income = getIncomeForMonth(month);
    const savingsTarget = income * 0.2;

    return `
      <article class="month-item">
        <div>
          <strong>${formatMonth(month)}</strong>
          <p>${expenses.length} gasto${expenses.length === 1 ? "" : "s"}</p>
        </div>
        <div>
          <strong>${formatCurrency(totalSpent)}</strong>
          <p>gasto</p>
        </div>
        <div>
          <strong>${formatCurrency(income)}</strong>
          <p>base</p>
        </div>
        <div>
          <strong>${formatCurrency(savingsTarget)}</strong>
          <p>20%</p>
        </div>
        <button type="button" data-month="${month}">Abrir</button>
      </article>
    `;
  }).join("");
}
function getRuleTotals(expenses) {
  return expenses.reduce((totals, expense) => {
    const groupKey = getRuleGroupKey(expense.category);
    if (!groupKey) return totals;
    totals[groupKey] = (totals[groupKey] || 0) + expense.amount;
    return totals;
  }, {});
}

function getRuleGroupKey(category) {
  return ruleGroups.find((item) => item.categories.includes(category))?.key || legacyCategoryGroups[category];
}

function getRuleGroupSummaries(income, totals) {
  return ruleGroups.map((group) => {
    const target = income * group.percentage;
    const used = totals[group.key] || 0;
    const remaining = target - used;
    const isSavings = group.key === "savings";
    const status = isSavings
      ? (used >= target ? "ok" : "warn")
      : (used <= target ? "ok" : "danger");

    return {
      ...group,
      target,
      used,
      remaining,
      status,
      badge: status === "danger" ? "Alerta" : status === "warn" ? "Atencao" : "Ok",
      alertTitle: isSavings ? group.title : `${group.title} em acompanhamento`,
      alertText: isSavings
        ? (remaining > 0 ? `${formatCurrency(remaining)} para completar a reserva de emergencia.` : "Reserva de emergencia completa neste mes.")
        : (remaining >= 0 ? `${formatCurrency(remaining)} ainda livres nesta parte.` : `${formatCurrency(Math.abs(remaining))} acima do limite recomendado.`)
    };
  });
}

function getCategoryTotals(expenses) {
  return expenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    return totals;
  }, {});
}

function getCategoryLabel(category) {
  return categoryLabels[category] || category;
}

function getIncomeForMonth(month) {
  return getIncomeDetails(month).ruleIncome || 0;
}

function getIncomeDetails(month) {
  const details = state.monthlyIncomeDetails?.[month];
  if (details) return normalizeIncomeDetail(details);

  const income = Number(state.monthlyIncomes?.[month]) || 0;
  return normalizeIncomeDetail({ netSalary: income });
}

function getIncomeFormDetails() {
  const netSalary = Number(elements.monthlyIncome.value) || 0;
  const mealVoucher = Number(elements.mealVoucher.value) || 0;

  return normalizeIncomeDetail({
    netSalary,
    mealVoucher
  });
}

function setIncomeFields(month) {
  const details = getIncomeDetails(month);
  const hasDetails = Boolean(state.monthlyIncomeDetails?.[month]);

  elements.monthlyIncome.value = details.netSalary || "";
  elements.mealVoucher.value = hasDetails && details.mealVoucher ? details.mealVoucher : "";
  renderIncomePreview(details);
}

function updateIncomePreview() {
  renderIncomePreview(getIncomeFormDetails());
}

function renderIncomePreview(details) {
  elements.ruleIncomeTotal.textContent = formatCurrency(details.ruleIncome);
}

function getSavedMonths() {
  const months = new Set([
    ...Object.keys(state.monthlyIncomes || {}),
    ...Object.keys(state.monthlyIncomeDetails || {})
  ]);
  state.expenses.forEach((expense) => {
    if (expense.date) months.add(expense.date.slice(0, 7));
  });
  if (state.selectedMonth) months.add(state.selectedMonth);

  return [...months].filter(Boolean).sort().reverse();
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function formatMonth(value) {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function toDateValue(date) {
  return date.toISOString().slice(0, 10);
}

function toMonthValue(date) {
  return date.toISOString().slice(0, 7);
}

function cleanCpf(value) {
  return value.replace(/\D/g, "");
}

function cpfToEmail(cpf) {
  return `${cpf}@agente-financeiro.app`;
}

function cpfToLegacyEmail(cpf) {
  return `${cpf}@cpf.agente-financeiro.local`;
}

function emailToCpf(email = "") {
  const cpf = email.split("@")[0] || "";
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
