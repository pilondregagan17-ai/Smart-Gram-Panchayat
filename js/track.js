// Unified Citizen Tracking Script (Complaints & Certificates)
document.addEventListener("DOMContentLoaded", () => {
    const trackForm = document.getElementById("trackForm");
    const trackingIdInput = document.getElementById("trackingIdInput");
    const trackingResult = document.getElementById("trackingResult");
    const errorAlert = document.getElementById("errorAlert");
    
    // Tab Elements
    const trackComplaintsTabBtn = document.getElementById("trackComplaintsTabBtn");
    const trackCertificatesTabBtn = document.getElementById("trackCertificatesTabBtn");
    
    // Elements to populate in result card
    const resId = document.getElementById("resId");
    const resName = document.getElementById("resName");
    const resMobile = document.getElementById("resMobile");
    const resMobileRow = document.getElementById("resMobileRow");
    const resCategory = document.getElementById("resCategory");
    const resDate = document.getElementById("resDate");
    const resStatus = document.getElementById("resStatus");
    const resDescription = document.getElementById("resDescription");
    const resPhotoWrapper = document.getElementById("resPhotoWrapper");
    const resPhoto = document.getElementById("resPhoto");
    
    // Extended rows
    const resPriorityRow = document.getElementById("resPriorityRow");
    const resPriority = document.getElementById("resPriority");
    const resLocationRow = document.getElementById("resLocationRow");
    const resLocationLink = document.getElementById("resLocationLink");
    const resSecretaryNotesRow = document.getElementById("resSecretaryNotesRow");
    const resSecretaryNotes = document.getElementById("resSecretaryNotes");
    
    // Label fields to translate headers dynamically
    const resTitleHeader = document.getElementById("resTitleHeader");
    const resCategoryLabel = document.getElementById("resCategoryLabel");
    const resDescHeader = document.getElementById("resDescHeader");
    
    // Stepper elements
    const stepPending = document.getElementById("stepPending");
    const stepProgress = document.getElementById("stepProgress");
    const stepCompleted = document.getElementById("stepCompleted");
    const stepLabel1 = document.getElementById("stepLabel1");
    const stepLabel2 = document.getElementById("stepLabel2");
    const stepLabel3 = document.getElementById("stepLabel3");

    let activeTab = "Complaints"; // Complaints or Certificates

    // Handle Tab switching
    if (trackComplaintsTabBtn && trackCertificatesTabBtn) {
        trackComplaintsTabBtn.addEventListener("click", () => {
            activeTab = "Complaints";
            trackComplaintsTabBtn.className = "btn btn-primary";
            trackCertificatesTabBtn.className = "btn btn-outline";
            
            // Adjust search instructions
            document.getElementById("trackTitle").textContent = "अपनी शिकायत की स्थिति ट्रैक करें";
            document.getElementById("trackDesc").textContent = "शिकायत दर्ज करते समय प्राप्त हुई विशिष्ट ट्रैकिंग आईडी दर्ज करके अपनी शिकायत की वर्तमान प्रगति देखें।";
            document.getElementById("trackLabel").textContent = "ट्रैकिंग आईडी दर्ज करें";
            trackingIdInput.placeholder = "जैसे: GP-COMP-123456";
            
            // Clear result state
            trackingResult.style.display = "none";
            errorAlert.style.display = "none";
        });

        trackCertificatesTabBtn.addEventListener("click", () => {
            activeTab = "Certificates";
            trackComplaintsTabBtn.className = "btn btn-outline";
            trackCertificatesTabBtn.className = "btn btn-primary";
            
            // Adjust search instructions
            document.getElementById("trackTitle").textContent = "प्रमाणपत्र आवेदन ट्रैक करें";
            document.getElementById("trackDesc").textContent = "प्रमाणपत्र आवेदन जमा करते समय प्राप्त हुई विशिष्ट आवेदन आईडी दर्ज करके उसकी वर्तमान स्थिति देखें।";
            document.getElementById("trackLabel").textContent = "आवेदन आईडी दर्ज करें (Application ID)";
            trackingIdInput.placeholder = "जैसे: GP-CERT-123456";
            
            // Clear result state
            trackingResult.style.display = "none";
            errorAlert.style.display = "none";
        });
    }

    if (trackForm) {
        trackForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const trackingId = trackingIdInput.value.trim();
            if (!trackingId) return;
            
            // Reset views
            trackingResult.style.display = "none";
            errorAlert.style.display = "none";
            resPhotoWrapper.style.display = "none";
            resLocationRow.style.display = "none";
            resSecretaryNotesRow.style.display = "none";
            
            try {
                if (activeTab === "Complaints") {
                    const complaint = await dbLayer.getComplaint(trackingId);
                    if (complaint) {
                        displayComplaintDetails(complaint);
                    } else {
                        document.getElementById("errorText").textContent = "अवैध ट्रैकिंग आईडी। कृपया सही आईडी दर्ज करें।";
                        errorAlert.style.display = "flex";
                    }
                } else {
                    const list = await dbLayer.getAllCertificateRequests();
                    const request = list.find(r => r.id === trackingId);
                    if (request) {
                        displayCertificateDetails(request);
                    } else {
                        document.getElementById("errorText").textContent = "अवैध आवेदन आईडी। कृपया सही प्रमाणपत्र संख्या दर्ज करें।";
                        errorAlert.style.display = "flex";
                    }
                }
            } catch (error) {
                console.error("Error tracking:", error);
                alert("Error tracking request. Please try again.");
            }
        });
    }

    // 1. Display Complaint Details
    function displayComplaintDetails(complaint) {
        const dict = getActiveLanguageDict();
        
        // Headers translation
        resTitleHeader.textContent = "शिकायत विवरण / Complaint Details";
        resCategoryLabel.textContent = "शिकायत की श्रेणी / Category";
        resDescHeader.textContent = "शिकायत का विवरण / Description";
        
        resId.textContent = complaint.trackingId;
        resName.textContent = complaint.name;
        
        if (resMobileRow) resMobileRow.style.display = "flex";
        if (resMobile) resMobile.textContent = "+91 " + complaint.mobile;
        
        resCategory.textContent = dict[complaint.category] || complaint.category;
        
        // Priority
        resPriorityRow.style.display = "flex";
        resPriority.innerHTML = `<span class="badge badge-${complaint.priority === 'Emergency' ? 'danger' : complaint.priority === 'High' ? 'warning' : 'primary'}">${complaint.priority || 'Normal'}</span>`;
        
        // Geolocation Maps button
        if (complaint.latitude && complaint.longitude) {
            resLocationRow.style.display = "flex";
            resLocationLink.setAttribute("href", `https://www.google.com/maps/search/?api=1&query=${complaint.latitude},${complaint.longitude}`);
        } else {
            resLocationRow.style.display = "none";
        }
        
        // Date
        const date = new Date(complaint.createdAt);
        resDate.textContent = date.toLocaleDateString(localStorage.getItem('gp_lang') === 'en' ? 'en-US' : 'hi-IN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        
        // Status Badge
        let statusBadgeClass = 'badge-pending';
        let statusTextKey = 'status_pending';
        
        if (complaint.status === 'In Progress') {
            statusBadgeClass = 'badge-progress';
            statusTextKey = 'status_progress';
        } else if (complaint.status === 'Completed') {
            statusBadgeClass = 'badge-completed';
            statusTextKey = 'status_completed';
        }
        resStatus.innerHTML = `<span class="badge ${statusBadgeClass}">${dict[statusTextKey]}</span>`;
        resDescription.textContent = complaint.description;
        
        // Stepper
        stepLabel1.textContent = "लंबित (Pending)";
        stepLabel2.textContent = "प्रगति पर (In Progress)";
        stepLabel3.textContent = "पूर्ण (Completed)";
        updateStepper(complaint.status);
        
        if (complaint.photo) {
            resPhoto.src = complaint.photo;
            resPhotoWrapper.style.display = "block";
        }
        
        trackingResult.style.display = "block";
        trackingResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 2. Display Certificate Details
    function displayCertificateDetails(request) {
        const dict = getActiveLanguageDict();
        
        resTitleHeader.textContent = "प्रमाणपत्र आवेदन विवरण / Certificate Details";
        resCategoryLabel.textContent = "प्रमाणपत्र का प्रकार / Certificate Type";
        resDescHeader.textContent = "आवेदन का कारण / Reason";
        
        resId.textContent = request.id;
        resName.textContent = request.name;
        if (resMobileRow) resMobileRow.style.display = "none";
        
        // Translating certificate category type
        resCategory.textContent = dict[request.certificateType] || request.certificateType;
        
        // Priority row and Maps row not applicable for certificates
        resPriorityRow.style.display = "none";
        resLocationRow.style.display = "none";
        
        // Date
        const date = new Date(request.createdAt);
        resDate.textContent = date.toLocaleDateString(localStorage.getItem('gp_lang') === 'en' ? 'en-US' : 'hi-IN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        
        // Status Badge mapping
        let statusBadgeClass = 'badge-pending';
        let statusText = request.status;
        if (request.status === 'Approved') {
            statusBadgeClass = 'badge-completed';
            statusText = 'स्वीकृत (Approved)';
        } else if (request.status === 'Rejected') {
            statusBadgeClass = 'badge-danger';
            statusText = 'अस्वीकृत (Rejected)';
        } else if (request.status === 'More Info Required') {
            statusBadgeClass = 'badge-warning';
            statusText = 'अतिरिक्त जानकारी आवश्यक (More Info Required)';
        } else {
            statusText = 'लंबित (Pending)';
        }
        resStatus.innerHTML = `<span class="badge ${statusBadgeClass}">${statusText}</span>`;
        resDescription.textContent = request.reason;
        
        // Stepper labels adjustments
        stepLabel1.textContent = "आवेदन जमा (Submitted)";
        stepLabel2.textContent = "सत्यापन (Verification)";
        stepLabel3.textContent = "अंतिम स्थिति (Final Status)";
        
        // Set stepper dots based on status
        stepPending.className = "step completed";
        stepProgress.className = "step";
        stepCompleted.className = "step";
        
        if (request.status === 'Pending') {
            stepProgress.classList.add("active");
        } else if (request.status === 'More Info Required') {
            stepProgress.classList.add("active");
            stepProgress.style.backgroundColor = "rgba(249, 115, 22, 0.2)"; // warn color
        } else {
            stepProgress.className = "step completed";
            stepCompleted.className = "step completed";
        }
        
        // Display comments from secretary if requested
        if (request.statusNote || request.moreInfoText) {
            resSecretaryNotesRow.style.display = "block";
            resSecretaryNotes.textContent = request.statusNote || request.moreInfoText;
        }
        
        trackingResult.style.display = "block";
        trackingResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function updateStepper(status) {
        stepPending.className = "step";
        stepProgress.className = "step";
        stepCompleted.className = "step";
        
        if (status === "Pending") {
            stepPending.classList.add("active");
        } else if (status === "In Progress") {
            stepPending.classList.add("completed");
            stepProgress.classList.add("active");
        } else if (status === "Completed") {
            stepPending.classList.add("completed");
            stepProgress.classList.add("completed");
            stepCompleted.classList.add("completed");
        }
    }

    // Auto-search via URL query parameter if "id" is present
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get("id");
    if (queryId) {
        trackingIdInput.value = queryId;
        if (queryId.startsWith("GP-CERT-")) {
            if (trackCertificatesTabBtn) {
                trackCertificatesTabBtn.click();
            }
        } else {
            if (trackComplaintsTabBtn) {
                trackComplaintsTabBtn.click();
            }
        }
        // Trigger submit
        setTimeout(() => {
            trackForm.dispatchEvent(new Event("submit"));
        }, 100);
    }

    // Listen for language changes to update translation text dynamically
    window.addEventListener('languageChanged', async () => {
        const currentTrackingId = resId.textContent;
        if (currentTrackingId && trackingResult.style.display === "block") {
            if (activeTab === "Complaints") {
                const complaint = await dbLayer.getComplaint(currentTrackingId);
                if (complaint) displayComplaintDetails(complaint);
            } else {
                const list = await dbLayer.getAllCertificateRequests();
                const request = list.find(r => r.id === currentTrackingId);
                if (request) displayCertificateDetails(request);
            }
        }
    });
});
