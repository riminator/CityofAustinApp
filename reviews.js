(function () {
    'use strict';

    const REVIEWS_KEY = 'localLensBusinessReviews';
    const ACCOUNT_KEY = 'currentUser';

    document.addEventListener('DOMContentLoaded', initializeReviews);

    function initializeReviews() {
        const list = document.getElementById('business-list');
        if (!list) return;

        enhanceBusinessCards();

        const observer = new MutationObserver(() => enhanceBusinessCards());
        observer.observe(list, { childList: true, subtree: false });
    }

    function enhanceBusinessCards() {
        document.querySelectorAll('.sheet-business-item:not([data-reviews-ready])').forEach((card) => {
            card.dataset.reviewsReady = 'true';
            const business = getBusinessFromCard(card);
            const reviewPanel = buildReviewPanel(business);
            card.appendChild(reviewPanel);
        });
    }

    function getBusinessFromCard(card) {
        const name = card.querySelector('h3')?.textContent.trim() || 'Untitled location';
        const category = card.querySelector('.sheet-category')?.textContent.trim() || '';
        const source = card.querySelector('.sheet-source-badge')?.textContent.trim() || '';
        return {
            key: slugify(`${source}-${name}-${category}`),
            name,
            category,
            source
        };
    }

    function buildReviewPanel(business) {
        const panel = document.createElement('section');
        panel.className = 'review-panel';
        panel.addEventListener('click', (event) => event.stopPropagation());
        renderReviewPanel(panel, business);
        return panel;
    }

    function renderReviewPanel(panel, business) {
        const reviews = getReviewsForBusiness(business.key);
        const average = getAverage(reviews);
        const currentUser = getCurrentUser();
        const canReview = Boolean(currentUser?.verified);

        panel.innerHTML = `
            <div class="review-summary">
                <div>
                    <strong>Community reviews</strong>
                    <span>${reviews.length ? `${average.toFixed(1)}/5 from ${reviews.length} review${reviews.length === 1 ? '' : 's'}` : 'No reviews yet'}</span>
                </div>
                <button class="review-toggle" type="button">${canReview ? 'Leave review' : 'Sign in to review'}</button>
            </div>
            <form class="review-form" hidden>
                ${canReview ? reviewFields() : reviewLockedMessage(currentUser)}
            </form>
            <div class="review-list">
                ${reviews.length ? reviews.slice(-3).reverse().map(renderReview).join('') : '<p class="review-empty">Be the first verified visitor to review this place.</p>'}
            </div>
        `;

        panel.querySelector('.review-toggle')?.addEventListener('click', () => {
            const form = panel.querySelector('.review-form');
            form.hidden = !form.hidden;
        });

        panel.querySelector('.review-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            submitReview(panel, business);
        });
    }

    function reviewFields() {
        return `
            <label>
                Rating
                <select class="review-rating" required>
                    <option value="5">5 - Loved it</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Okay</option>
                    <option value="2">2 - Needs work</option>
                    <option value="1">1 - Not recommended</option>
                </select>
            </label>
            <label>
                Review
                <textarea class="review-comment" maxlength="220" rows="3" placeholder="What should other visitors know?" required></textarea>
            </label>
            <button class="review-submit" type="submit"><i class="fas fa-star"></i> Post review</button>
        `;
    }

    function reviewLockedMessage(user) {
        if (!user) {
            return '<p class="review-locked">Create or log into an account before leaving reviews.</p><a class="review-account-link" href="account.html">Go to account</a>';
        }

        return '<p class="review-locked">Verify your email before leaving reviews.</p><a class="review-account-link" href="account.html">Verify account</a>';
    }

    function submitReview(panel, business) {
        const user = getCurrentUser();
        if (!user?.verified) return;

        const rating = Number(panel.querySelector('.review-rating')?.value || 0);
        const comment = panel.querySelector('.review-comment')?.value.trim() || '';
        if (!rating || !comment) return;

        const reviews = getAllReviews();
        const withoutExistingUserReview = reviews.filter((review) => !(review.businessKey === business.key && review.userEmail === user.email));
        withoutExistingUserReview.push({
            id: Date.now(),
            businessKey: business.key,
            businessName: business.name,
            rating,
            comment,
            userName: user.name || user.username || 'LocalLens user',
            username: user.username || '',
            userEmail: user.email,
            createdAt: new Date().toISOString()
        });

        localStorage.setItem(REVIEWS_KEY, JSON.stringify(withoutExistingUserReview));
        renderReviewPanel(panel, business);
    }

    function renderReview(review) {
        const date = new Date(review.createdAt).toLocaleDateString();
        return `
            <article class="review-item">
                <div class="review-item-header">
                    <strong>${escapeHtml(review.userName)}</strong>
                    <span>&#9733; ${Number(review.rating).toFixed(1)}/5</span>
                </div>
                <p>${escapeHtml(review.comment)}</p>
                <small>${escapeHtml(review.username ? `@${review.username}` : 'Verified reviewer')} · ${date}</small>
            </article>
        `;
    }

    function getAllReviews() {
        return JSON.parse(localStorage.getItem(REVIEWS_KEY) || '[]');
    }

    function getReviewsForBusiness(key) {
        return getAllReviews().filter((review) => review.businessKey === key);
    }

    function getAverage(reviews) {
        if (!reviews.length) return 0;
        return reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;
    }

    function getCurrentUser() {
        return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null');
    }

    function slugify(value) {
        return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    function escapeHtml(value) {
        const element = document.createElement('div');
        element.textContent = String(value || '');
        return element.innerHTML;
    }
}());
