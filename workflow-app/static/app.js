const state = {
  config: null,
  view: "dashboard",
  recordType: null,
  records: [],
  currentRecord: null,
};

const stageViews = new Set(["baseline", "planning", "execution", "review", "deployment", "maintenance"]);

const titleForView = {
  dashboard: "Dashboard",
  baseline: "Project Baseline",
  planning: "Planning",
  execution: "Execution",
  review: "Review and Evaluation",
  deployment: "Deployment",
  maintenance: "Maintenance and Monitoring",
  comments: "Comments and Feedback",
  history: "Version History",
  audit: "Audit Trail",
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function showMessage(text) {
  const node = document.getElementById("message");
  node.textContent = text;
  node.hidden = false;
  setTimeout(() => {
    node.hidden = true;
  }, 4500);
}

function submitter() {
  return document.getElementById("submitter").value.trim() || state.config.default_submitter;
}

function setView(view) {
  state.view = view;
  state.recordType = stageViews.has(view) ? view : null;
  document.querySelectorAll(".nav").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.getElementById("viewTitle").textContent = titleForView[view];
  document.querySelectorAll(".view").forEach((node) => {
    node.hidden = true;
  });
  if (stageViews.has(view)) {
    document.getElementById("stageView").hidden = false;
    loadStage(view);
  } else if (view === "comments") {
    document.getElementById("commentsView").hidden = false;
    loadComments();
  } else if (view === "history") {
    document.getElementById("historyView").hidden = false;
    loadHistory();
  } else if (view === "audit") {
    document.getElementById("auditView").hidden = false;
    loadAudit();
  } else {
    document.getElementById("dashboardView").hidden = false;
    loadDashboard();
  }
}

async function loadDashboard() {
  const data = await api("/api/dashboard");
  const statusCards = data.status_counts.map((item) => `
    <div class="card"><span>${item.status}</span><strong>${item.count}</strong></div>
  `).join("");
  document.getElementById("dashboardView").innerHTML = `
    <div class="cards">
      <div class="card"><span>Open revisions</span><strong>${data.open_revisions}</strong></div>
      <div class="card"><span>Deployments ready</span><strong>${data.deployment_ready}</strong></div>
      <div class="card"><span>Maintenance open</span><strong>${data.maintenance_open}</strong></div>
      <div class="card"><span>Approved baseline</span><strong>${data.approved_baseline ? `#${data.approved_baseline.snapshot_number}` : "None"}</strong></div>
      ${statusCards}
    </div>
  `;
}

async function loadStage(recordType) {
  state.records = await api(`/api/records?type=${recordType}`);
  const select = document.getElementById("recordSelect");
  select.innerHTML = state.records.map((record) => (
    `<option value="${record.id}">${record.title} (${record.status}, v${record.version_number})</option>`
  )).join("");
  if (state.records.length) {
    state.currentRecord = state.records[0];
    select.value = state.currentRecord.id;
  } else {
    state.currentRecord = null;
  }
  renderForm(recordType);
}

function renderForm(recordType) {
  const record = state.currentRecord;
  document.getElementById("recordTitle").value = record ? record.title : "";
  const payload = record ? record.payload : {};
  document.getElementById("dynamicFields").innerHTML = state.config.field_definitions[recordType].map((field) => `
    <label>
      ${field}
      <textarea data-field="${field}">${payload[field] || ""}</textarea>
    </label>
  `).join("");
}

function collectPayload() {
  const payload = {};
  document.querySelectorAll("#dynamicFields textarea").forEach((field) => {
    payload[field.dataset.field] = field.value.trim();
  });
  return payload;
}

async function saveRecord(event) {
  event.preventDefault();
  const body = {
    record_type: state.recordType,
    title: document.getElementById("recordTitle").value.trim() || "Untitled",
    payload: collectPayload(),
    submitter: submitter(),
    status: "Draft",
  };
  if (state.currentRecord) {
    state.currentRecord = await api(`/api/records/${state.currentRecord.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  } else {
    state.currentRecord = await api("/api/records", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  showMessage("Version saved.");
  await loadStage(state.recordType);
}

async function decide(decision) {
  if (!state.currentRecord) return showMessage("Select or create a record first.");
  state.currentRecord = await api(`/api/records/${state.currentRecord.id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, approver: submitter(), notes: "" }),
  });
  showMessage(`${decision} recorded.`);
  await loadStage(state.recordType);
}

async function submitForReview() {
  if (!state.currentRecord) return showMessage("Select or create a record first.");
  state.currentRecord = await api(`/api/records/${state.currentRecord.id}/submit`, {
    method: "POST",
    body: JSON.stringify({ submitter: submitter() }),
  });
  showMessage("Submitted for review.");
  await loadStage(state.recordType);
}

async function allRecords() {
  return api("/api/records");
}

function recordOptions(records) {
  return records.map((record) => (
    `<option value="${record.id}">${record.title} - ${titleForView[record.record_type]} (${record.status})</option>`
  )).join("");
}

async function loadComments() {
  const records = await allRecords();
  document.getElementById("commentRecord").innerHTML = recordOptions(records);
  const comments = await api("/api/comments");
  document.getElementById("commentsList").innerHTML = comments.map((comment) => `
    <div class="list-item">
      <strong>${comment.comment_type}</strong>
      <p>${comment.body}</p>
      <p class="meta">${comment.author} - ${comment.created_at}</p>
    </div>
  `).join("") || "<p>No comments yet.</p>";
}

async function addComment(event) {
  event.preventDefault();
  const recordId = document.getElementById("commentRecord").value;
  if (!recordId) return showMessage("Create a record before adding comments.");
  await api("/api/comments", {
    method: "POST",
    body: JSON.stringify({
      record_id: recordId,
      author: submitter(),
      comment_type: document.getElementById("commentType").value,
      body: document.getElementById("commentBody").value.trim(),
    }),
  });
  document.getElementById("commentBody").value = "";
  showMessage("Comment recorded.");
  loadComments();
}

async function loadHistory() {
  const records = await allRecords();
  const select = document.getElementById("historyRecord");
  select.innerHTML = recordOptions(records);
  await renderHistory();
  const snapshots = await api("/api/baselines");
  document.getElementById("baselineSnapshots").innerHTML = snapshots.map((snapshot) => `
    <div class="list-item">
      <strong>Snapshot #${snapshot.snapshot_number}${snapshot.is_active ? " (active)" : ""}</strong>
      <p class="meta">${snapshot.created_at}</p>
      <button data-restore="${snapshot.id}">Restore baseline</button>
    </div>
  `).join("") || "<p>No approved baselines yet.</p>";
  document.querySelectorAll("[data-restore]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/baselines/${button.dataset.restore}/restore`, {
        method: "POST",
        body: JSON.stringify({ actor: submitter() }),
      });
      showMessage("Baseline restored.");
      loadHistory();
    });
  });
}

async function renderHistory() {
  const recordId = document.getElementById("historyRecord").value;
  if (!recordId) {
    document.getElementById("historyList").innerHTML = "<p>No records yet.</p>";
    return;
  }
  const versions = await api(`/api/records/${recordId}/versions`);
  document.getElementById("historyList").innerHTML = versions.map((version) => `
    <div class="list-item">
      <strong>Version ${version.version_number} - ${version.status}</strong>
      <p class="meta">${version.submitter} - ${version.created_at}</p>
      <pre>${JSON.stringify(version.payload, null, 2)}</pre>
    </div>
  `).join("");
}

async function loadAudit() {
  const events = await api("/api/audit");
  document.getElementById("auditList").innerHTML = events.map((event) => `
    <div class="list-item">
      <strong>${event.event_type}</strong>
      <p class="meta">${event.actor} - ${event.created_at}</p>
      <pre>${JSON.stringify(event.details, null, 2)}</pre>
    </div>
  `).join("") || "<p>No audit events yet.</p>";
}

async function init() {
  state.config = await api("/api/config");
  document.getElementById("submitter").value = state.config.default_submitter;
  document.querySelectorAll(".nav").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.getElementById("recordSelect").addEventListener("change", (event) => {
    state.currentRecord = state.records.find((record) => record.id === event.target.value);
    renderForm(state.recordType);
  });
  document.getElementById("newRecord").addEventListener("click", () => {
    state.currentRecord = null;
    renderForm(state.recordType);
  });
  document.getElementById("recordForm").addEventListener("submit", saveRecord);
  document.getElementById("submitReview").addEventListener("click", submitForReview);
  document.getElementById("approveRecord").addEventListener("click", () => decide("Approved"));
  document.getElementById("needsRevision").addEventListener("click", () => decide("Needs Revision"));
  document.getElementById("rejectRecord").addEventListener("click", () => decide("Rejected"));
  document.getElementById("completeRecord").addEventListener("click", () => decide("Completed"));
  document.getElementById("deployRecord").addEventListener("click", () => decide("Deployed"));
  document.getElementById("commentForm").addEventListener("submit", addComment);
  document.getElementById("refreshHistory").addEventListener("click", renderHistory);
  document.getElementById("historyRecord").addEventListener("change", renderHistory);
  setView("dashboard");
}

init().catch((error) => showMessage(error.message));
