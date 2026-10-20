const aboutButton = document.querySelector('.about-button');
const aboutDialog = document.getElementById('about-dialog');
const closeButton = aboutDialog.querySelector('.close-button');

aboutButton.addEventListener('click', () => aboutDialog.showModal());
closeButton.addEventListener('click', () => aboutDialog.close());

// Only dismiss clicks that start and end on the backdrop, outside the dialog.
function isBackdrop(event) {
    const bounds = aboutDialog.getBoundingClientRect();
    return event.target === aboutDialog && (
        event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom
    );
}
let startedOnBackdrop = false;
aboutDialog.addEventListener('pointerdown', (event) => {
    startedOnBackdrop = isBackdrop(event);
});
aboutDialog.addEventListener('click', (event) => {
    if (startedOnBackdrop && isBackdrop(event)) aboutDialog.close();
    startedOnBackdrop = false;
});
aboutDialog.addEventListener('close', () => {
    startedOnBackdrop = false;
    aboutButton.focus();
});
