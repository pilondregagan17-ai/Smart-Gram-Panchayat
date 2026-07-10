// Admin Authentication Script

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const authError = document.getElementById("authError");
    const errorText = document.getElementById("errorText");

    const showError = (message) => {
        if (authError && errorText) {
            errorText.textContent = message;
            authError.style.display = "flex";
        } else {
            alert(message);
        }
    };

    const clearError = () => {
        if (authError) {
            authError.style.display = "none";
        }
    };

    // Handle Admin Login
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            clearError();
            
            const email = document.getElementById("emailInput").value.trim();
            const password = document.getElementById("passwordInput").value.trim();
            
            if (!email || !password) {
                showError("Please enter email and password.");
                return;
            }
            
            try {
                const btnSubmit = loginForm.querySelector("button[type='submit']");
                btnSubmit.disabled = true;
                const originalText = btnSubmit.innerHTML;
                btnSubmit.innerHTML = `<span>Logging in...</span>`;
                
                await dbLayer.loginAdmin(email, password);
                
                // Redirect to Dashboard
                window.location.href = "admin-dashboard.html";
            } catch (error) {
                console.error("Login failed:", error);
                btnSubmit.disabled = false;
                showError(error.message || "Invalid email or password.");
            }
        });
    }

    // Handle Admin Signup
    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            clearError();
            
            const email = document.getElementById("emailInput").value.trim();
            const password = document.getElementById("passwordInput").value.trim();
            const confirmPassword = document.getElementById("confirmPasswordInput").value.trim();
            
            if (!email || !password || !confirmPassword) {
                showError("Please fill in all fields.");
                return;
            }
            
            if (password !== confirmPassword) {
                showError("Passwords do not match.");
                return;
            }
            
            if (password.length < 5) {
                showError("Password should be at least 5 characters long.");
                return;
            }
            
            try {
                const btnSubmit = signupForm.querySelector("button[type='submit']");
                btnSubmit.disabled = true;
                
                await dbLayer.registerAdmin(email, password);
                
                // Redirect to Dashboard
                window.location.href = "admin-dashboard.html";
            } catch (error) {
                console.error("Signup failed:", error);
                btnSubmit.disabled = false;
                showError(error.message || "Registration failed. Account might already exist.");
            }
        });
    }

    // Protect Dashboard and Auth Pages
    if (window.location.pathname.endsWith("admin-dashboard.html")) {
        dbLayer.onAuthStateChanged((user) => {
            if (!user) {
                // Not logged in, redirect to login page
                window.location.href = "admin-login.html";
            }
        });
    } else if (window.location.pathname.endsWith("admin-login.html") || window.location.pathname.endsWith("admin-signup.html")) {
        dbLayer.onAuthStateChanged((user) => {
            if (user) {
                // Already logged in, redirect to dashboard
                window.location.href = "admin-dashboard.html";
            }
        });
    }
});

// Logout Helper
async function logoutAdmin() {
    try {
        await dbLayer.logoutAdmin();
        window.location.href = "index.html";
    } catch (error) {
        console.error("Logout failed:", error);
        alert("Logout failed. Please try again.");
    }
}
