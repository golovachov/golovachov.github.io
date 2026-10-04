const SPREADSHEET_ID = '1qKxOGBSZ2VztimSkuKSx8Q0GWwkLx2EJrE0Qvvu5hvM';
const SHEET_NAME = 'RSVP';
const HEADERS = ['Дата відповіді', 'Ім’я та прізвище', 'Присутність', 'Алкоголь', 'Проживання', 'Коментар', 'ID відповіді'];

function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

// Run once from the editor to authorize access and prepare the sheet.
function setup() {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
    if (!sheet.getRange(1, 7).getValue()) sheet.getRange(1, 7).setValue(HEADERS[6]);
    sheet.setFrozenRows(1);
}

function doPost(event) {
    const data = event && event.parameter || {};
    const name = String(data.name || '').trim();
    const comment = String(data.comment || '').trim();
    const choices = {
        attendance: ['Я буду на весіллі', 'На жаль, не зможу бути'],
        alcohol: ['Вино', 'Шампанське', 'Горілка', 'Не вживаю алкоголь'],
        accommodation: ['Так', 'Ні']
    };
    if (!name || name.length > 200 || comment.length > 3000 ||
        !/^[a-zA-Z0-9-]{20,80}$/.test(data.submissionId || '') ||
        Object.keys(choices).some(key => !choices[key].includes(data[key]))) {
        return jsonResponse({ok: false, error: 'invalid_fields'});
    }

    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000);
        const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
        if (!sheet) throw new Error('Run setup before deploying.');
        const lastRow = sheet.getLastRow();
        // A retry after a lost network response must not create another row.
        if (lastRow > 1 && sheet.getRange(2, 7, lastRow - 1, 1)
            .createTextFinder(data.submissionId).matchEntireCell(true).findNext()) {
            return jsonResponse({ok: true});
        }
        // Store guest text literally, never as a spreadsheet formula.
        const literal = value => /^[=+@-]/.test(value) ? "'" + value : value;
        sheet.appendRow([new Date(), literal(name), data.attendance, data.alcohol,
            data.accommodation, literal(comment), data.submissionId]);
        SpreadsheetApp.flush();
        return jsonResponse({ok: true});
    } catch (error) {
        console.error(error);
        return jsonResponse({ok: false, error: 'save_failed'});
    } finally {
        if (lock.hasLock()) lock.releaseLock();
    }
}
