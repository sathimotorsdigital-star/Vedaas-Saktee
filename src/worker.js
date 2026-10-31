const allowedEvents = new Set([
  'page_view','form_start','form_invalid','form_submit_attempt','lead_saved_sheet',
  'lead_saved_backup','lead_send_failed','sheet_post_error','whatsapp_click',
  'call_click','video_play','video_error'
]);
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
const short = (x, max) => String(x || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0,max);
const plain = (x, max) => short(x,max).replace(/[^a-zA-Z0-9_ .-]/g, '');
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      if (!env.DB) return json({ok:false,backup:'not_configured'}, 503);
      try {
        await env.DB.prepare('SELECT id FROM leads LIMIT 1').first();
        await env.DB.prepare('SELECT day FROM events_daily LIMIT 1').first();
        return json({ok:true,backup:'ready'});
      } catch (_) { return json({ok:false,backup:'database_not_ready'}, 503); }
    }
    if (request.method !== 'POST') return json({ok:false,error:'method_not_allowed'},405);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({ok:false,error:'invalid_origin'},403);
    if (!env.DB) return json({ok:false,error:'backup_not_configured'},503);
    if (!/application\/json/i.test(request.headers.get('content-type') || '')) return json({ok:false,error:'json_required'},415);
    const len = Number(request.headers.get('content-length') || 0);
    if (len > 3200) return json({ok:false,error:'too_large'},413);
    let payload;
    try { const txt = await request.text(); if (txt.length > 3200) throw Error('large'); payload = JSON.parse(txt); }
    catch (_) { return json({ok:false,error:'invalid_json'},400); }
    if (!payload || typeof payload !== 'object') return json({ok:false,error:'invalid_body'},400);
    if (url.pathname === '/api/lead') {
      const id = short(payload.submission_id,90);
      const name = short(payload.name,60);
      const phone = short(payload.phone,16);
      const address = short(payload.address,350);
      const website = short(payload.website,80);
      if (website) return json({ok:false,error:'rejected'},400);
      if (!/^[a-zA-Z0-9_-]{8,90}$/.test(id) || name.length < 2 ||
          !/^[6-9][0-9]{9}$/.test(phone) || String(payload.consent) !== 'yes')
        return json({ok:false,error:'invalid_fields'},400);
      let page = short(payload.page_url,350);
      try { if (new URL(page).origin !== url.origin) page = url.origin; }
      catch (_) { page = url.origin; }
      try {
        await env.DB.prepare(`INSERT OR IGNORE INTO leads
          (id, received_at, name, phone, address, product, price_inr, page_url, campaign, source, consent, status)
          VALUES (?, datetime('now'), ?, ?, ?, 'VEDDAS SAKTEE 30 Capsules', 1299, ?, ?, ?, 'yes', 'New Lead')`)
          .bind(id,name,phone,address,page,plain(payload.campaign,70),plain(payload.source,45)).run();
        return json({ok:true,stored:true,id},201);
      } catch (_) { return json({ok:false,error:'database_error'},503); }
    }
    if (url.pathname === '/api/event') {
      const event = short(payload.event,40);
      if (!allowedEvents.has(event)) return json({ok:false,error:'unknown_event'},400);
      try {
        await env.DB.prepare(`INSERT INTO events_daily(day, event, campaign, source, count)
          VALUES (date('now'), ?, ?, ?, 1)
          ON CONFLICT(day,event,campaign,source) DO UPDATE SET count=count+1`)
          .bind(event,plain(payload.campaign,70),plain(payload.source,45)).run();
        return json({ok:true});
      } catch (_) { return json({ok:false,error:'database_error'},503); }
    }
    return json({ok:false,error:'not_found'},404);
  }
};
