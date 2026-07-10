// Firebase Configuration and Unified Database Layer with LocalStorage Fallback

// REPLACE THIS CONFIGURATION WITH YOUR FIREBASE PROJECT CREDENTIALS WHEN DEPLOYING
const firebaseConfig = {
    apiKey: "AIzaSyD2ndIsVtTTb5UMrmee5PT4wlYbELfdNTs",
    authDomain: "gram-panchayat-project-1b1ac.firebaseapp.com",
    projectId: "gram-panchayat-project-1b1ac",
    messagingSenderId: "711673176568",
    appId: "1:711673176568:web:8a932d67e30988b1e5f60d"
};

// Check if Firebase configuration has been updated by user
const isFirebaseConfigured = () => {
    return firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
};

// Determine if we should run in Mock / LocalStorage Mode
let useMockMode = true;
let fbAuth = null;
let fbDb = null;

if (isFirebaseConfigured() && typeof firebase !== 'undefined') {
    try {
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        fbAuth = firebase.auth();
        fbDb = firebase.firestore();
        useMockMode = false;
        console.log("Smart Gram Panchayat: Firebase initialized successfully. Running in Cloud Database Mode.");
    } catch (error) {
        console.error("Smart Gram Panchayat: Firebase initialization failed. Falling back to LocalStorage Mode.", error);
        useMockMode = true;
    }
} else {
    console.warn("Smart Gram Panchayat: Firebase is not configured or SDK not loaded. Running in LocalStorage Demo Mode.");
    useMockMode = true;
}

// ============================================================================
// UNIFIED DATABASE LAYER (API)
// ============================================================================

const dbLayer = {
    // Mode information
    isMock: () => useMockMode,

    // ------------------------------------------------------------------------
    // COMPLAINTS
    // ------------------------------------------------------------------------
    addComplaint: async (complaint) => {
        if (useMockMode) {
            const complaints = JSON.parse(localStorage.getItem('gp_complaints') || '[]');
            complaints.push(complaint);
            localStorage.setItem('gp_complaints', JSON.stringify(complaints));
            return complaint.trackingId;
        } else {
            await fbDb.collection('complaints').doc(complaint.trackingId).set(complaint);
            return complaint.trackingId;
        }
    },

    getComplaint: async (trackingId) => {
        if (useMockMode) {
            const complaints = JSON.parse(localStorage.getItem('gp_complaints') || '[]');
            return complaints.find(c => c.trackingId === trackingId) || null;
        } else {
            const doc = await fbDb.collection('complaints').doc(trackingId).get();
            return doc.exists ? doc.data() : null;
        }
    },

    getAllComplaints: async () => {
        if (useMockMode) {
            return JSON.parse(localStorage.getItem('gp_complaints') || '[]');
        } else {
            const snapshot = await fbDb.collection('complaints').orderBy('createdAt', 'desc').get();
            const complaints = [];
            snapshot.forEach(doc => complaints.push(doc.data()));
            return complaints;
        }
    },

    updateComplaintStatus: async (trackingId, status) => {
        if (useMockMode) {
            const complaints = JSON.parse(localStorage.getItem('gp_complaints') || '[]');
            const index = complaints.findIndex(c => c.trackingId === trackingId);
            if (index !== -1) {
                complaints[index].status = status;
                localStorage.setItem('gp_complaints', JSON.stringify(complaints));
                return true;
            }
            return false;
        } else {
            await fbDb.collection('complaints').doc(trackingId).update({ status: status });
            return true;
        }
    },

    deleteComplaint: async (trackingId) => {
        if (useMockMode) {
            let complaints = JSON.parse(localStorage.getItem('gp_complaints') || '[]');
            const originalLength = complaints.length;
            complaints = complaints.filter(c => c.trackingId !== trackingId);
            localStorage.setItem('gp_complaints', JSON.stringify(complaints));
            return complaints.length < originalLength;
        } else {
            await fbDb.collection('complaints').doc(trackingId).delete();
            return true;
        }
    },

    // ------------------------------------------------------------------------
    // CERTIFICATES
    // ------------------------------------------------------------------------
    addCertificateRequest: async (request) => {
        const id = 'GP-CERT-' + Math.floor(100000 + Math.random() * 900000);
        const newRequest = { id, ...request, status: 'Pending', createdAt: new Date().toISOString() };
        
        if (useMockMode) {
            const requests = JSON.parse(localStorage.getItem('gp_certificates') || '[]');
            requests.push(newRequest);
            localStorage.setItem('gp_certificates', JSON.stringify(requests));
            return id;
        } else {
            await fbDb.collection('certificate_requests').doc(id).set(newRequest);
            return id;
        }
    },

    getAllCertificateRequests: async () => {
        if (useMockMode) {
            return JSON.parse(localStorage.getItem('gp_certificates') || '[]');
        } else {
            const snapshot = await fbDb.collection('certificate_requests').orderBy('createdAt', 'desc').get();
            const requests = [];
            snapshot.forEach(doc => requests.push(doc.data()));
            return requests;
        }
    },

    updateCertificateRequestStatus: async (id, status) => {
        if (useMockMode) {
            const requests = JSON.parse(localStorage.getItem('gp_certificates') || '[]');
            const index = requests.findIndex(r => r.id === id);
            if (index !== -1) {
                requests[index].status = status;
                localStorage.setItem('gp_certificates', JSON.stringify(requests));
                return true;
            }
            return false;
        } else {
            await fbDb.collection('certificate_requests').doc(id).update({ status: status });
            return true;
        }
    },

    deleteCertificateRequest: async (id) => {
        if (useMockMode) {
            let requests = JSON.parse(localStorage.getItem('gp_certificates') || '[]');
            const originalLength = requests.length;
            requests = requests.filter(r => r.id !== id);
            localStorage.setItem('gp_certificates', JSON.stringify(requests));
            return requests.length < originalLength;
        } else {
            await fbDb.collection('certificate_requests').doc(id).delete();
            return true;
        }
    },

    // ------------------------------------------------------------------------
    // ADMIN AUTHENTICATION
    // ------------------------------------------------------------------------
    registerAdmin: async (email, password) => {
        if (useMockMode) {
            const admins = JSON.parse(localStorage.getItem('gp_admins') || '[]');
            if (admins.some(a => a.email === email)) {
                throw new Error("Account with this email already exists.");
            }
            admins.push({ email, password });
            localStorage.setItem('gp_admins', JSON.stringify(admins));
            localStorage.setItem('gp_current_admin', email);
            return { email };
        } else {
            const userCredential = await fbAuth.createUserWithEmailAndPassword(email, password);
            return userCredential.user;
        }
    },

    loginAdmin: async (email, password) => {
        if (useMockMode) {
            const admins = JSON.parse(localStorage.getItem('gp_admins') || '[]');
            const foundAdmin = admins.find(a => a.email === email && a.password === password);
            if (!foundAdmin) {
                throw new Error("Invalid email or password.");
            }
            localStorage.setItem('gp_current_admin', email);
            return { email };
        } else {
            const userCredential = await fbAuth.signInWithEmailAndPassword(email, password);
            return userCredential.user;
        }
    },

    logoutAdmin: async () => {
        if (useMockMode) {
            localStorage.removeItem('gp_current_admin');
            return true;
        } else {
            await fbAuth.signOut();
            return true;
        }
    },

    getCurrentAdmin: () => {
        if (useMockMode) {
            return localStorage.getItem('gp_current_admin') || null;
        } else {
            return fbAuth ? fbAuth.currentUser : null;
        }
    },
    changeAdminPassword: async (newPassword) => {
        if (useMockMode) {
            const currentEmail = localStorage.getItem('gp_current_admin');
            if (!currentEmail) throw new Error("No admin logged in.");
            const admins = JSON.parse(localStorage.getItem('gp_admins') || '[]');
            const index = admins.findIndex(a => a.email === currentEmail);
            if (index !== -1) {
                admins[index].password = newPassword;
                localStorage.setItem('gp_admins', JSON.stringify(admins));
                return true;
            }
            throw new Error("Admin user not found.");
        } else {
            const user = fbAuth.currentUser;
            if (!user) throw new Error("No admin logged in.");
            await user.updatePassword(newPassword);
            return true;
        }
    },

    changeAdminEmail: async (newEmail) => {
        if (useMockMode) {
            const currentEmail = localStorage.getItem('gp_current_admin');
            if (!currentEmail) throw new Error("No admin logged in.");
            const admins = JSON.parse(localStorage.getItem('gp_admins') || '[]');
            const index = admins.findIndex(a => a.email === newEmail);
            if (index !== -1 && admins[index].email !== currentEmail) {
                throw new Error("Email already registered by another admin.");
            }
            const oldIndex = admins.findIndex(a => a.email === currentEmail);
            if (oldIndex !== -1) {
                admins[oldIndex].email = newEmail;
                localStorage.setItem('gp_admins', JSON.stringify(admins));
                localStorage.setItem('gp_current_admin', newEmail);
                return true;
            }
            throw new Error("Admin user not found.");
        } else {
            const user = fbAuth.currentUser;
            if (!user) throw new Error("No admin logged in.");
            await user.updateEmail(newEmail);
            return true;
        }
    },

    // A helper method to register changes to auth status
    onAuthStateChanged: (callback) => {
        if (useMockMode) {
            const current = localStorage.getItem('gp_current_admin');
            callback(current ? { email: current } : null);
        } else {
            fbAuth.onAuthStateChanged(callback);
        }
    },

    // ------------------------------------------------------------------------
    // VILLAGE NOTICE BOARD (NEW)
    // ------------------------------------------------------------------------
    addNotice: async (notice) => {
        const id = 'GP-NOTE-' + Math.floor(100 + Math.random() * 900);
        const newNotice = { id, ...notice, active: true, createdAt: new Date().toISOString() };
        if (useMockMode) {
            const list = JSON.parse(localStorage.getItem('gp_notices') || '[]');
            list.unshift(newNotice);
            localStorage.setItem('gp_notices', JSON.stringify(list));
            return id;
        } else {
            await fbDb.collection('notices').doc(id).set(newNotice);
            return id;
        }
    },

    getAllNotices: async () => {
        if (useMockMode) {
            return JSON.parse(localStorage.getItem('gp_notices') || '[]');
        } else {
            const snapshot = await fbDb.collection('notices').orderBy('createdAt', 'desc').get();
            const list = [];
            snapshot.forEach(doc => list.push(doc.data()));
            return list;
        }
    },

    deleteNotice: async (id) => {
        if (useMockMode) {
            let list = JSON.parse(localStorage.getItem('gp_notices') || '[]');
            list = list.filter(n => n.id !== id);
            localStorage.setItem('gp_notices', JSON.stringify(list));
            return true;
        } else {
            await fbDb.collection('notices').doc(id).delete();
            return true;
        }
    },

    // ------------------------------------------------------------------------
    // AUDIT ACTIVITY LOGS (NEW)
    // ------------------------------------------------------------------------
    addActivityLog: async (action, details) => {
        const adminEmail = localStorage.getItem('gp_current_admin') || (fbAuth && fbAuth.currentUser ? fbAuth.currentUser.email : "system@panchayat.gov.in");
        const log = {
            id: 'GP-LOG-' + Math.floor(100000 + Math.random() * 900000),
            action,
            details,
            adminEmail,
            createdAt: new Date().toISOString()
        };
        if (useMockMode) {
            const logs = JSON.parse(localStorage.getItem('gp_activity_logs') || '[]');
            logs.unshift(log);
            localStorage.setItem('gp_activity_logs', JSON.stringify(logs));
        } else {
            await fbDb.collection('activity_logs').doc(log.id).set(log);
        }
    },

    getActivityLogs: async () => {
        if (useMockMode) {
            return JSON.parse(localStorage.getItem('gp_activity_logs') || '[]');
        } else {
            const snapshot = await fbDb.collection('activity_logs').orderBy('createdAt', 'desc').get();
            const list = [];
            snapshot.forEach(doc => list.push(doc.data()));
            return list;
        }
    },



    // ------------------------------------------------------------------------
    // LIVE SMS DISPATCH GATEWAY (NEW)
    // ------------------------------------------------------------------------
    sendLiveSMS: async (mobileNumber, messageText) => {
        const provider = localStorage.getItem("gp_sms_provider") || "Disabled";
        const apiKey = localStorage.getItem("gp_sms_api_key") || "";
        const senderId = localStorage.getItem("gp_sms_sender_id") || "";

        console.log(`Panchayat Gateway Dispatch: [${provider}] sending to ${mobileNumber}: "${messageText}"`);

        // Check if gateway is active
        if (provider === "Fast2SMS" && apiKey) {
            try {
                const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=q&message=${encodeURIComponent(messageText)}&language=unicode&numbers=${mobileNumber}`;
                fetch(url).then(res => res.json()).then(resData => {
                    console.log("Fast2SMS Response:", resData);
                });
            } catch (e) {
                console.error("Fast2SMS fetch error:", e);
            }
        } else if (provider === "Twilio" && apiKey && senderId) {
            try {
                // Twilio requires Base64 Auth SID:Token
                const sid = senderId; // senderId holds SID in this layout
                const token = apiKey;
                const authHeader = 'Basic ' + btoa(sid + ':' + token);
                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
                
                // Form parameters
                const params = new URLSearchParams();
                params.append('To', mobileNumber.startsWith('+') ? mobileNumber : '+91' + mobileNumber);
                params.append('From', localStorage.getItem("gp_sms_sender_num") || "");
                params.append('Body', messageText);

                fetch(twilioUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: params
                }).then(res => res.json()).then(resData => {
                    console.log("Twilio Response:", resData);
                });
            } catch (e) {
                console.error("Twilio fetch error:", e);
            }
        }
    }
};

// Seed initial mock data if localStorage is empty
const seedMockData = () => {
    if (!localStorage.getItem('gp_complaints')) {
        const initialComplaints = [
            {
                trackingId: "GP-COMP-842719",
                name: "राकेश शर्मा (Rakesh Sharma)",
                mobile: "9876543210",
                category: "cat_water",
                priority: "High",
                latitude: "22.0574",
                longitude: "78.9382",
                description: "वार्ड नंबर ३ में पिछले चार दिनों से पीने के पानी की आपूर्ति नहीं हो रही है। कृपया तत्काल पानी के टैंकर का प्रबंध करें।",
                status: "Pending",
                createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            },
            {
                trackingId: "GP-COMP-319405",
                name: "सुनीता पाटिल (Sunita Patil)",
                mobile: "9911223344",
                category: "cat_light",
                priority: "Normal",
                latitude: "",
                longitude: "",
                description: "पंचायत भवन के पास का स्ट्रीट लाइट पोल पिछले एक हफ्ते से बंद है, जिससे रात में काफी अंधेरा रहता है।",
                status: "In Progress",
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                trackingId: "GP-COMP-720184",
                name: "विजय जाधव (Vijay Jadhav)",
                mobile: "9822334455",
                category: "cat_road",
                priority: "Emergency",
                latitude: "22.0612",
                longitude: "78.9395",
                description: "गांव के मुख्य रास्ते पर बड़े-बड़े गड्ढे हो गए हैं, जिससे दोपहिया वाहनों का चलना बहुत मुश्किल हो गया है। दुर्घटना की संभावना है।",
                status: "Completed",
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        localStorage.setItem('gp_complaints', JSON.stringify(initialComplaints));
    }

    if (!localStorage.getItem('gp_certificates')) {
        const initialCertificates = [
            {
                id: "GP-CERT-418059",
                name: "अमित कुमार (Amit Kumar)",
                mobile: "8899001122",
                certificateType: "cert_income",
                reason: "कॉलेज स्कॉलरशिप आवेदन के लिए आवश्यक है।",
                status: "Pending",
                createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
            },
            {
                id: "GP-CERT-950314",
                name: "राजेश गायकवाड़ (Rajesh Gaikwad)",
                mobile: "7766554433",
                certificateType: "cert_residence",
                reason: "नया गैस कनेक्शन लेने के लिए निवास प्रमाण पत्र की आवश्यकता है।",
                status: "Approved",
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        localStorage.setItem('gp_certificates', JSON.stringify(initialCertificates));
    }

    // Seed Notices
    if (!localStorage.getItem('gp_notices')) {
        const initialNotices = [
            {
                id: "GP-NOTE-101",
                title: "💧 पेयजल आपूर्ति बंद सूचना (Water Supply Update)",
                content: "पाइपलाइन मरम्मत कार्य के कारण वार्ड २ और ३ में दिनांक १० जुलाई को सुबह ९ बजे से शाम ५ बजे तक जलापूर्ति बाधित रहेगी। कृपया पानी सुरक्षित रखें।",
                type: "Water Supply",
                createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
                active: true
            },
            {
                id: "GP-NOTE-102",
                title: "🏛️ विशेष ग्राम सभा बैठक (Special Gram Sabha)",
                content: "पंचायत भवन परिसर में आगामी रविवार दोपहर २ बजे विकास योजनाओं और बजट आवंटन पर चर्चा के लिए विशेष ग्राम सभा बुलाई गई है। सभी नागरिकों की उपस्थिति अनिवार्य है।",
                type: "Gram Sabha",
                createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                active: true
            },
            {
                id: "GP-NOTE-103",
                title: "💉 निःशुल्क आरोग्य टीकाकरण शिविर (Vaccination Camp)",
                content: "सामुदायिक स्वास्थ्य केंद्र में १० जुलाई को सुबह १० बजे से शाम ४ बजे तक निःशुल्क स्वास्थ्य एवं टीकाकरण शिविर का आयोजन किया जा रहा है।",
                type: "Vaccination",
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                active: true
            }
        ];
        localStorage.setItem('gp_notices', JSON.stringify(initialNotices));
    }

    // Seed Activity Logs
    if (!localStorage.getItem('gp_activity_logs')) {
        const initialLogs = [
            {
                id: "GP-LOG-1",
                action: "Admin Login",
                details: "प्रशासक admin@panchayat.gov.in ने लॉग इन किया।",
                adminEmail: "admin@panchayat.gov.in",
                createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
            },
            {
                id: "GP-LOG-2",
                action: "Certificate Approved",
                details: "प्रमाणपत्र अनुरोध GP-CERT-950314 को स्वीकृत किया गया।",
                adminEmail: "admin@panchayat.gov.in",
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        localStorage.setItem('gp_activity_logs', JSON.stringify(initialLogs));
    }

    // Default admin account for demo
    if (!localStorage.getItem('gp_admins')) {
        localStorage.setItem('gp_admins', JSON.stringify([{ email: "admin@panchayat.gov.in", password: "admin" }]));
    }
};

// Execute seeding
seedMockData();
