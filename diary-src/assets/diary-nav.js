/* HD2's Diary — mobile navigation drawer (right unfolding sidebar) */
(function () {
    'use strict';

    var menuButton = document.querySelector('.menu-button');
    var mobileDrawer = document.getElementById('mobile-drawer');
    var drawerBackdrop = document.querySelector('.drawer-backdrop');
    var drawerClose = document.querySelector('.drawer-close');
    if (!menuButton || !mobileDrawer || !drawerBackdrop || !drawerClose) return;

    function openDrawer() {
        drawerBackdrop.hidden = false;
        window.requestAnimationFrame(function () {
            drawerBackdrop.classList.add('is-visible');
            mobileDrawer.classList.add('is-open');
        });
        mobileDrawer.setAttribute('aria-hidden', 'false');
        menuButton.setAttribute('aria-expanded', 'true');
        document.body.classList.add('drawer-open');
        drawerClose.focus();
    }

    function closeDrawer(restoreFocus) {
        if (!mobileDrawer.classList.contains('is-open')) return;
        mobileDrawer.classList.remove('is-open');
        drawerBackdrop.classList.remove('is-visible');
        mobileDrawer.setAttribute('aria-hidden', 'true');
        menuButton.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('drawer-open');
        window.setTimeout(function () {
            if (!mobileDrawer.classList.contains('is-open')) drawerBackdrop.hidden = true;
        }, 260);
        if (restoreFocus) menuButton.focus();
    }

    menuButton.addEventListener('click', openDrawer);
    drawerClose.addEventListener('click', function () { closeDrawer(true); });
    drawerBackdrop.addEventListener('click', function () { closeDrawer(true); });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && mobileDrawer.classList.contains('is-open')) closeDrawer(true);
    });
    // Returning through bfcache should never restore an unfolded sidebar.
    window.addEventListener('pageshow', function () { closeDrawer(false); });

    // Diary accordion: the row label is a link to /diary/, the caret toggles the
    // five sections underneath. Diary pages start open (set in the markup).
    Array.prototype.forEach.call(document.querySelectorAll('.drawer-toggle'), function (toggle) {
        var group = toggle.closest ? toggle.closest('.drawer-group') : null;
        if (!group) return;
        toggle.addEventListener('click', function () {
            var open = group.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    });
})();
