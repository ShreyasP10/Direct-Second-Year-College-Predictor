// Global variables
let excelData = [];
let filteredData = [];
const resultsPerPage = 20;
let currentPage = 1;
let totalPages = 1;
let seatChoices, branchChoices, collegeChoices, regionChoices;

// Determine college type
function getCollegeTypeFromInstitute(name) {
  if (!name) return "Other";
  const lower = name.toLowerCase();
  if (lower.includes("government") && lower.includes("autonomous"))
    return "Government‑Autonomous";
  if (lower.includes("government")) return "Government";
  if (lower.startsWith("-aided") || /\bunaided\b/.test(lower)) return "Unaided";
  if (/\baided\b/.test(lower)) return "Aided";
  if (lower.includes("autonomous")) return "Autonomous";
  return "Other";
}

// Mapping code prefixes to region
const regionMapping = {
  Amravati: "1",
  Sambhajinagar: "2",
  Mumbai: "3",
  Nagpur: "4",
  Nashik: "5",
  Pune: "6"
};

// Unified selection helper
function getSelectedValues(instance) {
  const selected = instance.getValue(true);
  if (selected.includes("ALL_BRANCHES")) {
    return instance._currentState.choices
      .map((c) => c.value)
      .filter((v) => v !== "ALL_BRANCHES");
  }
  return selected;
}

// Toast notification logic
function showNotification(message, type = "error") {
  const notif = document.getElementById("notification");
  notif.querySelector("span").textContent = message;
  notif.className = `notification ${type} show`;
  setTimeout(() => {
    notif.className = "notification";
  }, 5000);
}

// Initialize Choices.js dropdowns
function initDropdowns() {
  seatChoices = new Choices("#seatType", {
    removeItemButton: true,
    placeholder: true,
    placeholderValue: "Choose seat types"
  });
  branchChoices = new Choices("#branch", {
    removeItemButton: true,
    placeholder: true,
    placeholderValue: "Choose branches"
  });
  collegeChoices = new Choices("#collegeType", {
    removeItemButton: true,
    placeholder: true,
    placeholderValue: "Choose college types"
  });
  regionChoices = new Choices("#region", {
    removeItemButton: true,
    placeholder: true,
    placeholderValue: "Select region(s)"
  });

  regionChoices.setChoices(
    Object.keys(regionMapping).map((r) => ({ value: r, label: r })),
    "value",
    "label",
    true
  );
}

// Populate dropdowns dynamically from loaded data
function populateDropdowns(data) {
  const seatTypes = [...new Set(data.map((d) => d["Seat Type"]).filter(Boolean))];
  seatChoices.setChoices(
    seatTypes.map((s) => ({ value: s, label: s })),
    "value",
    "label",
    true
  );

  const branches = [...new Set(data.map((d) => d["Branch"]).filter(Boolean))];
  branches.sort();
  const branchOptions = [
    { value: "ALL_BRANCHES", label: "All Branches" },
    ...branches.map((b) => ({ value: b, label: b }))
  ];
  branchChoices.setChoices(branchOptions, "value", "label", true);

  const collegeTypes = [
    ...new Set(data.map((d) => getCollegeTypeFromInstitute(d["Institute"])))
  ];
  collegeChoices.setChoices(
    collegeTypes.map((c) => ({ value: c, label: c })),
    "value",
    "label",
    true
  );
}

// Show or hide loading spinner
function showLoading(show) {
  if (show) {
    const div = document.createElement("div");
    div.className = "loading";
    div.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading colleges...';
    document.querySelector("main").appendChild(div);
  } else {
    document.querySelector(".loading")?.remove();
  }
}

// Main filtering logic
function filterData() {
  const regions = getSelectedValues(regionChoices);
  const seatTypes = getSelectedValues(seatChoices);
  const branches = getSelectedValues(branchChoices);
  const collegeTypes = getSelectedValues(collegeChoices);
  const predictType = document.querySelector('input[name="predictType"]:checked').value;
  const inputValue = parseFloat(document.getElementById("inputValue").value);
  const collegeCount = document.getElementById("collegeCount").value;

  if (isNaN(inputValue)) {
    showNotification("Please enter a valid percentile or rank");
    return null;
  }
  if (predictType === "percentile" && (inputValue < 0 || inputValue > 100)) {
    showNotification("Percentile must be between 0 and 100");
    return null;
  }

  let filtered = [...excelData];

  if (seatTypes.length) {
    filtered = filtered.filter((d) => seatTypes.includes(d["Seat Type"]));
  }
  if (branches.length) {
    filtered = filtered.filter((d) => branches.includes(d["Branch"]));
  }
  if (collegeTypes.length) {
    filtered = filtered.filter((d) =>
      collegeTypes.includes(getCollegeTypeFromInstitute(d["Institute"]))
    );
  }

  if (predictType === "rank") {
    filtered = filtered.filter((d) => d["Rank"] && inputValue <= d["Rank"]);
  } else {
    filtered = filtered.filter((d) => d["Percentile"] && inputValue >= d["Percentile"]);
  }

  if (regions.length) {
    filtered = filtered.filter((d) => {
      const code = String(d["Institute Code"] || "");
      return regions.some((r) => code.startsWith(regionMapping[r]));
    });
  }

  filtered.sort((a, b) => (b["Percentile"] || 0) - (a["Percentile"] || 0));

  if (collegeCount !== "all") {
    filtered = filtered.slice(0, parseInt(collegeCount, 10));
  }

  return filtered;
}

// Display selected filter criteria
function displaySearchParams() {
  const params = [
    { label: "Region", value: getSelectedValues(regionChoices).join(", ") || "All" },
    { label: "Seat Type", value: getSelectedValues(seatChoices).join(", ") || "All" },
    { label: "Branch", value: getSelectedValues(branchChoices).join(", ") || "All" },
    { label: "College Type", value: getSelectedValues(collegeChoices).join(", ") || "All" }
  ];

  const predictType = document.querySelector('input[name="predictType"]:checked').value;
  params.push({ label: "Filter By", value: predictType === "percentile" ? "Percentile" : "Rank" });
  params.push({
    label: predictType === "percentile" ? "Percentile" : "Rank",
    value: document.getElementById("inputValue").value
  });

  const container = document.getElementById("searchParams");
  container.innerHTML = "";
  params.forEach((p) => {
    const div = document.createElement("div");
    div.className = "param-card";
    div.innerHTML = `<h3>${p.label}</h3><p>${p.value}</p>`;
    container.appendChild(div);
  });
}

// Show paginated results
function displayResults(page = 1) {
  currentPage = page;
  const start = (page - 1) * resultsPerPage;
  const end = Math.min(start + resultsPerPage, filteredData.length);
  const slice = filteredData.slice(start, end);

  const body = document.getElementById("resultsBody");
  body.innerHTML = slice.length
    ? ""
    : `<tr><td colspan="6">No colleges found</td></tr>`;
  slice.forEach((d) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d["Institute"] || "N/A"}</td>
      <td>${d["Branch"] || "N/A"}</td>
      <td>${getCollegeTypeFromInstitute(d["Institute"])}</td>
      <td>${d["Seat Type"] || "N/A"}</td>
      <td>${d["Rank"] ?? "N/A"}</td>
      <td>${d["Percentile"] ?? "N/A"}</td>`;
    body.appendChild(tr);
  });

  totalPages = Math.ceil(filteredData.length / resultsPerPage);
  document.getElementById("totalResults").textContent = filteredData.length;
  document.getElementById("currentPage").textContent = start + 1;
  document.getElementById("totalPages").textContent = end;

  renderPagination();
}

// Build pagination controls
function renderPagination() {
  const container = document.getElementById("pagination");
  container.innerHTML = "";

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "<";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => displayResults(currentPage - 1);
  container.appendChild(prevBtn);

  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = i === currentPage ? "active" : "";
    btn.onclick = () => displayResults(i);
    container.appendChild(btn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.textContent = ">";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => displayResults(currentPage + 1);
  container.appendChild(nextBtn);
}

// Export visible results to PDF
function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("College Prediction Results", 105, 15, null, null, "center");
  doc.setFontSize(12);
  let y = 30;
  document.querySelectorAll(".param-card").forEach((card) => {
    doc.text(`${card.querySelector("h3").textContent}: ${card.querySelector("p").textContent}`, 15, y);
    y += 8;
  });
  const headers = [["Institute", "Branch", "College Type", "Seat Type", "Rank", "Percentile"]];
  const body = filteredData.map((r) => [
    r["Institute"] || "N/A",
    r["Branch"] || "N/A",
    getCollegeTypeFromInstitute(r["Institute"]),
    r["Seat Type"] || "N/A",
    r["Rank"] ?? "N/A",
    r["Percentile"] ?? "N/A"
  ]);
  doc.autoTable({ startY: y + 10, head: headers, body, styles: { fontSize: 9 } });
  doc.save(`college-predictor-${Date.now()}.pdf`);
}

// Live search filter on displayed results
function searchResults() {
  const term = document.getElementById("searchResults").value.toLowerCase();
  if (!term) return displayResults(currentPage);
  const results = filteredData.filter((d) =>
    d["Institute"]?.toLowerCase().includes(term) ||
    d["Branch"]?.toLowerCase().includes(term) ||
    d["Seat Type"]?.toLowerCase().includes(term)
  );
  const body = document.getElementById("resultsBody");
  body.innerHTML = results.length
    ? ""
    : `<tr><td colspan="6">No results</td></tr>`;
  results.forEach((d) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d["Institute"] || "N/A"}</td>
      <td>${d["Branch"] || "N/A"}</td>
      <td>${getCollegeTypeFromInstitute(d["Institute"])}</td>
      <td>${d["Seat Type"] || "N/A"}</td>
      <td>${d["Rank"] ?? "N/A"}</td>
      <td>${d["Percentile"] ?? "N/A"}</td>`;
    body.appendChild(tr);
  });
}

// Reset filters & UI
function resetForm() {
  document.getElementById("predictorForm").reset();
  document.querySelector(".container").style.display = "block";
  document.getElementById("resultsContainer").style.display = "none";
  seatChoices.clearStore();
  branchChoices.clearStore();
  collegeChoices.clearStore();
  regionChoices.clearStore();
  populateDropdowns(excelData);
}

// Initialization
async function initApp() {
  initDropdowns();
  showLoading(true);
  try {
    const res = await fetch("DSE-Engineering-College-List.json");
    const json = await res.json();
    excelData = json["MHT-CET College Data"];
    populateDropdowns(excelData);
    showLoading(false);

    document.getElementById("predictButton").addEventListener("click", () => {
      filteredData = filterData();
      if (filteredData && filteredData.length) {
        document.querySelector(".container").style.display = "none";
        document.getElementById("resultsContainer").style.display = "block";
        displaySearchParams();
        displayResults();
      } else {
        showNotification("No colleges found matching your criteria", "info");
      }
    });

    document.getElementById("resetBtn").addEventListener("click", resetForm);
    document.getElementById("downloadPdfBtn").addEventListener("click", downloadPDF);
    document.getElementById("searchResults").addEventListener("input", searchResults);
    document.getElementById("clearSearch").addEventListener("click", () => {
      document.getElementById("searchResults").value = "";
      displayResults(currentPage);
    });
  } catch (err) {
    console.error(err);
    showLoading(false);
    showNotification("Failed to load college data", "error");
  }
}

// Kickoff
document.addEventListener("DOMContentLoaded", initApp);
