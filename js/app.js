// Shared App Logic - Theme & Translation Management

document.addEventListener("DOMContentLoaded", () => {
    // 1. Theme Initialization
    initTheme();

    // 2. Translation Initialization
    initTranslations();

    // 3. Lucide Icons Initialization
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // 4. Update Header controls if present
    setupHeaderControls();

    // 5. Load Gram Panchayat Profile Info (for home/contact pages)
    loadPanchayatProfile();

    // 6. Load notices if noticeBoardList is present
    if (document.getElementById("noticeBoardList")) {
        loadVillageNotices();
    }
});

// --- Theme Management ---
function initTheme() {
    const savedTheme = localStorage.getItem('gp_theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('gp_theme', theme);
    
    // Update theme toggle icon if it exists in the page
    const themeIcon = document.getElementById('themeToggleIcon');
    if (themeIcon) {
        if (theme === 'dark') {
            themeIcon.setAttribute('data-lucide', 'sun');
        } else {
            themeIcon.setAttribute('data-lucide', 'moon');
        }
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('gp_theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// --- Translation Management ---
function initTranslations() {
    // Default language is Hindi ('hi')
    const currentLang = localStorage.getItem('gp_lang') || 'hi';
    setLanguage(currentLang);
}

function setLanguage(lang) {
    localStorage.setItem('gp_lang', lang);
    
    // Run translation runner
    const dict = TRANSLATIONS[lang];
    if (!dict) return;

    // Translate standard content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.innerHTML = dict[key];
        }
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) {
            el.setAttribute('placeholder', dict[key]);
        }
    });

    // Sync any language dropdowns on the page
    const langSelects = document.querySelectorAll('.lang-select');
    langSelects.forEach(select => {
        select.value = lang;
    });

    // Re-initialize icons just in case icons were inside translated elements
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// --- Setup Common Header Controls ---
function setupHeaderControls() {
    // Language dropdown listeners
    const langSelects = document.querySelectorAll('.lang-select');
    langSelects.forEach(select => {
        select.addEventListener('change', (e) => {
            setLanguage(e.target.value);
            // Dispatch custom event for pages that need to re-run custom logic upon translation change
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: e.target.value }));
        });
    });

    // Theme toggle button
    const themeToggle = document.getElementById('themeToggleBtn');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            toggleTheme();
        });
    }

    // Dynamic Admin Link adjustment (Asynchronous to support Firebase load state)
    const adminLink = document.getElementById('adminLinkBtn');
    if (adminLink) {
        dbLayer.onAuthStateChanged((user) => {
            const currentLang = localStorage.getItem('gp_lang') || 'hi';
            if (user) {
                adminLink.setAttribute('href', 'admin-dashboard.html');
                if (currentLang === 'en') {
                    adminLink.setAttribute('title', 'Admin Dashboard');
                } else {
                    adminLink.setAttribute('title', 'प्रशासक डैशबोर्ड');
                }
            } else {
                adminLink.setAttribute('href', 'admin-login.html');
                if (currentLang === 'en') {
                    adminLink.setAttribute('title', 'Admin Login');
                } else {
                    adminLink.setAttribute('title', 'प्रशासक लॉगिन');
                }
            }
        });
    }
}

// Helper to get selected language dictionary in page scripts
function getActiveLanguageDict() {
    const currentLang = localStorage.getItem('gp_lang') || 'hi';
    return TRANSLATIONS[currentLang];
}

// Load Gram Panchayat details dynamically into matching DOM elements
function loadPanchayatProfile() {
    const gpName = localStorage.getItem("gp_name") || "ग्राम पंचायत बोरुजवाडा";
    const gpAddress = localStorage.getItem("gp_address") || "बोरुजवाडा, छिंदवाड़ा, मध्य प्रदेश";
    const gpSarpanch = localStorage.getItem("gp_sarpanch") || "श्री गगन पिलौंद्रे";
    const gpPhone = localStorage.getItem("gp_phone") || "+91 9876543210";
    const gpEmail = localStorage.getItem("gp_email") || "info@borujwada.gp.gov.in";
    const gpMap = localStorage.getItem("gp_map") || "https://maps.google.com/?q=Borujwada";

    const elements = {
        homeGpName: el => el.textContent = gpName,
        homeGpAddress: el => el.textContent = gpAddress,
        homeGpSarpanch: el => el.textContent = gpSarpanch,
        homeGpPhone: el => {
            el.textContent = gpPhone;
            el.setAttribute("href", "tel:" + gpPhone);
        },
        homeGpEmail: el => {
            el.textContent = gpEmail;
            el.setAttribute("href", "mailto:" + gpEmail);
        },
        homeGpMap: el => el.setAttribute("href", gpMap)
    };

    for (const [id, action] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) {
            action(el);
        }
    }
}

// Load village notices from unified dbLayer and render on home page
async function loadVillageNotices() {
    const listEl = document.getElementById("noticeBoardList");
    if (!listEl) return;
    try {
        const notices = await dbLayer.getAllNotices();
        const activeNotices = notices.filter(n => n.active !== false);
        if (activeNotices.length === 0) {
            return; // keep default empty notice message
        }
        listEl.innerHTML = "";
        activeNotices.forEach(n => {
            const dateStr = new Date(n.createdAt).toLocaleDateString(localStorage.getItem('gp_lang') === 'en' ? 'en-US' : 'hi-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            let typeBadge = "";
            let color = "var(--primary)";
            if (n.type === "Water Supply") {
                typeBadge = "💧 जल आपूर्ति (Water)";
                color = "#3B82F6";
            } else if (n.type === "Gram Sabha") {
                typeBadge = "🏛️ ग्राम सभा (Sabha)";
                color = "#F59E0B";
            } else if (n.type === "Vaccination") {
                typeBadge = "💉 टीकाकरण (Vaccination)";
                color = "#10B981";
            } else if (n.type === "Electricity") {
                typeBadge = "⚡ बिजली बंद (Power)";
                color = "#EF4444";
            } else {
                typeBadge = "📢 सूचना (Notice)";
                color = "var(--primary)";
            }

            const item = document.createElement("div");
            item.className = "card";
            item.style.padding = "1.25rem";
            item.style.borderLeft = `5px solid ${color}`;
            item.style.marginBottom = "0.75rem";
            item.style.flexDirection = "column";
            item.style.alignItems = "flex-start";
            item.style.gap = "0.5rem";
            item.style.boxShadow = "var(--shadow-sm)";

            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <span style="background-color: rgba(0,0,0,0.05); color: ${color}; font-size: 0.8rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 50px;">${typeBadge}</span>
                    <span style="font-size: 0.8rem; color: var(--text-light); font-weight: 600;">${dateStr}</span>
                </div>
                <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 0.25rem 0;">${n.title}</h4>
                <p style="font-size: 0.92rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">${n.content}</p>
            `;
            listEl.appendChild(item);
        });
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (e) {
        console.error("Error loading notices:", e);
    }
}
