(function () {
    'use strict';

    let savedScrollY = null;

    function isMapInteraction(event) {
        return Boolean(event.target && event.target.closest && event.target.closest('#map'));
    }

    function rememberScroll(event) {
        if (!isMapInteraction(event)) return;
        savedScrollY = window.scrollY;
    }

    function restoreScrollIfNeeded(event) {
        if (!isMapInteraction(event) || savedScrollY === null) return;

        window.setTimeout(() => {
            if (savedScrollY === null) return;
            const movedDistance = Math.abs(window.scrollY - savedScrollY);
            if (movedDistance > 24) {
                window.scrollTo({ top: savedScrollY, left: window.scrollX, behavior: 'auto' });
            }
            savedScrollY = null;
        }, 0);
    }

    document.addEventListener('pointerdown', rememberScroll, true);
    document.addEventListener('mousedown', rememberScroll, true);
    document.addEventListener('touchstart', rememberScroll, true);
    document.addEventListener('click', restoreScrollIfNeeded, true);
    document.addEventListener('focusin', restoreScrollIfNeeded, true);
}());
