(function () {
    'use strict';

    const ACCOUNT_KEY = 'currentUser';
    const USERS_KEY = 'localLensUsers';
    const DEFAULT_COLOR = '#176d6a';
    let lastAppliedSignature = '';

    document.addEventListener('DOMContentLoaded', initializeAccountCustomization);

    function initializeAccountCustomization() {
        const dashboard = document.getElementById('signed-in-view');
        if (!dashboard) return;

        addCustomizationCard();
        applyCustomizationIfChanged(true);
        window.setInterval(() => applyCustomizationIfChanged(false), 1000);
    }

    function addCustomizationCard() {
        if (document.getElementById('customize-form')) return;

        const profileCard = document.querySelector('.profile-edit-card');
        if (!profileCard) return;

        const card = document.createElement('section');
        card.className = 'account-card customize-card';
        card.innerHTML = `
            <div class="section-title-row">
                <span class="status-icon"><i class="fas fa-palette"></i></span>
                <div>
                    <h2>Customize account</h2>
                    <p>Personalize how your account appears on this browser.</p>
                </div>
            </div>
            <form id="customize-form" class="customize-form">
                <div class="form-grid account-form-grid">
                    <div class="form-group">
                        <label for="avatar-color">Avatar color</label>
                        <div class="color-control">
                            <input type="color" id="avatar-color" value="${DEFAULT_COLOR}">
                            <span id="avatar-color-label">Teal</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="favorite-category">Favorite category</label>
                        <select id="favorite-category">
                            <option value="">Not listed</option>
                            <option value="Food">Food</option>
                            <option value="Retail">Retail</option>
                            <option value="Services">Services</option>
                            <option value="Attractions">Attractions</option>
                            <option value="Hot Spots">Hot Spots</option>
                        </select>
                    </div>
                    <div class="form-group full-width">
                        <label for="profile-bio">Short bio</label>
                        <textarea id="profile-bio" maxlength="160" rows="3" placeholder="Tell your group what kinds of places you like reviewing."></textarea>
                        <p class="input-help"><span id="profile-bio-count">0</span>/160</p>
                    </div>
                    <label class="account-check full-width">
                        <input type="checkbox" id="show-email">
                        <span>Show my email on my account card</span>
                    </label>
                </div>
                <button class="account-secondary-btn" type="submit"><i class="fas fa-wand-magic-sparkles"></i> Save customization</button>
            </form>
        `;

        profileCard.insertAdjacentElement('afterend', card);
        fillCustomizationForm();

        const bioInput = document.getElementById('profile-bio');
        bioInput?.addEventListener('input', updateBioCount);
        document.getElementById('avatar-color')?.addEventListener('input', updateColorLabel);
        document.getElementById('customize-form')?.addEventListener('submit', handleCustomizationSave);
    }

    function fillCustomizationForm() {
        const user = findStoredCurrentUser();
        if (!user) return;

        document.getElementById('avatar-color').value = user.avatarColor || DEFAULT_COLOR;
        document.getElementById('favorite-category').value = user.favoriteCategory || '';
        document.getElementById('profile-bio').value = user.bio || '';
        document.getElementById('show-email').checked = Boolean(user.showEmail);
        updateBioCount();
        updateColorLabel();
    }

    function handleCustomizationSave(event) {
        event.preventDefault();
        const currentUser = findStoredCurrentUser();
        if (!currentUser) return;

        const avatarColor = document.getElementById('avatar-color').value || DEFAULT_COLOR;
        const favoriteCategory = document.getElementById('favorite-category').value;
        const bio = document.getElementById('profile-bio').value.trim();
        const showEmail = document.getElementById('show-email').checked;

        const users = getUsers().map((user) => {
            if (user.id !== currentUser.id) return user;
            return { ...user, avatarColor, favoriteCategory, bio, showEmail };
        });

        saveUsers(users);
        const updatedUser = users.find((user) => user.id === currentUser.id);
        setCurrentUser(publicUser(updatedUser));
        applyCustomization(updatedUser);
        lastAppliedSignature = getUserSignature(updatedUser);
        showCustomizationToast('Account customization saved.');
    }

    function applyCustomizationIfChanged(force) {
        const user = findStoredCurrentUser();
        const signature = user ? getUserSignature(user) : '';
        if (!force && signature === lastAppliedSignature) return;
        lastAppliedSignature = signature;
        if (user) {
            fillCustomizationForm();
            applyCustomization(user);
        }
    }

    function applyCustomization(user = findStoredCurrentUser()) {
        if (!user) return;

        const avatar = document.getElementById('profile-avatar');
        if (avatar) avatar.style.background = user.avatarColor || DEFAULT_COLOR;

        const email = document.getElementById('profile-email');
        if (email) email.hidden = !user.showEmail;

        let meta = document.getElementById('profile-custom-meta');
        if (!meta) {
            meta = document.createElement('div');
            meta.id = 'profile-custom-meta';
            meta.className = 'profile-custom-meta';
            document.getElementById('profile-username')?.insertAdjacentElement('afterend', meta);
        }

        const favorite = user.favoriteCategory ? `<span><i class="fas fa-heart"></i> ${escapeHtml(user.favoriteCategory)}</span>` : '';
        const bio = user.bio ? `<p>${escapeHtml(user.bio)}</p>` : '';
        const nextHtml = `${favorite}${bio}`;
        if (meta.innerHTML !== nextHtml) meta.innerHTML = nextHtml;
    }

    function getUserSignature(user) {
        return [user.id, user.email, user.avatarColor, user.favoriteCategory, user.bio, user.showEmail].join('|');
    }

    function updateBioCount() {
        const bio = document.getElementById('profile-bio');
        const count = document.getElementById('profile-bio-count');
        if (bio && count) count.textContent = String(bio.value.length);
    }

    function updateColorLabel() {
        const color = document.getElementById('avatar-color')?.value || DEFAULT_COLOR;
        const label = document.getElementById('avatar-color-label');
        if (label) label.textContent = color.toUpperCase();
    }

    function getUsers() {
        return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
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

    function findStoredCurrentUser() {
        const currentUser = getCurrentUser();
        if (!currentUser) return null;
        return getUsers().find((user) => user.id === currentUser.id || user.email === currentUser.email) || null;
    }

    function publicUser(user) {
        return {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            verified: Boolean(user.verified),
            avatarColor: user.avatarColor || DEFAULT_COLOR,
            favoriteCategory: user.favoriteCategory || '',
            bio: user.bio || '',
            showEmail: Boolean(user.showEmail)
        };
    }

    function showCustomizationToast(message) {
        const toast = document.createElement('div');
        toast.className = 'account-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function escapeHtml(value) {
        const element = document.createElement('div');
        element.textContent = String(value || '');
        return element.innerHTML;
    }
}());
