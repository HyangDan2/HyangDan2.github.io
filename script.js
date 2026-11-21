/* HD2Lab Web-HQ — mobile navigation drawer (right unfolding sidebar) */

// About used to open a dialog from ?about=1 / #about; it now has its own page,
// so old links (and any hub that still points at them) land on /about/.
if (/[?&]about=1(&|$)/.test(window.location.search) || window.location.hash === '#about') {
    window.location.replace('/about/');
}

const menuButton = document.querySelector('.menu-button');
const mobileDrawer = document.getElementById('mobile-drawer');
const drawerBackdrop = document.querySelector('.drawer-backdrop');
const drawerClose = document.querySelector('.drawer-close');

function openDrawer() {
    if (!mobileDrawer) return;
    drawerBackdrop.hidden = false;
    requestAnimationFrame(() => {
        drawerBackdrop.classList.add('is-visible');
        mobileDrawer.classList.add('is-open');
    });
    mobileDrawer.setAttribute('aria-hidden', 'false');
    menuButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-open');
    drawerClose.focus();
}

function closeDrawer(restoreFocus = true) {
    if (!mobileDrawer || !mobileDrawer.classList.contains('is-open')) return;
    mobileDrawer.classList.remove('is-open');
    drawerBackdrop.classList.remove('is-visible');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
    setTimeout(() => {
        if (!mobileDrawer.classList.contains('is-open')) drawerBackdrop.hidden = true;
    }, 260);
    if (restoreFocus) menuButton.focus();
}

if (menuButton && mobileDrawer) {
    menuButton.addEventListener('click', openDrawer);
    drawerClose.addEventListener('click', () => closeDrawer(true));
    drawerBackdrop.addEventListener('click', () => closeDrawer(true));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && mobileDrawer.classList.contains('is-open')) {
            closeDrawer(true);
        }
    });
    // A link inside the drawer navigates away; close first so the page never
    // comes back with the sidebar still unfolded (bfcache).
    window.addEventListener('pageshow', () => closeDrawer(false));
}

// Section accordions (Apps, Play, Diary, Info): the row label links to the hub
// page, the caret unfolds that group's sections — and unfolding one group
// folds the others, so a long section such as Apps never pushes About off the
// drawer. A page can start with its own group open by setting is-open /
// aria-expanded="true" in the markup.
const drawerGroups = Array.from(document.querySelectorAll('.drawer-group'));
const setGroupOpen = (group, open) => {
    const toggle = group.querySelector('.drawer-toggle');
    const panel = group.querySelector('.drawer-sub');
    if (!toggle || !panel) return;
    group.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    // Collapsed panels keep their height transition, so their links have to
    // leave the tab order another way than display:none.
    panel.inert = !open;
    if (open) {
        panel.removeAttribute('aria-hidden');
        // Reopening a scrolled section starts it at its first row again.
        const list = panel.querySelector('.drawer-sub-inner') || panel;
        list.scrollTop = 0;
    } else {
        panel.setAttribute('aria-hidden', 'true');
    }
};
drawerGroups.forEach((group) => {
    const toggle = group.querySelector('.drawer-toggle');
    if (!toggle) return;
    setGroupOpen(group, toggle.getAttribute('aria-expanded') === 'true');
    toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        if (open) drawerGroups.forEach((other) => { if (other !== group) setGroupOpen(other, false); });
        setGroupOpen(group, open);
    });
});
