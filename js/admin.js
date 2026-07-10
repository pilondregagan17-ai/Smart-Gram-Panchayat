// Production Ready Admin Control Panel Script
let localComplaints = [];
let localCertificates = [];
let localNotices = [];
let localLogs = [];

let activeStatusFilter = "All";
let searchQuery = "";
let rowsPerPage = 10;
let currentPage = 1;

// Chart references
let monthlyChartInstance = null;
let categoryChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    // 1. Auth Guard - Check if Administrator is logged in
    dbLayer.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = "admin-login.html";
        } else {
            // Populate Header email & badge
            const emailSpan = document.getElementById("adminEmailDisplay");
            if (emailSpan) emailSpan.textContent = user.email;
            
            // Load admin profile picture if exists
            loadAdminProfilePic(user.email);
            
            // Check connection status
            updateFirebaseConnectionStatus();
            
            // Load all database layers
            loadDashboardData();
        }
    });

    // 2. Setup Tab Switching
    setupTabSwitching();

    // 3. Bind Search and Filter Controls
    setupFilters();

    // 4. Bind Notice Publishing Form
    setupNoticePublishForm();

    // 5. Bind Admin settings forms
    setupSettingsForms();

    // 6. Bind Header Logout Button
    const logoutBtn = document.getElementById("dashboardLogoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            const isEng = localStorage.getItem("gp_lang") === "en";
            const confirmMsg = isEng ? "Are you sure you want to logout?" : "क्या आप लॉग आउट करना चाहते हैं?";
            if (confirm(confirmMsg)) {
                await dbLayer.logoutAdmin();
                window.location.href = "admin-login.html";
            }
        });
    }
});

// Setup Tab Navigation
function setupTabSwitching() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-tab");
            switchTab(target);
        });
    });
}

function switchTab(tabId) {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach(b => {
        if (b.getAttribute("data-tab") === tabId) {
            b.classList.add("active");
        } else {
            b.classList.remove("active");
        }
    });

    tabContents.forEach(c => {
        if (c.getAttribute("id") === tabId) {
            c.classList.add("active");
        } else {
            c.classList.remove("active");
        }
    });

    // Trigger tab-specific loads
    if (tabId === "overviewTab") {
        renderOverviewTab();
    } else if (tabId === "logsTab") {
        loadActivityLogs();
    }
}

// Check if Firebase is mock or live cloud
function updateFirebaseConnectionStatus() {
    const statusText = document.getElementById("firebaseStatusText");
    if (!statusText) return;
    
    if (dbLayer.isMock()) {
        statusText.textContent = "LocalStorage Mode (Demo)";
        statusText.style.color = "var(--accent)";
    } else {
        statusText.textContent = "Firebase Cloud Connected";
        statusText.style.color = "var(--success)";
    }
}

// Load DB Layers
async function loadDashboardData() {
    try {
        localComplaints = await dbLayer.getAllComplaints();
        localCertificates = await dbLayer.getAllCertificateRequests();
        localNotices = await dbLayer.getAllNotices();
        localLogs = await dbLayer.getActivityLogs();

        // Load config from settings
        rowsPerPage = parseInt(localStorage.getItem("gp_rows_per_page") || "10");
        const rowsSelect = document.getElementById("rowsPerPageSelect");
        if (rowsSelect) rowsSelect.value = rowsPerPage;

        // Render Overview tab default
        updateStats();
        renderOverviewTab();

        // Render Tables
        renderComplaintsTable();
        renderCertificatesTable();
        renderNoticesTable();
    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

// Stats & Overview KPI calculator
function updateStats() {
    const total = localComplaints.length;
    const pending = localComplaints.filter(c => c.status === "Pending").length;
    const progress = localComplaints.filter(c => c.status === "In Progress").length;
    const completed = localComplaints.filter(c => c.status === "Completed").length;

    // Set counters
    document.getElementById("statTotal").textContent = total;
    document.getElementById("statPending").textContent = pending;
    document.getElementById("statProgress").textContent = progress;
    document.getElementById("statCompleted").textContent = completed;

    // Today's complaints count
    const todayStr = new Date().toDateString();
    const todayCount = localComplaints.filter(c => new Date(c.createdAt).toDateString() === todayStr).length;
    const todayCountEl = document.getElementById("statToday");
    if (todayCountEl) todayCountEl.textContent = todayCount;

    // Weekly statistics text
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyComplaints = localComplaints.filter(c => new Date(c.createdAt).getTime() > oneWeekAgo);
    const weeklyCount = weeklyComplaints.length;
    const weeklyPending = weeklyComplaints.filter(c => c.status === "Pending").length;
    const pendingRate = weeklyCount > 0 ? Math.round((weeklyPending / weeklyCount) * 100) : 0;
    
    const weeklyText = document.getElementById("weeklyReviewText");
    if (weeklyText) {
        weeklyText.textContent = `इस सप्ताह कुल ${weeklyCount} शिकायतें दर्ज की गईं। लंबित दर ${pendingRate}% है। (Weekly complaints: ${weeklyCount}, pending rate: ${pendingRate}%)`;
    }
}

// ------------------------------------------------------------------------
// TAB 0: OVERVIEW & ANALYTICS CHARTS (Chart.js)
// ------------------------------------------------------------------------
function renderOverviewTab() {
    renderCharts();
    renderRecentsLists();
}

function renderCharts() {
    // 1. Category Chart
    const categoryCtx = document.getElementById("categoryChart");
    if (!categoryCtx) return;

    const dict = getActiveLanguageDict();
    const catCounts = {
        cat_water: 0,
        cat_road: 0,
        cat_light: 0,
        cat_garbage: 0,
        cat_drainage: 0
    };

    localComplaints.forEach(c => {
        if (catCounts[c.category] !== undefined) {
            catCounts[c.category]++;
        }
    });

    const categoryLabels = [
        dict.cat_water || "पेयजल",
        dict.cat_road || "सड़क",
        dict.cat_light || "स्ट्रीट लाइट",
        dict.cat_garbage || "कचरा",
        dict.cat_drainage || "जल निकासी"
    ];

    if (categoryChartInstance) categoryChartInstance.destroy();

    categoryChartInstance = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: categoryLabels,
            datasets: [{
                data: [
                    catCounts.cat_water,
                    catCounts.cat_road,
                    catCounts.cat_light,
                    catCounts.cat_garbage,
                    catCounts.cat_drainage
                ],
                backgroundColor: ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // 2. Monthly Trend Chart
    const monthlyCtx = document.getElementById("monthlyChart");
    if (!monthlyCtx) return;

    // Group complaints by month (last 6 months)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const last6Months = [];
    const monthlyCounts = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        last6Months.push(monthNames[d.getMonth()]);
        
        // Count complaints in this month
        const count = localComplaints.filter(c => {
            const compDate = new Date(c.createdAt);
            return compDate.getMonth() === d.getMonth() && compDate.getFullYear() === d.getFullYear();
        }).length;
        
        monthlyCounts.push(count);
    }

    if (monthlyChartInstance) monthlyChartInstance.destroy();

    monthlyChartInstance = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: last6Months,
            datasets: [{
                label: 'शिकायतें (Complaints)',
                data: monthlyCounts,
                backgroundColor: 'rgba(30, 64, 175, 0.85)',
                borderColor: '#1E40AF',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

function renderRecentsLists() {
    // 1. Recent complaints (last 5)
    const compList = document.getElementById("recentComplaintsList");
    if (compList) {
        compList.innerHTML = "";
        const dict = getActiveLanguageDict();
        const recentComps = [...localComplaints]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        if (recentComps.length === 0) {
            compList.innerHTML = `<p style="text-align: center; color: var(--text-light); padding: 1rem;">कोई शिकायत नहीं मिली।</p>`;
        } else {
            recentComps.forEach(c => {
                const item = document.createElement("div");
                item.style.padding = "0.75rem";
                item.style.borderBottom = "1px solid var(--border)";
                item.style.display = "flex";
                item.style.justifyContent = "space-between";
                item.style.alignItems = "center";
                item.style.fontSize = "0.9rem";

                item.innerHTML = `
                    <div>
                        <strong style="color:var(--primary); font-family:monospace;">${c.trackingId}</strong> - ${c.name}
                        <div style="font-size:0.75rem; color:var(--text-light); margin-top:3px;">
                            ${dict[c.category] || c.category} | Priority: <strong>${c.priority || 'Normal'}</strong>
                        </div>
                    </div>
                    <span class="badge badge-${c.status === 'Completed' ? 'completed' : c.status === 'In Progress' ? 'progress' : 'pending'}">
                        ${c.status}
                    </span>
                `;
                compList.appendChild(item);
            });
        }
    }

    // 2. Recent Certificates (last 5)
    const certList = document.getElementById("recentCertificatesList");
    if (certList) {
        certList.innerHTML = "";
        const dict = getActiveLanguageDict();
        const recentCerts = [...localCertificates]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        if (recentCerts.length === 0) {
            certList.innerHTML = `<p style="text-align: center; color: var(--text-light); padding: 1rem;">कोई प्रमाणपत्र अनुरोध नहीं मिला।</p>`;
        } else {
            recentCerts.forEach(r => {
                const item = document.createElement("div");
                item.style.padding = "0.75rem";
                item.style.borderBottom = "1px solid var(--border)";
                item.style.display = "flex";
                item.style.justifyContent = "space-between";
                item.style.alignItems = "center";
                item.style.fontSize = "0.9rem";

                item.innerHTML = `
                    <div>
                        <strong style="color:var(--accent); font-family:monospace;">${r.id}</strong> - ${r.name}
                        <div style="font-size:0.75rem; color:var(--text-light); margin-top:3px;">
                            ${dict[r.certificateType] || r.certificateType}
                        </div>
                    </div>
                    <span class="badge badge-${r.status === 'Approved' ? 'completed' : r.status === 'Rejected' ? 'danger' : r.status === 'More Info Required' ? 'warning' : 'pending'}">
                        ${r.status}
                    </span>
                `;
                certList.appendChild(item);
            });
        }
    }
}

// ------------------------------------------------------------------------
// TAB 1: COMPLAINTS RENDER & SORTING (Priority sorted)
// ------------------------------------------------------------------------
function setupFilters() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value;
            renderComplaintsTable();
        });
    }

    const filterBtns = document.querySelectorAll(".filter-buttons button");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => {
                b.className = "btn btn-outline btn-sm";
            });
            btn.className = "btn btn-primary btn-sm";
            activeStatusFilter = btn.getAttribute("data-filter");
            renderComplaintsTable();
        });
    });
}

function renderComplaintsTable() {
    const tbody = document.getElementById("complaintsTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    const dict = getActiveLanguageDict();

    // 1. Filter
    let filtered = localComplaints;
    if (activeStatusFilter !== "All") {
        filtered = filtered.filter(c => c.status === activeStatusFilter);
    }

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(c => 
            c.trackingId.toLowerCase().includes(query) ||
            c.name.toLowerCase().includes(query) ||
            c.mobile.includes(query) ||
            (dict[c.category] && dict[c.category].toLowerCase().includes(query))
        );
    }

    // 2. Priority Sorting (Emergency > High > Normal)
    const priorityWeights = { Emergency: 3, High: 2, Normal: 1 };
    filtered.sort((a, b) => {
        const weightA = priorityWeights[a.priority] || 1;
        const weightB = priorityWeights[b.priority] || 1;
        
        if (weightB !== weightA) {
            return weightB - weightA; // Higher weight first
        }
        // Fallback to Date descending
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem;">कोई शिकायत रिकॉर्ड नहीं मिला।</td></tr>`;
        return;
    }

    // Render Table rows
    filtered.forEach(c => {
        const row = document.createElement("tr");
        
        // Priority Badge styling
        const pClass = c.priority === 'Emergency' ? 'danger' : c.priority === 'High' ? 'warning' : 'primary';
        const priorityBadge = `<span class="badge badge-${pClass}">${c.priority || 'Normal'}</span>`;

        // Attachment link/thumbnail if photo exists
        let photoMarkup = "";
        if (c.photo) {
            photoMarkup = `<div style="margin-top:5px;"><a href="#" onclick="openPhotoLightbox('${c.photo}')" style="display:inline-flex; align-items:center; gap:0.25rem; font-size:0.75rem; color:var(--primary); font-weight:600;"><i data-lucide="image" style="width:12px;height:12px;"></i> View Photo</a></div>`;
        }

        // Map Location Column
        let mapMarkup = `<span style="color:var(--text-light); font-size:0.8rem;">None</span>`;
        if (c.latitude && c.longitude) {
            mapMarkup = `<a href="https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:0.2rem; font-size:0.75rem; padding:0.2rem 0.5rem;" title="${c.latitude}, ${c.longitude}"><i data-lucide="map-pin" style="width:12px;height:12px;color:var(--accent);"></i> Open Map</a>`;
        }

        // Date parse
        const dateStr = new Date(c.createdAt).toLocaleDateString();

        // Status select
        const statusSelect = `
            <select class="input-control select-status" onchange="updateComplaintStatus('${c.trackingId}', this.value)" style="padding:0.25rem; font-size:0.85rem; min-width:110px;">
                <option value="Pending" ${c.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="In Progress" ${c.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Completed" ${c.status === 'Completed' ? 'selected' : ''}>Completed</option>
            </select>
        `;

        row.innerHTML = `
            <td>
                <strong style="color:var(--primary); font-family:monospace;">${c.trackingId}</strong>
                <div style="font-size:0.75rem; color:var(--text-light); margin-top:3px;">${dateStr}</div>
            </td>
            <td>${priorityBadge}</td>
            <td>
                <strong>${c.name}</strong>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">+91 ${c.mobile}</div>
            </td>
            <td>${dict[c.category] || c.category}</td>
            <td>
                <div style="max-width: 250px; font-size:0.85rem; line-height:1.4; color:var(--text-secondary); word-wrap: break-word;">${c.description}</div>
                ${photoMarkup}
            </td>
            <td>${mapMarkup}</td>
            <td>${statusSelect}</td>
            <td>
                <button onclick="deleteComplaint('${c.trackingId}')" class="btn btn-danger btn-sm" style="padding: 0.35rem;" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
            </td>
        `;

        tbody.appendChild(row);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Update status handler
async function updateComplaintStatus(id, newStatus) {
    try {
        const ok = await dbLayer.updateComplaintStatus(id, newStatus);
        if (ok) {
            // Log administrative action
            await dbLayer.addActivityLog("Complaint Status Changed", `शिकायत संख्या ${id} का स्टेटस बदलकर "${newStatus}" किया गया।`);
            
            // Re-fetch database
            localComplaints = await dbLayer.getAllComplaints();
            updateStats();
            renderRecentsLists();
            
            // Citizen Simulated SMS dispatch
            const complaint = localComplaints.find(c => c.trackingId === id);
            if (complaint) {
                const alertText = `PANCHAYAT ALERT: Dear Citizen, status of your complaint ${id} is updated to: ${newStatus}. Log on to portal to track.`;
                await dbLayer.sendLiveSMS(complaint.mobile, alertText);
            }
        }
    } catch (e) {
        console.error(e);
        alert("Failed to update status.");
    }
}

// Delete complaint handler
async function deleteComplaint(id) {
    const isEng = localStorage.getItem("gp_lang") === "en";
    const confirmMsg = isEng ? "Are you sure you want to delete this complaint?" : "क्या आप वाकई इस शिकायत को हटाना चाहते हैं?";
    if (!confirm(confirmMsg)) return;

    try {
        const ok = await dbLayer.deleteComplaint(id);
        if (ok) {
            await dbLayer.addActivityLog("Complaint Deleted", `शिकायत संख्या ${id} को डिलीट किया गया।`);
            localComplaints = await dbLayer.getAllComplaints();
            updateStats();
            renderOverviewTab();
            renderComplaintsTable();
        }
    } catch (e) {
        console.error(e);
        alert("Failed to delete complaint.");
    }
}

// ------------------------------------------------------------------------
// TAB 2: CERTIFICATE REQUESTS & SECRETARY DECISIONS
// ------------------------------------------------------------------------
function renderCertificatesTable() {
    const tbody = document.getElementById("certificatesTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    const dict = getActiveLanguageDict();

    if (localCertificates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">कोई प्रमाणपत्र अनुरोध रिकॉर्ड नहीं मिला।</td></tr>`;
        return;
    }

    localCertificates.forEach(r => {
        const row = document.createElement("tr");
        const dateStr = new Date(r.createdAt).toLocaleDateString();

        // Status badge color mapping
        let statusBadgeClass = 'badge-pending';
        if (r.status === 'Approved') statusBadgeClass = 'badge-completed';
        else if (r.status === 'Rejected') statusBadgeClass = 'badge-danger';
        else if (r.status === 'More Info Required') statusBadgeClass = 'badge-warning';

        // Custom secretary actions based on current status
        let actionsButtons = "";
        if (r.status === 'Pending' || r.status === 'More Info Required') {
            actionsButtons = `
                <div style="display:flex; gap:0.4rem;">
                    <button onclick="approveCertificate('${r.id}')" class="btn btn-primary btn-sm" style="font-size:0.75rem; padding:0.3rem 0.5rem;"><i data-lucide="check" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:2px;"></i> Approve</button>
                    <button onclick="openRemarksModal('${r.id}', 'Rejected')" class="btn btn-danger btn-sm" style="font-size:0.75rem; padding:0.3rem 0.5rem;"><i data-lucide="x" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:2px;"></i> Reject</button>
                    <button onclick="openRemarksModal('${r.id}', 'More Info Required')" class="btn btn-outline btn-sm" style="font-size:0.75rem; padding:0.3rem 0.5rem;"><i data-lucide="help-circle" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:2px;"></i> Request Info</button>
                </div>
            `;
        } else {
            actionsButtons = `<span style="font-size:0.8rem; color:var(--text-light); font-weight:600;">Processed (No pending action)</span>`;
        }

        row.innerHTML = `
            <td>
                <strong style="color:var(--accent); font-family:monospace;">${r.id}</strong>
                <div style="font-size:0.75rem; color:var(--text-light); margin-top:3px;">${dateStr}</div>
            </td>
            <td>
                <strong>${r.name}</strong>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">+91 ${r.mobile}</div>
            </td>
            <td>${dict[r.certificateType] || r.certificateType}</td>
            <td>
                <div style="max-width: 250px; font-size:0.85rem; line-height:1.4; color:var(--text-secondary); word-wrap: break-word;">${r.reason}</div>
            </td>
            <td><span class="badge ${statusBadgeClass}">${r.status}</span></td>
            <td>${actionsButtons}</td>
        `;

        tbody.appendChild(row);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Approve certificate request
async function approveCertificate(id) {
    try {
        const ok = await dbLayer.updateCertificateRequestStatus(id, "Approved");
        if (ok) {
            await dbLayer.addActivityLog("Certificate Approved", `प्रमाणपत्र आवेदन ${id} को स्वीकृत किया गया।`);
            localCertificates = await dbLayer.getAllCertificateRequests();
            renderRecentsLists();
            renderCertificatesTable();

            // Simulate Email/SMS
            const cert = localCertificates.find(c => c.id === id);
            if (cert) {
                const message = `PANCHAYAT NOTICE: Dear ${cert.name}, your certificate application ${id} has been Approved. Please collect it from Panchayat Office.`;
                await dbLayer.sendLiveSMS(cert.mobile, message);
            }
        }
    } catch (e) {
        console.error(e);
        alert("Failed to approve certificate.");
    }
}

// Modal Remarks Popup helpers
function openRemarksModal(certId, actionType) {
    const modal = document.getElementById("remarksModal");
    const certIdInput = document.getElementById("modalRemarksCertId");
    const actionInput = document.getElementById("modalRemarksActionType");
    const modalHeader = document.getElementById("modalRemarksHeader");
    const modalDesc = document.getElementById("modalRemarksDesc");
    const remarksText = document.getElementById("modalRemarksText");

    if (!modal) return;

    certIdInput.value = certId;
    actionInput.value = actionType;
    remarksText.value = "";

    if (actionType === "Rejected") {
        modalHeader.textContent = "आवेदन अस्वीकृत करें (Reject Certificate)";
        modalDesc.textContent = "कृपया आवेदक को सूचित करने के लिए अस्वीकृति का स्पष्ट कारण लिखें (Reason for Rejection):";
    } else {
        modalHeader.textContent = "अतिरिक्त दस्तावेज / जानकारी मांगें";
        modalDesc.textContent = "कृपया आवश्यक दस्तावेजों या जानकारियों की सूची प्रदान करें (Required Documents list):";
    }

    modal.style.display = "flex";
}

function closeRemarksModal() {
    const modal = document.getElementById("remarksModal");
    if (modal) modal.style.display = "none";
}

// Submit remarks details
async function submitRemarksModalAction() {
    const certId = document.getElementById("modalRemarksCertId").value;
    const actionType = document.getElementById("modalRemarksActionType").value;
    const textNote = document.getElementById("modalRemarksText").value.trim();

    if (!textNote) {
        alert("Please write a remark message for the citizen.");
        return;
    }

    try {
        // Save status and remark details to DB
        if (useMockMode) {
            const list = JSON.parse(localStorage.getItem('gp_certificates') || '[]');
            const index = list.findIndex(c => c.id === certId);
            if (index !== -1) {
                list[index].status = actionType;
                list[index].statusNote = textNote;
                localStorage.setItem('gp_certificates', JSON.stringify(list));
            }
        } else {
            // Cloud update
            await fbDb.collection('certificate_requests').doc(certId).update({ 
                status: actionType, 
                statusNote: textNote 
            });
        }

        // Add Log
        await dbLayer.addActivityLog(`Certificate ${actionType}`, `प्रमाणपत्र आवेदन ${certId} की स्थिति बदल कर "${actionType}" की गई। संदेश: ${textNote}`);

        localCertificates = await dbLayer.getAllCertificateRequests();
        renderRecentsLists();
        renderCertificatesTable();
        closeRemarksModal();

        // Dispatch simulated alert
        const cert = localCertificates.find(c => c.id === certId);
        if (cert) {
            const message = `PANCHAYAT ALERT: Action required on your certificate request ${certId}. Status: ${actionType}. Note: ${textNote}`;
            await dbLayer.sendLiveSMS(cert.mobile, message);
        }
    } catch (e) {
        console.error(e);
        alert("Failed to save secretary decision.");
    }
}

// ------------------------------------------------------------------------
// TAB 3: VILLAGE NOTICE BOARD MANAGER
// ------------------------------------------------------------------------
function setupNoticePublishForm() {
    const form = document.getElementById("noticePublishForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const title = document.getElementById("noticeTitleInput").value.trim();
        const type = document.getElementById("noticeTypeSelect").value;
        const content = document.getElementById("noticeContentInput").value.trim();

        if (!title || !content) {
            alert("Please fill all notice fields.");
            return;
        }

        try {
            const notice = { title, type, content };
            await dbLayer.addNotice(notice);
            await dbLayer.addActivityLog("Notice Published", `शीर्षक "${title}" के साथ नई पंचायत सूचना प्रकाशित की गई।`);
            
            // Reset form
            form.reset();
            
            // Reload & re-render notice table
            localNotices = await dbLayer.getAllNotices();
            renderNoticesTable();
            alert("सूचना सफलतापूर्वक प्रकाशित की गई! (Announcement published successfully)");
        } catch (error) {
            console.error(error);
            alert("Notice publishing failed.");
        }
    });
}

function renderNoticesTable() {
    const tbody = document.getElementById("noticesTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (localNotices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color:var(--text-light);">कोई प्रकाशित सूचना नहीं मिली।</td></tr>`;
        return;
    }

    localNotices.forEach(n => {
        const row = document.createElement("tr");
        const dateStr = new Date(n.createdAt).toLocaleDateString();

        row.innerHTML = `
            <td>
                <strong>${n.type}</strong>
                <div style="font-size:0.75rem; color:var(--text-light); margin-top:2px;">${dateStr}</div>
            </td>
            <td><strong>${n.title}</strong></td>
            <td>
                <div style="max-width: 280px; font-size:0.85rem; line-height:1.4; color:var(--text-secondary); word-wrap: break-word;">${n.content}</div>
            </td>
            <td>
                <button onclick="deleteNotice('${n.id}')" class="btn btn-danger btn-sm" style="padding: 0.35rem;" title="Delete Notice"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function deleteNotice(id) {
    if (!confirm("क्या आप वाकई इस सूचना को हटाना चाहते हैं? (Delete notice?)")) return;

    try {
        await dbLayer.deleteNotice(id);
        await dbLayer.addActivityLog("Notice Deleted", `सूचना आईडी ${id} को हटाया गया।`);
        localNotices = await dbLayer.getAllNotices();
        renderNoticesTable();
    } catch (e) {
        console.error(e);
        alert("Failed to delete notice.");
    }
}

// ------------------------------------------------------------------------
// TAB 4: AUDIT ACTIVITY LOGS LIST
// ------------------------------------------------------------------------
async function loadActivityLogs() {
    const tbody = document.getElementById("logsTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem;">Loading Logs...</td></tr>`;

    try {
        localLogs = await dbLayer.getActivityLogs();
        tbody.innerHTML = "";

        if (localLogs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color:var(--text-light);">कोई लॉग गतिविधि नहीं मिली।</td></tr>`;
            return;
        }

        localLogs.forEach(l => {
            const row = document.createElement("tr");
            const dateStr = new Date(l.createdAt).toLocaleString();

            row.innerHTML = `
                <td style="font-family: monospace; font-size:0.85rem;">${dateStr}</td>
                <td><strong style="color:var(--primary);">${l.action}</strong></td>
                <td style="font-size:0.85rem; color:var(--text-secondary);">${l.details}</td>
                <td style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${l.adminEmail}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color:var(--danger);">Failed to fetch activity logs.</td></tr>`;
    }
}

// ------------------------------------------------------------------------
// TAB 5: SYSTEM CONFIGURATION & EXPORTS
// ------------------------------------------------------------------------
function setupSettingsForms() {
    // GP Details Form
    const gpForm = document.getElementById("panchayatForm");
    if (gpForm) {
        // Pre-fill
        document.getElementById("gpName").value = localStorage.getItem("gp_name") || "ग्राम पंचायत बोरुजवाडा";
        document.getElementById("gpAddress").value = localStorage.getItem("gp_address") || "बोरुजवाडा, छिंदवाड़ा, मध्य प्रदेश";
        document.getElementById("gpSarpanch").value = localStorage.getItem("gp_sarpanch") || "श्री गगन पिलौंद्रे";
        document.getElementById("gpPhone").value = localStorage.getItem("gp_phone") || "+91 9876543210";
        document.getElementById("gpEmail").value = localStorage.getItem("gp_email") || "info@borujwada.gp.gov.in";
        document.getElementById("gpMap").value = localStorage.getItem("gp_map") || "https://maps.google.com/?q=Borujwada";

        gpForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            localStorage.setItem("gp_name", document.getElementById("gpName").value.trim());
            localStorage.setItem("gp_address", document.getElementById("gpAddress").value.trim());
            localStorage.setItem("gp_sarpanch", document.getElementById("gpSarpanch").value.trim());
            localStorage.setItem("gp_phone", document.getElementById("gpPhone").value.trim());
            localStorage.setItem("gp_email", document.getElementById("gpEmail").value.trim());
            localStorage.setItem("gp_map", document.getElementById("gpMap").value.trim());

            await dbLayer.addActivityLog("Profile Settings Changed", "ग्राम पंचायत की प्रोफ़ाइल विवरण को अपडेट किया गया।");
            showSettingsAlert("Gram Panchayat Profile details saved successfully!");
        });
    }

    // Rows and auto-logout config
    const secForm = document.getElementById("securityForm");
    if (secForm) {
        // Pre-fill
        document.getElementById("autoLogout").value = localStorage.getItem("gp_autologout") || "30";
        
        secForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            localStorage.setItem("gp_autologout", document.getElementById("autoLogout").value);
            
            const rowsVal = document.getElementById("rowsPerPageSelect").value;
            localStorage.setItem("gp_rows_per_page", rowsVal);
            rowsPerPage = parseInt(rowsVal);
            
            await dbLayer.addActivityLog("Security Config Updated", `सुरक्षा कॉन्फ़िग और पंक्तियां (${rowsVal}/पेज) अपडेट किए गए।`);
            showSettingsAlert("System preferences saved successfully!");
            
            // Re-render complaints
            renderComplaintsTable();
        });
    }

    // Load SMS gate keys
    const provider = localStorage.getItem("gp_sms_provider") || "Disabled";
    const apiKey = localStorage.getItem("gp_sms_api_key") || "";
    const senderId = localStorage.getItem("gp_sms_sender_id") || "";
    const senderNum = localStorage.getItem("gp_sms_sender_num") || "";

    const provSelect = document.getElementById("smsProviderSelect");
    if (provSelect) {
        provSelect.value = provider;
        document.getElementById("smsApiKeyInput").value = apiKey;
        document.getElementById("smsSenderInput").value = senderId;
        document.getElementById("smsSenderNumInput").value = senderNum;
        toggleSmsProviderFields();
    }

    // 1. Change Email Form
    const emailForm = document.getElementById("changeEmailForm");
    if (emailForm) {
        emailForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const newEmail = document.getElementById("newAdminEmail").value.trim();
            try {
                await dbLayer.changeAdminEmail(newEmail);
                await dbLayer.addActivityLog("Email Updated", `प्रशासक ने अपना ईमेल बदलकर "${newEmail}" किया।`);
                showSettingsAlert("Email address updated successfully!");
                document.getElementById("adminEmailDisplay").textContent = newEmail;
                emailForm.reset();
            } catch (error) {
                alert("ईमेल बदलने में असमर्थ: " + error.message);
            }
        });
    }

    // 2. Change Password Form
    const passForm = document.getElementById("changePasswordForm");
    if (passForm) {
        passForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const newPass = document.getElementById("newAdminPassword").value;
            const confirmPass = document.getElementById("confirmAdminPassword").value;
            if (newPass !== confirmPass) {
                alert("पासवर्ड मेल नहीं खाते! (Passwords do not match!)");
                return;
            }
            try {
                await dbLayer.changeAdminPassword(newPass);
                await dbLayer.addActivityLog("Password Updated", "प्रशासक ने अपना पासवर्ड बदला।");
                showSettingsAlert("Password updated successfully!");
                passForm.reset();
            } catch (error) {
                alert("पासवर्ड बदलने में असमर्थ: " + error.message);
            }
        });
    }

    // 3. Register New Admin Account (Secondary Admin Manager)
    const regAdminForm = document.getElementById("registerAdminForm");
    if (regAdminForm) {
        regAdminForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("regAdminEmail").value.trim();
            const password = document.getElementById("regAdminPassword").value;
            try {
                if (dbLayer.isMock()) {
                    const admins = JSON.parse(localStorage.getItem('gp_admins') || '[]');
                    if (admins.some(a => a.email === email)) {
                        alert("Email already registered!");
                        return;
                    }
                    admins.push({ email, password });
                    localStorage.setItem('gp_admins', JSON.stringify(admins));
                } else {
                    // Firebase Secondary App trick to create user without changing current auth state
                    const secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryTempApp");
                    await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
                    await secondaryApp.delete();
                }

                await dbLayer.addActivityLog("New Admin Registered", `नया एडमिन "${email}" पंजीकृत किया गया।`);
                showSettingsAlert("New Admin Account created successfully!");
                regAdminForm.reset();
            } catch (error) {
                console.error(error);
                alert("पंजीकरण में विफलता: " + error.message);
            }
        });
    }
}

// Notification Save Key helpers
function toggleSmsProviderFields() {
    const prov = document.getElementById("smsProviderSelect").value;
    const block = document.getElementById("smsCredentialsBlock");
    const numBlock = document.getElementById("smsSenderNumGroup");
    const keyLabel = document.getElementById("smsApiKeyLabel");
    const senderLabel = document.getElementById("smsSenderLabel");

    if (prov === "Disabled") {
        block.style.display = "none";
    } else {
        block.style.display = "block";
        if (prov === "Twilio") {
            keyLabel.textContent = "Twilio Auth Token";
            senderLabel.textContent = "Twilio Account SID";
            numBlock.style.display = "block";
        } else {
            // Fast2SMS
            keyLabel.textContent = "Fast2SMS Authorization API Key";
            senderLabel.textContent = "Sender ID (Optional)";
            numBlock.style.display = "none";
        }
    }
}

async function saveNotificationSettings() {
    const prov = document.getElementById("smsProviderSelect").value;
    const key = document.getElementById("smsApiKeyInput").value.trim();
    const sender = document.getElementById("smsSenderInput").value.trim();
    const num = document.getElementById("smsSenderNumInput").value.trim();

    localStorage.setItem("gp_sms_provider", prov);
    localStorage.setItem("gp_sms_api_key", key);
    localStorage.setItem("gp_sms_sender_id", sender);
    localStorage.setItem("gp_sms_sender_num", num);

    await dbLayer.addActivityLog("Notification Settings Changed", `एसएमएस अधिसूचना प्रदाता को "${prov}" पर अपडेट किया गया।`);
    showSettingsAlert("SMS Gateway configurations saved successfully!");
}

function showSettingsAlert(msg) {
    const alertBox = document.getElementById("settingsAlert");
    const alertMsg = document.getElementById("alertMessage");
    if (alertBox && alertMsg) {
        alertMsg.textContent = msg;
        alertBox.style.display = "flex";
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            alertBox.style.display = "none";
        }, 4000);
    }
}

// ------------------------------------------------------------------------
// ADMINISTRATIVE EXPORTS EXCEL, CSV & PDF
// ------------------------------------------------------------------------
function exportData(type) {
    const dict = getActiveLanguageDict();
    
    // Format rows
    const dataRows = localComplaints.map(c => ({
        "Tracking ID": c.trackingId,
        "Name": c.name,
        "Mobile": c.mobile,
        "Category": dict[c.category] || c.category,
        "Priority": c.priority || "Normal",
        "GPS Lat": c.latitude || "N/A",
        "GPS Lng": c.longitude || "N/A",
        "Status": c.status,
        "Created Date": new Date(c.createdAt).toLocaleDateString()
    }));

    if (type === "CSV") {
        // Build CSV string
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Tracking ID,Name,Mobile,Category,Priority,GPS Lat,GPS Lng,Status,Created Date\n";
        dataRows.forEach(r => {
            csvContent += `"${r["Tracking ID"]}","${r.Name}","${r.Mobile}","${r.Category}","${r.Priority}","${r["GPS Lat"]}","${r["GPS Lng"]}","${r.Status}","${r["Created Date"]}"\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Panchayat_Complaints_Report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } 
    else if (type === "Excel") {
        // SheetJS Export
        const worksheet = XLSX.utils.json_to_sheet(dataRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Complaints");
        XLSX.writeFile(workbook, `Panchayat_Complaints_Report.xlsx`);
    } 
    else if (type === "PDF") {
        // High fidelity PDF Report using jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.setTextColor(30, 64, 175);
        doc.text("SMART GRAM PANCHAYAT REPORT", 20, 20);
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 28);
        doc.line(20, 32, 190, 32);

        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        let currentY = 40;

        dataRows.forEach((r, idx) => {
            if (currentY > 260) {
                doc.addPage();
                currentY = 20;
            }
            doc.text(`${idx + 1}. [${r["Tracking ID"]}] ${r.Name} (${r.Mobile})`, 20, currentY);
            doc.text(`   Category: ${r.Category} | Priority: ${r.Priority} | Status: ${r.Status}`, 20, currentY + 5);
            doc.text(`   GPS Coordinates: ${r["GPS Lat"]}, ${r["GPS Lng"]} | Date: ${r["Created Date"]}`, 20, currentY + 10);
            
            doc.setDrawColor(230, 230, 230);
            doc.line(20, currentY + 13, 190, currentY + 13);
            currentY += 18;
        });

        doc.save(`Panchayat_Complaints_Report.pdf`);
    }
}

// ------------------------------------------------------------------------
// DATA BACKUP & DATABASE RESTORATIONS
// ------------------------------------------------------------------------
function backupPanchayatData() {
    const backupObj = {
        complaints: JSON.parse(localStorage.getItem('gp_complaints') || '[]'),
        certificates: JSON.parse(localStorage.getItem('gp_certificates') || '[]'),
        notices: JSON.parse(localStorage.getItem('gp_notices') || '[]'),
        logs: JSON.parse(localStorage.getItem('gp_activity_logs') || '[]'),
        profile: {
            name: localStorage.getItem('gp_name') || "",
            address: localStorage.getItem('gp_address') || "",
            sarpanch: localStorage.getItem('gp_sarpanch') || "",
            phone: localStorage.getItem('gp_phone') || "",
            email: localStorage.getItem('gp_email') || "",
            map: localStorage.getItem('gp_map') || ""
        },
        version: "v1.1-backup"
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupObj))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `Panchayat_Full_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
}

function importPanchayatData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.version && data.version.includes("backup")) {
                localStorage.setItem('gp_complaints', JSON.stringify(data.complaints || []));
                localStorage.setItem('gp_certificates', JSON.stringify(data.certificates || []));
                localStorage.setItem('gp_notices', JSON.stringify(data.notices || []));
                localStorage.setItem('gp_activity_logs', JSON.stringify(data.logs || []));
                
                if (data.profile) {
                    localStorage.setItem('gp_name', data.profile.name || "");
                    localStorage.setItem('gp_address', data.profile.address || "");
                    localStorage.setItem('gp_sarpanch', data.profile.sarpanch || "");
                    localStorage.setItem('gp_phone', data.profile.phone || "");
                    localStorage.setItem('gp_email', data.profile.email || "");
                    localStorage.setItem('gp_map', data.profile.map || "");
                }

                await dbLayer.addActivityLog("Database Restored", "पूर्ण डेटाबेस बैकअप फ़ाइल से पुनर्स्थापित (Restored) किया गया।");
                alert("डेटाबेस सफलतापूर्वक पुनर्स्थापित किया गया! (Database restored successfully)");
                
                // Reload dashboard state
                loadDashboardData();
            } else {
                alert("अवैध बैकअप फ़ाइल। (Invalid backup file format)");
            }
        } catch (err) {
            console.error(err);
            alert("फ़ाइल पढ़ने में विफलता। (Error parsing file JSON)");
        }
    };
    reader.readAsText(file);
}

function clearSystemCache() {
    if (confirm("कैश साफ़ करने से सभी क्रेडेंशियल और सेटिंग रीसेट हो जाएंगी और आप लॉग आउट हो जाएंगे। क्या आप आगे बढ़ना चाहते हैं?")) {
        localStorage.clear();
        window.location.href = "index.html";
    }
}

// ------------------------------------------------------------------------
// ADMIN PROFILE AVATAR PICTURES HANDLERS
// ------------------------------------------------------------------------
function loadAdminProfilePic(email) {
    const picData = localStorage.getItem(`gp_admin_pic_${email}`);
    const badgePic = document.getElementById("adminBadgePic");
    const badgeIcon = document.getElementById("adminBadgeIcon");
    const settingsPic = document.getElementById("adminProfilePicPreview");

    const avatarUrl = picData || "images/default-user.png";

    if (badgePic) {
        badgePic.src = avatarUrl;
        badgePic.style.display = "block";
        if (badgeIcon) badgeIcon.style.display = "none";
    }
    if (settingsPic) {
        settingsPic.src = avatarUrl;
    }
}

function uploadAdminProfilePic(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        alert("File size exceeds 2MB limit.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;
        const currentEmail = localStorage.getItem("gp_current_admin") || "admin@panchayat.gov.in";
        
        localStorage.setItem(`gp_admin_pic_${currentEmail}`, base64);
        loadAdminProfilePic(currentEmail);
        
        dbLayer.addActivityLog("Avatar Updated", "प्रशासक प्रोफ़ाइल चित्र अपडेट किया गया।");
    };
    reader.readAsDataURL(file);
}

// ------------------------------------------------------------------------
// PHOTO ATTACHMENT LIGHTBOX
// ------------------------------------------------------------------------
function openPhotoLightbox(photoUrl) {
    const modal = document.getElementById("photoLightboxModal");
    const img = document.getElementById("lightboxImage");
    if (modal && img) {
        img.src = photoUrl;
        modal.style.display = "flex";
    }
}

function closePhotoLightbox() {
    const modal = document.getElementById("photoLightboxModal");
    if (modal) modal.style.display = "none";
}

// Explicit global bindings for inline HTML onclick triggers
window.switchTab = switchTab;
window.exportData = exportData;
window.openRemarksModal = openRemarksModal;
window.closeRemarksModal = closeRemarksModal;
window.submitRemarksModalAction = submitRemarksModalAction;
window.openPhotoLightbox = openPhotoLightbox;
window.closePhotoLightbox = closePhotoLightbox;
window.uploadAdminProfilePic = uploadAdminProfilePic;
window.backupPanchayatData = backupPanchayatData;
window.importPanchayatData = importPanchayatData;
window.clearSystemCache = clearSystemCache;
window.saveNotificationSettings = saveNotificationSettings;
window.toggleSmsProviderFields = toggleSmsProviderFields;
window.deleteNotice = deleteNotice;
window.approveCertificate = approveCertificate;
window.deleteComplaint = deleteComplaint;
window.updateComplaintStatus = updateComplaintStatus;
window.loadActivityLogs = loadActivityLogs;
