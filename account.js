const ACCOUNT_KEY = 'currentUser';
const USERS_KEY = 'localLensUsers';
const SUBMISSIONS_KEY = 'submittedBusinesses';
const COOLDOWN_MS = 2 * 60 * 60 * 1000;
const VERIFICATION_EMAIL_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwtr1WRUwSgo19zQtZjnCzTUpv9Atpcu6vNP5-_BdWrv5J8-0Bm89j2aivF3S3jV0vT/exec';

const signedOutView = document.getElementById('signed-out-view');
const signedInView = document.getElementById('signed-in-view');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileUsername = document.getElementById('profile-username');
const profileAvatar = document.getElementById('profile-avatar');
const verificationLabel = document.getElementById('verification-label');
const verificationCard = document.getElementById('verification-card');
const verificationMessage = document.getElementById('verification-message');
const profileAddBusiness = document.getElementById('profile-add-business');
const cooldownStatus = document.getElementById('cooldown-status');
const submissionList = document.getElementById('submission-list');

function normalizeEmail(email) {
    return email.trim().toLowerCase();
}

function normalizeUsername(username) {
    return username.trim().toLowerCase();
}

function getUsers() {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return users.map((user) => {
        const username = user.username || normalizeUsername((user.name || user.email || 'user').replace(/\s+/g, '_'));
        return {
            ...user,
            username,
            email: normalizeEmail(user.email || ''),
            verified: Boolean(user.verified)
        };
    });
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null');
}

function setCurrentUser(user) {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(user));
}

function clearCurrentUser() {
    localStorage.removeItem(ACCOUNT_KEY);
}

function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        verified: Boolean(user.verified)
    };
}

function getCooldownKey(user) {
    return `lastBusinessSubmissionAt:${(user?.email || 'guest').toLowerCase()}`;
}

function getRemainingCooldown(user) {
    const lastSubmission = Number(localStorage.getItem(getCooldownKey(user)) || 0);
    return Math.max(0, COOLDOWN_MS - (Date.now() - lastSubmission));
}

function formatDuration(ms) {
    const totalMinutes = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    if (minutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
    return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function generateVerificationCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `account-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3400);
}

function switchTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    document.querySelectorAll('.auth-form').forEach((form) => {
        form.classList.toggle('active', form.id === `${tabName}-form`);
    });
}

function findStoredCurrentUser() {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    return getUsers().find((user) => user.id === currentUser.id || user.email === currentUser.email) || null;
}

function refreshCurrentUserFromStorage() {
    const storedUser = findStoredCurrentUser();
    if (!storedUser) {
        clearCurrentUser();
        return null;
    }
    setCurrentUser(publicUser(storedUser));
    return storedUser;
}

function updateAccountView() {
    const user = refreshCurrentUserFromStorage();

    if (!user) {
        signedOutView.hidden = false;
        signedInView.hidden = true;
        return;
    }

    signedOutView.hidden = true;
    signedInView.hidden = false;
    profileName.textContent = user.name;
    profileEmail.textContent = user.email;
    profileUsername.textContent = `@${user.username}`;
    profileAvatar.textContent = (user.name || user.username || 'L').trim().charAt(0).toUpperCase();
    verificationLabel.textContent = user.verified ? 'Verified account' : 'Verification needed';
    verificationCard.hidden = user.verified;
    profileAddBusiness.classList.toggle('disabled-link', !user.verified);
    profileAddBusiness.setAttribute('aria-disabled', String(!user.verified));
    document.getElementById('edit-name').value = user.name;
    document.getElementById('edit-username').value = user.username;
    document.getElementById('edit-email').value = user.email;
    updateCooldownStatus(user);
    renderSubmissions(user);
}

function updateCooldownStatus(user) {
    if (!user.verified) {
        cooldownStatus.textContent = 'Verify your email before submitting businesses.';
        return;
    }

    const remaining = getRemainingCooldown(user);
    if (remaining > 0) {
        cooldownStatus.textContent = `You can submit another business in ${formatDuration(remaining)}.`;
    } else {
        cooldownStatus.textContent = 'You can submit a business now.';
    }
}

function renderSubmissions(user) {
    const submissions = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || '[]')
        .filter((submission) => !submission.submittedBy || submission.submittedBy === user.email)
        .slice(-6)
        .reverse();

    if (!submissions.length) {
        submissionList.innerHTML = '<div class="empty-state">No submissions from this browser yet.</div>';
        return;
    }

    submissionList.innerHTML = submissions.map((submission) => {
        const date = submission.dateAdded ? new Date(submission.dateAdded).toLocaleString() : 'Recently';
        return `
            <div class="submission-row">
                <div>
                    <strong>${submission.name || 'Untitled place'}</strong><br>
                    <span>${submission.category || 'Category not listed'} • ${date}</span>
                </div>
                <span>${submission.rating || submission.overallRating || 'Pending'}/5</span>
            </div>
        `;
    }).join('');
}

async function sendVerificationEmail(user) {
    if (!VERIFICATION_EMAIL_ENDPOINT) {
        verificationMessage.textContent = `Email sending is not connected yet. Demo verification code: ${user.verificationCode}`;
        return false;
    }

    const payload = new URLSearchParams({
        email: user.email,
        name: user.name,
        username: user.username,
        code: user.verificationCode
    });

    await fetch(VERIFICATION_EMAIL_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        body: payload
    });

    verificationMessage.textContent = `A verification code was sent to ${user.email}.`;
    return true;
}

async function createOrResendVerification(userId) {
    const users = getUsers();
    const userIndex = users.findIndex((user) => user.id === userId);
    if (userIndex === -1) return;

    users[userIndex] = {
        ...users[userIndex],
        verified: false,
        verificationCode: generateVerificationCode(),
        verificationSentAt: new Date().toISOString()
    };
    saveUsers(users);
    setCurrentUser(publicUser(users[userIndex]));

    try {
        const emailSent = await sendVerificationEmail(users[userIndex]);
        showToast(emailSent ? 'Verification email sent.' : 'Demo verification code is shown on the page.', emailSent ? 'success' : 'info');
    } catch (error) {
        verificationMessage.textContent = 'Could not send verification email. Try resending in a moment.';
        showToast('Verification email could not be sent.', 'error');
    }

    updateAccountView();
}

async function handleSignup(event) {
    event.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const username = normalizeUsername(document.getElementById('signup-username').value);
    const email = normalizeEmail(document.getElementById('signup-email').value);
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }

    const users = getUsers();
    if (users.some((user) => user.email === email)) {
        showToast('That email already has an account. Log in instead.', 'error');
        switchTab('login');
        return;
    }

    if (users.some((user) => normalizeUsername(user.username) === username)) {
        showToast('That username is already taken.', 'error');
        return;
    }

    const user = {
        id: Date.now(),
        name,
        username,
        email,
        password,
        verified: false,
        verificationCode: generateVerificationCode(),
        verificationSentAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);
    setCurrentUser(publicUser(user));
    document.getElementById('signup-form').reset();
    updateAccountView();
    await sendVerificationEmail(user);
    showToast('Account created. Verify your email before submitting businesses.', 'info');
}

function handleLogin(event) {
    event.preventDefault();
    const email = normalizeEmail(document.getElementById('login-email').value);
    const password = document.getElementById('login-password').value;
    const user = getUsers().find((candidate) => candidate.email === email && candidate.password === password);

    if (!user) {
        showToast('Email or password was not found.', 'error');
        return;
    }

    setCurrentUser(publicUser(user));
    showToast(user.verified ? 'Logged in successfully.' : 'Logged in. Please verify your email.');
    updateAccountView();
}

function handleVerification(event) {
    event.preventDefault();
    const currentUser = findStoredCurrentUser();
    if (!currentUser) return;

    const enteredCode = document.getElementById('verification-code').value.trim();
    if (enteredCode !== currentUser.verificationCode) {
        showToast('That verification code does not match.', 'error');
        return;
    }

    const users = getUsers().map((user) => {
        if (user.id !== currentUser.id) return user;
        const { verificationCode, ...verifiedUser } = user;
        return { ...verifiedUser, verified: true, verifiedAt: new Date().toISOString() };
    });

    saveUsers(users);
    const verifiedUser = users.find((user) => user.id === currentUser.id);
    setCurrentUser(publicUser(verifiedUser));
    document.getElementById('verification-code').value = '';
    showToast('Email verified. You can now submit businesses.');
    updateAccountView();
}

function handleProfileSave(event) {
    event.preventDefault();
    const currentUser = findStoredCurrentUser();
    if (!currentUser) return;

    const nextName = document.getElementById('edit-name').value.trim();
    const nextUsername = normalizeUsername(document.getElementById('edit-username').value);
    const nextEmail = normalizeEmail(document.getElementById('edit-email').value);
    const users = getUsers();

    if (users.some((user) => user.id !== currentUser.id && normalizeUsername(user.username) === nextUsername)) {
        showToast('That username is already taken.', 'error');
        return;
    }

    if (users.some((user) => user.id !== currentUser.id && user.email === nextEmail)) {
        showToast('That email already has an account.', 'error');
        return;
    }

    const emailChanged = nextEmail !== currentUser.email;
    const updatedUsers = users.map((user) => {
        if (user.id !== currentUser.id) return user;
        return {
            ...user,
            name: nextName,
            username: nextUsername,
            email: nextEmail,
            verified: emailChanged ? false : user.verified,
            verificationCode: emailChanged ? generateVerificationCode() : user.verificationCode,
            verificationSentAt: emailChanged ? new Date().toISOString() : user.verificationSentAt
        };
    });

    saveUsers(updatedUsers);
    const updatedUser = updatedUsers.find((user) => user.id === currentUser.id);
    setCurrentUser(publicUser(updatedUser));
    showToast(emailChanged ? 'Profile saved. Verify your new email.' : 'Profile saved.');
    updateAccountView();
    if (emailChanged) sendVerificationEmail(updatedUser);
}

function initializeAccountPage() {
    document.querySelectorAll('.auth-tab').forEach((tab) => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('verification-form').addEventListener('submit', handleVerification);
    document.getElementById('profile-form').addEventListener('submit', handleProfileSave);
    document.getElementById('resend-code-button').addEventListener('click', async () => {
        const user = findStoredCurrentUser();
        if (user) await createOrResendVerification(user.id);
    });
    document.getElementById('logout-button').addEventListener('click', () => {
        clearCurrentUser();
        showToast('Logged out.');
        updateAccountView();
    });
    profileAddBusiness.addEventListener('click', (event) => {
        const user = findStoredCurrentUser();
        if (user && !user.verified) {
            event.preventDefault();
            showToast('Verify your email before adding a business.', 'error');
        }
    });

    updateAccountView();
    setInterval(() => {
        const user = findStoredCurrentUser();
        if (user) updateCooldownStatus(user);
    }, 30000);
}

initializeAccountPage();
