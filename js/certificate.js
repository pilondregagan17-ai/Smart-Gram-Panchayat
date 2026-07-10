// Certificate Request Script

document.addEventListener("DOMContentLoaded", () => {
    const certificateForm = document.getElementById("certificateForm");
    const successCard = document.getElementById("successCard");
    const formCard = document.getElementById("formCard");
    const requestIdDisplay = document.getElementById("requestIdDisplay");
    
    if (certificateForm) {
        certificateForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const name = document.getElementById("nameInput").value.trim();
            const mobile = document.getElementById("mobileInput").value.trim();
            const certificateType = document.getElementById("certTypeSelect").value;
            const reason = document.getElementById("reasonInput").value.trim();
            
            // Validation
            if (!name || !mobile || !certificateType || !reason) {
                alert("Please fill all required fields.");
                return;
            }
            
            if (!/^\d{10}$/.test(mobile)) {
                alert("Please enter a valid 10-digit mobile number.");
                return;
            }
            
            const request = {
                name,
                mobile,
                certificateType,
                reason
            };
            
            try {
                const btnSubmit = certificateForm.querySelector("button[type='submit']");
                btnSubmit.disabled = true;
                const originalText = btnSubmit.innerHTML;
                btnSubmit.innerHTML = `<span>Submitting...</span>`;
                
                const id = await dbLayer.addCertificateRequest(request);
                
                // Show Success
                requestIdDisplay.textContent = id;
                formCard.style.display = "none";
                successCard.style.display = "block";
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (error) {
                console.error("Error submitting certificate request:", error);
                alert("Failed to submit request. Please try again.");
            }
        });
    }
});
