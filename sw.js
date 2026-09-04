const CACHE_NAME = "aqua-super-pwa-v15-20260904-notes-search-final";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./icon-192.png",
  "./icon-512.png"
];

const MOBILE_WIDTH_FIX = `
<style id="aqua-mobile-full-width-fix">
html,body{width:100%;max-width:none;overflow-x:hidden}
main{width:100%!important;max-width:none!important;margin:0!important;padding-left:0!important;padding-right:0!important}
#aquaGoogleDriveCard{margin-left:0!important;margin-right:0!important}
#aquaDailyBackupBox{margin-left:0!important;margin-right:0!important}
#aquaInstallBtn{display:none!important}
.item .row{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:9px!important;width:100%!important}
.item .row>button,.item .row>a,.item .row>input{width:100%!important;min-width:0!important;max-width:none!important;display:block!important;margin-left:0!important;margin-right:0!important}
</style>`;

const NOTES_INJECT = `
<style id="aqua-notes-style">
.aqua-notes-wrap{margin:0 0 14px;padding:14px 12px 18px;background:#fff;border-radius:0;box-shadow:0 2px 9px #0001}
.aqua-notes-title{font-size:22px;font-weight:800;color:#17324d;margin:2px 0 5px}.aqua-notes-sub{font-size:13px;color:#64748b;margin-bottom:12px}
.aqua-notes-text{width:100%;min-height:150px;padding:13px;border:1px solid #ccd8e3;border-radius:12px;font-size:16px;line-height:1.45;resize:vertical;background:#fff}
.aqua-notes-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:10px 0}.aqua-notes-actions button{min-height:52px;font-size:14px}
.aqua-note-wa{background:#16a34a!important}.aqua-note-sms{background:#2563eb!important}.aqua-note-next{background:#0ea5e9!important}
.aqua-note-customer{padding:13px 0;border-bottom:1px solid #e5edf3}.aqua-note-customer:last-child{border-bottom:0}
.aqua-note-name{font-size:17px;font-weight:800;color:#17324d}.aqua-note-phone{font-size:12px;color:#64748b;margin-top:3px}.aqua-note-btns{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:8px}
.aqua-note-btns button{font-size:13px;padding:11px 5px}.aqua-batch{padding:11px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;margin:10px 0;color:#075985;font-size:13px}
.aqua-notes-search-wrap{padding:0 12px 10px;background:#fff}
.aqua-notes-search{width:100%;padding:12px 14px;border:1px solid #ccd8e3;border-radius:10px;font-size:15px;background:#fff;box-sizing:border-box}
.aqua-notes-noresult{padding:10px 0;color:#64748b;font-size:13px}
@media(max-width:360px){.aqua-notes-actions,.aqua-note-btns{grid-template-columns:1fr}.aqua-notes-text{min-height:130px}}
</style>
<script id="aqua-notes-script">
(function(){
  function startNotes(){
    if(window.__AQUA_NOTES_READY)return; window.__AQUA_NOTES_READY=true;
    var KEY="AQUA_SUPER_NOTES_MESSAGE_1",BKEY="AQUA_SUPER_NOTES_BATCH_1";
    function el(id){return document.getElementById(id)}
    function msg(){var x=el("aquaNotesMessage");return x?x.value.trim():""}
    function saveMsg(){try{localStorage.setItem(KEY,msg())}catch(e){}}
    function list(){return (window.db&&db.customers?db.customers:[]).filter(function(c){return c&&String(c.mobile||"").replace(/\\D/g,"").length>=10})}
    function openOne(c,ch){var m=msg();if(!m){alert("Pehle Notes message type karein.");return false}saveMsg();if(!c||!c.mobile){alert("Is customer ka mobile number nahi hai.");return false}window.location.href=ch==="wa"?"https://wa.me/"+String(c.mobile).replace(/\\D/g,"")+"?text="+encodeURIComponent(m):"sms:"+String(c.mobile).replace(/\\D/g,"")+"?body="+encodeURIComponent(m);return true}
    function batch(ch){var a=list(),m=msg();if(!m){alert("Pehle Notes message type karein.");return}if(!a.length){alert("Kisi customer ka valid mobile number nahi mila.");return}saveMsg();try{localStorage.setItem(BKEY,JSON.stringify({channel:ch,index:0,total:a.length,message:m}))}catch(e){}openOne(a[0],ch);renderBatch()}
    function renderBatch(){var b=el("aquaNotesBatch");if(!b)return;var x=null;try{x=JSON.parse(localStorage.getItem(BKEY)||"null")}catch(e){}if(!x){b.innerHTML="";return}var label=x.channel==="wa"?"WhatsApp":"SIM SMS";b.innerHTML="📨 <b>All Customer "+label+" batch:</b> "+(Number(x.index)+1)+" / "+x.total+"<br>Message open karne ke baad <b>Next Customer</b> dabayein."+'<button class="aqua-note-next" style="margin-top:9px" onclick="aquaNotesNext()">➡️ Next Customer '+label+'</button><button style="margin-top:7px;background:#64748b" onclick="aquaNotesStopBatch()">✖ Stop Batch</button>'}
    window.aquaNotesNext=function(){var x=null;try{x=JSON.parse(localStorage.getItem(BKEY)||"null")}catch(e){}if(!x)return;var a=list(),n=Number(x.index)+1;if(n>=a.length){alert("✅ All customers batch complete.");window.aquaNotesStopBatch();return}x.index=n;x.total=a.length;try{localStorage.setItem(BKEY,JSON.stringify(x))}catch(e){}if(el("aquaNotesMessage"))el("aquaNotesMessage").value=x.message||msg();openOne(a[n],x.channel);renderBatch()};
    window.aquaNotesStopBatch=function(){try{localStorage.removeItem(BKEY)}catch(e){}renderBatch()};
    window.aquaNotesSendAllWhatsApp=function(){batch("wa")};
    window.aquaNotesSendAllSMS=function(){batch("sms")};
    window.aquaNotesSendWhatsApp=function(i){openOne((window.db&&db.customers?db.customers:[])[Number(i)],"wa")};
    window.aquaNotesSendSMS=function(i){openOne((window.db&&db.customers?db.customers:[])[Number(i)],"sms")};
    function renderCustomerList(q){
      var box=el("aquaNotesCustomerList");if(!box)return;
      q=String(q||"").toLowerCase().trim();
      var a=list(),found=0,out="";
      a.forEach(function(c,i){
        var hay=(String(c.name||"")+" "+String(c.mobile||"")).toLowerCase();
        if(q && hay.indexOf(q)<0)return;
        found++;
        out+='<div class="aqua-note-customer"><div class="aqua-note-name">'+(window.esc?esc(c.name||""):String(c.name||""))+' Ji</div><div class="aqua-note-phone">📱 '+(window.esc?esc(c.mobile||"Mobile number nahi hai"):String(c.mobile||"Mobile number nahi hai"))+'</div><div class="aqua-note-btns"><button class="aqua-note-wa" onclick="aquaNotesSendWhatsApp('+i+')">📲 WhatsApp</button><button class="aqua-note-sms" onclick="aquaNotesSendSMS('+i+')">💬 SIM SMS</button></div></div>';
      });
      box.innerHTML=found?out:'<div class="aqua-notes-noresult">Is search se koi customer nahi mila.</div>';
    }
    window.aquaNotesFilterCustomers=function(q){renderCustomerList(q)};
    window.aquaNotesRender=function(){
      var main=el("main"),nav=document.querySelector("nav");if(!main)return;
      if(nav){nav.querySelectorAll("button").forEach(function(b){b.className=""});if(el("nNotes"))el("nNotes").className="active"}
      var saved="";try{saved=localStorage.getItem(KEY)||""}catch(e){}
      main.innerHTML='<div class="aqua-notes-wrap"><div class="aqua-notes-title">📝 Notes / اطلاع</div><div class="aqua-notes-sub">Plant band, gaadi breakdown, staff nahi aaya ya koi bhi update customer ko bhejein.</div><textarea id="aquaNotesMessage" class="aqua-notes-text" placeholder="Yahan apna message manually type karein...">'+(window.esc?esc(saved):saved.replace(/[&<>]/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[m]}))+'</textarea><div class="aqua-notes-actions"><button class="aqua-note-wa" onclick="aquaNotesSendAllWhatsApp()">📲 All Customer<br>WhatsApp</button><button class="aqua-note-sms" onclick="aquaNotesSendAllSMS()">💬 All Customer<br>SIM SMS</button></div><div id="aquaNotesBatch" class="aqua-batch"></div></div><div class="aqua-notes-search-wrap"><input id="aquaNotesCustomerSearch" class="aqua-notes-search" type="search" placeholder="🔎 Customer name ya mobile number search karein..." oninput="aquaNotesFilterCustomers(this.value)" autocomplete="off"></div><div class="box" style="margin:0 12px 12px"><h2>👥 All Customers</h2><div class="small" style="margin-bottom:8px">Har customer ko Notes message alag se WhatsApp ya SIM SMS kar sakte hain.</div><div id="aquaNotesCustomerList"></div></div>';
      renderCustomerList("");renderBatch();var t=el("aquaNotesMessage");if(t)t.addEventListener("input",saveMsg);
    };
    var oldGo=window.go;window.go=function(p){if(p==="notes"){window.aquaNotesRender();return}if(typeof oldGo==="function")oldGo(p)};
    var nav=document.querySelector("nav");if(nav){if(!el("nNotes")){var b=document.createElement("button");b.id="nNotes";b.onclick=function(){go("notes")};b.innerHTML="📝<br/>Notes";nav.appendChild(b)}nav.style.gridTemplateColumns="repeat(6,1fr)"}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",startNotes);else startNotes();
})();
</script>`;

async function injectHtml(response) {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;
    const html = await response.text();
    if (html.includes('id="aqua-notes-script"')) return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
    const updated = html.replace(/<\\/head>/i, MOBILE_WIDTH_FIX + "</head>").replace(/<\\/body>/i, NOTES_INJECT + "</body>");
    const headers = new Headers(response.headers);
    headers.set("content-type","text/html; charset=utf-8");
    headers.delete("content-length");
    return new Response(updated,{status:response.status,statusText:response.statusText,headers:headers});
  } catch(e) { return response; }
}

self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("message",event=>{if(event.data&&event.data.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const isHtml=event.request.mode==="navigate"||(event.request.headers.get("accept")||"").includes("text/html");
  if(isHtml){
    event.respondWith(fetch(event.request).then(injectHtml).then(response=>{if(response&&response.status===200){const copy=response.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy)).catch(()=>{})}return response}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>{if(cached)return cached;return fetch(event.request).then(response=>{if(!response||response.status!==200||response.type==="opaque")return response;const copy=response.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy));return response}).catch(()=>cached)}));
});
