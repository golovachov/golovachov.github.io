const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const backend = fs.readFileSync('google-apps-script/Code.gs', 'utf8');
const frontend = fs.readFileSync('assets/rsvp.js', 'utf8');

test('server validates, saves six answers plus ID, escapes formulas, and deduplicates retries', () => {
    const rows = [];
    let locked = false;
    const sheet = {
        getLastRow: () => rows.length,
        appendRow: row => rows.push(row),
        setFrozenRows() {},
        getRange(row, column) {
            return {
                getValue: () => rows[row - 1]?.[column - 1],
                setValue(value) { rows[row - 1][column - 1] = value; },
                createTextFinder(value) {
                    return {matchEntireCell() { return this; }, findNext: () => rows.slice(1).some(r => r[6] === value)};
                }
            };
        }
    };
    const context = vm.createContext({
        console,
        SpreadsheetApp: {openById(id) {
            assert.equal(id, '1qKxOGBSZ2VztimSkuKSx8Q0GWwkLx2EJrE0Qvvu5hvM');
            return {getSheetByName(name) {assert.equal(name, 'RSVP'); return sheet; }};
        }, flush() {}},
        LockService: {getScriptLock: () => ({waitLock() {locked = true; }, hasLock: () => locked, releaseLock() {locked = false; }})},
        ContentService: {MimeType: {JSON: 'json'}, createTextOutput: text => ({setMimeType: () => JSON.parse(text)})}
    });
    vm.runInContext(backend, context);
    context.setup();
    assert.equal(rows.length, 1);
    const parameter = {name: '=test', attendance: 'Я буду на весіллі', alcohol: 'Не вживаю алкоголь', accommodation: 'Ні', comment: '', submissionId: '12345678-1234-1234-1234-123456789abc'};
    assert.equal(context.doPost({parameter: {...parameter, alcohol: ''}}).ok, false);
    assert.equal(context.doPost({parameter: {...parameter, name: '  '}}).ok, false);
    assert.equal(rows.length, 1);
    assert.equal(context.doPost({parameter}).ok, true);
    assert.equal(rows.length, 2);
    assert.equal(rows[1][1], "'=test");
    assert.equal(rows[1][5], '');
    assert.equal(rows[1][6], parameter.submissionId);
    assert.equal(context.doPost({parameter}).ok, true);
    assert.equal(rows.length, 2);
    assert.equal(locked, false);
});

function browser(endpoint = '') {
    const fields = ['guest-name', 'attendance', 'alcohol', 'accommodation'].map(id => ({
        id, value: 'valid', validity: {valid: true}, addEventListener() {},
        setAttribute() {}, removeAttribute() {}, focus() { this.focused = true; }
    }));
    const errors = Object.fromEntries(fields.map(field => [`${field.id}-error`, {hidden: true}]));
    const status = {textContent: '', classList: {toggle() {}}};
    const button = {};
    const data = {name: 'Гість', attendance: 'Я буду на весіллі', alcohol: 'Вино', accommodation: 'Так', comment: ''};
    const form = {
        querySelectorAll: selector => selector === '[required]' ? fields : [...fields, button],
        querySelector: () => button,
        addEventListener(type, handler) {this[type] = handler; },
        setAttribute() {}, removeAttribute() {}, reset() {this.resetCalled = true; }
    };
    const requests = [];
    let fail = false;
    let ids = 0;
    const context = {
        document: {querySelector: () => form, getElementById: id => id === 'rsvp-status' ? status : errors[id]},
        URLSearchParams, FormData: class { constructor() {return Object.entries(data); } },
        crypto: {randomUUID: () => `unique-request-${++ids}`}, AbortController, setTimeout, clearTimeout,
        fetch: async (url, options) => {
            requests.push(options.body.toString());
            if (fail) throw new Error('Network failure');
            return {ok: true, json: async () => ({ok: true})};
        }
    };
    vm.runInNewContext(frontend.replace(/const RSVP_ENDPOINT = '[^']*';/, `const RSVP_ENDPOINT = '${endpoint}';`), context);
    return {form, fields, errors, status, button, requests, setFail(value) {fail = value; }};
}

test('client rejects missing fields and an unconfigured endpoint without sending', async () => {
    const b = browser();
    b.fields.forEach(field => {field.value = ''; });
    await b.form.submit({preventDefault() {}});
    assert.ok(Object.values(b.errors).every(error => !error.hidden));
    assert.equal(b.requests.length, 0);
    b.fields.forEach(field => {field.value = 'valid'; });
    await b.form.submit({preventDefault() {}});
    assert.match(b.status.textContent, /ще не готова/);
    assert.equal(b.requests.length, 0);
});

test('client preserves entries on failure, reuses retry ID, and resets only on confirmed success', async () => {
    const b = browser('https://script.google.com/macros/s/test/exec');
    b.setFail(true);
    await b.form.submit({preventDefault() {}});
    assert.equal(b.form.resetCalled, undefined);
    assert.match(b.status.textContent, /Не вдалося/);
    assert.equal(b.button.disabled, false);
    b.setFail(false);
    await b.form.submit({preventDefault() {}});
    assert.equal(b.requests[0], b.requests[1]);
    assert.equal(b.form.resetCalled, true);
    assert.match(b.status.textContent, /збережено/);
    assert.equal(b.button.disabled, false);
});
