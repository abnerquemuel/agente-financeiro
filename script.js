const storageKey = "agente-financeiro-state";

const categories = [
  "Moradia",
  "Alimentacao",
  "Transporte",
  "Lazer",
  "Saude",
  "Educacao",
  "Outros"
];

const categoryLabels = {
  Alimentacao: "Alimentação",
  Saude: "Saúde",
  Educacao: "Educação"
};

const state = loadState();

const elements = {
  budgetForm: document.querySelector("#budgetForm"),
  monthlyGoal: document.querySelector("#monthlyGoal"),
  monthFilter: document.querySelector("#monthFilter"),
  expenseForm: document.querySelector("#expenseForm"),
  expenseName: document.querySelector("#expenseName"),
  expenseAmount: document.querySelector("#expenseAmount"),
  expenseDate: document.querySelector("#expenseDate"),
  expenseCategory: document.querySelector("#expenseCategory"),
  resetDemo: document.querySelector("#resetDemo"),
  spentTotal: document.querySelector("#spentTotal"),
  spentStatus: document.querySelector("#spentStatus"),
  goalTotal: document.querySelector("#goalTotal"),
  goalStatus: document.querySelector("#goalStatus"),
  remainingTotal: document.querySelector("#remainingTotal"),
  remainingStatus: document.querySelector("#remainingStatus"),
  progressPercent: document.querySelector("#progressPercent"),
  progressBar: document.querySelector("#progressBar"),
  progressPanel: document.querySelector(".progress-panel"),
  agentHeadline: document.querySelector("#agentHeadline"),
  agentMessage: document.querySelector("#agentMessage"),
  alertsList: document.querySelector("#alertsList"),
  categoryList: document.querySelector("#categoryList"),
  transactionsList: document.querySelector("#transactionsList")
};

initialize();

function initialize() {
  const today = new Date();
  const currentMonth = toMonthValue(today);

  elements.monthFilter.value = state.selectedMonth || currentMonth;
  elements.expenseDate.value = toDateValue(today);
  elements.monthlyGoal.value = state.monthlyGoal || "";

  elements.budgetForm.addEventListener("submit", saveBudget);
  elements.expenseForm.addEventListener("submit", addExpense);
  elements.monthFilter.addEventListener("change", () => {
    state.selectedMonth = elements.monthFilter.value;
    saveState();
    render();
  });
  elements.resetDemo.addEventListener("click", resetData);

  elements.transactionsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-id]");
    if (!button) return;

    state.expenses = state.expenses.filter((expense) => expense.id !== button.dataset.removeId);
    saveState();
    render();
  });

  render();
}

function loadState() {
  const fallback = {
    monthlyGoal: 0,
    selectedMonth: "",
    expenses: []
  };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return saved && Array.isArray(saved.expenses) ? saved : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function saveBudget(event) {
  event.preventDefault();
  state.monthlyGoal = Number(elements.monthlyGoal.value) || 0;
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
  state.monthlyGoal = 0;
  state.selectedMonth = toMonthValue(new Date());
  state.expenses = [];
  elements.monthlyGoal.value = "";
  elements.monthFilter.value = state.selectedMonth;
  saveState();
  render();
}

function render() {
  const month = elements.monthFilter.value;
  const monthlyExpenses = state.expenses.filter((expense) => expense.date.startsWith(month));
  const totalSpent = sum(monthlyExpenses.map((expense) => expense.amount));
  const goal = Number(state.monthlyGoal) || 0;
  const remaining = goal - totalSpent;
  const percent = goal > 0 ? Math.round((totalSpent / goal) * 100) : 0;

  elements.spentTotal.textContent = formatCurrency(totalSpent);
  elements.goalTotal.textContent = formatCurrency(goal);
  elements.remainingTotal.textContent = formatCurrency(remaining);
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressBar.style.width = `${Math.min(percent, 100)}%`;

  elements.spentStatus.textContent = monthlyExpenses.length
    ? `${monthlyExpenses.length} gasto${monthlyExpenses.length === 1 ? "" : "s"} registrado${monthlyExpenses.length === 1 ? "" : "s"} neste mês.`
    : "Nenhum gasto registrado neste mês.";

  elements.goalStatus.textContent = goal > 0
    ? "Alertas ativos para sua meta mensal."
    : "Defina uma meta para ativar alertas.";

  elements.remainingStatus.textContent = remaining >= 0
    ? `${formatCurrency(remaining)} ainda disponível.`
    : `${formatCurrency(Math.abs(remaining))} acima da meta.`;

  elements.progressPanel.classList.toggle("is-warning", percent >= 80 && percent < 100);
  elements.progressPanel.classList.toggle("is-danger", percent >= 100);

  renderAgent(totalSpent, goal, percent, remaining);
  renderAlerts(monthlyExpenses, totalSpent, goal, percent);
  renderCategories(monthlyExpenses, totalSpent);
  renderTransactions(monthlyExpenses);
}

function renderAgent(totalSpent, goal, percent, remaining) {
  if (!goal) {
    elements.agentHeadline.textContent = "Defina sua meta para eu monitorar.";
    elements.agentMessage.textContent = "Depois disso eu comparo seus gastos com o limite do mês e aviso quando estiver perto de passar.";
    return;
  }

  if (percent >= 100) {
    elements.agentHeadline.textContent = "Atenção: você passou da meta.";
    elements.agentMessage.textContent = `Você gastou ${formatCurrency(totalSpent)} e ultrapassou o limite em ${formatCurrency(Math.abs(remaining))}.`;
    return;
  }

  if (percent >= 80) {
    elements.agentHeadline.textContent = "Você está perto do limite.";
    elements.agentMessage.textContent = `Já usou ${percent}% da meta. Ainda restam ${formatCurrency(remaining)} para fechar o mês.`;
    return;
  }

  elements.agentHeadline.textContent = "Seu mês está saudável.";
  elements.agentMessage.textContent = `Você usou ${percent}% da meta e ainda tem ${formatCurrency(remaining)} disponíveis.`;
}

function renderAlerts(expenses, totalSpent, goal, percent) {
  const alerts = [];
  const categoryTotals = getCategoryTotals(expenses);
  const highestCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  if (!goal) {
    alerts.push({
      level: "warn",
      label: "Meta",
      title: "Cadastre sua meta mensal",
      text: "Sem meta, eu consigo listar gastos, mas ainda não consigo avisar quando você passar do limite."
    });
  } else if (percent >= 100) {
    alerts.push({
      level: "danger",
      label: "Crítico",
      title: "Meta mensal ultrapassada",
      text: `Seu gasto chegou a ${formatCurrency(totalSpent)}, equivalente a ${percent}% da meta.`
    });
  } else if (percent >= 80) {
    alerts.push({
      level: "warn",
      label: "Atenção",
      title: "Limite quase alcançado",
      text: `Você já consumiu ${percent}% da meta mensal. Vale segurar compras não essenciais.`
    });
  } else {
    alerts.push({
      level: "ok",
      label: "Ok",
      title: "Gastos dentro da meta",
      text: "Seu orçamento ainda tem boa folga para o restante do mês."
    });
  }

  if (highestCategory && totalSpent > 0) {
    const categoryShare = Math.round((highestCategory[1] / totalSpent) * 100);
    alerts.push({
      level: categoryShare >= 50 ? "warn" : "ok",
      label: "Padrão",
      title: `${getCategoryLabel(highestCategory[0])} concentra seus gastos`,
      text: `Essa categoria representa ${categoryShare}% do total do mês.`
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

function getCategoryTotals(expenses) {
  return expenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    return totals;
  }, {});
}

function getCategoryLabel(category) {
  return categoryLabels[category] || category;
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

function toDateValue(date) {
  return date.toISOString().slice(0, 10);
}

function toMonthValue(date) {
  return date.toISOString().slice(0, 7);
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
