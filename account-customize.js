(function () {
    'use strict';

    const ACCOUNT_KEY = 'currentUser';
    const USERS_KEY = 'localLensUsers';
    const DEFAULT_COLOR = '#176d6a';
    const COLOR_OPTIONS = ['#176d6a', '#225c68', '#8a5a12', '#7c3aed', '#b04435'];

    document.addEventListener('DOMContentLoaded', initializeAccountCustomization);

    function initializeAccountCustomization() {
        addCustomizationCard();
        bindAccountRefreshEvents();
        syncCustomizationView();
    }

    function addCustomizationCard() {
        if (document.getElementById('customize-form')) return;

        const profileCard = document.querySelector('.profile-edit-card');
        if (!profileCard) return;

        const card = document.createElement('section');
        card.className = 'account-card customize-card';
        card.innerHTML = `
            <div class="section-title-row customize-title-row">
                <span class="status-icon"><i class="fas fa-palette"></i></span>
                <div>
                    <h2>Customize account</h2>
                    <p>Choose a profile color, a short bio, and what details people can see.</p>
                </div>
            </div>
            <form id="customize-form" class="customize-form">
                <div class="customize-grid">
                    <div class="form-group color-field">
                        <label for="avatar-color">Avatar color</label>
                        <div class="color-control">
                            <input type="color" id="avatar-color" value="${DEFAULT_COLOR}" aria-label="Avatar color">
                            <div class="color-swatches" aria-label="Preset avatar colors">
                                ${COLOR_OPTIONS.map((color) => `<button type="button" class="color-swatch" data-color="${color}" style="--swatch-color: ${color};" aria-label="Use color ${color}"></button>`).join('')}
                            </div>
                            <span id="avatar-color-label">${DEFAULT_COLOR.toUpperCase()}</span>
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
                <button class="account-secondary-btn" type="submit"><i class="fas fa-save"></i> Save customization</button>
            </form>
        `;

        profileCard.insertAdjacentElement('afterend', card);
        bindCustomizationControls();
    }

    function bindCustomizationControls() {
        document.getElementById('customize-form')?.addEventListener('submit', handleCustomizationSave);
        document.getElementById('profile-bio')?.addEventListener('input', updateBioCount);
        document.getElementById('avatar-color')?.addEventListener('input', () => {
            updateColorLabel();
            updateSelectedSwatch();
        });

        document.querySelectorAll('.color-swatch').forEach((button) => {
            button.addEventListener('click', () => {
                const colorInput = document.getElementById('avatar-color');
                colorInput.value = button.dataset.color || DEFAULT_COLOR;
                updateColorLabel();
                updateSelectedSwatch();
            });
        });
    }

    function bindAccountRefreshEvents() {
        ['login-form', 'signup-form', 'verification-form', 'profile-form'].forEach((id) => {
            document.getElementById(id)?.addEventListener('submit', () => scheduleSync(), true);
        });

        document.getElementById('logout-button')?.addEventListener('click', () => scheduleSync(), true);
        document.getElementById('resend-code-button')?.addEventListener('click', () => scheduleSync(), true);
        window.addEventListener('storage', (event) => {
            if (event.key === ACCOUNT_KEY || event.key === USERS_KEY) syncCustomizationView();
        });
    }

    function scheduleSync() {
        window.setTimeout(syncCustomizationView, 250);
    }

    function syncCustomizationView() {
        const user = findStoredCurrentUser();
        if (!user) {
            clearCustomizationPreview();
            return;
        }

        fillCustomizationForm(user);
        applyCustomization(user);
    }

    function fillCustomizationForm(user) {
        const colorInput = document.getElementById('avatar-color');
        const categoryInput = document.getElementById('favorite-category');
        const bioInput = document.getElementById('profile-bio');
        const showEmailInput = document.getElementById('show-email');

        if (colorInput) colorInput.value = user.avatarColor || DEFAULT_COLOR;
        if (categoryInput) categoryInput.value = user.favoriteCategory || '';
        if (bioInput) bioInput.value = user.bio || '';
        if (showEmailInput) showEmailInput.checked = Boolean(user.showEmail);

        updateBioCount();
        updateColorLabel();
        updateSelectedSwatch();
    }

    function handleCustomizationSave(event) {
        event.preventDefault();
        const currentUser = findStoredCurrentUser();
        if (!currentUser) return;

        const avatarColor = document.getElementById('avatar-color')?.value || DEFAULT_COLOR;
        const favoriteCategory = document.getElementById('favorite-category')?.value || '';
        const bio = document.getElementById('profile-bio')?.value.trim() || '';
        const showEmail = Boolean(document.getElementById('show-email')?.checked);

        const users = getUsers().map((user) => {
            if (user.id !== currentUser.id) return user;
            return { ...user, avatarColor, favoriteCategory, bio, showEmail };
        });

        saveUsers(users);
        const updatedUser = users.find((user) => user.id === currentUser.id);
        setCurrentUser(publicUser(updatedUser));
        applyCustomization(updatedUser);
        showCustomizationToast('Account customization saved.');
    }

    function applyCustomization(user) {
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
        meta.innerHTML = `${favorite}${bio}` || '<p class="profile-custom-empty">No custom profile details yet.</p>';
    }

    function clearCustomizationPreview() {
        const meta = document.getElementById('profile-custom-meta');
        if (meta) meta.remove();
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

    function updateSelectedSwatch() {
        const color = (document.getElementById('avatar-color')?.value || DEFAULT_COLOR).toLowerCase();
        document.querySelectorAll('.color-swatch').forEach((button) => {
            button.classList.toggle('active', button.dataset.color?.toLowerCase() === color);
        });
    }

    function getUsers() {
        try {
            return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null');
        } catch {
            return null;
        }
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
