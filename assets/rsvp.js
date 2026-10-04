// Google Apps Script web app deployment for the RSVP spreadsheet.
const RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzCxS8TfGX0zJ8XUy9DPIpnyZwEg1ZHeNQlTZZNSvgL0VXQWDIvTtAhi7QmrFx89E5M/exec';

const rsvpForm = document.querySelector('.rsvp .form');
const requiredFields = [...rsvpForm.querySelectorAll('[required]')];
const statusMessage = document.getElementById('rsvp-status');
const submitButton = rsvpForm.querySelector('button[type="submit"]');
let submitted = false;
let sending = false;
let lastPayload = '';
let submissionId = '';

rsvpForm.noValidate = true;

function validateField(field) {
    const valid = field.value.trim() !== '' && field.validity.valid;
    document.getElementById(`${field.id}-error`).hidden = valid;
    field.setAttribute('aria-invalid', String(!valid));
    return valid;
}

function showStatus(message, error = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle('field-error', error);
}

rsvpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    submitted = true;
    showStatus('');
    const invalidFields = requiredFields.filter(field => !validateField(field));
    if (invalidFields.length) {
        invalidFields[0].focus();
        return;
    }
    if (!RSVP_ENDPOINT) {
        showStatus('Форма ще не готова до надсилання. Спробуйте пізніше.', true);
        return;
    }

    const body = new URLSearchParams(new FormData(rsvpForm));
    body.set('name', body.get('name').trim());
    body.set('comment', body.get('comment').trim());
    const payload = body.toString();
    if (payload !== lastPayload || !submissionId) {
        submissionId = crypto.randomUUID();
        lastPayload = payload;
    }
    body.set('submissionId', submissionId);

    sending = true;
    const controls = [...rsvpForm.querySelectorAll('input, select, textarea, button')];
    controls.forEach(control => { control.disabled = true; });
    rsvpForm.setAttribute('aria-busy', 'true');
    submitButton.textContent = 'Надсилаємо…';
    showStatus('Зберігаємо вашу відповідь…');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
        // URL-encoded data avoids a cross-origin preflight. Follow Google's redirect.
        const response = await fetch(RSVP_ENDPOINT, {
            method: 'POST', body, redirect: 'follow', credentials: 'omit',
            signal: controller.signal
        });
        if (!response.ok || (await response.json()).ok !== true) throw new Error('Save not confirmed');
        rsvpForm.reset();
        submitted = false;
        submissionId = '';
        lastPayload = '';
        requiredFields.forEach(field => field.removeAttribute('aria-invalid'));
        showStatus('Дякуємо! Вашу відповідь збережено.');
    } catch (error) {
        showStatus('Не вдалося підтвердити збереження відповіді. Перевірте з’єднання та спробуйте ще раз.', true);
    } finally {
        clearTimeout(timeout);
        sending = false;
        controls.forEach(control => { control.disabled = false; });
        rsvpForm.removeAttribute('aria-busy');
        submitButton.textContent = 'Відправити відповідь';
    }
});

requiredFields.forEach(field => {
    ['input', 'change'].forEach(type => {
        field.addEventListener(type, () => {
            if (submitted) validateField(field);
        });
    });
});
