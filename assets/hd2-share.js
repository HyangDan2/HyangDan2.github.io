/* ==========================================================================
   HD2Lab · shared page share control
   --------------------------------------------------------------------------
   A single floating link button in the bottom-right corner (44px, safe-area
   aware). It replaces the floating theme toggle: the light/dark switch now
   lives in the site header, so the corner belongs to sharing the page.

     · phones and browsers with the Web Share API → the system share sheet
       ({ title, url }); a cancelled sheet (AbortError) is not an error
     · everywhere else → the URL is copied and a toast confirms it
       ("링크가 복사되었어요" / "Link copied", following <html lang>)
   ========================================================================== */
(function () {
  'use strict';

  var button = document.getElementById('share-toggle');
  var toast = document.getElementById('share-toast');
  if (!button) return;

  var korean = (document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('ko') === 0;
  var copiedMessage = korean ? '링크가 복사되었어요' : 'Link copied';
  var hideTimer = 0;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(value);
        }
      );
    }
    return Promise.resolve(legacyCopy(value));
  }

  function legacyCopy(value) {
    try {
      var field = document.createElement('textarea');
      field.value = value;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.top = '-1000px';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      var copied = document.execCommand('copy');
      document.body.removeChild(field);
      return copied;
    } catch (error) {
      return false;
    }
  }

  button.addEventListener('click', function () {
    var url = window.location.href;

    if (navigator.share) {
      navigator
        .share({ title: document.title, url: url })
        .catch(function (error) {
          if (error && error.name === 'AbortError') return;
          copyText(url).then(function (copied) {
            if (copied) showToast(copiedMessage);
          });
        });
      return;
    }

    copyText(url).then(function (copied) {
      if (copied) showToast(copiedMessage);
    });
  });
})();
