// Complaint Registration Script
document.addEventListener("DOMContentLoaded", () => {
    const complaintForm = document.getElementById("complaintForm");
    const photoInput = document.getElementById("photoInput");
    const photoPreview = document.getElementById("photoPreview");
    const successCard = document.getElementById("successCard");
    const formCard = document.getElementById("formCard");
    const trackingIdDisplay = document.getElementById("trackingIdDisplay");
    const copyBtn = document.getElementById("copyBtn");
    
    // New Elements
    const getLocationBtn = document.getElementById("getLocationBtn");
    const latInput = document.getElementById("latInput");
    const lngInput = document.getElementById("lngInput");
    const downloadReceiptBtn = document.getElementById("downloadReceiptBtn");
    
    let photoBase64 = "";

    // 1. Geolocation Locator
    if (getLocationBtn) {
        getLocationBtn.addEventListener("click", () => {
            getLocationBtn.disabled = true;
            getLocationBtn.innerHTML = `<span>Locating...</span>`;
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        latInput.value = position.coords.latitude.toFixed(6);
                        lngInput.value = position.coords.longitude.toFixed(6);
                        getLocationBtn.disabled = false;
                        getLocationBtn.innerHTML = `<i data-lucide="check-circle" style="color:var(--success);width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Located`;
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    },
                    (error) => {
                        console.error("Geolocation error:", error);
                        let errMsg = "स्थान प्राप्त करने में असमर्थ।";
                        if (error.code === error.PERMISSION_DENIED) {
                            errMsg = "स्थान अनुमति अस्वीकार कर दी गई।";
                        }
                        alert(errMsg);
                        getLocationBtn.disabled = false;
                        getLocationBtn.innerHTML = `<i data-lucide="map-pin"></i> Get Location`;
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    },
                    { enableHighAccuracy: true, timeout: 8000 }
                );
            } else {
                alert("Geolocation is not supported by this browser.");
                getLocationBtn.disabled = false;
            }
        });
    }

    // File Upload Handler (Converts and compresses image)
    if (photoInput) {
        photoInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                const currentLang = localStorage.getItem('gp_lang') || 'hi';
                alert(currentLang === 'en' ? "File size exceeds 5MB limit." : "फ़ाइल का आकार 5MB से अधिक है।");
                photoInput.value = "";
                photoPreview.style.display = "none";
                return;
            }

            const previewText = document.querySelector(".file-upload-text span");
            const originalText = previewText ? previewText.textContent : "";
            if (previewText) {
                const currentLang = localStorage.getItem('gp_lang') || 'hi';
                previewText.textContent = currentLang === 'en' ? "Compressing Image..." : "फ़ोटो कंप्रेस की जा रही है...";
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxDimension = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxDimension) {
                            height = Math.round((height * maxDimension) / width);
                            width = maxDimension;
                        }
                    } else {
                        if (height > maxDimension) {
                            width = Math.round((width * maxDimension) / height);
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    photoBase64 = canvas.toDataURL('image/jpeg', 0.7);
                    photoPreview.src = photoBase64;
                    photoPreview.style.display = "block";

                    if (previewText) previewText.textContent = originalText;
                };
            };
            reader.onerror = () => {
                alert("Failed to read file.");
            };
        });
    }

    // Form Submission
    if (complaintForm) {
        complaintForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const name = document.getElementById("nameInput").value.trim();
            const mobile = document.getElementById("mobileInput").value.trim();
            const category = document.getElementById("categorySelect").value;
            const description = document.getElementById("descriptionInput").value.trim();
            const priority = document.getElementById("prioritySelect").value;
            const latitude = latInput ? latInput.value : "";
            const longitude = lngInput ? lngInput.value : "";
            
            if (!name || !mobile || !category || !description) {
                alert("Please fill all required fields.");
                return;
            }
            
            if (!/^\d{10}$/.test(mobile)) {
                alert("Please enter a valid 10-digit mobile number.");
                return;
            }
            
            const btnSubmit = complaintForm.querySelector("button[type='submit']");
            btnSubmit.disabled = true;
            const originalText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = `<span>Submitting...</span>`;

            // Generate Tracking ID (GP-COMP-XXXXXX)
            const randomId = Math.floor(100000 + Math.random() * 900000);
            const trackingId = `GP-COMP-${randomId}`;
            
            try {
                // Upload Photo to Firebase Storage or get local base64 fallback
                let photoUrl = "";
                if (photoBase64) {
                    photoUrl = await dbLayer.uploadComplaintPhoto(trackingId, photoBase64);
                }

                const complaint = {
                    trackingId,
                    name,
                    mobile,
                    category,
                    priority,
                    latitude,
                    longitude,
                    photo: photoUrl,
                    status: "Pending",
                    createdAt: new Date().toISOString()
                };
                
                await dbLayer.addComplaint(complaint);
                
                // Trigger Live SMS Dispatch and simulation toast
                const messageText = `PANCHAYAT ALERT: Dear ${name}, your complaint is registered. Category: ${category}, Priority: ${priority}. Tracking ID is: ${trackingId}. Track at portal.`;
                await dbLayer.sendLiveSMS(mobile, messageText);
                
                // Show simulated phone SMS toast
                showSimulatedNotification(mobile, trackingId, priority);
                
                // Populate and Display Success
                trackingIdDisplay.textContent = trackingId;
                formCard.style.display = "none";
                successCard.style.display = "block";
                
                // Set direct tracking URL
                const trackDirectBtn = document.getElementById("trackComplaintDirectBtn");
                if (trackDirectBtn) {
                    trackDirectBtn.href = `track-complaint.html?id=${trackingId}`;
                }
                
                // Prepare high-fidelity official HTML receipt in background
                const categorySelect = document.getElementById("categorySelect");
                const categoryText = categorySelect.options[categorySelect.selectedIndex].text;
                prepareReceiptTemplate(trackingId, name, mobile, categoryText, priority, description, latitude, longitude, photoBase64);
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (error) {
                console.error("Error submitting complaint:", error);
                alert("Failed to submit complaint. Please try again.");
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = originalText;
            }
        });
    }

    // 2. Upgraded HTML Receipt Actions (Bilingual PDF & Printing)
    const printReceiptBtn = document.getElementById("printReceiptBtn");
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener("click", () => {
            const receiptEl = document.getElementById("complaintReceiptTemplate");
            
            const printWindow = window.open("", "_blank");
            printWindow.document.write(`
                <html>
                <head>
                    <title>Print Receipt - ${receiptEl.querySelector('#receiptTrackingId').textContent}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&family=Poppins:wght@400;500;600;700&family=Mukta:wght@400;600;700&display=swap" rel="stylesheet">
                    <style>
                        body {
                            margin: 0;
                            padding: 20px;
                            background: #ffffff;
                            font-family: 'Mukta', 'Noto Sans Devanagari', 'Poppins', sans-serif;
                            display: flex;
                            justify-content: center;
                        }
                        .badge {
                            display: inline-block;
                            padding: 0.25rem 0.6rem;
                            border-radius: 4px;
                            font-size: 0.75rem;
                            font-weight: 700;
                            text-transform: uppercase;
                            text-align: center;
                        }
                        .badge-pending {
                            background-color: rgba(249, 115, 22, 0.1);
                            color: #f97316;
                        }
                        div { box-sizing: border-box; }
                    </style>
                </head>
                <body>
                    ${receiptEl.outerHTML}
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(() => window.close(), 600);
                        }
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        });
    }

    if (downloadReceiptBtn) {
        downloadReceiptBtn.addEventListener("click", () => {
            const element = document.getElementById("complaintReceiptTemplate");
            const trackingId = document.getElementById("receiptTrackingId").textContent;
            
            const opt = {
                margin:       10,
                filename:     `Panchayat_Receipt_${trackingId}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2.5, useCORS: true, letterRendering: true },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            const originalText = downloadReceiptBtn.innerHTML;
            downloadReceiptBtn.innerHTML = `<span>Generating PDF...</span>`;
            downloadReceiptBtn.disabled = true;
            
            html2pdf().set(opt).from(element).save().then(() => {
                downloadReceiptBtn.innerHTML = originalText;
                downloadReceiptBtn.disabled = false;
            }).catch(err => {
                console.error(err);
                alert("Failed to generate PDF. Please try printing instead.");
                downloadReceiptBtn.innerHTML = originalText;
                downloadReceiptBtn.disabled = false;
            });
        });
    }

function prepareReceiptTemplate(trackingId, name, mobile, category, priority, description, lat, lng, photoData) {
    document.getElementById("receiptTrackingId").textContent = trackingId;
    document.getElementById("receiptCitizenName").textContent = name;
    document.getElementById("receiptMobile").textContent = "+91 " + mobile;
    document.getElementById("receiptCategory").textContent = category;
    
    // Priority styling
    const priorityEl = document.getElementById("receiptPriority");
    priorityEl.textContent = priority;
    if (priority === "Emergency") {
        priorityEl.style.color = "#ef4444";
        priorityEl.style.fontWeight = "bold";
    } else if (priority === "High") {
        priorityEl.style.color = "#f59e0b";
        priorityEl.style.fontWeight = "bold";
    } else {
        priorityEl.style.color = "#1e40af";
        priorityEl.style.fontWeight = "bold";
    }

    // Status styling
    const statusEl = document.getElementById("receiptStatus");
    statusEl.textContent = "PENDING";
    statusEl.className = "badge badge-pending";
    statusEl.style.backgroundColor = "rgba(249, 115, 22, 0.1)";
    statusEl.style.color = "#f97316";

    // Date
    document.getElementById("receiptDate").textContent = new Date().toLocaleString();

    // GPS location
    const gpsEl = document.getElementById("receiptGps");
    if (lat && lng) {
        gpsEl.textContent = `${lat}, ${lng}`;
    } else {
        gpsEl.textContent = "N/A";
    }

    // Description
    document.getElementById("receiptDescription").textContent = description;

    // Optional Photo
    const photoBlock = document.getElementById("receiptPhotoBlock");
    const photoImg = document.getElementById("receiptPhoto");
    if (photoData) {
        photoImg.src = photoData;
        photoBlock.style.display = "block";
    } else {
        photoBlock.style.display = "none";
    }

    // Generate QR Code containing the tracking URL for receipt (PDF & Print)
    const qrContainer = document.getElementById("receiptQrCode");
    qrContainer.innerHTML = "";
    
    // Generate QR Code containing the tracking URL for success card
    const successQrContainer = document.getElementById("successQrCode");
    if (successQrContainer) successQrContainer.innerHTML = "";
    
    const trackingUrl = `${window.location.origin}${window.location.pathname.replace('register-complaint.html', 'track-complaint.html')}?id=${trackingId}`;
    
    if (typeof QRCode !== 'undefined') {
        // Receipt QR (120x120 pixels)
        new QRCode(qrContainer, {
            text: trackingUrl,
            width: 120,
            height: 120,
            colorDark : "#0f172a",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });

        // Success Page QR (120x120 pixels)
        if (successQrContainer) {
            new QRCode(successQrContainer, {
                text: trackingUrl,
                width: 120,
                height: 120,
                colorDark : "#0f172a",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }
    }
}

    // 3. Simulated SMS Dispatch Notification Toast
    function showSimulatedNotification(mobile, trackingId, priority) {
        const toast = document.createElement("div");
        toast.style.position = "fixed";
        toast.style.bottom = "20px";
        toast.style.right = "20px";
        toast.style.backgroundColor = "#1e293b";
        toast.style.color = "#ffffff";
        toast.style.padding = "1rem 1.5rem";
        toast.style.borderRadius = "12px";
        toast.style.boxShadow = "0 20px 25px -5px rgba(0, 0, 0, 0.3)";
        toast.style.zIndex = "10000";
        toast.style.maxWidth = "350px";
        toast.style.borderLeft = "6px solid var(--accent)";
        toast.style.display = "flex";
        toast.style.flexDirection = "column";
        toast.style.gap = "0.5rem";
        toast.style.animation = "slideIn 0.3s ease-out forwards";

        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.9rem; color: var(--accent);">
                <i data-lucide="message-square" style="width:16px;height:16px;"></i>
                <span>💬 SMS Dispatch Simulator</span>
            </div>
            <div style="font-size: 0.85rem; line-height: 1.5;">
                <strong>To:</strong> +91 ${mobile}<br>
                <strong>Message:</strong> प्रिय नागरिक, आपकी शिकायत दर्ज हो गई है। प्राथमिकता: ${priority}। ट्रैकिंग आईडी: <strong>${trackingId}</strong>।
            </div>
        `;

        document.body.appendChild(toast);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Add keyframes dynamically if not present
        if (!document.getElementById("toastAnimation")) {
            const style = document.createElement("style");
            style.id = "toastAnimation";
            style.innerHTML = `
                @keyframes slideIn {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateY(0); opacity: 1; }
                    to { transform: translateY(100px); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => {
            toast.style.animation = "slideOut 0.3s ease-in forwards";
            setTimeout(() => toast.remove(), 300);
        }, 6000);
    }

    // Copy Tracking ID to Clipboard
    if (copyBtn) {
        copyBtn.addEventListener("click", () => {
            const trackingId = trackingIdDisplay.textContent;
            navigator.clipboard.writeText(trackingId).then(() => {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = `<i data-lucide="check" style="width:14px;height:14px;"></i> Copied!`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }, 2000);
            });
        });
    }
});
