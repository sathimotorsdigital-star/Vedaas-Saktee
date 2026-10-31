/**
 * VEDDAS SAKTEE lead receiver — Name / Phone / optional Address / Consent.
 * Keeps the existing 11-column Leads sheet structure and Lead ID deduplication.
 * After replacing Code.gs: Deploy > Manage deployments > Edit > New version > Deploy.
 * Web app: Execute as Me; access Anyone (for this existing public form workflow).
 */
const SHEET_ID = '1OHcYBhCXNK0xcyKw9PA-hUavYi1I4LddnXaYbSw9J2Y';
const TAB_NAME = 'Leads';

function doGet(e) {
  const q = (e && e.parameter) || {};
  if (q.action === 'status') {
    const id = String(q.id || '');
    const cb = String(q.callback || '');
    if (!/^[a-zA-Z0-9_-]{8,90}$/.test(id) || !/^veddasAck_[a-zA-Z0-9_]{8,90}$/.test(cb)) {
      return ContentService.createTextOutput('Invalid request');
    }
    let saved = false, error = false;
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName(TAB_NAME);
      if (!sheet) throw new Error('Leads tab missing');
      const last = sheet.getLastRow();
      if (last > 1) {
        const cell = sheet.getRange(2, 2, last - 1, 1)
          .createTextFinder(id).matchEntireCell(true).findNext();
        saved = !!cell;
      }
    } catch (err) {
      console.error('STATUS_CHECK: ' + err);
      error = true;
    }
    const response = JSON.stringify({type:'VEDDAS_LEAD_CHECK', id:id, saved:saved, error:error});
    return ContentService.createTextOutput(cb + '(' + response + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
    return ContentService.createTextOutput(sheet
      ? 'VEDDAS SAKTEE lead receiver is ACTIVE. Leads sheet found.'
      : 'ERROR: Leads tab not found.');
  } catch(err) {
    return ContentService.createTextOutput('ERROR: Cannot access Google Sheet. Check account permissions.');
  }
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const id = String(p.submission_id || '').trim().slice(0, 90);
  try {
    if (String(p.website || '').trim()) throw new Error('Honeypot field filled');
    const name = cleanText_(p.name, 60);
    const phone = String(p.phone || '').trim();
    const address = cleanText_(p.address, 350);
    const consent = String(p.consent || "").trim().toLowerCase();
    const pageURL = cleanText_(p.page_url, 300);
    if (name.length < 2 || !/^[6-9][0-9]{9}$/.test(phone)) {
      throw new Error('Name or phone is invalid');
    }
    if (consent !== 'yes') throw new Error('Contact consent is required');
    if (!/^[a-zA-Z0-9_-]{8,90}$/.test(id)) throw new Error('Invalid submission ID');

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) throw new Error('Server busy; retry later');
    try {
      const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
      if (!sheet) throw new Error('Leads tab not found');
      const last = sheet.getLastRow();
      const found = last > 1 && sheet.getRange(2, 2, last - 1, 1)
        .createTextFinder(id).matchEntireCell(true).findNext();
      if (!found) {
        sheet.appendRow([
          Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss'),
          safeText_(id), safeText_(name), safeText_(phone),
          address ? 'Order' : 'Enquiry', safeText_(address),
          'VEDDAS SAKTEE 30 Capsules', 1299,
          safeText_(pageURL), 'New Lead', 'Yes'
        ]);
        SpreadsheetApp.flush();
      }
    } finally {
      lock.releaseLock();
    }
    return postResponse_(true, id);
  } catch(err) {
    console.error('SUBMISSION_ERROR: ' + err);
    return postResponse_(false, id);
  }
}

function cleanText_(v, limit) {
  return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, limit);
}
function safeText_(v) {
  const s = String(v || '');
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function postResponse_(ok, id) {
  const message = JSON.stringify({type:'VEDDAS_LEAD_RESULT', ok:ok, id:id});
  const html = '<!doctype html><html><body><script>window.top.postMessage(' +
    message.replace(/</g, '\\u003c') + ',"*");</script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
