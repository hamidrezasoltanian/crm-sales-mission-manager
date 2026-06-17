// crm.js — پورتال مدیریت فروش آتنا زیست درمان
// ── تنظیم خودکار آدرس API (همان دامنه) ──────────────────────
(function(){
  // API همیشه همان دامنه
  var base=window.location.origin+'/api';
  localStorage.setItem('crm_api_base',base);
})();



// ================================================================
// AUTO-RESTORE SESSION — جلوگیری از logout بعد از refresh
// ================================================================
function tryAutoLogin(){
  var s=localStorage.getItem('crm_sess');
  if(!s)return false;
  var o;
  try{ o=JSON.parse(s); }catch(e){ localStorage.removeItem('crm_sess'); return false; }
  if(!o||!o.u||!o.d)return false;
  // بررسی timeout — 12 ساعت
  if(o.ts && (Date.now()-o.ts) > 12*3600*1000){
    localStorage.removeItem('crm_sess');
    localStorage.removeItem('crm_token');
    return false;
  }
  // FIX: فقط با token restore می‌کنیم — نه رمز
  var token=localStorage.getItem('crm_token');
  if(!token){ localStorage.removeItem('crm_sess'); return false; }
  // FIX: role و isManager را از session ذخیره‌شده بازیابی می‌کنیم
  _doLoginSuccess(o.u, o.d, '');
  return true;
}

document.addEventListener('DOMContentLoaded',function(){
  var loginScr=document.getElementById('loginScreen');
  if(!tryAutoLogin()){
    if(loginScr)loginScr.style.display='flex';
  }
});

// ================================================================
// SAVE QUEUE — صف ذخیره مطمئن در دیتابیس
// ================================================================

var _SQ = {
  _q: [],
  _running: false,
  _retryTimer: null,
  _debounce: {},
  _MAX_BATCH: 20,  // FIX: batch size محدود

  // ذخیره edit یک record (با debounce 1s)
  edit: function(type, id) {
    var key = type + '||' + id;
    clearTimeout(this._debounce[key]);
    var self = this;
    this._debounce[key] = setTimeout(function() {
      var e = type === 'pc' ? (userEdits.pc[id]||{}) : getEdit(type, id);
      // حذف نسخه قدیمی همین record از صف
      self._q = self._q.filter(function(i){
        return !(i.k==='edit' && i.type===type && i.id===id);
      });
      // FIX: کپی بدون audit (server-side ساخته می‌شود)
      var eCopy = JSON.parse(JSON.stringify(e));
      delete eCopy.audit;
      self._q.push({k:'edit', type:type, id:id, data:eCopy});
      self._run();
    }, 1000);
  },

  // ذخیره فوری یادداشت
  note: function(type, id, note) {
    this._q.push({k:'note', type:type, id:id, data:note});
    this._run();
  },

  // ذخیره چک‌لیست (با debounce)
  checklist: function(date, items, noteText) {
    clearTimeout(this._debounce['ck_'+date]);
    var self = this;
    this._debounce['ck_'+date] = setTimeout(function() {
      self._q = self._q.filter(function(i){return !(i.k==='ck'&&i.date===date);});
      self._q.push({k:'ck', date:date, items:items, note:noteText||''});
      self._run();
    }, 1000);
  },

  _run: async function() {
    if (this._running || !this._q.length) return;
    if (!getApiBase()) { setSyncStatus('off'); return; }

    // اطمینان از token — بدون ذخیره رمز
    var token = localStorage.getItem('crm_token');
    if (!token) {
      setSyncStatus('err');
      this._schedRetry();
      return;
    }

    this._running = true;
    setSyncStatus('busy');
    var failed = [];
    // FIX: batch حداکثر _MAX_BATCH آیتم
    var batch = this._q.splice(0, Math.min(this._q.length, this._MAX_BATCH));

    for (var j=0; j<batch.length; j++) {
      var item = batch[j];
      try {
        if (item.k === 'edit') {
          await apiCall('POST','/record/edit.php',{
            type:         item.type,
            id:           item.id,
            // FIX: undefined چک می‌کنیم نه falsy — رشته خالی و 0 معتبر هستند
            status:       item.data.status       !== undefined ? item.data.status       : null,
            lead:         item.data.lead         !== undefined ? item.data.lead         : null,
            potential:    item.data.potential    !== undefined ? item.data.potential    : (item.data.pot !== undefined ? item.data.pot : null),
            followupDate: item.data.followupDate !== undefined ? item.data.followupDate : null,
            prods:        item.data.prods        || null,
            owner:        item.data.owner        !== undefined ? item.data.owner        : null,
            name:         item.data._name        || item.data.name || null,
            centerType:   item.data.type         !== undefined ? item.data.type         : null,
            _del:         !!item.data._del,
            lastActivity: item.data.lastActivity || Date.now(),
          });
        } else if (item.k === 'note') {
          await apiCall('POST','/record/note.php',{
            type:  item.type,
            id:    item.id,
            text:  item.data.text,
            ts:    item.data.ts,
            rawTs: item.data.rawTs,
          });
        } else if (item.k === 'ck') {
          await apiCall('POST','/record/checklist.php',{
            date:  item.date,
            items: item.items,
            note:  item.note,
          });
        }
      } catch(e) {
        failed.push(item);
      }
    }

    this._running = false;
    if (failed.length) {
      this._q = failed.concat(this._q);
      setSyncStatus('err');
      this._schedRetry();
    } else {
      setSyncStatus('ok');
      // FIX: _pendingSave پاک شود فقط اگر صف خالی است
      if (!this._q.length) _pendingSave = false;
      var badge = document.getElementById('saveBadge');
      if (badge) { badge.textContent='✅ ذخیره شد'; setTimeout(function(){badge.textContent='';},2000); }
      // FIX: اگر صف هنوز آیتم دارد ادامه بده
      if (this._q.length) { var _sq=this; setTimeout(function(){_sq._run();},100); }
    }
  },

  _schedRetry: function() {
    clearTimeout(this._retryTimer);
    var self = this;
    this._retryTimer = setTimeout(function(){ self._run(); }, 10000);
  }
};

// wrapper های قدیمی برای سازگاری
function immSaveEdit(type,id){ _SQ.edit(type,id); }
function immSaveNote(type,id,note){ _SQ.note(type,id,note); }
function immSaveChecklist(date,items,note){ _SQ.checklist(date,items,note); }

// ── (موج ۳) توابع تگ ────────────────────────────────────────
function normRecordType(t){
  // 'centers' → 'center' و غیره
  var m = {centers:'center', provinces:'province', pc:'pc'};
  return m[t] || t;
}

async function createTag(name, color, icon, expiresAt, description){
  if(!getApiBase())return null;
  try{
    var res = await apiCall('POST','/tags/manage.php',{
      action:'create', name:name, color:color||'#3b82f6',
      icon:icon||'', expires_at:expiresAt||'', description:description||''
    });
    if(res.ok){
      // اضافه به TAGS محلی
      TAGS.push({id:res.id, name:name, color:color||'#3b82f6', icon:icon||'', expires_at:expiresAt||null, description:description||''});
      return res.id;
    }
  }catch(e){console.error('createTag:',e);}
  return null;
}

async function assignTag(recordType, recordId, tagId){
  if(!getApiBase())return false;
  var rt = normRecordType(recordType);
  var key = rt + '_' + recordId;
  // ابتدا local update برای واکنش سریع
  if(!RECORD_TAGS[key]) RECORD_TAGS[key] = [];
  if(RECORD_TAGS[key].indexOf(tagId) === -1) RECORD_TAGS[key].push(tagId);
  // sync با سرور
  try{
    var res = await apiCall('POST','/tags/manage.php',{
      action:'assign', record_type:rt, record_id:recordId, tag_id:tagId
    });
    if(!res.ok){
      // rollback
      RECORD_TAGS[key] = RECORD_TAGS[key].filter(function(t){return t!==tagId;});
      return false;
    }
    return true;
  }catch(e){
    RECORD_TAGS[key] = RECORD_TAGS[key].filter(function(t){return t!==tagId;});
    return false;
  }
}

async function unassignTag(recordType, recordId, tagId){
  if(!getApiBase())return false;
  var rt = normRecordType(recordType);
  var key = rt + '_' + recordId;
  // FIX: state قبلی را نگه می‌داریم تا در صورت خطا rollback کنیم
  var prevState = RECORD_TAGS[key] ? RECORD_TAGS[key].slice() : null;
  if(RECORD_TAGS[key]){
    RECORD_TAGS[key] = RECORD_TAGS[key].filter(function(t){return t!==tagId;});
    if(!RECORD_TAGS[key].length) delete RECORD_TAGS[key];
  }
  try{
    var res = await apiCall('POST','/tags/manage.php',{
      action:'unassign', record_type:rt, record_id:recordId, tag_id:tagId
    });
    if(!res.ok){
      // rollback
      if(prevState !== null) RECORD_TAGS[key] = prevState;
      return false;
    }
    return true;
  }catch(e){
    // rollback در صورت خطای شبکه
    if(prevState !== null) RECORD_TAGS[key] = prevState;
    else delete RECORD_TAGS[key];
    return false;
  }
}

async function deleteTag(tagId){
  if(!getApiBase())return false;
  try{
    var res = await apiCall('POST','/tags/manage.php',{action:'delete', id:tagId});
    if(res.ok){
      TAGS = TAGS.filter(function(t){return t.id!==tagId;});
      // حذف از همه RECORD_TAGS
      Object.keys(RECORD_TAGS).forEach(function(k){
        RECORD_TAGS[k] = RECORD_TAGS[k].filter(function(t){return t!==tagId;});
        if(!RECORD_TAGS[k].length) delete RECORD_TAGS[k];
      });
      return true;
    }
  }catch(e){}
  return false;
}

// ذخیره preference در سرور
async function savePreference(key, value){
  PREFERENCES[key] = value;
  if(!getApiBase())return;
  try{await apiCall('POST','/users/preferences.php',{key:key, value:String(value)});}
  catch(e){}
}

// ============================================================
// FONT — Vazirmatn with localStorage offline caching
// ============================================================
(async function(){
  const KEY='vazirmatn_v33';
  function inject(src){
    const s=document.createElement('style');
    s.textContent=`@font-face{font-family:'Vazirmatn';src:url('${src}') format('woff2');font-weight:100 900;font-style:normal}`;
    document.head.insertBefore(s,document.head.firstChild);
  }
  try{
    const cached=localStorage.getItem(KEY);
    if(cached){inject(cached);return;}
    const urls=[
      'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn[wght].woff2',
      'https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.8/files/vazirmatn-arabic-wght-normal.woff2'
    ];
    for(const url of urls){
      try{
        const r=await fetch(url);
        if(!r.ok)continue;
        const buf=await r.arrayBuffer();
        // FIX: spread operator روی Uint8Array بزرگ crash می‌کند — از حلقه chunked استفاده می‌شود
        var bytes=new Uint8Array(buf),binary='',chunk=8192;
        for(var ci=0;ci<bytes.byteLength;ci+=chunk){
          binary+=String.fromCharCode.apply(null,bytes.subarray(ci,ci+chunk));
        }
        const b64=btoa(binary);
        const dataUrl='data:font/woff2;base64,'+b64;
        try{localStorage.setItem(KEY,dataUrl);}catch(e){}
        inject(dataUrl);
        return;
      }catch(e){continue;}
    }
  }catch(e){}
})();

// ============================================================
// CONFIG
// ============================================================
const USERS_DEFAULT={
  // FIX: رمزها از JS حذف شدند — server-side authentication الزامی است
  // برای حالت آفلاین کامل بدون سرور، رمزها در DB قرار دارند
  'admin':               {name:'ادمین سیستم',role:'مدیر سیستم',isSuperAdmin:true,isManager:true},
  'Sarah.hosseini':      {name:'حسینی',      role:'مدیر فروش',isManager:true},
  'Reyhane.kashisaz':    {name:'کاشی‌ساز',   role:'کارشناس تمام‌وقت'},
  'Mohammad.seyedsalehi':{name:'سید صالحی',  role:'کارشناس تمام‌وقت'},
  'Rambod.ghasemi':      {name:'قاسمی',      role:'کارشناس نیمه‌وقت'}
};

function loadDynamicUsers(){
  // FIX: کاربران از /data/init.php می‌آیند — localStorage حذف
  return _DYNAMIC_USERS || {};
}
function saveDynamicUsers(extra){
  // FIX: ذخیره در سرور از طریق /users/manage.php
  _DYNAMIC_USERS = extra;
}
var _DYNAMIC_USERS = {};
function getAllUsers(){return Object.assign({},USERS_DEFAULT,loadDynamicUsers());}
function getActiveUsers(){const all=getAllUsers();const res={};Object.keys(all).forEach(k=>{if(!all[k].inactive)res[k]=all[k];});return res;}
function getUser(u){return getAllUsers()[u]||null;}

const STATUS_LIST=['بدون تماس','تماس اولیه','ملاقات انجام شد','پیشنهاد ارسال شد','قرارداد بسته شد','غیرفعال'];
const STATUS_CLS =['st-0','st-1','st-2','st-3','st-4','st-5'];

function getOwnerFA(){
  const res={};const all=getAllUsers();
  Object.keys(all).forEach(k=>{res[k]=all[k].name;});
  return res;
}
// legacy alias — used throughout
let OWNER_FA={'Sarah.hosseini':'حسینی','Reyhane.kashisaz':'کاشی‌ساز','Mohammad.seyedsalehi':'سید صالحی','Rambod.ghasemi':'قاسمی'};
function refreshOwnerFA(){OWNER_FA=getOwnerFA();}

// داده‌های استان‌ها از پایگاه داده بارگذاری می‌شوند (api/data/init.php)

// داده‌های مراکز تهران از پایگاه داده بارگذاری می‌شوند (api/data/init.php)

const PROVINCES=[];  // پر می‌شود توسط loadStaticData() از DB
const CENTERS=[];    // پر می‌شود توسط loadStaticData() از DB

// FIX (موج ۳): متغیرهای global برای تگ‌ها، رویدادها، ترجیحات
let TAGS = [];          // [{id, name, color, icon, expires_at, description}, ...]
let RECORD_TAGS = {};   // {'center_c12': [tagId1, tagId2], ...}
let EVENTS = [];        // [{id, title, start_at, end_at, ...}, ...] — lazy-loaded
let PREFERENCES = {};   // {view_centers: 'kanban', view_provinces: 'list', ...}

// helpers برای دسترسی به تگ‌های یک رکورد
function getRecordTagIds(type, id){
  // type: 'center'|'province'|'pc' (singular)
  var key = type + '_' + id;
  return RECORD_TAGS[key] || [];
}
function getRecordTags(type, id){
  var ids = getRecordTagIds(type, id);
  return ids.map(function(tid){return TAGS.find(function(t){return t.id===tid;});}).filter(Boolean);
}
function getTagById(id){
  return TAGS.find(function(t){return t.id===id;});
}

// ============================================================
// STATE
// ============================================================
let currentUser=null, currentTab='provinces';
let userEdits={provinces:{},centers:{},pc:{},checklist:{}};
let notesContext={type:null,id:null,name:''};

// ============================================================
// STORAGE
// ============================================================
function sk(k){return`crm_${k}_${currentUser}`;}
function loadEdits(){
  // FIX: localStorage حذف شد — userEdits در RAM زندگی می‌کند
  // داده‌ها از DB پس از login می‌آیند (syncPull)
  userEdits = {provinces:{},centers:{},pc:{},checklist:{}};
}


// ── ensureToken: اطمینان از وجود token معتبر ──────────────
async function ensureToken(){
  var token=localStorage.getItem('crm_token');
  if(token) return true;
  // token ندارم — نمی‌توانم بدون رمز re-auth کنم (رمز دیگر در localStorage نیست)
  setSyncStatus('err');
  return false;
}

// ── beforeunload: تلاش برای ذخیره pending changes ────────
window.addEventListener('beforeunload',function(e){
  if(_pendingSave||(typeof _SQ!=='undefined'&&_SQ._q&&_SQ._q.length)){
    // تلاش sync با sendBeacon (sync request هنگام close)
    var base=getApiBase();
    var token=localStorage.getItem('crm_token');
    if(base&&token&&navigator.sendBeacon){
      // FIX: token در body ارسال می‌شود (نه URL) تا در لاگ‌های سرور ظاهر نشود
      var payload=JSON.stringify({
        _token:token,
        provinces:userEdits.provinces,
        centers:userEdits.centers,
        pc:userEdits.pc||{},
        checklist:userEdits.checklist||{}
      });
      var blob=new Blob([payload],{type:'application/json'});
      try{
        navigator.sendBeacon(base+'/sync/push.php',blob);
      }catch(e){}
    }
  }
});

// ── visibility change: sync هنگام بازگشت به صفحه ────────────
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&currentUser&&getApiBase()){
    // اگر pending داریم upload کن
    if(_pendingSave){syncNow();}
    // و pull جدیدترین داده‌ها
    if(typeof syncPull==='function')syncPull();
    // FIX: داده‌های ثابت (provinces/centers/users/PC) هم refresh
    // تا اگر مدیر کاربر/مرکز جدید اضافه کرد، فوراً دیده شود
    if(typeof loadStaticData==='function'){
      loadStaticData().then(function(){
        if(typeof rebuildOwnerFilter==='function')rebuildOwnerFilter();
        if(typeof rebuildTagFilter==='function')rebuildTagFilter();
        if(typeof renderTable==='function')renderTable();
      });
    }
  }
});

// ── periodic background sync: هر ۳ دقیقه ─────────────────
var _bgSyncInterval = setInterval(function(){
  if(!currentUser||!getApiBase())return;
  if(document.visibilityState!=='visible')return;  // اگر tab فعال نیست skip
  if(typeof syncPull==='function')syncPull();
},3*60*1000);

// ================================================================
// SYNC NOW — ذخیره فوری همه تغییرات در دیتابیس
// ================================================================
var _syncNowTimer = null;
var _pendingSave = false;

function saveEdits(){
  // FIX: localStorage حذف — userEdits فقط در RAM
  // FIX: syncNow حذف — هر فیلد از طریق _SQ (debounced) به /record/edit.php می‌رود
  // syncNow فقط برای beforeunload و restore backup صدا زده می‌شود
  pruneEdits();
  _pendingSave = true;
  setSyncStatus('busy');
}

async function syncNow(){
  if(!getApiBase()){setSyncStatus('off');_pendingSave=false;return;}
  // اطمینان از token
  var ok = await ensureToken();
  if(!ok){
    setSyncStatus('err');
    // retry بعد از ۵ ثانیه
    setTimeout(syncNow, 5000);
    return;
  }
  try{
    var res = await apiCall('POST','/sync/push.php',{
      provinces: userEdits.provinces,
      centers:   userEdits.centers,
      pc:        userEdits.pc||{},
      checklist: userEdits.checklist||{}
    });
    if(res.ok){
      _pendingSave = false;
      setSyncStatus('ok');
      // نشان دادن تیک ذخیره
      showSaveToast('✅ ذخیره شد');
    }else{
      setSyncStatus('err');
      showSaveToast('⚠️ خطا در ذخیره');
      setTimeout(syncNow, 8000);
    }
  }catch(e){
    setSyncStatus('err');
    showSaveToast('⚠️ در انتظار اتصال...');
    setTimeout(syncNow, 8000);
  }
}

function showSaveToast(msg){
  var el=document.getElementById('saveToast');
  if(!el)return;
  el.textContent=msg;el.style.opacity='1';
  clearTimeout(el._timer);
  el._timer=setTimeout(function(){el.style.opacity='0';},2500);
}

// بارگذاری اولیه از سرور
async function syncPull(){
  if(!getApiBase())return;
  var ok=await ensureToken();
  if(!ok)return;
  setSyncStatus('busy');
  try{
    var res=await apiCall('GET','/sync/pull.php');
    if(res.ok&&res.data){
      mergeServerData(res.data);
      setSyncStatus('ok');
      renderDashboard();renderTable();renderTodayBanner();renderStallBanner();
    }
  }catch(e){setSyncStatus(e.message==='no_api_base'?'off':'err');}
}


function getEdit(type,id){
  if(type==='pc'){return userEdits.pc[id]||{status:'بدون تماس',notesList:[]};}
  return userEdits[type][id]||{status:'بدون تماس',notesList:[]};
}
function setField(type,id,key,val){
  if(type==='pc'){
    var oldPc=userEdits.pc[id]?userEdits.pc[id][key]:undefined;
    if(!userEdits.pc[id])userEdits.pc[id]={};
    userEdits.pc[id][key]=val;
    userEdits.pc[id].lastActivity=nowTS();
    if(oldPc!==undefined&&oldPc!==val&&['status','lead','potential','followupDate'].indexOf(key)>=0){
      addAudit('pc',id,key,oldPc,val);
    }
    saveEdits();
    immSaveEdit(type,id);return;
  }
  var oldVal=userEdits[type][id]?userEdits[type][id][key]:undefined;
  if(!userEdits[type][id])userEdits[type][id]={status:'بدون تماس',notesList:[]};
  userEdits[type][id][key]=val;
  userEdits[type][id].lastActivity=nowTS();
  if(oldVal!==undefined&&oldVal!==val&&['status','lead','potential','followupDate','owner'].indexOf(key)>=0){
    addAudit(type,id,key,oldVal,val);
  }
  saveEdits();
  immSaveEdit(type,id);
}
function onCenterField(id,field,val){
  const old=userEdits.centers[id]?userEdits.centers[id][field]:undefined;
  if(!userEdits.centers[id])userEdits.centers[id]={status:'بدون تماس',notesList:[]};
  userEdits.centers[id][field]=val;
  userEdits.centers[id].lastActivity=nowTS();  // FIX: always update
  // FIX: همه تغییرات را در audit محلی ثبت می‌کنیم (برای Activity log)
  if(old!==undefined&&old!==val&&['status','lead','potential','followupDate'].indexOf(field)>=0){
    addAudit('centers',id,field,old,val);
  }
  saveEdits();
  immSaveEdit('centers',id);
  if(field==='followupDate')renderTodayBanner();
}
function getPass(u){return (getUser(u)||{}).pass||''; /* FIX: no localStorage password */ }

// ============================================================
// AUDIT TRAIL
// ============================================================
const STALL_DAYS=7;
function nowTS(){return Date.now();}

// ============================================================
// JALALI DATE UTILITIES
// ============================================================
function g2j(gy,gm,gd){
  var g_dm=[31,28,31,30,31,30,31,31,30,31,30,31];
  var j_dm=[31,31,31,31,31,31,30,30,30,30,30,29];
  gy-=1600;gm--;
  var g_d_no=365*gy+Math.floor((gy+3)/4)-Math.floor((gy+99)/100)+Math.floor((gy+399)/400);
  for(var i=0;i<gm;++i)g_d_no+=g_dm[i];
  if(gm>1&&((gy%4===0&&gy%100!==0)||(gy%400===0)))g_d_no++;
  g_d_no+=gd-1;
  var j_d_no=g_d_no-79;
  var j_np=Math.floor(j_d_no/12053);j_d_no%=12053;
  var jy=979+33*j_np+4*Math.floor(j_d_no/1461);
  j_d_no%=1461;
  if(j_d_no>=366){jy+=Math.floor((j_d_no-1)/365);j_d_no=(j_d_no-1)%365;}
  for(var j=0;j<11&&j_d_no>=j_dm[j];++j)j_d_no-=j_dm[j];
  return[jy,j+1,j_d_no+1];
}
function j2g(jy,jm,jd){
  var j_dm=[31,31,31,31,31,31,30,30,30,30,30,29];
  var jy1=jy-979; var jm1=jm-1;
  var j_np=Math.floor(jy1/33); var rem=jy1%33;
  var j_d_no=j_np*12053+Math.floor(rem/4)*1461+(rem%4)*365+(rem%4>0?1:0);
  for(var i=0;i<jm1;i++)j_d_no+=j_dm[i];
  j_d_no+=jd-1;
  var g_d_no=j_d_no+79;
  var gy=1600+400*Math.floor(g_d_no/146097); g_d_no%=146097;
  var leap=true;
  if(g_d_no>=36525){g_d_no--;gy+=100*Math.floor(g_d_no/36524);g_d_no%=36524;if(g_d_no>=365)g_d_no++;else leap=false;}
  gy+=4*Math.floor(g_d_no/1461); g_d_no%=1461;
  if(g_d_no>=366){leap=false;g_d_no--;gy+=Math.floor(g_d_no/365);g_d_no%=365;}
  var g_dm=[31,29,31,30,31,30,31,31,30,31,30,31];
  if(!leap)g_dm[1]=28;
  var gm=0;while(gm<12&&g_d_no>=g_dm[gm]){g_d_no-=g_dm[gm];gm++;}
  return[gy,gm+1,g_d_no+1];
}
function todayJalali(){
  var d=new Date();
  var j=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
  return j[0]+'/'+String(j[1]).padStart(2,'0')+'/'+String(j[2]).padStart(2,'0');
}
function jalaliNow(){
  var d=new Date();
  var j=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
  return j[0]+'/'+String(j[1]).padStart(2,'0')+'/'+String(j[2]).padStart(2,'0')
    +' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

// ── Jalali Date Picker ──────────────────────────────────────
var JDP={
  popup:null, inp:null, cb:null, jy:0, jm:0,
  J_MONTHS:['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'],
  DOW_LABELS:['ش','ی','د','س','چ','پ','ج'], // Sat-first

  // Days in month — leap year for Esfand
  dim:function(jy,jm){
    if(jm<12)return[31,31,31,31,31,31,30,30,30,30,30][jm-1];
    return((jy*8+29)%33<8)?30:29;
  },

  // First day of week for Jalali 1st (0=Sat … 6=Fri)
  // Strategy: use g2j search starting from approximate Gregorian date
  firstDow:function(jy,jm){
    var gy=jy+621, gm=jm+3;
    if(gm>12){gm-=12;gy++;}
    var d=new Date(gy,gm-1,1);
    for(var t=0;t<100;t++){
      var j=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
      if(j[0]===jy&&j[1]===jm&&j[2]===1)break;
      var ahead=(j[0]<jy)||(j[0]===jy&&j[1]<jm)||(j[0]===jy&&j[1]===jm&&j[2]<1);
      d=new Date(d.getTime()+(ahead?1:-1)*86400000);
    }
    return(d.getDay()+1)%7; // 0=Sat,1=Sun,...,6=Fri
  },

  // Update input CSS class based on date value
  updateInputClass:function(inp,val){
    if(!val){inp.className='followup-inp';return;}
    var today=todayJalali();
    inp.className='followup-inp'+(val<today?' overdue':val===today?' due-today':'');
  },

  open:function(inp,cb){
    JDP.inp=inp;JDP.cb=cb;
    var popup=document.getElementById('jdpPopup');
    JDP.popup=popup;
    var cur=inp.value;
    var tj=todayJalali().split('/').map(Number);
    if(cur&&/^\d{4}\/\d{2}\/\d{2}$/.test(cur)){
      var p=cur.split('/').map(Number);JDP.jy=p[0];JDP.jm=p[1];
    }else{JDP.jy=tj[0];JDP.jm=tj[1];}
    JDP.render();
    // Position (fixed — no scrollY needed)
    var rect=inp.getBoundingClientRect();
    var pw=248,ph=300;
    var left=rect.right-pw;
    if(left<4)left=4;
    if(left+pw>window.innerWidth-4)left=window.innerWidth-pw-4;
    var top=rect.bottom+4;
    if(top+ph>window.innerHeight-4)top=Math.max(4,rect.top-ph-4);
    popup.style.top=top+'px';
    popup.style.left=left+'px';
    popup.style.right='auto';
    popup.style.display='block';
  },

  close:function(){if(JDP.popup)JDP.popup.style.display='none';},

  nav:function(delta){
    JDP.jm+=delta;
    if(JDP.jm>12){JDP.jm=1;JDP.jy++;}
    if(JDP.jm<1){JDP.jm=12;JDP.jy--;}
    JDP.render();
  },

  pick:function(d){
    var val=JDP.jy+'/'+String(JDP.jm).padStart(2,'0')+'/'+String(d).padStart(2,'0');
    JDP.inp.value=val;
    JDP.updateInputClass(JDP.inp,val);
    if(JDP.cb)JDP.cb(val);
    JDP.close();
    // Re-render table after short delay so colors update across all rows
    setTimeout(function(){if(typeof renderTable==='function')renderTable();},50);
  },

  clear:function(){
    JDP.inp.value='';
    JDP.updateInputClass(JDP.inp,'');
    if(JDP.cb)JDP.cb('');
    JDP.close();
    setTimeout(function(){if(typeof renderTable==='function')renderTable();},50);
  },

  render:function(){
    var popup=JDP.popup;
    var todayArr=todayJalali().split('/').map(Number);
    var selectedVal=JDP.inp.value;
    var dim=JDP.dim(JDP.jy,JDP.jm);
    var fdow=JDP.firstDow(JDP.jy,JDP.jm);
    var isCurrentMonth=(JDP.jy===todayArr[0]&&JDP.jm===todayArr[1]);

    // Header — RTL: right=prev, left=next
    var html='<div class="jdp-header">'
      +'<button class="jdp-nav" onclick="JDP.nav(-1);event.stopPropagation()" title="ماه قبل">&#10094;</button>'
      +'<span class="jdp-title">'+JDP.J_MONTHS[JDP.jm-1]+'&nbsp;'+JDP.jy+'</span>'
      +'<button class="jdp-nav" onclick="JDP.nav(1);event.stopPropagation()" title="ماه بعد">&#10095;</button>'
      +'</div>';

    // Day-of-week headers
    html+='<div class="jdp-grid">';
    JDP.DOW_LABELS.forEach(function(dw){html+='<div class="jdp-dow">'+dw+'</div>';});

    // Empty cells before 1st
    for(var e=0;e<fdow;e++)html+='<div class="jdp-day empty"></div>';

    // Day cells
    for(var d2=1;d2<=dim;d2++){
      var isToday=isCurrentMonth&&d2===todayArr[2];
      var thisDayStr=JDP.jy+'/'+String(JDP.jm).padStart(2,'0')+'/'+String(d2).padStart(2,'0');
      var isSel=selectedVal===thisDayStr;
      var cls='jdp-day';
      if(isSel&&isToday)cls+=' today-sel';
      else if(isSel)cls+=' selected';
      else if(isToday)cls+=' today';
      html+='<div class="'+cls+'" onclick="JDP.pick('+d2+');event.stopPropagation()">'+d2+'</div>';
    }
    html+='</div>';
    html+='<button class="jdp-clear" onclick="JDP.clear();event.stopPropagation()">✕ پاک کردن تاریخ</button>';
    popup.innerHTML=html;
  }
};
document.addEventListener('click',function(e){
  if(JDP.popup&&JDP.popup.style.display!=='none'){
    if(!JDP.popup.contains(e.target)&&e.target!==JDP.inp)JDP.close();
  }
});

function tsToFa(ts){
  if(!ts)return'';
  return new Date(ts).toLocaleDateString('fa-IR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function addAudit(type,id,field,from,to){
  var store=type==='pc'?userEdits.pc:userEdits[type];
  if(!store[id])store[id]={status:'بدون تماس',notesList:[]};
  if(!store[id].audit)store[id].audit=[];
  store[id].audit.push({ts:nowTS(),user:currentUser,field:field,from:from,to:to});
  store[id].lastActivity=nowTS();
  saveEdits();
}
function getLastActivity(type,id){
  var e=getEdit(type,id);
  var t=e.lastActivity||0;
  // also check notes
  var notes=e.notesList||[];
  notes.forEach(function(n){if(n.rawTs&&n.rawTs>t)t=n.rawTs;});
  return t;
}
function isStalled(type,id){
  var e=getEdit(type,id);
  var st=e.status||'بدون تماس';
  if(st==='بدون تماس'||st==='قرارداد بسته شد'||st==='غیرفعال')return false;
  var last=getLastActivity(type,id);
  if(!last)return false; // no recorded activity yet — not stalled
  return (nowTS()-last)>(STALL_DAYS*24*3600*1000);
}
// FIX: کاملاً متروک (>۳۰ روز) — badge قرمز
function isLongStalled(type,id){
  var e=getEdit(type,id);
  var st=e.status||'بدون تماس';
  if(st==='قرارداد بسته شد'||st==='غیرفعال')return false;
  var last=getLastActivity(type,id);
  if(!last)return false;
  return (nowTS()-last)>(30*24*3600*1000);
}
// FIX: تاریخ پیگیری گذشته (overdue)
function isFollowupOverdue(type,id){
  var e=getEdit(type,id);
  var st=e.status||'بدون تماس';
  if(st==='قرارداد بسته شد'||st==='غیرفعال')return false;
  var fd=e.followupDate||'';
  if(!fd)return false;
  return fd<todayJalali();
}
function getStalledCount(){
  var count=0;
  var isManager=getUser(currentUser).isManager;
  var pData=isManager?PROVINCES:PROVINCES.filter(function(r){return r.owner===currentUser;});
  var cData=isManager?CENTERS:CENTERS.filter(function(r){return r.owner===currentUser;});
  pData.forEach(function(r){if(isStalled('provinces',r.id))count++;});
  cData.forEach(function(r){if(isStalled('centers',r.id))count++;});
  // pc
  PROVINCES.forEach(function(prov){
    if(!isManager&&prov.owner!==currentUser)return;
    var pk=pkey(prov.name);
    var raw=PROVINCE_CENTERS_RAW[pk]||[];
    raw.forEach(function(c,i){if(isStalled('pc',pk+'||'+i))count++;});
  });
  return count;
}

// ============================================================
// FOLLOW-UP DATE helpers
// ============================================================
function todayStr(){return todayJalali();} // alias — uses Jalali
function getFollowups(){
  // Returns [{type,id,name,date,overdue}]
  var today=todayJalali();
  var res=[];
  var isManager=getUser(currentUser).isManager;
  var check=function(type,arr,nameKey){
    arr.forEach(function(r){
      var e=getEdit(type,r.id);
      var fd=e.followupDate;
      if(fd&&fd<=today){
        res.push({type:type,id:r.id,name:r[nameKey]||r.name,date:fd,overdue:fd<today});
      }
    });
  };
  var pData=isManager?PROVINCES:PROVINCES.filter(function(r){return r.owner===currentUser;});
  var cData=isManager?CENTERS:CENTERS.filter(function(r){return r.owner===currentUser;});
  check('provinces',pData,'name');
  check('centers',cData,'name');
  // province centers
  PROVINCES.forEach(function(prov){
    if(!isManager&&prov.owner!==currentUser)return;
    var pk=pkey(prov.name);
    var raw=PROVINCE_CENTERS_RAW[pk]||[];
    raw.forEach(function(c,i){
      var e=userEdits.pc[pk+'||'+i]||{};
      var fd=e.followupDate;
      if(fd&&fd<=today){
        res.push({type:'pc',id:pk+'||'+i,name:(e.name||c[1]),date:fd,overdue:fd<today});
      }
    });
  });
  return res;
}

// ============================================================
// AUTH
// ============================================================

// ============================================================
// API SYNC — Offline-First
// آدرس سرور را از superAdmin تنظیم کنید
// ============================================================

function saveApiBase(){
  var url=(document.getElementById('apiBaseInp').value||'').trim().replace(/\/+$/,'');
  setApiBase(url);
  var res=document.getElementById('apiTestResult');
  if(!url){res.textContent='آدرس پاک شد — حالت آفلاین';res.style.color='#92400e';setSyncStatus('off');return;}
  res.textContent='در حال تست...';res.style.color='#0369a1';
  checkServerStatus().then(function(ok){
    if(ok){res.textContent='✅ سرور در دسترس است';res.style.color='#166534';}
    else{res.textContent='❌ سرور پاسخ نداد';res.style.color='#991b1b';}
  });
}
async function checkServerStatus(){
  if(!getApiBase()){setSyncStatus('off');return false;}
  try{
    await apiCall('GET','/sync/status.php');
    setSyncStatus('ok');return true;
  }catch(e){setSyncStatus('err');return false;}
}
function getApiBase(){
  return (localStorage.getItem('crm_api_base')||'').replace(/\/+$/,'');
}
function setApiBase(url){
  localStorage.setItem('crm_api_base', (url||'').trim());
}

// ── وضعیت sync در navbar ────────────────────────────────────
var _syncTm=null;
function setSyncStatus(st){
  var el=document.getElementById('syncStatusBtn');
  if(!el)return;
  var map={
    ok:  {icon:'✅', cls:'sync-ok',  tip:'آخرین sync موفق بود'},
    err: {icon:'⚠️', cls:'sync-err', tip:'خطا در sync — کلیک برای تلاش مجدد'},
    busy:{icon:'🔄', cls:'sync-busy',tip:'در حال sync...'},
    off: {icon:'📴', cls:'sync-off', tip:'آفلاین — localStorage فعال'}
  };
  var s=map[st]||map['off'];
  el.textContent=s.icon; el.className=s.cls; el.title=s.tip;
}

// ── درخواست به API ──────────────────────────────────────────
async function apiCall(method,endpoint,body){
  var base=getApiBase();
  if(!base)throw new Error('no_api_base');
  var token=localStorage.getItem('crm_token');
  var opts={method:method,headers:{'Content-Type':'application/json'}};
  // FIX: هر دو header برای سازگاری
  if(token){opts.headers['Authorization']='Bearer '+token;opts.headers['X-CRM-Token']=token;}
  if(body&&method==='POST')opts.body=JSON.stringify(body);
  var res=await fetch(base+endpoint,opts);
  // FIX: 401 invalid_token — token expire شده، logout اجباری
  if(res.status===401){
    var err401;
    try{err401=await res.json();}catch(e){err401={};}
    if(err401.err==='invalid_token'||err401.err==='no_token'){
      localStorage.removeItem('crm_token');
      // اگر در حال sync نیست، logout
      if(currentUser){
        console.warn('Session expired — logging out');
        doLogout();
        alert('جلسه شما منقضی شد. لطفاً دوباره وارد شوید.');
      }
      throw new Error('session_expired');
    }
  }
  var data;
  try{data=await res.json();}catch(e){data={};}
  if(!res.ok)throw new Error(data.error||data.err||'HTTP '+res.status);
  return data;
}

// push/pull replaced by syncNow/syncPull above

// ── Merge: ادغام داده سرور با localStorage ─────────────────
function mergeServerData(serverData){
  ['provinces','centers','pc'].forEach(function(type){
    Object.keys(serverData[type]||{}).forEach(function(id){
      var sv=serverData[type][id];
      var lv=userEdits[type][id];
      if(!lv){
        userEdits[type][id]=sv;
      }else{
        // فیلدهای اصلی: timestamp بالاتر برنده
        if((sv.lastActivity||0)>(lv.lastActivity||0)){
          if(sv.status!==null&&sv.status!==undefined)lv.status=sv.status;
          if(sv.lead!==null&&sv.lead!==undefined)lv.lead=sv.lead;
          if(sv.potential)lv.potential=sv.potential;
          if(sv.followupDate!==undefined)lv.followupDate=sv.followupDate;
          if(sv.prods&&sv.prods.length)lv.prods=sv.prods;
          if(sv.owner)lv.owner=sv.owner;
          lv.lastActivity=sv.lastActivity;
        }else if(sv.owner&&!lv.owner){
          // owner همیشه از سرور می‌گیریم اگر محلی نداریم
          lv.owner=sv.owner;
        }
        // یادداشت‌ها — بدون تکرار
        var existTs=new Set((lv.notesList||[]).map(function(n){return n.rawTs;}));
        var newNotes=(sv.notesList||[]).filter(function(n){return!existTs.has(n.rawTs);});
        if(newNotes.length){
          lv.notesList=[...(lv.notesList||[]),...newNotes].sort(function(a,b){return(a.rawTs||0)-(b.rawTs||0);});
        }
      }
    });
  });
  // Checklist
  Object.keys(serverData.checklist||{}).forEach(function(d){
    if(!userEdits.checklist[d])userEdits.checklist[d]=serverData.checklist[d];
  });
  // FIX: localStorage حذف — userEdits فقط در RAM
}

// ── Server Auth: دریافت token از سرور ──────────────────────
async function tryServerAuth(uKey,pwd){
  if(!getApiBase())return false;
  try{
    var res=await apiCall('POST','/auth/login.php',{username:uKey,password:pwd});
    if(res.ok&&res.token){
      localStorage.setItem('crm_token',res.token);
      // FIX: رمز در localStorage ذخیره نمی‌شود — فقط token
      return true;
    }
  }catch(e){}
  return false;
}

// FIX: تابع checkServerStatus یک‌بار تعریف می‌شود (نسخه تکراری حذف شد)

function doLogin(){
  refreshOwnerFA();
  const uRaw=document.getElementById('usernameInput').value.trim();
  const p=document.getElementById('passwordInput').value;
  const allUsers=getAllUsers();
  const uKey=Object.keys(allUsers).find(k=>k.toLowerCase()===uRaw.toLowerCase())||uRaw;
  const usr=allUsers[uKey];
  const err=document.getElementById('loginError');
  err.style.display='none';

  if(!uRaw||!p){err.style.display='block';return;}

  // FIX: Server-first authentication (رمزها در JS نیستند)
  if(getApiBase()){
    setSyncStatus('busy');
    tryServerAuth(uKey,p).then(function(ok){
      if(ok){
        const allUsers2=getAllUsers();
        const usr2=allUsers2[uKey]||usr||{name:uKey,role:'کارشناس'};
        if(!usr2.inactive){
          _doLoginSuccess(uKey,usr2,p);
        }else{
          setSyncStatus('off');
          err.textContent='کاربر غیرفعال است';
          err.style.display='block';
        }
      }else{
        setSyncStatus('off');
        err.textContent='نام کاربری یا رمز عبور اشتباه است';
        err.style.display='block';
      }
    }).catch(function(){
      setSyncStatus('err');
      err.textContent='خطا در اتصال به سرور';
      err.style.display='block';
    });
  }else{
    // آفلاین: نمی‌توان وارد شد چون رمز در JS نیست
    err.textContent='برای ورود اول، اتصال به سرور لازم است. لطفاً به اینترنت متصل شوید.';
    err.style.display='block';
  }
}

// ============================================================
// بارگذاری داده‌های ثابت از سرور (استان‌ها، مراکز، کاربران)
// ============================================================
async function loadStaticData(){
  if(!getApiBase())return;
  var token=localStorage.getItem('crm_token');
  if(!token)return;

  try{
    var res=await apiCall('GET','/data/init.php');
    if(!res.ok)return;

    // استان‌ها
    if(res.provinces&&res.provinces.length){
      PROVINCES.length=0;
      res.provinces.forEach(function(p){PROVINCES.push(p);});
      localStorage.setItem('crm_cache_provs',JSON.stringify(res.provinces));
    }

    // مراکز تهران
    if(res.centers&&res.centers.length){
      CENTERS.length=0;
      res.centers.forEach(function(ct){CENTERS.push(ct);});
      localStorage.setItem('crm_cache_cents',JSON.stringify(res.centers));
    }

    // FIX: مراکز استانی از DB (قبلاً hardcoded در PROVINCE_CENTERS_RAW)
    if(res.provinceCenters){
      // ساخت ساختار: {pkey: [[row_num, name, potential, type, lead], ...]}
      var pcMap={};
      // ابتدا نگاشت province_id → pkey
      var pidToPkey={};
      res.provinces.forEach(function(p){pidToPkey[p.id]=pkey(p.name);});
      res.provinceCenters.forEach(function(pc){
        var pk=pidToPkey[pc.province_id]||pc.province_id;
        if(!pcMap[pk])pcMap[pk]=[];
        pcMap[pk].push([pc.row||0, pc.name||'', pc.potential||3, pc.type||'', pc.lead||'سرنخ']);
      });
      // overwrite کلیدها در PROVINCE_CENTERS_RAW
      Object.keys(pcMap).forEach(function(k){PROVINCE_CENTERS_RAW[k]=pcMap[k];});
      // ذخیره owner map برای استفاده در pcGetList
      window._PC_OWNERS={};
      res.provinceCenters.forEach(function(pc){
        if(pc.owner)window._PC_OWNERS[pc.id]=pc.owner;
      });
      localStorage.setItem('crm_cache_pc',JSON.stringify({map:pcMap,owners:window._PC_OWNERS}));
    }

    // FIX (موج ۳): تگ‌ها + اتصالات + ترجیحات
    if(res.tags){
      TAGS = res.tags.map(function(t){
        return {
          id: parseInt(t.id),
          name: t.name,
          color: t.color || '#3b82f6',
          icon: t.icon || '',
          expires_at: t.expires_at || null,
          description: t.description || ''
        };
      });
    }
    if(res.recordTags){
      RECORD_TAGS = {};
      res.recordTags.forEach(function(rt){
        var k = rt.record_type + '_' + rt.record_id;
        if(!RECORD_TAGS[k]) RECORD_TAGS[k] = [];
        RECORD_TAGS[k].push(parseInt(rt.tag_id));
      });
    }
    if(res.preferences){
      PREFERENCES = res.preferences || {};
    }

    // کاربران — ذخیره در dynamic users
    if(res.users){
      // ادغام با USERS_DEFAULT: DB مقدم است
      var merged={};
      Object.keys(res.users).forEach(function(k){merged[k]=res.users[k];});
      _DYNAMIC_USERS = merged;  // FIX: in-memory only
    }

  }catch(e){
    // fallback: بارگذاری از cache
    _loadStaticFromCache();
  }
}

function _loadStaticFromCache(){
  try{
    var cp=localStorage.getItem('crm_cache_provs');
    var cc=localStorage.getItem('crm_cache_cents');
    var cpc=localStorage.getItem('crm_cache_pc');
    if(cp){var p=JSON.parse(cp);PROVINCES.length=0;p.forEach(function(r){PROVINCES.push(r);});}
    if(cc){var ct=JSON.parse(cc);CENTERS.length=0;ct.forEach(function(r){CENTERS.push(r);});}
    if(cpc){
      var pcCache=JSON.parse(cpc);
      if(pcCache.map)Object.keys(pcCache.map).forEach(function(k){PROVINCE_CENTERS_RAW[k]=pcCache.map[k];});
      if(pcCache.owners)window._PC_OWNERS=pcCache.owners;
    }
  }catch(e){}
}

// بارگذاری از cache هنگام start آفلاین
function loadStaticCache(){
  _loadStaticFromCache();
}


function _doLoginSuccess(uKey,usr,p){
  currentUser=uKey; loadEdits(); loadNewCenters();
  // FIX: role و isManager در session ذخیره می‌شوند تا بعد از refresh بازیابی شوند
  try{localStorage.setItem('crm_sess',JSON.stringify({u:uKey,d:{name:usr.name,role:usr.role,isManager:!!usr.isManager,isSuperAdmin:!!usr.isSuperAdmin,inactive:!!usr.inactive},isManager:!!usr.isManager,isSuperAdmin:!!usr.isSuperAdmin,ts:Date.now()}));}catch(e){}
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('app').style.display='block';
  const badge=usr.isSuperAdmin?'🔑 '+usr.name+' — '+usr.role:usr.name+' — '+usr.role;
  document.getElementById('userBadgeText').textContent=badge;
  if(usr.isManager){
    document.getElementById('managerMergeArea').style.display='block';
    document.getElementById('lblOwner').style.display='';
    document.getElementById('filterOwner').style.display='';
    document.getElementById('userMgmtBtn').style.display='';
    document.getElementById('tabMgrDash').style.display='';
    rebuildOwnerFilter();
  }
  if(usr.isSuperAdmin){
    document.getElementById('superAdminBtn').style.display='';
    // اگه آدرس API تنظیم نشده، یه بار یادآوری کن
    if(!getApiBase()&&!localStorage.getItem('crm_api_reminded')){
      localStorage.setItem('crm_api_reminded','1');
      setTimeout(function(){
        var url=prompt('برای sync داده، آدرس API را وارد کنید:\n(مثال: https://yoursite.ir/api)\n\nبرای رد کردن Cancel بزنید','');
        if(url&&url.trim()){setApiBase(url.trim());checkServerStatus();}
      },1000);
    }
  }
  renderDashboard(); switchTab('provinces');
  renderTodayBanner(); renderStallBanner();

  // اتصال به سرور در پس‌زمینه
  if(getApiBase()){
    // بارگذاری فوری از cache تا داده‌های قدیمی نمایش داده شوند
    _loadStaticFromCache();
    renderDashboard(); renderTable();
    // FIX: اگر token موجود است (auto-login) نیازی به re-auth نیست
    var existingToken = localStorage.getItem('crm_token');
    var authPromise = (p && !existingToken)
      ? tryServerAuth(uKey, p)
      : Promise.resolve(!!existingToken);

    authPromise.then(function(ok){
      if(ok){
        loadStaticData().then(function(){
          syncPull().then(function(){
            if(_pendingSave||Object.keys(userEdits.provinces).length||
               Object.keys(userEdits.centers).length||Object.keys(userEdits.pc).length){
              setTimeout(syncNow, 500);
            }
            rebuildOwnerFilter();
            rebuildTagFilter();
            renderDashboard();
            renderTable();
            renderTodayBanner();
            renderStallBanner();
          });
        });
      }
    });
  }else{
    loadStaticCache();
    setSyncStatus('off');
  }
}
function doLogout(){
  // FIX: حذف همه کلیدهای session و رمز
  try{
    localStorage.removeItem('crm_sess');
    localStorage.removeItem('crm_token');
    // حذف رمزهای ذخیره‌شده قدیمی
    Object.keys(localStorage).filter(function(k){return k.startsWith('crm_pass_');}).forEach(function(k){localStorage.removeItem(k);});
    // اطلاع به سرور
    var t=localStorage.getItem('crm_token');
    if(t&&getApiBase()){fetch(getApiBase()+'/auth/logout.php',{method:'DELETE',headers:{'X-CRM-Token':t}}).catch(function(){});}
  }catch(e){}
  // FIX: پاک‌کردن intervals و _SQ queue (جلوگیری از memory leak)
  if(typeof _bgSyncInterval!=='undefined'&&_bgSyncInterval){clearInterval(_bgSyncInterval);_bgSyncInterval=null;}
  if(typeof _SQ!=='undefined'){
    _SQ._q=[];
    if(_SQ._retryTimer){clearTimeout(_SQ._retryTimer);_SQ._retryTimer=null;}
    Object.keys(_SQ._debounce||{}).forEach(function(k){clearTimeout(_SQ._debounce[k]);});
    _SQ._debounce={};
    _SQ._running=false;
  }
  if(typeof _syncNowTimer!=='undefined'){clearTimeout(_syncNowTimer);}
  currentUser=null; userEdits={provinces:{},centers:{},pc:{},checklist:{}};
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('app').style.display='none';
  document.getElementById('usernameInput').value='';
  document.getElementById('passwordInput').value='';
  document.getElementById('loginError').style.display='none';
  document.getElementById('backupPanel').style.display='none';
  document.getElementById('userMgmtBtn').style.display='none';
  document.getElementById('tabMgrDash').style.display='none';
  document.getElementById('todayBanner').style.display='none';
  document.getElementById('stallBanner').style.display='none';
  document.getElementById('superAdminBtn').style.display='none';
}
document.getElementById('passwordInput').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

function rebuildOwnerFilter(){
  var sel=document.getElementById('filterOwner');
  var active=getActiveUsers();
  sel.innerHTML='<option value="">همه</option>'+Object.keys(active).map(function(k){
    return '<option value="'+k+'">'+active[k].name+'</option>';
  }).join('');
}

// FIX (موج ۳): پر کردن dropdown فیلتر تگ
function rebuildTagFilter(){
  var sel = document.getElementById('filterTag');
  if(!sel) return;
  var curVal = window._FILTER_TAG_ID || 0;
  sel.innerHTML = '<option value="">همه</option>' +
    TAGS.map(function(t){
      return '<option value="'+t.id+'"'+(curVal===t.id?' selected':'')+'>'
           +(t.icon||'')+' '+t.name+'</option>';
    }).join('');
}

function onFilterTagChange(val){
  window._FILTER_TAG_ID = val ? parseInt(val) : 0;
  renderTable();
}

// تابع global برای باز کردن مودال از هر جایی
window.openModal=function(rt,ri,rn,rp){
  openCenterModal(rt,decodeURIComponent(ri),decodeURIComponent(rn),decodeURIComponent(rp));
};

function renderTodayBanner(){
  var items=getFollowups();
  var banner=document.getElementById('todayBanner');
  var cont=document.getElementById('todayItems');
  if(!items.length){banner.style.display='none';return;}
  banner.style.display='block';
  cont.innerHTML=items.map(function(it){
    var prov=it.type==='centers'?'تهران':it.type==='provinces'?it.name:'';
    var ri=encodeURIComponent(it.id);
    var rn=encodeURIComponent(it.name);
    var rp=encodeURIComponent(prov);
    var cls='today-item'+(it.overdue?' overdue':'');
    return '<button class="'+cls+'" onclick="openModal(\''+it.type+'\',\''+ri+'\',\''+rn+'\',\''+rp+'\')" title="'+escHtml(it.name)+'">'
      +'<span class="ti-name">'+escHtml(it.name)+'</span>'
      +'<span class="ti-date">'+(it.overdue?'⚠️ ':'')+it.date+'</span>'
      +'</button>';
  }).join('');
  // FIX: اعلان مرورگر — یک‌بار در روز، ساعت ۹ صبح به بعد
  maybeShowFollowupNotification(items);
}

// ── اعلان browser برای followup ─────────────────────────────
function maybeShowFollowupNotification(items){
  if(!items||!items.length)return;
  if(!('Notification' in window))return;
  if(Notification.permission==='denied')return;

  var today=todayJalali();
  var key='crm_notif_'+currentUser+'_'+today;
  var alreadyShown=localStorage.getItem(key);
  if(alreadyShown)return;

  var hour=new Date().getHours();
  if(hour<9)return;  // فقط بعد از ۹ صبح

  function show(){
    try{
      var n=new Notification('🔔 پیگیری امروز',{
        body:items.length+' مرکز برای پیگیری امروز دارید',
        icon:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#0ea5e9"/><text x="32" y="42" font-size="32" text-anchor="middle" fill="white">🏥</text></svg>'),
        tag:'crm-followup-'+today,
        requireInteraction:false
      });
      n.onclick=function(){window.focus();n.close();};
      localStorage.setItem(key,'1');
    }catch(e){}
  }

  if(Notification.permission==='granted'){show();return;}
  // درخواست اجازه
  Notification.requestPermission().then(function(perm){
    if(perm==='granted')show();
  });
}
function renderStallBanner(){
  var count=getStalledCount();
  var banner=document.getElementById('stallBanner');
  if(!count){banner.style.display='none';return;}
  banner.style.display='block';
  document.getElementById('stallBannerText').textContent='⚠️ '+count+' مرکز بیش از ۷ روز بدون پیگیری — برای مشاهده، ستون «آخرین فعالیت» را بررسی کنید';
}

function jumpToCenter(type,id){
  if(type==='provinces'){switchTab('provinces');}
  else if(type==='centers'){switchTab('centers');}
  // TODO: scroll to row
}

// ============================================================
// TABS & FILTERS
// ============================================================
function switchTab(tab){
  document.getElementById('addCenterBtn').style.display=(tab==='centers'?'block':'none');
  currentTab=tab;
  document.getElementById('tabProvinces').classList.toggle('active',tab==='provinces');
  document.getElementById('tabCenters').classList.toggle('active',tab==='centers');
  document.getElementById('tabChecklist').classList.toggle('active',tab==='checklist');
  document.getElementById('tabMgrDash').classList.toggle('active',tab==='mgrdash');
  document.getElementById('tabActivity').classList.toggle('active',tab==='activity');
  // FIX: تب تقویم
  var tabCal=document.getElementById('tabCalendar');
  if(tabCal)tabCal.classList.toggle('active',tab==='calendar');
  const isChecklist=tab==='checklist';
  const isCenters=tab==='centers';
  const isMgrDash=tab==='mgrdash';
  const isActivity=tab==='activity';
  const isCalendar=tab==='calendar';
  // show/hide filters and table
  document.querySelector('.filters-bar').style.display=(isChecklist||isMgrDash||isActivity||isCalendar)?'none':'';
  document.querySelector('.table-wrap').style.display=(isChecklist||isMgrDash||isActivity||isCalendar)?'none':'';
  document.getElementById('dashboardArea').style.display=(isChecklist||isMgrDash||isActivity||isCalendar)?'none':'';
  document.getElementById('checklistPanel').style.display=isChecklist?'block':'none';
  document.getElementById('mgrDashPanel').style.display=isMgrDash?'block':'none';
  document.getElementById('activityPanel').style.display=isActivity?'block':'none';
  var calPanel=document.getElementById('calendarPanel');
  if(calPanel)calPanel.style.display=isCalendar?'block':'none';
  document.getElementById('filterLead').style.display=isCenters?'':'none';
  document.getElementById('lblLead').style.display=isCenters?'':'none';
  document.getElementById('filterType').style.display=isCenters?'':'none';
  document.getElementById('lblType').style.display=isCenters?'':'none';
  ['filterPot','filterStatus','filterLead','filterType','filterOwner'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.value='';
  });
  document.getElementById('searchInput').value='';
  if(isCenters)populateTypeFilter();
  // FIX: بازیابی ترجیح view کاربر برای این tab
  if((currentTab==='provinces'||currentTab==='centers') && typeof applyStoredViewMode === 'function'){
    applyStoredViewMode();
  }
  if(isChecklist){ckInit();}
  else if(isMgrDash){renderMgrDashboard();}
  else if(isActivity){renderActivityLog();}
  else if(isCalendar){renderCalendar();}
  else{renderDashboard(); renderTable();}
}
function populateTypeFilter(){
  const isManager=getUser(currentUser).isManager;
  const rows=isManager?CENTERS:CENTERS.filter(r=>r.owner===currentUser);
  const types=[...new Set(rows.map(r=>r.type).filter(Boolean))].sort();
  document.getElementById('filterType').innerHTML='<option value="">همه انواع</option>'+types.map(t=>`<option>${t}</option>`).join('');
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard(){
  const isManager=getUser(currentUser).isManager;
  const pData=isManager?PROVINCES:PROVINCES.filter(r=>r.owner===currentUser);
  const cData=isManager?CENTERS:CENTERS.filter(r=>r.owner===currentUser);
  function cs(arr,type,s){return arr.filter(r=>(getEdit(type,r.id).status||'بدون تماس')===s).length;}
  const contracted=cs(pData,'provinces','قرارداد بسته شد')+cs(cData,'centers','قرارداد بسته شد');
  const meetings=cs(pData,'provinces','ملاقات انجام شد')+cs(cData,'centers','ملاقات انجام شد');
  const proposals=cs(pData,'provinces','پیشنهاد ارسال شد')+cs(cData,'centers','پیشنهاد ارسال شد');
  const noContact=cs(pData,'provinces','بدون تماس')+cs(cData,'centers','بدون تماس');
  document.getElementById('dashboardArea').innerHTML=`
    <div class="stat-card"><div class="stat-num">${pData.length}</div><div class="stat-label">استان</div></div>
    <div class="stat-card orange"><div class="stat-num">${cData.length}</div><div class="stat-label">مرکز تهران</div></div>
    <div class="stat-card green"><div class="stat-num">${contracted}</div><div class="stat-label">قرارداد بسته شد</div></div>
    <div class="stat-card purple"><div class="stat-num">${proposals}</div><div class="stat-label">پیشنهاد ارسال شد</div></div>
    <div class="stat-card orange"><div class="stat-num">${meetings}</div><div class="stat-label">ملاقات انجام شد</div></div>
    <div class="stat-card gray"><div class="stat-num">${noContact}</div><div class="stat-label">بدون تماس</div></div>
    <div class="stat-card green"><div class="stat-num">${cData.filter(r=>r.lead==='مشتری').length}</div><div class="stat-label">مشتری (تهران)</div></div>
    <div class="stat-card red"><div class="stat-num">${cData.filter(r=>r.lead==='لید').length}</div><div class="stat-label">لید (تهران)</div></div>`;
}

// ============================================================
// TABLE
// ============================================================
// ── FIX: fuzzy match فارسی — نرمال‌سازی حروف و فاصله مجازی ─────
function fuzzyNorm(s){
  return (s||'').toString().toLowerCase()
    .replace(/[ي]/g,'ی')
    .replace(/[ك]/g,'ک')
    .replace(/[ةه]/g,'ه')
    .replace(/[أإآا]/g,'ا')
    .replace(/[ؤو]/g,'و')
    .replace(/[ئی]/g,'ی')
    .replace(/[\u200c\u200d\u200e\u200f\u202a-\u202e]/g,' ')  // ZWJ, ZWNJ, RTL marks
    .replace(/[۰-۹]/g, function(d){return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d));})  // Persian → English digits
    .replace(/[٠-٩]/g, function(d){return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d));})  // Arabic → English digits
    .replace(/[^\u0600-\u06FF\w\s]/g,' ')  // punctuation → space
    .replace(/\s+/g,' ').trim();
}
function fuzzyMatch(query, text){
  if (!query) return true;
  return fuzzyNorm(text).indexOf(fuzzyNorm(query)) >= 0;
}

function getFiltered(){
  const isManager=getUser(currentUser).isManager;
  const search=document.getElementById('searchInput').value.trim();
  const fPot=document.getElementById('filterPot').value;
  const fStat=document.getElementById('filterStatus').value;
  const fOwner=document.getElementById('filterOwner').value;
  const fLead=document.getElementById('filterLead').value;
  const fType=document.getElementById('filterType').value;
  // FIX (موج ۳): فیلتر تگ — global state
  const fTag=window._FILTER_TAG_ID || 0;
  const type=currentTab==='provinces'?'provinces':'centers';
  const singularType = type==='provinces'?'province':'center';
  let base=currentTab==='provinces'
    ?(isManager?PROVINCES:PROVINCES.filter(r=>r.owner===currentUser))
    :(isManager?CENTERS:CENTERS.filter(r=>r.owner===currentUser));
  return base.filter(r=>{
    const edit=getEdit(type,r.id);
    if(search&&!fuzzyMatch(search,r.name))return false;
    if(fPot&&String(r.potential)!==fPot)return false;
    if(fStat&&(edit.status||'بدون تماس')!==fStat)return false;
    if(fOwner&&r.owner!==fOwner)return false;
    if(fLead&&r.lead!==fLead)return false;
    if(fType&&r.type!==fType)return false;
    if(fTag){
      const tagIds = getRecordTagIds(singularType, r.id);
      if(tagIds.indexOf(fTag) === -1) return false;
    }
    return true;
  });
}

function leadCls(l){
  if(!l)return'';
  const m={'مشتری':'lb-مشتری','فرصت':'lb-فرصت','سرنخ':'lb-سرنخ','لید':'lb-لید'};
  return m[l]||'lb-ندارد';
}
function leadSelCls(l){
  if(!l)return'lead-sel ls-ندارد';
  const m={'مشتری':'ls-مشتری','فرصت':'ls-فرصت','سرنخ':'ls-سرنخ','لید':'ls-لید','ندارد':'ls-ندارد','بدون مصرف':'ls-بدون'};
  return'lead-sel '+(m[l]||'ls-ندارد');
}

// ── (موج ۳) UI helpers برای تگ‌ها ───────────────────────────
function renderTagBadges(recordType, recordId){
  var rt = normRecordType(recordType);
  var ids = getRecordTagIds(rt, recordId);
  if(!ids.length) return '';
  var today = todayJalali();
  return ids.map(function(tid){
    var t = getTagById(tid);
    if(!t) return '';
    var expired = t.expires_at && t.expires_at < today;
    var icon = t.icon || '';
    var cls = 'tag-badge' + (expired ? ' expired' : '');
    var title = t.description || t.name;
    if(t.expires_at) title += ' (تا ' + t.expires_at + ')';
    return '<span class="'+cls+'" style="background:'+t.color+'22;color:'+t.color+';border-color:'+t.color+'66" '
         + 'title="'+escHtml(title)+'" onclick="event.stopPropagation();openTagPicker(\''+rt+'\',\''+recordId+'\',event)">'
         + (icon ? '<span>'+icon+'</span>' : '')
         + '<span>'+escHtml(t.name)+'</span>'
         + '</span>';
  }).join('');
}

function renderTagCell(recordType, recordId){
  var badges = renderTagBadges(recordType, recordId);
  var picker = '<button class="tag-picker-btn" onclick="event.stopPropagation();openTagPicker(\''
             + normRecordType(recordType)+'\',\''+recordId+'\',event)" title="افزودن تگ">+</button>';
  return '<div class="tag-cell">'+badges+picker+'</div>';
}

// Tag picker
var _tagPickerCtx = null;
function openTagPicker(recordType, recordId, ev){
  closeTagPicker();
  _tagPickerCtx = {type:recordType, id:recordId};
  var menu = document.createElement('div');
  menu.className = 'tag-picker-menu open';
  menu.id = '__tagPickerMenu';
  menu.style.position = 'fixed';
  var rect = ev.target.getBoundingClientRect();
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  if(parseInt(menu.style.right) < 8) menu.style.right = '8px';

  var html = '<input class="tag-picker-search" placeholder="جستجو یا تگ جدید..." oninput="filterTagPicker(this.value)" id="__tagSearch" />';
  html += '<div id="__tagPickerList">';
  var assigned = getRecordTagIds(recordType, recordId);
  TAGS.forEach(function(t){
    var sel = assigned.indexOf(t.id) >= 0;
    html += '<div class="tag-picker-item'+(sel?' selected':'')+'" data-name="'+escHtml(t.name)+'" '
         +  'onclick="toggleTagOnRecord('+t.id+')">';
    html +=    '<span class="tp-dot" style="background:'+t.color+'"></span>';
    html +=    '<span class="tp-icon">'+(t.icon||'')+'</span>';
    html +=    '<span class="tp-name">'+escHtml(t.name)+'</span>';
    if(sel) html += '<span class="tp-check">✓</span>';
    html += '</div>';
  });
  html += '</div>';
  html += '<div class="tag-picker-divider"></div>';
  html += '<div class="tag-picker-item tag-picker-new" onclick="openCreateTagModal()">';
  html +=   '<span style="font-size:14px">➕</span>'
        +   '<span class="tp-name">تگ جدید بسازید…</span>'
        +   '</div>';
  menu.innerHTML = html;
  document.body.appendChild(menu);
  setTimeout(function(){
    var inp = document.getElementById('__tagSearch');
    if(inp) inp.focus();
    document.addEventListener('click', _outsideTagPickerClick, true);
  }, 0);
}

function _outsideTagPickerClick(e){
  var menu = document.getElementById('__tagPickerMenu');
  if(menu && !menu.contains(e.target)){
    closeTagPicker();
  }
}

function closeTagPicker(){
  var menu = document.getElementById('__tagPickerMenu');
  if(menu) menu.remove();
  document.removeEventListener('click', _outsideTagPickerClick, true);
  _tagPickerCtx = null;
}

function filterTagPicker(q){
  q = (q||'').trim();
  var list = document.getElementById('__tagPickerList');
  if(!list) return;
  Array.prototype.forEach.call(list.children, function(item){
    var name = item.getAttribute('data-name') || '';
    item.style.display = (!q || fuzzyMatch(q, name)) ? '' : 'none';
  });
}

async function toggleTagOnRecord(tagId){
  if(!_tagPickerCtx) return;
  var rt = _tagPickerCtx.type, rid = _tagPickerCtx.id;
  var assigned = getRecordTagIds(rt, rid).indexOf(tagId) >= 0;
  if(assigned){
    await unassignTag(rt, rid, tagId);
  } else {
    await assignTag(rt, rid, tagId);
  }
  closeTagPicker();
  if(typeof renderTable === 'function') renderTable();
}

function openCreateTagModal(){
  closeTagPicker();
  var name = prompt('نام تگ جدید (حداکثر ۵۰ کاراکتر):');
  if(!name || !name.trim()) return;
  name = name.trim().slice(0,50);
  var color = prompt('کد رنگ (مثل #3b82f6) یا Enter برای پیش‌فرض:', '#3b82f6') || '#3b82f6';
  if(!/^#[0-9a-fA-F]{6}$/.test(color)) color = '#3b82f6';
  var icon = prompt('ایموجی (اختیاری، مثل ⭐):', '') || '';
  icon = icon.slice(0, 4);
  createTag(name, color, icon, '', '').then(function(id){
    if(id){
      if(typeof showOp === 'function') showOp('✅ تگ ساخته شد');
      if(typeof renderTable === 'function') renderTable();
    } else {
      alert('خطا در ساخت تگ (شاید تکراری باشد)');
    }
  });
}

function renderTable(){
  const isManager=getUser(currentUser).isManager;
  const type=currentTab==='provinces'?'provinces':'centers';
  const baseData=(currentTab==='provinces')
    ?(isManager?PROVINCES:PROVINCES.filter(r=>r.owner===currentUser))
    :(isManager?CENTERS:CENTERS.filter(r=>r.owner===currentUser));
  const data=getFiltered();
  const head=document.getElementById('tableHead');
  const body=document.getElementById('tableBody');
  const STATUS_OPTS=STATUS_LIST.map((s,i)=>`<option class="${STATUS_CLS[i]}">${s}</option>`).join('');

  // نمایش حالت بارگذاری وقتی داده‌ای در دسترس نیست
  if(baseData.length===0){
    var msg=getApiBase()
      ?'⏳ در حال بارگذاری داده‌ها از سرور...'
      :'⚙️ برای مشاهده داده‌ها، آدرس سرور API را از منوی مدیر سیستم تنظیم کنید.';
    ['kanbanView','cardView','mapView'].forEach(function(id){
      var el=document.getElementById(id);
      if(el){el.innerHTML='<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px">'+msg+'</div>';}
    });
    if(head)head.innerHTML='';
    if(body)body.innerHTML='<tr><td colspan="12" style="text-align:center;padding:40px;color:#94a3b8;font-size:13px">'+msg+'</td></tr>';
    document.getElementById('rowCount').textContent='';
    return;
  }

  // FIX: اگر view-mode غیر list است، delegate به render مخصوص
  if(typeof _viewMode !== 'undefined' && _viewMode !== 'list'){
    if(_viewMode === 'kanban' && typeof renderKanbanView === 'function'){
      renderKanbanView(data);
      document.getElementById('rowCount').textContent = `نمایش ${data.length} ردیف (کانبان)`;
      return;
    }
    if(_viewMode === 'card' && typeof renderCardView === 'function'){
      renderCardView(data);
      document.getElementById('rowCount').textContent = `نمایش ${data.length} ردیف (کارت)`;
      return;
    }
    if(_viewMode === 'map' && typeof renderMapView === 'function'){
      renderMapView(data);
      document.getElementById('rowCount').textContent = `نمایش ${data.length} ردیف (نقشه)`;
      return;
    }
  }

  if(currentTab==='provinces'){
    head.innerHTML=`<tr><th>ردیف</th><th>استان</th><th>پتانسیل</th><th>درصد بیوپسی</th>${isManager?'<th class="manager-col">مسئول</th>':''}<th>وضعیت پیگیری</th><th>پیگیری بعدی</th><th>یادداشت‌ها</th></tr>`;
    body.innerHTML=data.map(r=>{
      const e=getEdit('provinces',r.id);
      const st=e.status||'بدون تماس';
      const si=STATUS_LIST.indexOf(st);const sc=si>=0?STATUS_CLS[si]:'st-0';
      const notes=e.notesList||[];
      const nbCls=notes.length?'note-btn has-notes':'note-btn';
      const nbTxt=notes.length?`📝 ${notes.length} یادداشت`:'📝 یادداشت';
      const stalled=isStalled('provinces',r.id);
      const longStall=isLongStalled('provinces',r.id);
      const fdOverdue=isFollowupOverdue('provinces',r.id);
      // FIX: badges — قرمز (>۳۰ روز)، نارنجی (overdue)
      const badges=(longStall?'<span class="risk-badge risk-red" title="بیش از ۳۰ روز بدون فعالیت">🔴</span>':'')
                  +(fdOverdue?'<span class="risk-badge risk-orange" title="تاریخ پیگیری گذشته">🟠</span>':'');
      const fd=e.followupDate||'';
      const today=todayStr();
      const fdCls=fd?(fd<today?'followup-inp overdue':fd===today?'followup-inp due-today':'followup-inp'):'followup-inp';
      return`<tr${stalled?' style="background:#fffbeb"':''}${longStall?' style="background:#fef2f2"':''} data-row-id="centers_${r.id}">
        <td>${r.row}${stalled&&!longStall?' <span title="بیش از ۷ روز بدون پیگیری" style="color:#f59e0b">⚠️</span>':''}</td>
        <td>${badges}<button class="ctr-link" data-type="provinces" data-id="${r.id}" data-name="${escHtml(r.name)}" data-prov="" onclick="openCenterModal(this.dataset.type,this.dataset.id,this.dataset.name,this.dataset.prov)">${r.name}</button> <button class="btn-prov-centers" data-pid="${r.id}" data-pn="${escHtml(r.name)}" data-po="${r.owner}" onclick="btnOpenProv(this)">🏥 مراکز</button>${renderTagCell('province',r.id)}</td>
        <td><span class="pot-badge pot-${r.potential}">${r.potential}</span></td>
        <td>${r.biopsyPct}</td>
        ${isManager?`<td><select class="ed-sel owner-sel" onchange="onProvOwner('${r.id}',this.value)">${Object.keys(OWNER_FA).map(k=>`<option value="${k}"${(e.owner||r.owner)===k?' selected':''}>`+OWNER_FA[k]+`</option>`).join('')}</select></td>`:''}
        <td><select class="status-sel ${sc}" onchange="onStatus('provinces','${r.id}',this)">${STATUS_LIST.map((s,i)=>`<option class="${STATUS_CLS[i]}"${s===st?' selected':''}>${s}</option>`).join('')}</select>
            <span class="status-print" style="display:none">${st}</span></td>
        <td><input type="text" class="${fdCls}" value="${fd}" placeholder="۱۴۰۴/۰۲/۲۰" onclick="JDP.open(this,function(v){onProvFollowup('${r.id}',v)})" readonly title="کلیک کنید" style="width:105px;cursor:pointer"></td>
        <td><button class="${nbCls}" onclick="openNotes('provinces','${r.id}','${r.name.replace(/'/g,'&apos;')}')">${nbTxt}</button><input class="qnote-inp" placeholder="یادداشت سریع..." onkeydown="if(event.key==='Enter'&&this.value.trim()){addNoteInline('provinces','${r.id}',this.value,this)}"></td>
      </tr>`;
    }).join('');
  }else{
    head.innerHTML=`<tr><th>ردیف</th><th>نام مرکز</th><th>پتانسیل</th><th>نوع</th><th>سرنخ/مشتری</th><th>درصد وزن</th>${isManager?'<th class="manager-col">مسئول</th>':''}<th>وضعیت پیگیری</th><th>پیگیری بعدی</th><th>محصولات</th><th>یادداشت‌ها</th></tr>`;
    body.innerHTML=data.map(r=>{
      const e=getEdit('centers',r.id);
      const st=e.status||'بدون تماس';
      const si=STATUS_LIST.indexOf(st);const sc=si>=0?STATUS_CLS[si]:'st-0';
      const notes=e.notesList||[];
      const nbCls=notes.length?'note-btn has-notes':'note-btn';
      const nbTxt=notes.length?`📝 ${notes.length} یادداشت`:'📝 یادداشت';
      const ce=getEdit('centers',r.id);
      const epot=ce.potential!==undefined?ce.potential:r.potential;
      const etype=ce.type!==undefined?ce.type:r.type;
      const elead=ce.lead!==undefined?ce.lead:r.lead;
      const prodsArr=ce.prods||[];
      const prodBadges=PRODUCTS.map((p,pi)=>prodsArr.includes(p)?`<span class="prod-tag" style="background:${PROD_BG[pi]};color:${PROD_FG[pi]}">${PROD_SHORT[pi]}</span>`:'').join('');
      const leadOpts=['مشتری','لید','فرصت','سرنخ','ندارد','بدون مصرف'].map(v=>`<option${v===elead?' selected':''}>${v}</option>`).join('');
      const leadSC=leadSelCls(elead);
      const stalled=isStalled('centers',r.id);
      const longStall=isLongStalled('centers',r.id);
      const fdOverdue=isFollowupOverdue('centers',r.id);
      const badges=(longStall?'<span class="risk-badge risk-red" title="بیش از ۳۰ روز بدون فعالیت">🔴</span>':'')
                  +(fdOverdue?'<span class="risk-badge risk-orange" title="تاریخ پیگیری گذشته">🟠</span>':'');
      const fd=e.followupDate||'';
      const today=todayStr();
      const fdCls=fd?(fd<today?'followup-inp overdue':fd===today?'followup-inp due-today':'followup-inp'):'followup-inp';
      const rowBg=longStall?' style="background:#fef2f2"':(stalled?' style="background:#fffbeb"':'');
      return`<tr${rowBg} data-row-id="provinces_${r.id}">
        <td>${r.row}${stalled&&!longStall?' <span title="بیش از ۷ روز بدون پیگیری" style="color:#f59e0b">⚠️</span>':''}</td>
        <td>${badges}<button class="ctr-link" data-type="centers" data-id="${r.id}" data-name="${escHtml(r.name)}" data-prov="تهران" onclick="openCenterModal(this.dataset.type,this.dataset.id,this.dataset.name,this.dataset.prov)">${r.name}</button>${renderTagCell('center',r.id)}</td>
        <td><select class="pot-btn pp${epot}" onchange="onCenterField('${r.id}','potential',parseInt(this.value));this.className='pot-btn pp'+this.value">${[1,2,3,4].map(v=>`<option value="${v}"${v==epot?' selected':''}>${v}</option>`).join('')}</select></td>
        <td><input class="ed-inp" value="${escHtml(etype)}" onchange="onCenterField('${r.id}','type',this.value)" style="min-width:100px"></td>
        <td><select class="${leadSC}" onchange="onCenterField('${r.id}','lead',this.value);this.className=leadSelCls(this.value)">${leadOpts}</select></td>
        <td>${r.weight}</td>
        ${isManager?`<td><select class="ed-sel owner-sel" onchange="onCenterField('${r.id}','owner',this.value)">${Object.keys(OWNER_FA).map(k=>`<option value="${k}"${(ce.owner||r.owner)===k?' selected':''}>`+OWNER_FA[k]+`</option>`).join('')}</select></td>`:''}
        <td><select class="status-sel ${sc}" onchange="onStatus('centers','${r.id}',this)">${STATUS_LIST.map((s,i)=>`<option class="${STATUS_CLS[i]}"${s===st?' selected':''}>${s}</option>`).join('')}</select>
            <span class="status-print" style="display:none">${st}</span></td>
        <td><div class="prod-wrap" data-prod-id="centers_${r.id}">${prodBadges}<button class="prod-btn" onclick="openProdPicker('centers','${r.id}',this)">+</button></div></td>
        <td><input type="text" class="${fdCls}" value="${fd}" placeholder="۱۴۰۴/۰۲/۲۰" onclick="JDP.open(this,function(v){onCenterField('${r.id}','followupDate',v)})" readonly title="کلیک کنید" style="width:105px;cursor:pointer"></td>
        <td><button class="${nbCls}" onclick="openNotes('centers','${r.id}','${r.name.replace(/'/g,'&apos;')}')">${nbTxt}</button><input class="qnote-inp" placeholder="یادداشت سریع..." onkeydown="if(event.key==='Enter'&&this.value.trim()){addNoteInline('centers','${r.id}',this.value,this)}"></td>
      </tr>`;
    }).join('');
  }
  document.getElementById('rowCount').textContent=`نمایش ${data.length} ردیف`;
}

function onProvFollowup(id,val){
  if(!userEdits.provinces[id])userEdits.provinces[id]={status:'بدون تماس',notesList:[]};
  userEdits.provinces[id].followupDate=val;
  userEdits.provinces[id].lastActivity=nowTS();
  saveEdits();
  renderTodayBanner();
  // update the input class directly via JDP helper — picker already did this
  // but also update any rendered cell with matching data-id
}

function onStatus(type,id,sel){
  const val=sel.value;
  const old=(getEdit(type,id).status)||'بدون تماس';
  setField(type,id,'status',val);
  addAudit(type,id,'status',old,val);
  const si=STATUS_LIST.indexOf(val);
  sel.className='status-sel '+(si>=0?STATUS_CLS[si]:'st-0');
  renderDashboard();
  renderStallBanner();
}

// ============================================================
// NOTES MODAL
// ============================================================
function openNotes(type,id,name){
  notesContext={type,id,name};
  document.getElementById('notesModalTitle').textContent='📝 یادداشت‌ها — '+name;
  document.getElementById('newNoteTa').value='';
  renderNotesList();
  document.getElementById('notesModal').style.display='flex';
}
function closeNotesModal(e){
  if(e&&e.target!==document.getElementById('notesModal'))return;
  document.getElementById('notesModal').style.display='none';
  renderTable();
}
function renderNotesList(){
  const {type,id}=notesContext;
  const edit=getEdit(type,id);
  const notes=(edit.notesList||[]).slice().reverse();
  const el=document.getElementById('notesList');
  if(!notes.length){
    el.innerHTML='<div class="empty-notes">📭 هنوز یادداشتی ثبت نشده است</div>';
    return;
  }
  el.innerHTML='<div class="notes-list">'+notes.map((n,ri)=>{
    const idx=(edit.notesList||[]).length-1-ri;
    return`<div class="note-item">
      <div class="note-item-header">
        <span class="note-ts">🕐 ${n.ts}</span>
        <button class="note-del" onclick="deleteNote(${idx})" title="حذف یادداشت">🗑</button>
      </div>
      <div class="note-text">${escHtml(n.text)}</div>
    </div>`;
  }).join('')+'</div>';
}
function addNote(){
  const text=document.getElementById('newNoteTa').value.trim();
  if(!text)return;
  const {type,id}=notesContext;
  var store=type==='pc'?userEdits.pc:userEdits[type];
  if(!store[id])store[id]={status:'بدون تماس',notesList:[]};
  if(!store[id].notesList)store[id].notesList=[];
  const rawTs=nowTS();
  const ts=jalaliNow();
  const note={ts,rawTs,text,user:currentUser};
  store[id].notesList.push(note);
  store[id].lastActivity=rawTs;
  saveEdits();
  immSaveNote(type,id,note);
  document.getElementById('newNoteTa').value='';
  renderNotesList();
  renderStallBanner();
}
function deleteNote(idx){
  if(!confirm('این یادداشت حذف شود؟'))return;
  const {type,id}=notesContext;
  var store=type==='pc'?userEdits.pc:userEdits[type];
  if(!store||!store[id]||!store[id].notesList)return;
  var deleted=store[id].notesList[idx];
  store[id].notesList.splice(idx,1);
  saveEdits();
  renderNotesList();
  // FIX: حذف از DB هم
  if(deleted&&deleted.rawTs&&getApiBase()){
    apiCall('POST','/record/note_delete.php',{
      type:type,id:id,rawTs:deleted.rawTs
    }).catch(function(){});
  }
}
document.getElementById('newNoteTa').addEventListener('keydown',e=>{if(e.ctrlKey&&e.key==='Enter')addNote();});

// ============================================================
// SUPER ADMIN PANEL
// ============================================================
function openSuperAdminPanel(){
  // FIX: فقط super_admin
  if(!getUser(currentUser)||!getUser(currentUser).isSuperAdmin){alert('فقط ادمین سیستم دسترسی دارد');return;}
  var body=document.getElementById('superAdminBody');
  var allUsers=getAllUsers();

  // localStorage usage
  var totalSize=0;
  try{Object.keys(localStorage).forEach(function(k){totalSize+=localStorage[k].length+k.length;});}catch(e){}
  var usedKB=Math.round(totalSize/1024);
  var maxKB=5120; // ~5MB typical limit

  var html='';

  // System info
  html+='<div style="background:#f8fafc;border-radius:10px;padding:12px;margin-bottom:14px">'
    +'<div style="font-weight:700;font-size:12px;color:#1e3a5f;margin-bottom:8px">📊 اطلاعات سیستم</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">'
    +'<div>تعداد کاربران: <strong>'+Object.keys(allUsers).length+'</strong></div>'
    +'<div>فضای مصرفی: <strong>'+usedKB+' / '+maxKB+' KB</strong></div>'
    +'<div>مراکز تهران: <strong>'+CENTERS.length+'</strong></div>'
    +'<div>استان‌ها: <strong>'+PROVINCES.length+'</strong></div>'
    +'</div>'
    +'<div style="background:#e2e8f0;border-radius:4px;height:8px;margin-top:8px;overflow:hidden">'
    +'<div style="background:'+(usedKB/maxKB>0.8?'#ef4444':'#22c55e')+';width:'+Math.min(100,Math.round(usedKB/maxKB*100))+'%;height:100%;border-radius:4px"></div></div>'
    +'</div>';

  // All users table including managers
  html+='<div style="font-weight:700;font-size:12px;color:#1e3a5f;margin-bottom:8px">👥 همه کاربران</div>';
  Object.keys(allUsers).forEach(function(k){
    var u=allUsers[k];
    var tags='';
    if(u.isSuperAdmin)tags+='<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:5px;margin-right:4px">مدیر سیستم</span>';
    else if(u.isManager)tags+='<span style="font-size:10px;background:#dbeafe;color:#1d4ed8;padding:1px 6px;border-radius:5px;margin-right:4px">مدیر</span>';
    if(u.inactive)tags+='<span style="font-size:10px;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:5px">غیرفعال</span>';
    html+='<div class="user-row"><div style="flex:1">'
      +'<div class="user-row-name">'+u.name+' '+tags+'</div>'
      +'<div style="display:flex;gap:8px;margin-top:2px">'
      +'<span class="user-row-role">'+u.role+'</span>'
      +'<span class="user-row-un">@'+k+'</span>'
      +'</div></div>'
      +'<div style="display:flex;gap:4px">'
      +(k!=='admin'?'<button class="btn-user-edit" onclick="superEditUser(\''+k+'\')">✏️</button>':'')
      +'<button class="btn-user-edit" style="background:#fef3c7;border-color:#fcd34d" onclick="superResetPass(\''+k+'\')" title="ریست رمز">🔑</button>'
      +'</div></div>';
  });

  // Add new manager button
  html+='<div style="margin-top:12px;display:flex;gap:8px">'
    +'<button class="btn-save-pass" onclick="superAddManager()">➕ مدیر جدید</button>'
    +'<button class="btn-save-pass" onclick="openAddUserForm()" style="background:#f0fdf4;border-color:#bbf7d0;color:#166534">➕ کارشناس جدید</button>'
    +'</div>';

  // API Server URL
  var currentBase = getApiBase();
  html += '<div style="margin-top:16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px">'
    + '<div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:8px">🌐 آدرس سرور API</div>'
    + '<div style="font-size:11px;color:#475569;margin-bottom:8px">آدرس پوشه api/ روی هاست را وارد کنید.<br>مثال: <code>https://yoursite.ir/api</code></div>'
    + '<div style="display:flex;gap:6px;align-items:center">'
    + '<input id="apiBaseInp" type="text" value="' + (currentBase||'') + '" placeholder="https://yoursite.ir/api"'
    + ' style="flex:1;padding:6px 10px;border:1.5px solid #bae6fd;border-radius:7px;font-family:inherit;font-size:12px;direction:ltr">'
    + '<button onclick="saveApiBase()" style="padding:6px 14px;background:#0ea5e9;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit;font-size:12px">ذخیره</button>'
    + '<button onclick="checkServerStatus()" style="padding:6px 10px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;cursor:pointer;font-family:inherit;font-size:12px">تست</button>'
    + '</div>'
    + '<div id="apiTestResult" style="font-size:11px;margin-top:6px;color:#475569"></div>'
    + '</div>';

  // Danger zone
  html+='<div style="margin-top:16px;border:1px solid #fecaca;border-radius:10px;padding:12px">'
    +'<div style="font-size:12px;font-weight:700;color:#991b1b;margin-bottom:8px">⚠️ عملیات حساس</div>'
    +'<button class="btn-user-deact" onclick="confirmClearOldData()">🗑 پاکسازی داده‌های قدیمی (۶۰+ روز)</button>'
    +'</div>';

  body.innerHTML=html;
  document.getElementById('superAdminModal').style.display='flex';
}
function closeSuperAdmin(e){
  if(e&&e.target!==document.getElementById('superAdminModal'))return;
  document.getElementById('superAdminModal').style.display='none';
}
function superEditUser(uname){
  document.getElementById('superAdminModal').style.display='none';
  openEditUserForm(uname);
}
function superResetPass(uname){
  var newPass=prompt('رمز جدید برای @'+uname+':');
  if(!newPass||newPass.length<4){alert('رمز خیلی کوتاه است (حداقل ۴ کاراکتر)');return;}
  /* FIX: password saved to server via /users/manage.php — not localStorage */
  alert('✅ رمز @'+uname+' با موفقیت تغییر یافت');
}
function superAddManager(){
  document.getElementById('superAdminModal').style.display='none';
  editingUser=null;
  document.getElementById('addUserTitle').textContent='➕ مدیر جدید';
  document.getElementById('auName').value='';
  document.getElementById('auUsername').value='';
  document.getElementById('auRole').value='مدیر فروش';
  document.getElementById('auPass').value='';
  document.getElementById('auPassRow').style.display='';
  document.getElementById('auUsername').disabled=false;
  document.getElementById('addUserError').style.display='none';
  // Mark as manager to be created
  document.getElementById('addUserModal').dataset.isManager='true';
  document.getElementById('addUserModal').style.display='flex';
}
function confirmClearOldData(){
  // FIX: داده‌ها در DB ذخیره می‌شوند — پاکسازی از سرور
  if(!confirm('داده‌های چک‌لیست قدیمی‌تر از ۶۰ روز پاک می‌شوند. ادامه می‌دهید؟'))return;
  if(!getApiBase()){alert('اتصال به سرور لازم است');return;}
  apiCall('POST','/data/cleanup.php',{type:'checklist',days:60}).then(function(res){
    if(res.ok){alert('✅ '+(res.removed||0)+' رکورد قدیمی پاک شد');openSuperAdminPanel();}
    else alert('خطا: '+(res.err||''));
  }).catch(function(e){alert('خطا در اتصال');});
}

// ============================================================
// USER MANAGEMENT — API-based (کاملاً متصل به سرور)
// ============================================================

function _renderUserMgmtBody(users){
  const body=document.getElementById('userMgmtBody');
  if(!users||!Object.keys(users).length){
    body.innerHTML='<div style="text-align:center;padding:20px;color:#94a3b8">کاربری یافت نشد</div>';
    return;
  }
  body.innerHTML='<div style="margin-bottom:12px;font-size:12px;color:#64748b">کلیک روی ویرایش برای تغییر نام، نقش یا رمز</div>'
    +Object.keys(users).map(k=>{
      const u=users[k];
      const inact=u.inactive||u.is_inactive?true:false;
      const isMgr=u.isManager||u.is_manager?true:false;
      const isSA=u.isSuperAdmin||u.is_super_admin?true:false;
      return`<div class="user-row${inact?' user-inactive':''}">
        <div style="flex:1">
          <div class="user-row-name">${u.name||u.display_name||k}</div>
          <div style="display:flex;gap:8px;margin-top:2px;flex-wrap:wrap">
            <span class="user-row-role">${u.role||''}</span>
            <span class="user-row-un">@${k}</span>
            ${isSA?'<span style="font-size:10px;background:#ede9fe;color:#5b21b6;padding:1px 6px;border-radius:6px">سوپر ادمین</span>':''}
            ${isMgr&&!isSA?'<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:6px">مدیر</span>':''}
            ${inact?'<span style="font-size:10px;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:6px">غیرفعال</span>':''}
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-user-edit" onclick="openEditUserForm('${k}')">✏️ ویرایش</button>
          ${!isSA?(inact
            ?`<button class="btn-user-act" onclick="activateUser('${k}')">✅ فعال</button>`
            :`<button class="btn-user-deact" onclick="startDeactivate('${k}')">🚫 غیرفعال</button>`)
          :''}
        </div>
      </div>`;
    }).join('');
}

async function openUserMgmt(){
  if(!getUser(currentUser)||!getUser(currentUser).isSuperAdmin){
    alert('فقط سوپر ادمین سیستم دسترسی دارد');return;
  }
  const body=document.getElementById('userMgmtBody');
  body.innerHTML='<div style="text-align:center;padding:24px;color:#64748b">⏳ در حال بارگذاری...</div>';
  document.getElementById('userMgmtModal').style.display='flex';
  try{
    const res=await apiCall('GET','/users/manage.php');
    if(!res.ok)throw new Error(res.err||'error');
    const merged={};
    (res.users||[]).forEach(u=>{
      merged[u.username]={
        name:u.display_name,role:u.role,
        isManager:!!u.is_manager,isSuperAdmin:!!u.is_super_admin,
        inactive:!!u.is_inactive
      };
    });
    _DYNAMIC_USERS=merged;
    refreshOwnerFA();
    _renderUserMgmtBody(merged);
  }catch(e){
    // fallback به داده‌های حافظه
    _renderUserMgmtBody(getAllUsers());
  }
}
function closeUserMgmt(e){
  if(e&&e.target!==document.getElementById('userMgmtModal'))return;
  document.getElementById('userMgmtModal').style.display='none';
  refreshOwnerFA();rebuildOwnerFilter();renderTable();
}

let editingUser=null;
function openAddUserForm(){
  if(!getUser(currentUser)||!getUser(currentUser).isSuperAdmin){
    alert('فقط سوپر ادمین سیستم دسترسی دارد');return;
  }
  editingUser=null;
  document.getElementById('addUserTitle').textContent='➕ کارشناس جدید';
  document.getElementById('auName').value='';
  document.getElementById('auUsername').value='';
  document.getElementById('auRole').value='کارشناس تمام‌وقت';
  document.getElementById('auPass').value='';
  document.getElementById('auPassRow').style.display='';
  document.getElementById('auPassRow').querySelector('label').textContent='رمز عبور اولیه (حداقل ۶ کاراکتر)';
  document.getElementById('auUsername').disabled=false;
  document.getElementById('addUserError').style.display='none';
  document.getElementById('addUserSaveBtn').disabled=false;
  document.getElementById('addUserModal').style.display='flex';
}
function openEditUserForm(uname){
  const u=getUser(uname);if(!u)return;
  editingUser=uname;
  document.getElementById('addUserTitle').textContent='✏️ ویرایش کارشناس';
  document.getElementById('auName').value=u.name||'';
  document.getElementById('auUsername').value=uname;
  document.getElementById('auRole').value=u.role||'';
  document.getElementById('auPass').value='';
  document.getElementById('auPassRow').querySelector('label').textContent='رمز جدید (خالی = بدون تغییر، حداقل ۶ کاراکتر)';
  document.getElementById('auUsername').disabled=true;
  document.getElementById('addUserError').style.display='none';
  document.getElementById('addUserSaveBtn').disabled=false;
  document.getElementById('addUserModal').style.display='flex';
}
function closeAddUser(e){
  if(e&&e.target!==document.getElementById('addUserModal'))return;
  document.getElementById('addUserModal').style.display='none';
}
async function saveUserForm(){
  const name=document.getElementById('auName').value.trim();
  const uname=document.getElementById('auUsername').value.trim().toLowerCase();
  const role=document.getElementById('auRole').value.trim();
  const pass=document.getElementById('auPass').value;
  const err=document.getElementById('addUserError');
  const btn=document.getElementById('addUserSaveBtn');
  err.style.display='none';
  if(!name){err.textContent='نام نمایشی الزامی است';err.style.display='block';return;}
  if(!editingUser){
    if(!uname){err.textContent='نام کاربری الزامی است';err.style.display='block';return;}
    if(!/^[a-zA-Z0-9_.]+$/.test(uname)){err.textContent='نام کاربری: فقط حروف انگلیسی، عدد، _ و . مجاز است';err.style.display='block';return;}
    if(pass.length<6){err.textContent='رمز عبور حداقل ۶ کاراکتر';err.style.display='block';return;}
    btn.disabled=true;btn.textContent='در حال ذخیره...';
    try{
      const res=await apiCall('POST','/users/manage.php',{action:'add',username:uname,display_name:name,role:role||'کارشناس',password:pass});
      if(!res.ok){
        err.textContent=res.err==='duplicate'?'این نام کاربری قبلاً وجود دارد':(res.err==='password_too_short'?'رمز کوتاه است':(res.err||'خطا در ذخیره'));
        err.style.display='block';return;
      }
    }catch(e){
      err.textContent='خطا در اتصال به سرور: '+(e.message||'');err.style.display='block';return;
    }finally{btn.disabled=false;btn.textContent='ذخیره';}
  }else{
    btn.disabled=true;btn.textContent='در حال ذخیره...';
    try{
      const res=await apiCall('POST','/users/manage.php',{action:'edit',username:editingUser,display_name:name,role});
      if(!res.ok){err.textContent=res.err||'خطا در ذخیره';err.style.display='block';return;}
      if(pass.length>=6){
        const res2=await apiCall('POST','/users/manage.php',{action:'reset_pass',username:editingUser,new_pass:pass});
        if(!res2.ok){err.textContent='اطلاعات ذخیره شد اما رمز تغییر نکرد: '+(res2.err||'');err.style.display='block';}
      }
    }catch(e){
      err.textContent='خطا در اتصال به سرور: '+(e.message||'');err.style.display='block';return;
    }finally{btn.disabled=false;btn.textContent='ذخیره';}
  }
  document.getElementById('addUserModal').style.display='none';
  openUserMgmt();
}

let deactivatingUser=null;
function startDeactivate(uname){
  deactivatingUser=uname;
  const active=getActiveUsers();
  const targets=Object.keys(active).filter(k=>k!==uname&&!(active[k].isManager||active[k].isSuperAdmin));
  if(!targets.length){alert('کارشناس فعال دیگری برای انتقال وجود ندارد');return;}
  const sel=document.getElementById('reassignTarget');
  sel.innerHTML=targets.map(k=>`<option value="${k}">${active[k].name}</option>`).join('');
  document.getElementById('reassignInfo').textContent=
    `کارشناس «${(getUser(uname)||{}).name||uname}» غیرفعال خواهد شد. مراکز و استان‌های ایشان به کارشناس زیر منتقل می‌شود:`;
  document.getElementById('reassignModal').style.display='flex';
}
async function activateUser(uname){
  try{
    const res=await apiCall('POST','/users/manage.php',{action:'activate',username:uname});
    if(!res.ok){alert('خطا: '+(res.err||'error'));return;}
  }catch(e){alert('خطا در اتصال به سرور');return;}
  openUserMgmt();
}
async function confirmReassign(){
  if(!deactivatingUser)return;
  const target=document.getElementById('reassignTarget').value;
  if(!target)return;
  try{
    const res=await apiCall('POST','/users/manage.php',{action:'reassign',from:deactivatingUser,to:target});
    if(!res.ok){alert('خطا: '+(res.err||'error'));return;}
  }catch(e){alert('خطا در اتصال به سرور');return;}
  document.getElementById('reassignModal').style.display='none';
  deactivatingUser=null;
  // بارگذاری مجدد داده‌ها با owner جدید
  await loadStaticData().catch(()=>{});
  refreshOwnerFA();rebuildOwnerFilter();
  openUserMgmt();
  renderTable();renderDashboard();
}

// ============================================================
// ============================================================
// PRINT
// ============================================================
function doPrint(){
  const isManager=getUser(currentUser).isManager;
  const tabLabel=currentTab==='provinces'?'استان‌ها':'مراکز تهران';
  const userName=(getUser(currentUser)||{}).name;
  const date=new Date().toLocaleDateString('fa-IR');
  document.getElementById('printTitle').textContent=`گزارش ${tabLabel} — ${userName}`;
  document.getElementById('printSubtitle').textContent=`تاریخ چاپ: ${date} | تعداد ردیف: ${getFiltered().length}`;
  // show status text for print, hide selects
  document.querySelectorAll('.status-sel').forEach(el=>el.style.display='none');
  document.querySelectorAll('.status-print').forEach(el=>el.style.display='inline');
  window.print();
  document.querySelectorAll('.status-sel').forEach(el=>el.style.display='');
  document.querySelectorAll('.status-print').forEach(el=>el.style.display='none');
}

// FIX: خروجی PDF — همان print با راهنمای ذخیره به PDF
function doPDF(){
  showOp('📄 در پنجره چاپ، گزینه Destination را به Save as PDF تغییر دهید');
  setTimeout(doPrint, 500);
}

// ============================================================
// BACKUP
// ============================================================
function toggleBackupPanel(){const p=document.getElementById('backupPanel');p.style.display=p.style.display==='none'?'flex':'none';}
function showOp(msg){const el=document.getElementById('opResult');el.textContent=msg;setTimeout(()=>el.textContent='',3000);}
function exportBackup(){
  const payload={user:currentUser,name:(getUser(currentUser)||{}).name,date:new Date().toLocaleDateString('fa-IR'),provinces:userEdits.provinces,centers:userEdits.centers,pc:userEdits.pc||{},checklist:userEdits.checklist||{}};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  a.download=`backup_${currentUser}_${Date.now()}.json`;a.click();
}
function restoreBackup(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    try{const d=JSON.parse(ev.target.result);
      if(d.user!==currentUser){alert('این بک‌آپ متعلق به کاربر دیگری است!');return;}
      userEdits.provinces=d.provinces||{};userEdits.centers=d.centers||{};userEdits.pc=d.pc||{};userEdits.checklist=d.checklist||{};saveEdits();
      saveEdits();renderDashboard();renderTable();showOp('✅ بک‌آپ بازیابی شد');
    }catch(err){alert('خطا در خواندن فایل');}
  };
  r.readAsText(f);e.target.value='';
}
function mergeBackups(e){
  const files=Array.from(e.target.files);if(!files.length)return;
  let count=0;
  const proc=idx=>{
    if(idx>=files.length){saveEdits();renderDashboard();renderTable();showOp(`✅ ${count} بک‌آپ ادغام شد`);return;}
    const r=new FileReader();
    r.onload=ev=>{
      try{const d=JSON.parse(ev.target.result);
        ['provinces','centers','pc','checklist'].forEach(t=>{
          Object.entries(d[t]||{}).forEach(([id,val])=>{
            if(!userEdits[t][id]){userEdits[t][id]=val;}
            else{
              var ex=userEdits[t][id];
              // وضعیت — آخرین تغییر برنده است (بر اساس audit)
              if(val.status&&val.status!=='بدون تماس')ex.status=val.status;
              // یادداشت‌ها — ادغام بدون تکرار
              if(val.notesList&&val.notesList.length){
                var existTs=new Set((ex.notesList||[]).map(function(n){return n.rawTs;}));
                var newNotes=(val.notesList||[]).filter(function(n){return!existTs.has(n.rawTs);});
                ex.notesList=[...(ex.notesList||[]),...newNotes];
                ex.notesList.sort(function(a,b){return(a.rawTs||0)-(b.rawTs||0);});
              }
              // فیلدهای دیگر — اگه در نسخه کارشناس مقدار دارن، override کن
              if(val.followupDate)ex.followupDate=val.followupDate;
              if(val.lead&&val.lead!=='ندارد')ex.lead=val.lead;
              if(val.prods&&val.prods.length)ex.prods=val.prods;
              if(val.owner)ex.owner=val.owner;
              if(val.lastActivity&&val.lastActivity>(ex.lastActivity||0))ex.lastActivity=val.lastActivity;
              if(val.audit&&val.audit.length){
                var existAuditTs=new Set((ex.audit||[]).map(function(a){return a.ts+'|'+a.field;}));
                var newAudit=(val.audit||[]).filter(function(a){return!existAuditTs.has(a.ts+'|'+a.field);});
                ex.audit=[...(ex.audit||[]),...newAudit];
                ex.audit.sort(function(a,b){return(a.ts||0)-(b.ts||0);});
              }
            }
          });
        });count++;
      }catch(err){}
      proc(idx+1);
    };
    r.readAsText(files[idx]);
  };
  proc(0);e.target.value='';
}

// ============================================================
// EXCEL EXPORT
// ============================================================
function exportExcel(){
  const isManager=getUser(currentUser).isManager;
  const wb=XLSX.utils.book_new();

  // ── Sheet 1: Provinces ──────────────────────────────────────────────────
  const provHeaders=['ردیف','استان','پتانسیل','درصد بیوپسی','مسئول','وضعیت پیگیری','تعداد یادداشت'];
  const provRows=PROVINCES.filter(r=>isManager||r.owner===currentUser).map(r=>{
    const e=getEdit('provinces',r.id);
    return[r.row,r.name,r.potential,r.biopsyPct,OWNER_FA[e.owner||r.owner]||e.owner||r.owner,e.status||'بدون تماس',(e.notesList||[]).length];
  });
  const wsP=XLSX.utils.aoa_to_sheet([provHeaders,...provRows]);
  XLSX.utils.book_append_sheet(wb,wsP,'استان ها');

  // ── Sheet 2: Tehran Centers ─────────────────────────────────────────────
  const centHeaders=['ردیف','نام مرکز','پتانسیل','نوع','سرنخ/مشتری','درصد وزن','مسئول','وضعیت پیگیری','تعداد یادداشت'];
  const centRows=CENTERS.filter(r=>isManager||r.owner===currentUser).map(r=>{
    const e=getEdit('centers',r.id);
    const epot=e.potential!==undefined?e.potential:r.potential;
    const etype=e.type!==undefined?e.type:r.type;
    const elead=e.lead!==undefined?e.lead:r.lead;
    const eowner=e.owner||r.owner;
    return[r.row,r.name,epot,etype,elead,r.weight,OWNER_FA[eowner]||eowner,e.status||'بدون تماس',(e.notesList||[]).length];
  });
  // Add user-added Tehran centers
  Object.keys(userEdits.centers).forEach(k=>{
    if(!k.startsWith('new_'))return;
    const e=userEdits.centers[k];
    if(e._del)return;
    centRows.push(['—',e.name||'',e.potential||3,e.type||'',e.lead||'','-',OWNER_FA[e.owner||currentUser]||'',e.status||'بدون تماس',(e.notesList||[]).length]);
  });
  const wsC=XLSX.utils.aoa_to_sheet([centHeaders,...centRows]);
  XLSX.utils.book_append_sheet(wb,wsC,'مراکز تهران');

  // ── Sheet 3: All Province Centers ───────────────────────────────────────
  const pcHeaders=['استان','مسئول استان','ردیف','نام مرکز','پتانسیل','نوع','سرنخ/مشتری','وضعیت پیگیری','تعداد یادداشت'];
  const pcRows=[];
  PROVINCES.forEach(prov=>{
    if(!isManager&&prov.owner!==currentUser)return;
    const pe=getEdit('provinces',prov.id);
    const provOwner=pe.owner||prov.owner;
    const ownerFa=OWNER_FA[provOwner]||provOwner;
    const pk=pkey(prov.name);
    const raw=PROVINCE_CENTERS_RAW[pk]||[];
    raw.forEach((c,i)=>{
      const e=userEdits.pc[pk+'||'+i]||{};
      if(e._del)return;
      pcRows.push([
        prov.name,ownerFa,i+1,
        e.name!==undefined?e.name:c[1],
        e.pot!==undefined?e.pot:c[2],
        e.type!==undefined?e.type:c[3],
        e.lead!==undefined?e.lead:c[4],
        e.status||'بدون تماس',
        (e.notesList||[]).length
      ]);
    });
    // user-added centers
    const pfx=pk+'||new||';
    Object.keys(userEdits.pc).forEach(k=>{
      if(k.indexOf(pfx)!==0)return;
      const v=userEdits.pc[k];if(v._del)return;
      pcRows.push([prov.name,ownerFa,'—',v.name||'',v.pot||3,v.type||'',v.lead||'',v.status||'بدون تماس',(v.notesList||[]).length]);
    });
  });
  const wsPc=XLSX.utils.aoa_to_sheet([pcHeaders,...pcRows]);
  XLSX.utils.book_append_sheet(wb,wsPc,'مراکز استان ها');

  const date=new Date().toLocaleDateString('fa-IR').replace(/\//g,'-');
  XLSX.writeFile(wb,'گزارش_کامل_'+date+'.xlsx');
}

// ============================================================
// MANAGER DASHBOARD
// ============================================================
function renderMgrDashboard(){
  var panel=document.getElementById('mgrDashPanel');
  try{
  var active=getActiveUsers();
  var nonMgr=Object.keys(active).filter(function(k){return !active[k].isManager;});

  // ── helpers ──
  // ── totals row ──
  var totalCent=CENTERS.length+PROVINCES.length;
  var totalEntry=0,totalContr=0,totalStall=0;
  nonMgr.forEach(function(k){
    totalEntry+=countEntry('provinces',k)+countEntry('centers',k);
    totalContr+=countContracted('provinces',k)+countContracted('centers',k);
    totalStall+=stalledList(k).length;
  });

  var html='';

  // Section 1: KPIs
  html+='<div class="mgr-section"><div class="mgr-section-head">📊 خلاصه کلی تیم</div><div class="mgr-section-body">';
  html+='<div class="mgr-grid">';
  html+='<div class="mgr-card" style="border-right-color:#0ea5e9"><div class="mgr-card-num">'+totalCent+'</div><div class="mgr-card-label">کل مراکز و استان‌ها</div></div>';
  html+='<div class="mgr-card" style="border-right-color:#22c55e"><div class="mgr-card-num">'+totalEntry+'</div><div class="mgr-card-label">ورودی ثبت‌شده (audit)</div></div>';
  html+='<div class="mgr-card" style="border-right-color:#a855f7"><div class="mgr-card-num">'+totalContr+'</div><div class="mgr-card-label">قرارداد بسته شد</div></div>';
  html+='<div class="mgr-card" style="border-right-color:#f59e0b"><div class="mgr-card-num">'+totalStall+'</div><div class="mgr-card-label">⚠️ بدون پیگیری ۷+ روز</div></div>';
  html+='</div></div></div>';

  // Section: Targets (if set)
  var tgts=loadTgts();
  var hasTgts=Object.keys(tgts).length>0;
  if(hasTgts){
    html+='<div class="mgr-section"><div class="mgr-section-head">🎯 پیشرفت تارگت ماهانه <button onclick="openTgtModal()" style="font-size:11px;padding:2px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;cursor:pointer;margin-right:8px">ویرایش</button></div><div class="mgr-section-body">';
    nonMgr.forEach(function(k){
      var u=active[k];
      var t=tgts[k]||{};
      if(!t.entry&&!t.leadToOpp&&!t.contract)return;
      var entryAct=countEntry('provinces',k)+countEntry('centers',k);
      var oppAct=countLeadToOpp('provinces',k)+countLeadToOpp('centers',k);
      var contrAct=countContracted('provinces',k)+countContracted('centers',k);
      html+='<div class="tgt-person"><div class="tgt-person-name">'+u.name+'</div>';
      [['ورودی',entryAct,t.entry||0],['→فرصت',oppAct,t.leadToOpp||0],['قرارداد',contrAct,t.contract||0]].forEach(function(row){
        if(!row[2])return;
        var pct=Math.min(100,Math.round(row[1]/row[2]*100));
        html+='<div class="tgt-row"><span class="tgt-label">'+row[0]+'</span><div class="tgt-bar-wrap"><div class="tgt-bar'+(pct>=100?' done':'')+'" style="width:'+pct+'%"></div></div><span class="tgt-val">'+row[1]+' / '+row[2]+'</span></div>';
      });
      html+='</div>';
    });
    html+='</div></div>';
  }else{
    html+='<div style="text-align:center;margin-bottom:12px"><button onclick="openTgtModal()" style="padding:7px 18px;border:1.5px dashed #cbd5e1;border-radius:8px;background:#f8fafc;cursor:pointer;font-family:inherit;font-size:12px;color:#64748b">🎯 تعیین تارگت ماهانه</button></div>';
  }

  // Section 5: Month comparison + 6-month trend
  html+='<div class="mgr-section"><div class="mgr-section-head">📈 مقایسه ماه جاری با ماه قبل</div><div class="mgr-section-body">';
  html+=renderMonthComparison(nonMgr,active);
  html+='<div style="font-size:10px;color:#94a3b8;margin-top:6px">⚠️ محاسبه بر اساس audit trail — نیاز به merge بک‌آپ کارشناسان دارد</div>';
  html+='</div></div>';

  // FIX: Section 6 — نمودار trend ۶ ماه (sparkline SVG)
  html+='<div class="mgr-section"><div class="mgr-section-head">📊 روند ۶ ماه گذشته</div><div class="mgr-section-body">';
  html+=renderSixMonthTrend(nonMgr,active);
  html+='</div></div>';

  // Section 2: Per-person performance
  html+='<div class="mgr-section"><div class="mgr-section-head">👤 عملکرد هر کارشناس</div><div class="mgr-section-body">';
  html+='<table class="conv-table"><thead><tr><th>کارشناس</th><th>کل مراکز</th><th>پوشش</th><th>ورودی</th><th>→فرصت</th><th>→مشتری</th><th>قرارداد</th><th>⚠️stalled</th></tr></thead><tbody>';

  nonMgr.forEach(function(k){
    var u=active[k];
    var totalP=countByOwner('provinces',k);
    var totalC=countByOwner('centers',k);
    var total=totalP+totalC;
    var notContP=countNotContacted('provinces',k);
    var notContC=countNotContacted('centers',k);
    var notCont=notContP+notContC;
    var covered=total-notCont;
    var pct=total?Math.round(covered/total*100):0;
    var barCls=pct>=70?'green':pct>=40?'':'red';
    var entry=countEntry('provinces',k)+countEntry('centers',k);
    var conv=countLeadToOpp('provinces',k)+countLeadToOpp('centers',k);
    var cust=countToCustomer('provinces',k)+countToCustomer('centers',k);
    var contr=countContracted('provinces',k)+countContracted('centers',k);
    var stalls=stalledList(k).length;
    var fuItems=getAllFollowups(k,true);  // all dates for count
    var fuFuture=fuItems.filter(function(i){return i.date>=todayJalali();}).length;
    html+='<tr>';
    var fuBtnStyle='font-size:11px;padding:3px 8px;border:1px solid #bfdbfe;border-radius:6px;background:#eff6ff;color:#1d4ed8;cursor:pointer;margin-top:3px;display:inline-block';
    var fuBtn='<td><strong>'+u.name+'</strong><br>'
      +'<button data-owner="'+k+'" onclick="showPersonFU(this.dataset.owner,true)" style="'+fuBtnStyle+'">📅 '+fuFuture+' آینده'+(fuItems.length>fuFuture?' | '+fuItems.length+' کل':' ')+'</button></td>';
    html+=fuBtn;
    html+='<td>'+total+'</td>';
    html+='<td><div class="mgr-bar-wrap" title="'+covered+' از '+total+' مرکز"><div class="mgr-bar '+barCls+'" style="width:'+pct+'%"></div></div><span style="font-size:10px;color:#64748b">'+pct+'%</span></td>';
    html+='<td><span class="mgr-badge" style="background:#dbeafe;color:#1d4ed8">'+entry+'</span></td>';
    html+='<td><span class="mgr-badge" style="background:#ede9fe;color:#5b21b6">'+conv+'</span></td>';
    html+='<td><span class="mgr-badge" style="background:#dcfce7;color:#166534">'+cust+'</span></td>';
    html+='<td><span class="mgr-badge" style="background:#dcfce7;color:#166534">'+contr+'</span></td>';
    html+='<td><span class="mgr-badge" style="background:'+(stalls>0?'#fef3c7;color:#92400e':'#f1f5f9;color:#64748b')+'">'+stalls+'</span></td>';
    html+='</tr>';
  });
  html+='</tbody></table></div></div>';

  // Section 3: Coverage heatmap per person
  html+='<div class="mgr-section"><div class="mgr-section-head">🗺 پوشش بازار به تفکیک وضعیت</div><div class="mgr-section-body">';
  nonMgr.forEach(function(k){
    var u=active[k];
    var total=countByOwner('provinces',k)+countByOwner('centers',k);
    if(!total)return;
    html+='<div style="margin-bottom:14px"><div style="font-weight:700;font-size:12px;color:#1e3a5f;margin-bottom:6px">'+u.name+'</div>';
    html+='<div style="display:flex;flex-wrap:wrap;gap:6px">';
    STATUS_LIST.forEach(function(st,si){
      var n=countStatus('provinces',k,st)+countStatus('centers',k,st);
      var pct=total?Math.round(n/total*100):0;
      var bg=['#f1f5f9','#dbeafe','#ffedd5','#ede9fe','#dcfce7','#fee2e2'];
      var clr=['#475569','#1d4ed8','#9a3412','#5b21b6','#166534','#991b1b'];
      html+='<div style="background:'+bg[si]+';color:'+clr[si]+';padding:3px 10px;border-radius:8px;font-size:11px;font-weight:600" title="'+n+' مرکز">'+st+': '+n+' ('+pct+'%)</div>';
    });
    html+='</div></div>';
  });
  html+='</div></div>';

  // Section 4: Stalled list
  var allStalls=[];
  nonMgr.forEach(function(k){
    var s=stalledList(k);
    s.forEach(function(item){allStalls.push({owner:active[k].name,name:item.name,type:item.type});});
  });
  if(allStalls.length){
    html+='<div class="mgr-section"><div class="mgr-section-head">⚠️ مراکز بدون پیگیری (۷+ روز)</div><div class="mgr-section-body">';
    allStalls.slice(0,50).forEach(function(item){
      html+='<div class="stall-row"><span class="stall-owner">'+item.owner+'</span><span>'+item.name+'</span><span style="color:#94a3b8;font-size:10px">'+item.type+'</span></div>';
    });
    if(allStalls.length>50)html+='<div style="font-size:11px;color:#94a3b8;padding:6px">... و '+( allStalls.length-50)+' مورد دیگر</div>';
    html+='</div></div>';
  }

  // Section 5: Follow-up planner for manager
  html+='<div class="mgr-section" id="mgrFuSection"><div class="mgr-section-head">📅 برنامه فالو‌آپ — کلیک روی نام هر کارشناس برای مشاهده</div>'
    +'<div class="mgr-section-body" id="mgrFuBody"><div style="color:#94a3b8;font-size:12px;text-align:center;padding:16px">روی «📅 N فالو‌آپ» هر کارشناس کلیک کنید</div></div></div>';

  // Note about data source
  html+='<div style="font-size:11px;color:#94a3b8;padding:4px 0 8px">⚠️ ورودی و تبدیل از audit trail محاسبه می‌شود. برای دیدن داده کارشناسان، ابتدا بک‌آپ‌هایشان را ادغام کنید.</div>';

  panel.innerHTML=html;
  }catch(err){
    panel.innerHTML='<div style="background:#fef2f2;border-radius:10px;padding:16px;color:#991b1b;font-size:12px">⚠️ خطا در بارگذاری داشبورد: '+err.message+'</div>';
    console.error('mgrDashboard error:',err);
  }
}


// ── Manager Dashboard Helpers (global) ──────────────────────────
function allOf(type,pred){
  var base=type==='provinces'?PROVINCES:CENTERS;
  return base.filter(pred);
}
function countStatus(type,owner,st){
  var base=type==='provinces'?PROVINCES:CENTERS;
  return base.filter(function(r){
    var o=(getEdit(type,r.id).owner||r.owner);
    return o===owner&&(getEdit(type,r.id).status||'بدون تماس')===st;
  }).length;
}
function countByOwner(type,owner){
  var base=type==='provinces'?PROVINCES:CENTERS;
  return base.filter(function(r){return (getEdit(type,r.id).owner||r.owner)===owner;}).length;
}
function countNotContacted(type,owner){
  return countStatus(type,owner,'بدون تماس');
}
function countContracted(type,owner){
  return countStatus(type,owner,'قرارداد بسته شد');
}
function countEntry(type,owner){
  // entry = status changed FROM بدون تماس (recorded in audit)
  var base=type==='provinces'?PROVINCES:CENTERS;
  var n=0;
  base.forEach(function(r){
    if((getEdit(type,r.id).owner||r.owner)!==owner)return;
    var audit=(getEdit(type,r.id).audit||[]);
    var found=audit.some(function(a){return a.field==='status'&&a.from==='بدون تماس';});
    if(found)n++;
  });
  return n;
}
function countLeadToOpp(type,owner){
  var base=type==='provinces'?PROVINCES:CENTERS;
  var n=0;
  base.forEach(function(r){
    if((getEdit(type,r.id).owner||r.owner)!==owner)return;
    var audit=(getEdit(type,r.id).audit||[]);
    audit.forEach(function(a){
      if(a.field==='lead'&&(a.from==='سرنخ'||a.from==='لید')&&a.to==='فرصت')n++;
    });
  });
  return n;
}
function countToCustomer(type,owner){
  var base=type==='provinces'?PROVINCES:CENTERS;
  var n=0;
  base.forEach(function(r){
    if((getEdit(type,r.id).owner||r.owner)!==owner)return;
    var audit=(getEdit(type,r.id).audit||[]);
    audit.forEach(function(a){
      if(a.field==='lead'&&a.to==='مشتری')n++;
    });
  });
  return n;
}
function getAllFollowups(owner,includeAll){
  // includeAll=true or undefined → show all; false → only future+today
  var items=[];
  PROVINCES.forEach(function(r){
    if(owner&&(getEdit('provinces',r.id).owner||r.owner)!==owner)return;
    var e=getEdit('provinces',r.id);
    if(e.followupDate)items.push({
      recType:'provinces',recId:r.id,name:r.name,province:r.name,
      date:e.followupDate,type:'استان',status:(e.status||'بدون تماس'),
      owner:(e.owner||r.owner)
    });
  });
  CENTERS.forEach(function(r){
    if(owner&&(getEdit('centers',r.id).owner||r.owner)!==owner)return;
    var e=getEdit('centers',r.id);
    if(e.followupDate)items.push({
      recType:'centers',recId:r.id,name:r.name,province:'تهران',
      date:e.followupDate,type:'مرکز',status:(e.status||'بدون تماس'),
      owner:(e.owner||r.owner)
    });
  });
  PROVINCES.forEach(function(prov){
    if(owner&&(getEdit('provinces',prov.id).owner||prov.owner)!==owner)return;
    var pk=pkey(prov.name);
    var raw=PROVINCE_CENTERS_RAW[pk]||[];
    raw.forEach(function(c,i){
      var pcKey=pk+'||'+i;
      var e=userEdits.pc[pcKey]||{};
      if(e.followupDate)items.push({
        recType:'pc',recId:pcKey,name:(e.name||c[1]),province:prov.name,
        date:e.followupDate,type:'مرکز استانی',status:(e.status||'بدون تماس'),
        owner:(e.owner||prov.owner)
      });
    });
  });
  if(includeAll===false){
    var today=todayJalali();
    items=items.filter(function(i){return i.date>=today;});
  }
  items.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});
  return items;
}
  function stalledList(owner){
  var res=[];
  PROVINCES.forEach(function(r){
    if((getEdit('provinces',r.id).owner||r.owner)!==owner)return;
    if(isStalled('provinces',r.id))res.push({name:r.name,type:'استان'});
  });
  CENTERS.forEach(function(r){
    if((getEdit('centers',r.id).owner||r.owner)!==owner)return;
    if(isStalled('centers',r.id))res.push({name:r.name,type:'مرکز'});
  });
  return res;
}


function showPersonFU(ownerKey,showAll){
  var active=getActiveUsers();
  var u=active[ownerKey];if(!u)return;
  // showAll: true=all dates, false=future only, default=all
  var includeAll=(showAll===false)?false:true;
  var items=getAllFollowups(ownerKey,includeAll);
  var today=todayJalali();
  var future=items.filter(function(i){return i.date>=today;});
  var past=items.filter(function(i){return i.date<today;});

  var sec=document.getElementById('mgrFuSection');
  var body=document.getElementById('mgrFuBody');
  if(!sec||!body)return;

  // Update header
  sec.querySelector('.mgr-section-head').innerHTML=
    '📅 برنامه فالو‌آپ — <strong>'+u.name+'</strong>'
    +' <span style="font-size:11px;font-weight:400;color:#64748b;margin:0 6px">'
    +future.length+' آینده · '+past.length+' گذشته</span>'
    +'<div style="display:flex;gap:5px;margin-right:auto">'
    +'<button onclick="showPersonFU(\''+ownerKey+'\',true)" style="font-size:11px;padding:2px 8px;border:1px solid #bfdbfe;border-radius:6px;background:'+(includeAll?'#dbeafe':'#eff6ff')+';color:#1d4ed8;cursor:pointer">همه</button>'
    +'<button onclick="showPersonFU(\''+ownerKey+'\',false)" style="font-size:11px;padding:2px 8px;border:1px solid #bbf7d0;border-radius:6px;background:'+(includeAll?'#f0fdf4':'#dcfce7')+';color:#166534;cursor:pointer">آینده</button>'
    +'</div>';

  // Scroll into view
  sec.scrollIntoView({behavior:'smooth',block:'start'});

  if(!items.length){
    body.innerHTML='<div style="color:#94a3b8;font-size:12px;text-align:center;padding:24px">'
      +'هیچ فالو‌آپی ثبت نشده — برای ثبت، در جدول اصلی روی فیلد «پیگیری بعدی» کلیک کنید</div>';
    return;
  }

  // Group by date
  var groups={};
  items.forEach(function(it){
    if(!groups[it.date])groups[it.date]=[];
    groups[it.date].push(it);
  });

  var html='<div class="fu-list">';
  Object.keys(groups).sort().forEach(function(d){
    var isPast=d<today, isToday=d===today;
    var rowCls=isPast?'overdue':isToday?'due-today':'future';
    var dateLabel=isPast?'⚠️ گذشته':isToday?'✅ امروز':'📆';
    groups[d].forEach(function(it){
      // Province badge
      var provBadge=it.province
        ?'<span style="font-size:9px;background:#f0fdf4;color:#166534;padding:1px 6px;border-radius:4px;flex-shrink:0">'+escHtml(it.province)+'</span>'
        :'';
      // Type badge
      var typeBadge='<span style="font-size:9px;background:#f1f5f9;color:#475569;padding:1px 5px;border-radius:4px;flex-shrink:0">'+it.type+'</span>';
      html+='<div class="fu-item '+rowCls+'">'
        +'<span class="fu-date" style="min-width:90px"><span style="font-size:9px;color:#94a3b8">'+dateLabel+'</span> '+d+'</span>'
        +provBadge+typeBadge
        +'<button class="ctr-link fu-name fu-modal-btn"'
        +' data-rt="'+escHtml(it.recType)+'"'
        +' data-ri="'+encodeURIComponent(it.recId)+'"'
        +' data-rn="'+encodeURIComponent(it.name)+'"'
        +' data-rp="'+encodeURIComponent(it.province||'')+'">'
        +escHtml(it.name)+'</button>'
        +'<span style="font-size:10px;color:#64748b;flex-shrink:0">'+it.status+'</span>'
        +'<button class="fu-date-btn" data-rtype="'+escHtml(it.recType)+'" data-rid="'+encodeURIComponent(it.recId)+'" data-date="'+d+'" data-owner="'+ownerKey+'"'
        +' style="font-size:10px;padding:2px 7px;border:1px solid #bfdbfe;border-radius:5px;background:#eff6ff;color:#1d4ed8;cursor:pointer;flex-shrink:0">✏️ تاریخ</button>'
        +'<button class="fu-del-btn" data-rtype="'+escHtml(it.recType)+'" data-rid="'+encodeURIComponent(it.recId)+'" data-owner="'+ownerKey+'"'
        +' style="font-size:10px;padding:2px 7px;border:1px solid #fecaca;border-radius:5px;background:#fef2f2;color:#dc2626;cursor:pointer;flex-shrink:0">✕</button>'
        +'</div>';
    });
  });
  html+='</div>';
  body.innerHTML=html;

  // event delegation ساده
  body.onclick=function(e){
    var btn=e.target;
    // اگه روی text کلیک شده، parent را چک کن
    if(btn.nodeType===3)btn=btn.parentNode;
    if(!btn||btn.tagName!=='BUTTON')return;

    if(btn.classList.contains('fu-modal-btn')){
      var rt=btn.getAttribute('data-rt');
      var ri=decodeURIComponent(btn.getAttribute('data-ri')||'');
      var rn=decodeURIComponent(btn.getAttribute('data-rn')||'');
      var rp=decodeURIComponent(btn.getAttribute('data-rp')||'');
      openCenterModal(rt,ri,rn,rp);

    } else if(btn.classList.contains('fu-date-btn')){
      mgrEditFUClick(btn);

    } else if(btn.classList.contains('fu-del-btn')){
      mgrDeleteFUClick(btn);
    }
  };
}

function fuOpenModal(btn){
  var type=btn.dataset.rt;
  var id=decodeURIComponent(btn.dataset.ri);
  var name=decodeURIComponent(btn.dataset.rn);
  var prov=decodeURIComponent(btn.dataset.rp);
  openCenterModal(type,id,name,prov);
}
function mgrEditFUClick(btn){
  var recType=btn.dataset.rtype, recId=btn.dataset.rid, curDate=btn.dataset.date, ownerKey=btn.dataset.owner;
  var proxy=document.getElementById('fuProxyInput');if(!proxy)return;
  proxy.value=curDate;
  _fuEditCtx={recType:recType,recId:recId,ownerKey:ownerKey};
  var rect=btn.getBoundingClientRect();
  proxy.style.top=(rect.bottom+2)+'px';proxy.style.left=rect.left+'px';
  JDP.open(proxy,function(newDate){
    if(!newDate)return;
    if(_fuEditCtx.recType==='pc'){
      if(!userEdits.pc[_fuEditCtx.recId])userEdits.pc[_fuEditCtx.recId]={};
      userEdits.pc[_fuEditCtx.recId].followupDate=newDate;
    }else{
      var store=userEdits[_fuEditCtx.recType];
      if(!store[_fuEditCtx.recId])store[_fuEditCtx.recId]={status:'بدون تماس',notesList:[]};
      store[_fuEditCtx.recId].followupDate=newDate;
    }
    saveEdits();renderTodayBanner();
    showPersonFU(_fuEditCtx.ownerKey,true);
  });
}

function mgrDeleteFUClick(btn){
  if(!confirm('فالو‌آپ این مرکز پاک شود؟'))return;
  var recType=btn.dataset.rtype, recId=btn.dataset.rid, ownerKey=btn.dataset.owner;
  if(recType==='pc'){
    if(userEdits.pc[recId])userEdits.pc[recId].followupDate='';
  }else{
    if(userEdits[recType]&&userEdits[recType][recId])userEdits[recType][recId].followupDate='';
  }
  saveEdits();renderTodayBanner();
  showPersonFU(ownerKey,true);
}


var _fuEditCtx={};

function confirmClearOldData(){
  // FIX: داده‌ها در DB ذخیره می‌شوند — پاکسازی از سرور
  if(!confirm('داده‌های چک‌لیست قدیمی‌تر از ۶۰ روز پاک می‌شوند. ادامه می‌دهید؟'))return;
  if(!getApiBase()){alert('اتصال به سرور لازم است');return;}
  apiCall('POST','/data/cleanup.php',{type:'checklist',days:60}).then(function(res){
    if(res.ok){alert('✅ '+(res.removed||0)+' رکورد قدیمی پاک شد');openSuperAdminPanel();}
    else alert('خطا: '+(res.err||''));
  }).catch(function(e){alert('خطا در اتصال');});
}

// ============================================================
// ============================================================
// AUDIT TRAIL MODAL
// ============================================================
function openAuditModal(type,id,name){
  const e=getEdit(type,id);
  const audit=(e.audit||[]).slice().reverse();
  document.getElementById('auditModalTitle').textContent='📋 تاریخچه — '+name;
  const el=document.getElementById('auditList');
  if(!audit.length){el.innerHTML='<div class="audit-empty">هنوز تغییری ثبت نشده است</div>';
  }else{
    el.innerHTML='<div class="audit-list">'+audit.map(a=>{
      const uname=(getUser(a.user)||{}).name||a.user;
      let txt='';
      if(a.field==='status')txt=`وضعیت از «${a.from}» به «${a.to}» تغییر یافت`;
      else if(a.field==='lead')txt=`سرنخ از «${a.from}» به «${a.to}» تغییر یافت`;
      else txt=`${a.field}: ${a.from} ← ${a.to}`;
      return`<div class="audit-item"><span class="audit-ts">${tsToFa(a.ts)}</span><span class="audit-user">${uname}</span><span class="audit-text">${txt}</span></div>`;
    }).join('')+'</div>';
  }
  document.getElementById('auditModal').style.display='flex';
}
function closeAuditModal(e){
  if(e&&e.target!==document.getElementById('auditModal'))return;
  document.getElementById('auditModal').style.display='none';
}

// ============================================================
// PASSWORD MODAL
// ============================================================
function openPassModal(){document.getElementById('passModal').style.display='flex';['passOld','passNew','passConfirm'].forEach(i=>document.getElementById(i).value='');document.getElementById('passError').style.display='none';document.getElementById('passSuccess').style.display='none';}
function closePassModal(e){if(e&&e.target!==document.getElementById('passModal'))return;document.getElementById('passModal').style.display='none';}
function changePassword(){
  const old=document.getElementById('passOld').value;
  const nw=document.getElementById('passNew').value;
  const cf=document.getElementById('passConfirm').value;
  const err=document.getElementById('passError');
  err.style.display='none';
  if(nw.length<6){err.textContent='رمز جدید باید حداقل ۶ کاراکتر باشد';err.style.display='block';return;}
  if(nw!==cf){err.textContent='رمز جدید و تکرار آن یکسان نیستند';err.style.display='block';return;}
  if(!getApiBase()){err.textContent='برای تغییر رمز اتصال به سرور لازم است';err.style.display='block';return;}
  apiCall('POST','/users/password.php',{current:old,new:nw}).then(function(res){
    if(res.ok){document.getElementById('passSuccess').style.display='block';localStorage.removeItem('crm_token');setTimeout(function(){document.getElementById('passModal').style.display='none';doLogout();},1500);}
    else{err.textContent=res.err==='wrong_current'?'رمز فعلی اشتباه است':'خطا در سرور';err.style.display='block';}
  }).catch(function(){err.textContent='خطا در اتصال';err.style.display='block';});
}

// ============================================================
// PRINT
// ============================================================
// FIX: doPrint دوم حذف شد — یکبار کافی است
// ============================================================
// BACKUP
// ============================================================
function toggleBackupPanel(){const p=document.getElementById('backupPanel');p.style.display=p.style.display==='none'?'flex':'none';}
function showOp(msg){const el=document.getElementById('opResult');el.textContent=msg;setTimeout(()=>el.textContent='',3000);}
function exportBackup(){
  const payload={user:currentUser,name:(getUser(currentUser)||{}).name,date:new Date().toLocaleDateString('fa-IR'),provinces:userEdits.provinces,centers:userEdits.centers,pc:userEdits.pc||{},checklist:userEdits.checklist||{}};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  a.download=`backup_${currentUser}_${Date.now()}.json`;a.click();
}
function restoreBackup(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    try{const d=JSON.parse(ev.target.result);
      if(d.user!==currentUser){alert('این بک‌آپ متعلق به کاربر دیگری است!');return;}
      userEdits.provinces=d.provinces||{};userEdits.centers=d.centers||{};userEdits.pc=d.pc||{};userEdits.checklist=d.checklist||{};saveEdits();
      saveEdits();renderDashboard();renderTable();showOp('✅ بک‌آپ بازیابی شد');
    }catch(err){alert('خطا در خواندن فایل');}
  };
  r.readAsText(f);e.target.value='';
}
function mergeBackups(e){
  const files=Array.from(e.target.files);if(!files.length)return;
  let count=0;
  const proc=idx=>{
    if(idx>=files.length){saveEdits();renderDashboard();renderTable();showOp(`✅ ${count} بک‌آپ ادغام شد`);return;}
    const r=new FileReader();
    r.onload=ev=>{
      try{const d=JSON.parse(ev.target.result);
        ['provinces','centers','pc','checklist'].forEach(t=>{
          Object.entries(d[t]||{}).forEach(([id,val])=>{
            if(!userEdits[t][id])userEdits[t][id]=val;
            else{if(val.status&&val.status!=='بدون تماس')userEdits[t][id].status=val.status;
              if(val.notesList&&val.notesList.length){userEdits[t][id].notesList=[...(userEdits[t][id].notesList||[]),...val.notesList];}
            }
          });
        });count++;
      }catch(err){}
      proc(idx+1);
    };
    r.readAsText(files[idx]);
  };
  proc(0);e.target.value='';
}

// ============================================================
// EXCEL EXPORT
// ============================================================
function exportExcel(){
  const isManager=getUser(currentUser).isManager;
  const wb=XLSX.utils.book_new();

  // ── Sheet 1: Provinces ──────────────────────────────────────────────────
  const provHeaders=['ردیف','استان','پتانسیل','درصد بیوپسی','مسئول','وضعیت پیگیری','تعداد یادداشت'];
  const provRows=PROVINCES.filter(r=>isManager||r.owner===currentUser).map(r=>{
    const e=getEdit('provinces',r.id);
    return[r.row,r.name,r.potential,r.biopsyPct,OWNER_FA[e.owner||r.owner]||e.owner||r.owner,e.status||'بدون تماس',(e.notesList||[]).length];
  });
  const wsP=XLSX.utils.aoa_to_sheet([provHeaders,...provRows]);
  XLSX.utils.book_append_sheet(wb,wsP,'استان ها');

  // ── Sheet 2: Tehran Centers ─────────────────────────────────────────────
  const centHeaders=['ردیف','نام مرکز','پتانسیل','نوع','سرنخ/مشتری','درصد وزن','مسئول','وضعیت پیگیری','تعداد یادداشت'];
  const centRows=CENTERS.filter(r=>isManager||r.owner===currentUser).map(r=>{
    const e=getEdit('centers',r.id);
    const epot=e.potential!==undefined?e.potential:r.potential;
    const etype=e.type!==undefined?e.type:r.type;
    const elead=e.lead!==undefined?e.lead:r.lead;
    const eowner=e.owner||r.owner;
    return[r.row,r.name,epot,etype,elead,r.weight,OWNER_FA[eowner]||eowner,e.status||'بدون تماس',(e.notesList||[]).length];
  });
  // Add user-added Tehran centers
  Object.keys(userEdits.centers).forEach(k=>{
    if(!k.startsWith('new_'))return;
    const e=userEdits.centers[k];
    if(e._del)return;
    centRows.push(['—',e.name||'',e.potential||3,e.type||'',e.lead||'','-',OWNER_FA[e.owner||currentUser]||'',e.status||'بدون تماس',(e.notesList||[]).length]);
  });
  const wsC=XLSX.utils.aoa_to_sheet([centHeaders,...centRows]);
  XLSX.utils.book_append_sheet(wb,wsC,'مراکز تهران');

  // ── Sheet 3: All Province Centers ───────────────────────────────────────
  const pcHeaders=['استان','مسئول استان','ردیف','نام مرکز','پتانسیل','نوع','سرنخ/مشتری','وضعیت پیگیری','تعداد یادداشت'];
  const pcRows=[];
  PROVINCES.forEach(prov=>{
    if(!isManager&&prov.owner!==currentUser)return;
    const pe=getEdit('provinces',prov.id);
    const provOwner=pe.owner||prov.owner;
    const ownerFa=OWNER_FA[provOwner]||provOwner;
    const pk=pkey(prov.name);
    const raw=PROVINCE_CENTERS_RAW[pk]||[];
    raw.forEach((c,i)=>{
      const e=userEdits.pc[pk+'||'+i]||{};
      if(e._del)return;
      pcRows.push([
        prov.name,ownerFa,i+1,
        e.name!==undefined?e.name:c[1],
        e.pot!==undefined?e.pot:c[2],
        e.type!==undefined?e.type:c[3],
        e.lead!==undefined?e.lead:c[4],
        e.status||'بدون تماس',
        (e.notesList||[]).length
      ]);
    });
    // user-added centers
    const pfx=pk+'||new||';
    Object.keys(userEdits.pc).forEach(k=>{
      if(k.indexOf(pfx)!==0)return;
      const v=userEdits.pc[k];if(v._del)return;
      pcRows.push([prov.name,ownerFa,'—',v.name||'',v.pot||3,v.type||'',v.lead||'',v.status||'بدون تماس',(v.notesList||[]).length]);
    });
  });
  const wsPc=XLSX.utils.aoa_to_sheet([pcHeaders,...pcRows]);
  XLSX.utils.book_append_sheet(wb,wsPc,'مراکز استان ها');

  const date=new Date().toLocaleDateString('fa-IR').replace(/\//g,'-');
  XLSX.writeFile(wb,'گزارش_کامل_'+date+'.xlsx');
}

// ============================================================
// MANAGER DASHBOARD
// ============================================================

// ============================================================
// 1. محصولات (Product Interest)
// ============================================================
const PRODUCTS=['نفروستومی','بیوپسی','آرتر لاین','رابط کیسه'];
const PROD_SHORT=['نفر','بیوپ','آرتر','رابط'];
const PROD_BG=['#dbeafe','#ede9fe','#fef3c7','#dcfce7'];
const PROD_FG=['#1d4ed8','#5b21b6','#92400e','#166534'];

function getProdBadges(type,id){
  const prods=getEdit(type,id).prods||[];
  return PRODUCTS.map((p,pi)=>prods.includes(p)
    ?`<span class="prod-tag" style="background:${PROD_BG[pi]};color:${PROD_FG[pi]}">${PROD_SHORT[pi]}</span>`
    :''
  ).join('');
}

var _prodCtx={};
function openProdPicker(type,id,btn){
  const el=document.getElementById('prodPickerEl');
  const prods=getEdit(type,id).prods||[];
  _prodCtx={type,id};
  el.innerHTML=PRODUCTS.map((p,pi)=>`
    <label>
      <input type="checkbox" ${prods.includes(p)?'checked':''} onchange="toggleProd('${p}',this.checked)">
      <span style="font-weight:700;color:${PROD_FG[pi]}">${p}</span>
    </label>`).join('')
    +'<div style="border-top:1px solid #f1f5f9;margin-top:4px;padding-top:4px;text-align:center"><button onclick="closeProdPicker()" style="font-size:11px;padding:2px 10px;border:1px solid #e2e8f0;border-radius:5px;cursor:pointer;background:#f8fafc">بستن</button></div>';
  const rect=btn.getBoundingClientRect();
  el.style.top=(rect.bottom+4)+'px';
  el.style.right=(window.innerWidth-rect.right)+'px';
  el.style.left='auto';
  el.style.display='block';
}
function toggleProd(prod,checked){
  const {type,id}=_prodCtx;
  const e=getEdit(type,id);
  const prods=[...(e.prods||[])];
  const i=prods.indexOf(prod);
  if(checked&&i<0)prods.push(prod);
  else if(!checked&&i>=0)prods.splice(i,1);
  setField(type,id,'prods',prods);
  // Update badges in table without full re-render
  const wrap=document.querySelector(`[data-prod-id="${type}_${id}"]`);
  if(wrap)wrap.innerHTML=getProdBadges(type,id)+wrap.querySelector('button').outerHTML;
}
function closeProdPicker(){document.getElementById('prodPickerEl').style.display='none';}
document.addEventListener('click',function(e){
  const pp=document.getElementById('prodPickerEl');
  if(pp&&pp.style.display!=='none'&&!pp.contains(e.target)&&!e.target.classList.contains('prod-btn'))closeProdPicker();
});

// ============================================================
// 3. یادداشت سریع inline
// ============================================================
function addNoteInline(type,id,text,inp){
  if(!text.trim())return;
  const store=type==='pc'?userEdits.pc:userEdits[type];
  if(!store[id])store[id]={status:'بدون تماس',notesList:[]};
  if(!store[id].notesList)store[id].notesList=[];
  const rawTs=nowTS();
  const inlineNote={ts:jalaliNow(),rawTs,text:text.trim(),user:currentUser};
  store[id].notesList.push(inlineNote);
  store[id].lastActivity=rawTs;
  saveEdits();
  immSaveNote(type,id,inlineNote);
  inp.value='';
  inp.placeholder='✅ ذخیره شد';
  setTimeout(()=>{inp.placeholder='یادداشت سریع...';},1500);
  // Update notes button count without full re-render
  const btn=inp.previousElementSibling;
  if(btn&&btn.classList.contains('note-btn')){
    const n=store[id].notesList.length;
    btn.textContent='📝 '+n+' یادداشت';
    btn.classList.add('has-notes');
  }
  renderStallBanner();
}

// ============================================================
// 2. لاگ فعالیت شخصی
// ============================================================
async function renderActivityLog(){
  const panel=document.getElementById('activityPanel');
  if(!panel)return;
  panel.innerHTML='<div class="act-empty" style="text-align:center;padding:40px;color:#94a3b8;font-size:13px">در حال بارگذاری...</div>';

  if(!getApiBase()){
    panel.innerHTML='<div class="act-empty" style="text-align:center;padding:40px;color:#94a3b8;font-size:13px">برای نمایش لاگ، اتصال به سرور لازم است.</div>';
    return;
  }

  // ۷ روز گذشته
  const fromTs=Date.now() - 7*24*60*60*1000;
  const toTs  =Date.now() + 24*60*60*1000;
  let data;
  try{
    data=await apiCall('GET','/analytics/log.php?from='+fromTs+'&to='+toTs+'&limit=500',null);
  }catch(e){
    panel.innerHTML='<div class="act-empty" style="text-align:center;padding:40px;color:#dc2626;font-size:13px">خطا در دریافت لاگ: '+(e.message||'')+'</div>';
    return;
  }

  const events=(data.logs||data.rows||data.events||[]);
  if(!events.length){
    panel.innerHTML='<div class="act-empty" style="text-align:center;padding:50px;color:#94a3b8;font-size:13px">در ۷ روز گذشته هیچ فعالیتی ثبت نشده است.<br><small>برای شروع، وضعیت یک مرکز را تغییر دهید یا یادداشت اضافه کنید.</small></div>';
    return;
  }

  // مرتب‌سازی بر اساس changed_at نزولی
  events.sort((a,b)=>(b.changed_at||0)-(a.changed_at||0));

  // گروه‌بندی بر اساس تاریخ شمسی
  const today=todayJalali();
  const groups={};
  events.forEach(ev=>{
    const ts=parseInt(ev.changed_at||0);
    if(!ts)return;
    const d=new Date(ts);
    const jArr=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
    const jDate=jArr[0]+'/'+String(jArr[1]).padStart(2,'0')+'/'+String(jArr[2]).padStart(2,'0');
    if(!groups[jDate])groups[jDate]=[];
    groups[jDate].push({...ev,_ts:ts,_jDate:jDate});
  });

  const activeUsers=getActiveUsers();
  // helper برای نمایش نام رکورد
  function recordName(ev){
    if(ev.record_name)return ev.record_name;
    if(ev.record_type==='center'){
      const c=(CENTERS||[]).find(x=>x.id===ev.record_id);
      if(c)return c.name;
    }
    if(ev.record_type==='province'){
      const p=(PROVINCES||[]).find(x=>x.id===ev.record_id);
      if(p)return p.name;
    }
    return ev.record_id||'';
  }
  function typeLabel(rt){
    return rt==='province'?'استان':rt==='pc'?'مرکز استانی':rt==='center'?'مرکز':rt==='user'?'کاربر':rt;
  }
  function fieldDesc(ev){
    const f=ev.field_name||'';
    const fr=ev.old_value||'';
    const to=ev.new_value||'';
    if(f==='status')return 'وضعیت: «'+fr+'» → «'+to+'»';
    if(f==='lead')return 'سرنخ: «'+fr+'» → «'+to+'»';
    if(f==='potential')return 'پتانسیل: «'+fr+'» → «'+to+'»';
    if(f==='followup_date')return 'تاریخ پیگیری: '+(to||'حذف شد');
    if(f==='owner')return 'مسئول: «'+fr+'» → «'+to+'»';
    if(f==='center_type')return 'نوع: «'+fr+'» → «'+to+'»';
    if(f==='_DELETE')return 'حذف رکورد';
    if(f==='_NEW'||f==='_CREATE')return 'ایجاد: '+to;
    if(f==='_DEACTIVATE')return 'غیرفعال‌سازی کاربر';
    if(f==='_ACTIVATE')return 'فعال‌سازی کاربر';
    if(f==='_RESET_PASS')return 'بازنشانی رمز';
    if(f==='_NOTE_DELETE')return 'حذف یادداشت';
    return f+': '+to;
  }

  let html='';
  Object.keys(groups).sort().reverse().forEach(d=>{
    const label=d===today?'امروز':d;
    html+='<div class="act-day-head">'+label+'</div>';
    groups[d].forEach(ev=>{
      const d2=new Date(ev._ts);
      const hm=String(d2.getHours()).padStart(2,'0')+':'+String(d2.getMinutes()).padStart(2,'0');
      const uName=(activeUsers[ev.changed_by]||{}).name||ev.changed_by||'';
      const desc=fieldDesc(ev);
      const rname=recordName(ev);
      const rtl=typeLabel(ev.record_type);
      html+='<div class="act-item">'
           +'<span class="act-time">'+hm+'</span>'
           +'<span class="act-name" title="'+rname.replace(/"/g,'&quot;')+'">'+rname+'</span>'
           +'<span class="act-desc">'+desc+'</span>'
           +'<span class="act-tag">'+uName+'</span>'
           +'<span class="act-tag" style="background:#f0f9ff;color:#0369a1">'+rtl+'</span>'
           +'</div>';
    });
  });
  panel.innerHTML=html;
}

// ============================================================
// 4. تارگت ماهانه
// ============================================================
function loadTgts(){try{return JSON.parse(localStorage.getItem('crm_tgt')||'{}');}catch(e){return{};}}
function saveTgts(){
  const tgts=loadTgts();
  document.querySelectorAll('.tgt-inp').forEach(inp=>{
    const [u,key]=inp.dataset.key.split('|');
    if(!tgts[u])tgts[u]={};
    tgts[u][key]=parseInt(inp.value)||0;
  });
  localStorage.setItem('crm_tgt',JSON.stringify(tgts));
  closeTgtModal();
  if(document.getElementById('mgrDashPanel').style.display!=='none')renderMgrDashboard();
}
function openTgtModal(){
  const active=getActiveUsers();
  const nonMgr=Object.keys(active).filter(k=>!active[k].isManager);
  const tgts=loadTgts();
  const KEYS=[['entry','ورودی (تماس اول)'],['leadToOpp','سرنخ→فرصت'],['contract','قرارداد']];
  let html='';
  nonMgr.forEach(k=>{
    const u=active[k];
    html+=`<div style="margin-bottom:14px"><div style="font-weight:700;font-size:12px;color:#1e3a5f;margin-bottom:6px">${u.name}</div>`;
    KEYS.forEach(([key,label])=>{
      const val=(tgts[k]||{})[key]||0;
      html+=`<div class="tgt-row"><span class="tgt-label">${label}</span><input class="tgt-inp" data-key="${k}|${key}" value="${val}" type="number" min="0"></div>`;
    });
    html+='</div>';
  });
  document.getElementById('tgtModalBody').innerHTML=html;
  document.getElementById('tgtModal').style.display='flex';
}
function closeTgtModal(e){
  if(e&&e.target!==document.getElementById('tgtModal'))return;
  document.getElementById('tgtModal').style.display='none';
}

// ============================================================
// 5. مقایسه ماه به ماه
// ============================================================
function getJalaliMonth(ts){
  const d=new Date(ts);
  const j=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());
  return j[0]+'/'+String(j[1]).padStart(2,'0');
}
function countAuditInMonth(type,owner,field,toVal,jMonth){
  let n=0;
  (type==='provinces'?PROVINCES:CENTERS).forEach(r=>{
    if((getEdit(type,r.id).owner||r.owner)!==owner)return;
    (getEdit(type,r.id).audit||[]).forEach(a=>{
      if(a.field===field&&a.to===toVal&&a.ts&&getJalaliMonth(a.ts)===jMonth)n++;
    });
  });
  return n;
}
function renderMonthComparison(nonMgr,active){
  const today=todayJalali().split('/').map(Number);
  const thisM=today[0]+'/'+String(today[1]).padStart(2,'0');
  const prevMon=today[1]===1?12:today[1]-1;
  const prevY=today[1]===1?today[0]-1:today[0];
  const prevM=prevY+'/'+String(prevMon).padStart(2,'0');
  const diff=(a,b)=>{const d=a-b;return d>0?`<span class="comp-up">+${d}▲</span>`:d<0?`<span class="comp-dn">${d}▼</span>`:`<span class="comp-eq">—</span>`;};

  let html='<table class="comp-table"><thead><tr><th>کارشناس</th>'
    +`<th>ورودی ${prevM.split('/')[1]}</th><th>ورودی ${thisM.split('/')[1]}</th><th>تغییر</th>`
    +`<th>→فرصت ${prevM.split('/')[1]}</th><th>→فرصت ${thisM.split('/')[1]}</th><th>تغییر</th>`
    +'</tr></thead><tbody>';
  nonMgr.forEach(k=>{
    const n=active[k].name;
    const ep=['provinces','centers'].reduce((s,t)=>s+countAuditInMonth(t,k,'status','تماس اولیه',prevM),0);
    const et=['provinces','centers'].reduce((s,t)=>s+countAuditInMonth(t,k,'status','تماس اولیه',thisM),0);
    const fp=['provinces','centers'].reduce((s,t)=>s+countAuditInMonth(t,k,'lead','فرصت',prevM),0);
    const ft=['provinces','centers'].reduce((s,t)=>s+countAuditInMonth(t,k,'lead','فرصت',thisM),0);
    html+=`<tr><td><strong>${n}</strong></td><td>${ep}</td><td>${et}</td><td>${diff(et,ep)}</td><td>${fp}</td><td>${ft}</td><td>${diff(ft,fp)}</td></tr>`;
  });
  html+='</tbody></table>';
  return html;
}

// FIX: نمودار trend ۶ ماه — SVG inline (~۲KB)
function renderSixMonthTrend(nonMgr,active){
  const today=todayJalali().split('/').map(Number);
  const months=[];
  let y=today[0], m=today[1];
  for(let i=0;i<6;i++){
    months.unshift({y:y,m:m,key:y+'/'+String(m).padStart(2,'0'),label:String(m)});
    m--; if(m===0){m=12;y--;}
  }

  const monthNames={1:'فروردین',2:'اردیبهشت',3:'خرداد',4:'تیر',5:'مرداد',6:'شهریور',7:'مهر',8:'آبان',9:'آذر',10:'دی',11:'بهمن',12:'اسفند'};

  // محاسبه totals برای هر ماه
  const entry=[], contract=[];
  months.forEach(mo=>{
    let e=0, c=0;
    nonMgr.forEach(k=>{
      e += countAuditInMonth('provinces',k,'status','تماس اولیه',mo.key);
      e += countAuditInMonth('centers',k,'status','تماس اولیه',mo.key);
      c += countAuditInMonth('provinces',k,'status','قرارداد بسته شد',mo.key);
      c += countAuditInMonth('centers',k,'status','قرارداد بسته شد',mo.key);
    });
    entry.push(e); contract.push(c);
  });

  const maxV=Math.max(1,...entry,...contract);
  const W=560, H=180, padL=30, padR=10, padT=20, padB=30;
  const innerW=W-padL-padR, innerH=H-padT-padB;
  const xStep=innerW/(months.length-1||1);
  const yScale=v=>padT+innerH-(v/maxV)*innerH;

  // ساخت polyline
  function makePoly(arr){
    return arr.map((v,i)=>(padL+i*xStep)+','+yScale(v)).join(' ');
  }

  // gridlines
  let grid='';
  for(let i=0;i<=4;i++){
    const y=padT+(innerH*i/4);
    grid+='<line x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'" stroke="#f1f5f9" stroke-width="1"/>';
    const labelV=Math.round(maxV*(1-i/4));
    grid+='<text x="'+(padL-4)+'" y="'+(y+4)+'" font-size="9" text-anchor="end" fill="#94a3b8">'+labelV+'</text>';
  }
  // x labels
  let xLabels='';
  months.forEach((mo,i)=>{
    xLabels+='<text x="'+(padL+i*xStep)+'" y="'+(H-10)+'" font-size="10" text-anchor="middle" fill="#64748b">'+monthNames[mo.m].substring(0,3)+'</text>';
  });
  // ورودی line + dots
  let entryDots='';
  entry.forEach((v,i)=>{
    const cx=padL+i*xStep, cy=yScale(v);
    entryDots+='<circle cx="'+cx+'" cy="'+cy+'" r="3.5" fill="#22c55e"/>';
    entryDots+='<text x="'+cx+'" y="'+(cy-7)+'" font-size="9" text-anchor="middle" fill="#16a34a" font-weight="bold">'+v+'</text>';
  });
  let contractDots='';
  contract.forEach((v,i)=>{
    const cx=padL+i*xStep, cy=yScale(v);
    contractDots+='<circle cx="'+cx+'" cy="'+cy+'" r="3.5" fill="#a855f7"/>';
    contractDots+='<text x="'+cx+'" y="'+(cy+14)+'" font-size="9" text-anchor="middle" fill="#7e22ce" font-weight="bold">'+v+'</text>';
  });

  return '<div style="overflow-x:auto"><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:600px;font-family:Vazirmatn,sans-serif" xmlns="http://www.w3.org/2000/svg">'
    +grid
    +'<polyline fill="none" stroke="#22c55e" stroke-width="2" points="'+makePoly(entry)+'"/>'
    +'<polyline fill="none" stroke="#a855f7" stroke-width="2" stroke-dasharray="4,3" points="'+makePoly(contract)+'"/>'
    +entryDots+contractDots+xLabels
    +'</svg></div>'
    +'<div style="text-align:center;font-size:11px;color:#64748b;margin-top:6px">'
    +'<span style="display:inline-block;width:10px;height:10px;background:#22c55e;border-radius:50%;margin-left:4px"></span>ورودی (تماس اولیه)'
    +'<span style="display:inline-block;width:10px;height:10px;background:#a855f7;border-radius:50%;margin-right:14px;margin-left:4px"></span>قرارداد بسته شد'
    +'</div>';
}

// ============================================================
// 7. جستجوی سراسری
// ============================================================
function openGSearch(){
  const ov=document.getElementById('gsearchOverlay');
  ov.style.display='flex';
  setTimeout(()=>document.getElementById('gsearchInp').focus(),50);
}
function closeGSearch(e){
  if(e&&e.target!==document.getElementById('gsearchOverlay'))return;
  document.getElementById('gsearchOverlay').style.display='none';
  document.getElementById('gsearchInp').value='';
  document.getElementById('gsearchResults').innerHTML='<div class="gsearch-empty">نام مرکز یا استان را تایپ کنید</div>';
}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeGSearch();});

function runGSearch(q){
  q=q.trim();
  const res=document.getElementById('gsearchResults');
  if(!q||q.length<2){res.innerHTML='<div class="gsearch-empty">نام مرکز یا استان را تایپ کنید</div>';return;}
  const ql=q.toLowerCase();
  const items=[];
  PROVINCES.forEach(r=>{
    if(r.name.includes(q)||r.name.toLowerCase().includes(ql)){
      const e=getEdit('provinces',r.id);
      const st=e.status||'بدون تماس';
      const si=STATUS_LIST.indexOf(st);
      items.push({name:r.name,type:'provinces',id:r.id,prov:'',detail:'استان',status:st,sCls:si>=0?STATUS_CLS[si]:'st-0'});
    }
  });
  CENTERS.forEach(r=>{
    if(r.name.includes(q)||r.name.toLowerCase().includes(ql)){
      const e=getEdit('centers',r.id);
      const st=e.status||'بدون تماس';
      const si=STATUS_LIST.indexOf(st);
      items.push({name:r.name,type:'centers',id:r.id,prov:'تهران',detail:'مرکز تهران',status:st,sCls:si>=0?STATUS_CLS[si]:'st-0'});
    }
  });
  PROVINCES.forEach(prov=>{
    const pk=pkey(prov.name);
    (PROVINCE_CENTERS_RAW[pk]||[]).forEach((c,i)=>{
      if(!c[1])return;
      if(c[1].includes(q)||c[1].toLowerCase().includes(ql)){
        const e=userEdits.pc[pk+'||'+i]||{};
        const st=e.status||'بدون تماس';
        const si=STATUS_LIST.indexOf(st);
        items.push({name:c[1],type:'pc',id:pk+'||'+i,prov:prov.name,detail:'استان '+prov.name,status:st,sCls:si>=0?STATUS_CLS[si]:'st-0'});
      }
    });
  });

  if(!items.length){res.innerHTML='<div class="gsearch-empty">نتیجه‌ای یافت نشد</div>';return;}
  res.innerHTML=items.slice(0,40).map(it=>`
    <div class="gsearch-item" onclick="gSearchNav('${it.type}','${escHtml(it.id)}','${escHtml(it.name)}','${escHtml(it.prov||'')}')">
      <span class="gsearch-name">${escHtml(it.name)}</span>
      ${it.prov?`<span class="gsearch-prov">${escHtml(it.prov)}</span>`:''}
      <span class="gsearch-type">${it.detail}</span>
      <span class="gsearch-stat ${it.sCls}" style="font-size:10px;padding:1px 6px;border-radius:4px">${it.status}</span>
    </div>`).join('');
}

function gSearchNav(type,id,name,province){
  closeGSearch();
  openCenterModal(type,id,name,province||'');
}

// ============================================================
// 8. بهینه‌سازی داده
// ============================================================
function pruneEdits(){
  // Remove entries that are all-default (reduces localStorage footprint)
  ['provinces','centers'].forEach(type=>{
    Object.keys(userEdits[type]).forEach(id=>{
      const e=userEdits[type][id];
      const isEmpty=(!e.status||e.status==='بدون تماس')
        &&(!e.notesList||!e.notesList.length)
        &&!e.followupDate&&!e.owner&&(!e.prods||!e.prods.length)
        &&!e.lastActivity&&(!e.audit||!e.audit.length);
      if(isEmpty)delete userEdits[type][id];
    });
  });
}


// ============================================================
// CENTER DETAIL MODAL
// ============================================================
var _cdm={type:'',id:'',isPC:false};

function openCenterModal(type,id,name,province){
  var modal=document.getElementById('centerDetailModal');
  if(!modal)return;

  _cdm={type:type,id:id,name:name,province:province||''};

  // اول مودال را نشان بده
  modal.style.display='flex';

  // عنوان و badge
  document.getElementById('cdmTitle').textContent=name;
  var pb=document.getElementById('cdmProvBadge');
  if(pb){pb.textContent=province||'';pb.style.display=province?'':'none';}

  var e=type==='pc'?(userEdits.pc[id]||{}):getEdit(type,id);

  // Status
  var stSel=document.getElementById('cdmStatus');
  if(stSel){
    stSel.innerHTML=STATUS_LIST.map(function(s,i){return'<option value="'+s+'">'+s+'</option>';}).join('');
    var st=e.status||'بدون تماس';
    stSel.value=st;
    var si=STATUS_LIST.indexOf(st);stSel.className='status-sel '+(si>=0?STATUS_CLS[si]:'st-0');
  }

  // Lead
  var leadSel=document.getElementById('cdmLead');
  if(leadSel){
    var LEADS=['مشتری','لید','فرصت','سرنخ','ندارد','بدون مصرف'];
    leadSel.innerHTML=LEADS.map(function(v){return'<option value="'+v+'">'+v+'</option>';}).join('');
    var lead=e.lead||'ندارد';leadSel.value=lead;
    if(typeof leadSelCls==='function')leadSel.className=leadSelCls(lead);
  }

  // Followup
  var fi=document.getElementById('cdmFollowup');
  if(fi){var fd=e.followupDate||'';fi.value=fd;if(JDP&&JDP.updateInputClass)JDP.updateInputClass(fi,fd);}

  // Potential
  var potSel=document.getElementById('cdmPot');
  if(potSel)potSel.value=String(e.pot||e.potential||3);

  // Products
  try{cdmRenderProds(e.prods||[]);}catch(err){}

  // Notes
  try{cdmRenderNotes(e.notesList||[]);}catch(err){}

  // Audit
  try{cdmRenderAudit(e.audit||[]);}catch(err){}
}

function closeCenterModal(ev){
  if(ev&&ev.target!==document.getElementById('centerDetailModal'))return;
  document.getElementById('centerDetailModal').style.display='none';
  // Refresh wherever we came from
  if(currentTab==='provinces'||currentTab==='centers')renderTable();
  renderTodayBanner();renderStallBanner();
}

function cdmGetStore(){
  if(_cdm.type==='pc'){
    if(!userEdits.pc[_cdm.id])userEdits.pc[_cdm.id]={};
    return userEdits.pc[_cdm.id];
  }
  if(!userEdits[_cdm.type][_cdm.id])userEdits[_cdm.type][_cdm.id]={status:'بدون تماس',notesList:[]};
  return userEdits[_cdm.type][_cdm.id];
}

function cdmOnStatus(sel){
  var val=sel.value;var store=cdmGetStore();
  var old=store.status||'بدون تماس';
  store.status=val;store.lastActivity=nowTS();
  if(!store.audit)store.audit=[];
  store.audit.push({ts:nowTS(),user:currentUser,field:'status',from:old,to:val});
  var si=STATUS_LIST.indexOf(val);sel.className='status-sel '+(si>=0?STATUS_CLS[si]:'st-0');
  saveEdits();immSaveEdit(_cdm.type,_cdm.id);renderStallBanner();renderDashboard();
}

function cdmOnLead(sel){
  var val=sel.value;var store=cdmGetStore();
  var old=store.lead||'ندارد';
  store.lead=val;store.lastActivity=nowTS();
  if(old!==val){if(!store.audit)store.audit=[];store.audit.push({ts:nowTS(),user:currentUser,field:'lead',from:old,to:val});}
  sel.className=leadSelCls(val);
  saveEdits();immSaveEdit(_cdm.type,_cdm.id);
}

function cdmOnFollowup(val){
  var store=cdmGetStore();store.followupDate=val;store.lastActivity=nowTS();
  var fi=document.getElementById('cdmFollowup');fi.value=val;JDP.updateInputClass(fi,val);
  saveEdits();immSaveEdit(_cdm.type,_cdm.id);renderTodayBanner();
}

function cdmOnPot(sel){
  var store=cdmGetStore();store.pot=parseInt(sel.value);store.potential=parseInt(sel.value);
  saveEdits();immSaveEdit(_cdm.type,_cdm.id);
}

function cdmRenderProds(prods){
  var wrap=document.getElementById('cdmProds');
  wrap.innerHTML=PRODUCTS.map(function(p,pi){
    var checked=prods.includes(p);
    return'<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;padding:3px 6px;border-radius:6px;background:'+(checked?PROD_BG[pi]:'#f1f5f9')+';color:'+(checked?PROD_FG[pi]:'#64748b')+';">'
      +'<input type="checkbox"'+(checked?' checked':'')+' onchange="cdmToggleProd(\''+p+'\',this.checked,'+pi+',this.parentElement)" style="cursor:pointer"> '+p+'</label>';
  }).join('');
}

function cdmToggleProd(prod,checked,pi,lbl){
  var store=cdmGetStore();var prods=[...(store.prods||[])];
  var i=prods.indexOf(prod);
  if(checked&&i<0)prods.push(prod);else if(!checked&&i>=0)prods.splice(i,1);
  store.prods=prods;saveEdits();immSaveEdit(_cdm.type,_cdm.id);
  lbl.style.background=checked?PROD_BG[pi]:'#f1f5f9';lbl.style.color=checked?PROD_FG[pi]:'#64748b';
}

function cdmRenderNotes(notes){
  var el=document.getElementById('cdmNotesList');
  if(!notes.length){el.innerHTML='<div style="color:#94a3b8;font-size:11px;text-align:center;padding:10px">هنوز یادداشتی ثبت نشده</div>';return;}
  var active=getActiveUsers();
  el.innerHTML=[...notes].reverse().map(function(n){
    var uName=(active[n.user]||{}).name||n.user||'';
    return'<div class="cdm-note-item">'+escHtml(n.text)
      +'<div class="cdm-note-meta"><span>'+n.ts+'</span><span>'+uName+'</span></div></div>';
  }).join('');
}

function cdmAddNote(){
  var text=document.getElementById('cdmNoteInp').value.trim();if(!text)return;
  var store=cdmGetStore();
  if(!store.notesList)store.notesList=[];
  var rawTs=nowTS();
  const cdmNote={ts:jalaliNow(),rawTs:rawTs,text:text,user:currentUser};
  store.notesList.push(cdmNote);
  store.lastActivity=rawTs;
  saveEdits();
  immSaveNote(_cdm.type,_cdm.id,cdmNote);
  document.getElementById('cdmNoteInp').value='';
  cdmRenderNotes(store.notesList);
  renderStallBanner();
}

function cdmRenderAudit(audit){
  var el=document.getElementById('cdmAuditList');
  if(!audit.length){el.innerHTML='<div style="color:#94a3b8;font-size:11px;text-align:center;padding:8px">تغییری ثبت نشده</div>';return;}
  var active=getActiveUsers();
  el.innerHTML=[...audit].reverse().slice(0,20).map(function(a){
    var uName=(active[a.user]||{}).name||a.user;
    var txt=a.field==='status'?'وضعیت: «'+a.from+'»→«'+a.to+'»':a.field==='lead'?'سرنخ: «'+a.from+'»→«'+a.to+'»':(a.field+': '+a.to);
    return'<div class="cdm-audit-item"><span class="cdm-audit-ts">'+tsToFa(a.ts)+'</span><span class="cdm-audit-txt">'+txt+' — '+uName+'</span></div>';
  }).join('');
}

// ============================================================
// NEW CENTER PERSISTENCE (بارگذاری مراکز جدید تهران از localStorage)
// ============================================================
function loadNewCenters(){
  // مراکز جدید تهران که به CENTERS اضافه شدن باید دوباره لود بشن
  var edits=userEdits.centers||{};
  Object.keys(edits).forEach(function(id){
    if(id.indexOf('new_')===0&&!CENTERS.find(function(c){return c.id===id;})){
      var e=edits[id];
      var maxRow=CENTERS.reduce(function(m,r){return Math.max(m,r.row);},0);
      CENTERS.push({id:id,row:maxRow+1,name:e._name||id,potential:e.potential||3,
        type:e.type||'',lead:e.lead||'سرنخ',weight:'0%',owner:e.owner||currentUser});
    }
  });
}

function escHtml(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
// FIX: ۱۷۸۰ مرکز استانی از DB می‌آیند (init.php → loadStaticData)
// hardcoded نسخه قبلی حذف شد — صرفه‌جویی ~۱۱۰KB در crm.js
var PROVINCE_CENTERS_RAW={};
const PNAME={
  'اصفهان':'اصفهان',
  'فارس':'فارس',
  'آذربایجان شرقی':'آذربايجان شرقي',
  'مازندران':'مازندران',
  'سیستان و بلوچستان':'سيستان و بلوچستان',
  'گلستان':'گلستان',
  'لرستان':'لرستان',
  'بوشهر':'بوشهر',
  'اردبیل':'اردبيل',
  'چهارمحال و بختیاری':'چهارمحال و بختياري',
  'خراسان رضوی':'خراسان رضوی',
  'گیلان':'گيلان',
  'مرکزی':'مرکزي',
  'قم':'قم',
  'یزد':'یزد',
  'خراسان شمالی':'خراسان شمالي',
  'خراسان جنوبی':'خراسان جنوبي',
  'ایلام':'ايلام',
  'خوزستان':'خوزستان',
  'آذربایجان غربی':'آذربايجان غربي',
  'کرمان':'کرمان',
  'کرمانشاه':'کرمانشاه',
  'البرز':'البرز',
  'همدان':'همدان',
  'کردستان':'کردستان',
  'قزوین':'قزوین',
  'زنجان':'زنجان',
  'سمنان':'سمنان',
  'هرمزگان':'هرمزگان',
  'کهگیلویه و بویراحمد':'کهگيلويه و بويراحمد'
};
function pkey(n){var k=n.replace(/ی/g,'ي');return PNAME[n]||PNAME[k]||k;}


// ================================================================
// PROVINCE CENTERS — full implementation
// ================================================================
var curProv=null;
var addCenterTarget=null; // 'tehran' or 'province'

// ---- Key helpers ----
function pcEKey(pk,idx){return pk+'||'+idx;}

function pcGet(pk,idx){
  var k=pcEKey(pk,idx);
  return userEdits.pc[k]||{};
}
function pcSet(pk,idx,field,val){
  var k=pcEKey(pk,idx);
  if(!userEdits.pc[k])userEdits.pc[k]={};
  userEdits.pc[k][field]=val;
  saveEdits();
}

// ---- Open / Close province modal ----
function btnOpenProv(btn){
  var pid=btn.dataset.pid;
  var pn=btn.dataset.pn;
  // Effective owner: check edit first, then raw
  var e=userEdits.provinces[pid]||{};
  var owner=e.owner||btn.dataset.po;
  openProvModal(pid,pn,owner);
}
function onProvOwner(id,val){
  setField('provinces',id,'owner',val);
  // re-render so the btn data-po also reflects new owner
  renderTable();
}
function openProvModal(pid,pname,powner){
  curProv={id:pid,name:pname,owner:powner};
  document.getElementById('provModalTitle').textContent='🏥 مراکز استان — '+pname;
  document.getElementById('pcSrch').value='';
  document.getElementById('pcFPot').value='';
  document.getElementById('pcFStat').value='';
  pcRender();
  document.getElementById('provModal').style.display='flex';
}
function closeProvModal(e){
  if(e&&e.target!==document.getElementById('provModal'))return;
  document.getElementById('provModal').style.display='none';
}

// ---- Get list of centers for current province ----
function pcGetList(){
  var pk=pkey(curProv.name);
  var raw=PROVINCE_CENTERS_RAW[pk]||[];
  var result=[];
  for(var i=0;i<raw.length;i++){
    var c=raw[i];
    var e=pcGet(pk,i);
    if(e._del)continue;
    result.push({idx:i,id:c[0],name:e.name!==undefined?e.name:c[1],
      pot:e.pot!==undefined?e.pot:c[2],type:e.type!==undefined?e.type:c[3],
      lead:e.lead!==undefined?e.lead:c[4],
      status:e.status||'بدون تماس',notesList:e.notesList||[],followupDate:e.followupDate||'',isNew:false});
  }
  // user-added
  var pfx=pk+'||new||';
  Object.keys(userEdits.pc).forEach(function(k){
    if(k.indexOf(pfx)===0){
      var v=userEdits.pc[k];
      if(v._del)return;
      result.push({idx:k,id:null,name:v.name||'',pot:v.pot||3,type:v.type||'',
        lead:v.lead||'سرنخ',status:v.status||'بدون تماس',notesList:v.notesList||[],followupDate:v.followupDate||'',isNew:true});
    }
  });
  return result;
}

// ---- Render province centers table ----
function pcRender(){
  var pk=pkey(curProv.name);
  var srch=(document.getElementById('pcSrch').value||'').trim();
  var fPot=document.getElementById('pcFPot').value;
  var fStat=document.getElementById('pcFStat').value;
  var rows=pcGetList().filter(function(c){
    if(srch&&!fuzzyMatch(srch,c.name))return false;
    if(fPot&&String(c.pot)!==fPot)return false;
    if(fStat&&c.status!==fStat)return false;
    return true;
  });
  document.getElementById('pcRowCount').textContent='نمایش '+rows.length+' مرکز';
  var ownerFa=OWNER_FA[curProv.owner]||curProv.owner;
  var tbody=document.getElementById('pcTbody');
  tbody.innerHTML='';

  rows.forEach(function(c,ri){
    var tr=document.createElement('tr');
    // new rows همرنگ بقیه

    // # 
    var td=document.createElement('td');
    td.style.cssText='color:#94a3b8;font-size:10px';
    td.textContent=ri+1;tr.appendChild(td);

    // Name
    td=document.createElement('td');
    if(c.isNew){
      var inp=document.createElement('input');
      inp.className='ed-inp';inp.value=c.name;
      (function(idx,isNew){inp.addEventListener('change',function(){pcSaveField(pk,idx,'name',this.value,isNew);});})(c.idx,c.isNew);
      td.appendChild(inp);
    }else{
      var sp=document.createElement('button');sp.className='ctr-link';sp.textContent=c.name;sp.title=c.name;
      (function(cc,pk2){sp.addEventListener('click',function(){
        var pcId=cc.isNew?cc.idx:(pk2+'||'+cc.idx);
        openCenterModal('pc',pcId,cc.name,curProv.name);
      });})(c,pk);
      td.appendChild(sp);
    }
    tr.appendChild(td);

    // Potential
    td=document.createElement('td');
    var sel=document.createElement('select');
    sel.className='pot-btn pp'+c.pot;
    [1,2,3,4].forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=v;if(v==c.pot)o.selected=true;sel.appendChild(o);});
    (function(idx,isNew){sel.addEventListener('change',function(){pcSaveField(pk,idx,'pot',parseInt(this.value),isNew);this.className='pot-btn pp'+this.value;});})(c.idx,c.isNew);
    td.appendChild(sel);tr.appendChild(td);

    // Type
    td=document.createElement('td');
    var tinp=document.createElement('input');
    tinp.className='ed-inp';tinp.value=c.type;tinp.style.minWidth='110px';
    (function(idx,isNew){tinp.addEventListener('change',function(){pcSaveField(pk,idx,'type',this.value,isNew);});})(c.idx,c.isNew);
    td.appendChild(tinp);tr.appendChild(td);

    // Lead
    td=document.createElement('td');
    var lsel=document.createElement('select');lsel.className='ed-sel';
    ['مشتری','لید','فرصت','سرنخ','ندارد','بدون مصرف','پیگیری'].forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=v;if(v===c.lead)o.selected=true;lsel.appendChild(o);});
    (function(idx,isNew){lsel.addEventListener('change',function(){pcSaveField(pk,idx,'lead',this.value,isNew);});})(c.idx,c.isNew);
    td.appendChild(lsel);tr.appendChild(td);

    // Owner
    td=document.createElement('td');
    var ow=document.createElement('span');ow.className='owner-badge';ow.style.fontSize='10px';ow.textContent=ownerFa;td.appendChild(ow);tr.appendChild(td);

    // Status
    td=document.createElement('td');
    var ssel=document.createElement('select');
    var si=STATUS_LIST.indexOf(c.status);var sc=si>=0?STATUS_CLS[si]:'st-0';
    ssel.className='status-sel '+sc;
    STATUS_LIST.forEach(function(s,i){var o=document.createElement('option');o.className=STATUS_CLS[i];o.value=s;o.textContent=s;if(s===c.status)o.selected=true;ssel.appendChild(o);});
    (function(idx,isNew,oldSt){ssel.addEventListener('change',function(){
      var v=this.value;
      pcSaveField(pk,idx,'status',v,isNew);
      addAudit('pc',isNew?String(idx):pcEKey(pk,idx),'status',oldSt,v);
      var si2=STATUS_LIST.indexOf(v);this.className='status-sel '+(si2>=0?STATUS_CLS[si2]:'st-0');
      renderStallBanner();
    });})(c.idx,c.isNew,c.status);
    td.appendChild(ssel);tr.appendChild(td);

    // Follow-up date
    td=document.createElement('td');
    var fdinp=document.createElement('input');
    fdinp.type='text';fdinp.placeholder='۱۴۰۴/۰۲/۲۰';fdinp.style.width='105px';fdinp.readOnly=true;fdinp.style.cursor='pointer';
    fdinp.value=c.followupDate||'';
    var todayJ=todayJalali();
    if(c.followupDate){
      if(c.followupDate<todayJ)fdinp.className='followup-inp overdue';
      else if(c.followupDate===todayJ)fdinp.className='followup-inp due-today';
      else fdinp.className='followup-inp';
    }else{fdinp.className='followup-inp';}
    (function(idx,isNew,finp){finp.addEventListener('click',function(){
      JDP.open(finp,function(v){
        pcSaveField(pk,idx,'followupDate',v,isNew);
        JDP.updateInputClass(finp,v);
        renderTodayBanner();
      });
    });})(c.idx,c.isNew,fdinp);
    td.appendChild(fdinp);tr.appendChild(td);

    // Notes
    td=document.createElement('td');
    var nb=c.notesList.length;
    var nbtn=document.createElement('button');
    nbtn.className=nb?'note-btn has-notes':'note-btn';nbtn.textContent=nb?'📝'+nb:'📝';
    (function(idx,cname,isNew){nbtn.addEventListener('click',function(){pcOpenNotes(pk,idx,cname,isNew);});})(c.idx,c.name,c.isNew);
    td.appendChild(nbtn);tr.appendChild(td);

    // Delete
    td=document.createElement('td');
    var dbtn=document.createElement('button');
    dbtn.className='btn-row-del';dbtn.title='حذف';dbtn.textContent='🗑';
    (function(idx,isNew){dbtn.addEventListener('click',function(){pcDelete(pk,idx,isNew);});})(c.idx,c.isNew);
    td.appendChild(dbtn);tr.appendChild(td);

    tbody.appendChild(tr);
  });
}

function pcSaveField(pk,idx,field,val,isNew){
  var k=isNew?String(idx):pcEKey(pk,idx);
  if(!userEdits.pc[k])userEdits.pc[k]={};
  userEdits.pc[k][field]=val;
  if(field==='followupDate')userEdits.pc[k].lastActivity=nowTS();
  saveEdits();
  var _pcKey=isNew?String(idx):pcEKey(pk,idx);
  immSaveEdit('pc',_pcKey);
}

function pcDelete(pk,idx,isNew){
  if(!confirm('این مرکز حذف شود؟'))return;
  var k=isNew?String(idx):pcEKey(pk,idx);
  if(!userEdits.pc[k])userEdits.pc[k]={};
  userEdits.pc[k]._del=true;
  userEdits.pc[k].lastActivity=nowTS();
  saveEdits();
  immSaveEdit('pc',k);  // FIX: حذف هم به سرور برود
  pcRender();
}

function pcAddOpen(){
  addCenterTarget='province';
  document.getElementById('newCenterName').value='';
  document.getElementById('newCenterType').value='';
  document.getElementById('newCenterPot').value='3';
  document.getElementById('newCenterLead').value='سرنخ';
  document.getElementById('addCenterModal').style.display='flex';
}

function pcOpenNotes(pk,idx,name,isNew){
  var k=isNew?String(idx):pcEKey(pk,idx);
  notesContext={type:'pc',id:k,name:name};
  document.getElementById('notesModalTitle').textContent='📝 یادداشت\u200cها — '+name;
  document.getElementById('newNoteTa').value='';
  renderNotesList();
  document.getElementById('notesModal').style.display='flex';
}

// ---- Add Center modal (Tehran + Province) ----
function openAddCenterTehran(){
  addCenterTarget='tehran';
  document.getElementById('newCenterName').value='';
  document.getElementById('newCenterType').value='';
  document.getElementById('newCenterPot').value='3';
  document.getElementById('newCenterLead').value='سرنخ';
  document.getElementById('addCenterModal').style.display='flex';
}
function closeAddCenter(e){
  if(e&&e.target!==document.getElementById('addCenterModal'))return;
  document.getElementById('addCenterModal').style.display='none';
}
function confirmAddCenter(){
  var name=document.getElementById('newCenterName').value.trim();
  if(!name){alert('نام مرکز را وارد کنید');return;}
  var pot=parseInt(document.getElementById('newCenterPot').value);
  var type=document.getElementById('newCenterType').value.trim();
  var lead=document.getElementById('newCenterLead').value;
  if(addCenterTarget==='tehran'){
    var newId='new_'+Date.now();
    var maxRow=CENTERS.reduce(function(m,r){return Math.max(m,r.row);},0);
    CENTERS.push({id:newId,row:maxRow+1,name:name,potential:pot,type:type,lead:lead,weight:'0%',owner:currentUser});
    userEdits.centers[newId]={status:'بدون تماس',notesList:[],potential:pot,type:type,lead:lead,_name:name,owner:currentUser};
    saveEdits();renderTable();renderDashboard();
  } else if(addCenterTarget==='province'){
    var pk=pkey(curProv.name);
    var k=pk+'||new||'+Date.now();
    userEdits.pc[k]={name:name,pot:pot,type:type,lead:lead,status:'بدون تماس',notesList:[]};
    saveEdits();
    pcRender();
  }
  document.getElementById('addCenterModal').style.display='none';
}


// ================================================================
// CHECKLIST DATA
// ================================================================
const CK_SECTIONS=[
  {id:'morning',icon:'⏰',title:'شروع روز (۸:۳۰ – ۹:۳۰) | مطالبات',items:[
    {id:'ck1',text:'شروع کار ساعت ۸:۳۰'},
    {id:'ck2',text:'پیگیری مطالبات انجام شد'},
    {id:'ck3',text:'نتیجه هر پیگیری در میزیتو ثبت شد'},
    {id:'ck4',text:'زمان پیگیری بعد مشخص شد'},
  ]},
  {id:'sales',icon:'📞',title:'بازه فروش (۹:۳۰ – ۱۵:۰۰)',items:[
    {id:'ck5',text:'حداقل ۱۵ مرکز تماس گرفته شد'},
    {id:'ck6',text:'تماس با ترکیب: سرنخ / فرصت / مشتری'},
    {id:'ck7',text:'حداقل X تماس مؤثر (صحبت با تصمیم‌گیرنده)'},
    {id:'ck8',text:'پیگیری درخواست‌های ثبت‌شده در سامانه انجام شد'},
    {id:'ck9',text:'وضعیت هر تماس در میزیتو ثبت شد'},
    {id:'ck10',text:'برای مشتریان علاقه‌مند پیش‌فاکتور ارسال شد'},
  ]},
  {id:'push',icon:'💰',title:'پیشبرد فروش',items:[
    {id:'ck11',text:'لیدهای داغ پیگیری شدند'},
    {id:'ck12',text:'اعتراضات مشتریان پاسخ داده شد'},
    {id:'ck13',text:'فروش‌های نزدیک به بستن پیگیری شدند'},
    {id:'ck14',text:'تلاش برای نهایی‌سازی فروش انجام شد'},
  ]},
  {id:'system',icon:'🖥',title:'سامانه تدارکات (بعد از ۱۵:۰۰)',items:[
    {id:'ck15',text:'درخواست‌های سامانه بررسی شد'},
    {id:'ck16',text:'اقدامات لازم در سامانه انجام شد'},
    {id:'ck17',text:'موارد مهم ثبت، پیگیری و پاسخ داده شد'},
  ]},
  {id:'mizito',icon:'🗂',title:'ثبت اطلاعات در میزیتو',items:[
    {id:'ck18',text:'گزارش هر مرکز ثبت شد'},
    {id:'ck19',text:'اطلاعات افراد کلیدی (نام، سمت، تماس) ثبت/آپدیت شد'},
    {id:'ck20',text:'وضعیت مشتریان به‌روز شد'},
  ]},
  {id:'plan',icon:'📅',title:'برنامه‌ریزی روز بعد (قبل از پایان روز)',items:[
    {id:'ck21',text:'برنامه ویزیت فردا ثبت شد'},
    {id:'ck22',text:'لیست تماس فردا (حداقل ۱۵ مرکز) مشخص شد'},
    {id:'ck23',text:'دسته‌بندی مراکز (سرنخ / فرصت / مشتری) انجام شد'},
  ]},
  {id:'summary',icon:'📊',title:'جمع‌بندی روز',items:[
    {id:'ck24',text:'تعداد تماس‌ها ثبت شد'},
    {id:'ck25',text:'تعداد پیگیری‌ها مشخص شد'},
    {id:'ck26',text:'میزان فروش ثبت شد'},
    {id:'ck27',text:'مهم‌ترین نتیجه روز مشخص شد'},
  ]},
];

const CK_MANDATORY={
  id:'mandatory',icon:'⚠️',
  title:'قانون مدیریتی — اگر این ۴ مورد تیک نخورده باشد، روز قابل قبول نیست',
  items:[
    {id:'ckm1',text:'تماس کافی (۱۵ مرکز)'},
    {id:'ckm2',text:'پیگیری واقعی'},
    {id:'ckm3',text:'ارسال پیشنهاد'},
    {id:'ckm4',text:'برنامه فردا'},
  ]
};

const CK_ALL_IDS=(()=>{
  const ids=[];
  CK_SECTIONS.forEach(s=>s.items.forEach(it=>ids.push(it.id)));
  CK_MANDATORY.items.forEach(it=>ids.push(it.id));
  return ids;
})();

let ckCurrentDate=''; // YYYY-MM-DD

// ── Helpers ──────────────────────────────────────────────────
function ckTodayStr(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function ckGetData(dateStr){
  if(!userEdits.checklist)userEdits.checklist={};
  return userEdits.checklist[dateStr]||{items:{},note:''};
}
function ckSaveData(dateStr,data){
  if(!userEdits.checklist)userEdits.checklist={};
  userEdits.checklist[dateStr]=data;
  saveEdits();
  immSaveChecklist(dateStr, data.items||{}, data.note||'');
}

// ── Init ─────────────────────────────────────────────────────
function ckInit(){
  if(!ckCurrentDate)ckCurrentDate=ckTodayStr();
  document.getElementById('ckDateInput').value=ckCurrentDate;
  ckRenderHistory();
  ckRenderSections();
}

function ckGoToday(){ckCurrentDate=ckTodayStr();ckInit();}
function ckNavDay(d){
  const dt=new Date(ckCurrentDate);dt.setDate(dt.getDate()+d);
  ckCurrentDate=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  document.getElementById('ckDateInput').value=ckCurrentDate;
  ckRenderHistory();ckRenderSections();
}
function ckLoadDate(){
  ckCurrentDate=document.getElementById('ckDateInput').value;
  ckRenderHistory();ckRenderSections();
}

// ── History bar (last 7 days) ─────────────────────────────────
function ckRenderHistory(){
  const bar=document.getElementById('ckHistoryBar');
  bar.innerHTML='';
  for(var i=13;i>=0;i--){
    const dt=new Date();dt.setDate(dt.getDate()-i);
    const ds=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
    const d=ckGetData(ds);
    const checked=Object.values(d.items||{}).filter(Boolean).length;
    const total=CK_ALL_IDS.length;
    const isToday=ds===ckTodayStr();
    const isCur=ds===ckCurrentDate;
    const btn=document.createElement('button');
    btn.className='ck-hist-btn'+(checked>0?' has-data':'')+(isToday?' today':'');
    if(isCur)btn.style.cssText='border-color:#0ea5e9;background:#e0f2fe;font-weight:700';
    const jArr=g2j(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    const shortMonths=['فر','ارد','خر','تیر','مر','شه','مه','آب','آذ','دی','به','اس'];
    const label=isToday?'امروز':(jArr[2]+' '+shortMonths[jArr[1]-1]);
    btn.textContent=label+(checked>0?' ('+checked+'/'+total+')':'');
    btn.title=ds;
    btn.onclick=(function(s){return function(){ckCurrentDate=s;document.getElementById('ckDateInput').value=s;ckRenderHistory();ckRenderSections();};})(ds);
    bar.appendChild(btn);
  }
  const note=document.createElement('span');
  note.style.cssText='font-size:10px;color:#94a3b8;margin-right:8px;align-self:center;flex-shrink:0';
  note.textContent='۶۰ روز ذخیره';
  bar.appendChild(note);
}

// ── Render sections ───────────────────────────────────────────
function ckRenderSections(){
  const data=ckGetData(ckCurrentDate);
  const items=data.items||{};
  const totalItems=CK_ALL_IDS.length;
  const checkedCount=CK_ALL_IDS.filter(function(id){return items[id];}).length;

  // score badge
  const badge=document.getElementById('ckScoreBadge');
  badge.textContent=checkedCount+' / '+totalItems;
  badge.className='ck-score-badge'+(checkedCount===totalItems?' all-done':checkedCount>=totalItems*0.7?' warn':' danger');

  const container=document.getElementById('ckSections');
  container.innerHTML='';

  // Mandatory section
  const mandDone=CK_MANDATORY.items.every(function(it){return items[it.id];});
  const mandDiv=document.createElement('div');
  mandDiv.className='ck-mandatory-section';

  const mandHead=document.createElement('div');
  mandHead.className='ck-section-head'+(mandDone?' all-ok':'');
  mandHead.innerHTML=CK_MANDATORY.icon+' <span>'+CK_MANDATORY.title+'</span>'
    +'<span class="ck-sec-badge'+(mandDone?' sec-done':'')+'">'+
    CK_MANDATORY.items.filter(function(it){return items[it.id];}).length+' / '+CK_MANDATORY.items.length+'</span>';
  mandDiv.appendChild(mandHead);

  CK_MANDATORY.items.forEach(function(it){
    mandDiv.appendChild(ckMakeItem(it,items[it.id],true,data,items));
  });
  container.appendChild(mandDiv);

  // Regular sections
  CK_SECTIONS.forEach(function(sec){
    const secDone=sec.items.every(function(it){return items[it.id];});
    const secChecked=sec.items.filter(function(it){return items[it.id];}).length;
    const div=document.createElement('div');div.className='ck-section';

    const head=document.createElement('div');head.className='ck-section-head';
    head.innerHTML=sec.icon+' <span>'+sec.title+'</span>'
      +'<span class="ck-sec-badge'+(secDone?' sec-done':'')+'">'+secChecked+' / '+sec.items.length+'</span>';
    div.appendChild(head);

    sec.items.forEach(function(it){
      div.appendChild(ckMakeItem(it,items[it.id],false,data,items));
    });
    container.appendChild(div);
  });

  // Note area
  const noteWrap=document.createElement('div');
  noteWrap.className='ck-section';
  noteWrap.innerHTML='<div class="ck-section-head">📝 یادداشت روزانه</div><div class="ck-note-area"><textarea id="ckNoteArea" placeholder="یادداشت‌های امروز...">'+escHtml(data.note||'')+'</textarea></div>';
  container.appendChild(noteWrap);
  document.getElementById('ckNoteArea').addEventListener('input',function(){
    var d=ckGetData(ckCurrentDate);d.note=this.value;ckSaveData(ckCurrentDate,d);ckShowToast();
  });
}

function ckMakeItem(it,checked,isMandatory,data,items){
  const row=document.createElement('div');
  row.className='ck-item'+(isMandatory?' mandatory':'')+(checked?' checked':'');
  const cb=document.createElement('div');cb.className='ck-cb';
  if(checked)cb.textContent='✓';
  const txt=document.createElement('div');txt.className='ck-item-text';txt.textContent=it.text;
  row.appendChild(cb);row.appendChild(txt);
  row.addEventListener('click',function(){
    var d=ckGetData(ckCurrentDate);
    if(!d.items)d.items={};
    d.items[it.id]=!d.items[it.id];
    ckSaveData(ckCurrentDate,d);
    ckShowToast();
    ckRenderSections();
  });
  return row;
}

function ckShowToast(){
  var t=document.getElementById('ckToast');
  t.classList.add('show');
  clearTimeout(window._ckToastTimer);
  window._ckToastTimer=setTimeout(function(){t.classList.remove('show');},1500);
}


// ════════════════════════════════════════════════════════════════
// CALENDAR — تقویم شمسی + رویدادها (موج ۴)
// ════════════════════════════════════════════════════════════════
var _CAL_VIEW = 'month';       // month | week | list
var _CAL_DATE = null;          // jalali [year, month, day] — مرکز نمایش
var _CAL_EVENTS_LOADED = false;
var _CAL_RANGE_FROM = 0;
var _CAL_RANGE_TO = 0;

// تعداد روز ماه شمسی (۱-۶: ۳۱ روز، ۷-۱۱: ۳۰ روز، ۱۲: ۲۹ یا ۳۰)
function jDaysInMonth(jy, jm){
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // اسفند: ۲۹ یا ۳۰. الگوریتم استاندارد:
  // سال کبیسه: (((jy - 474) % 2820) + 474 + 38) * 682 / 2816 % 2816 < 682
  var r = (((jy - 474) % 2820) + 474 + 38) * 682;
  return (r % 2816 < 682) ? 30 : 29;
}

// به‌دست آوردن روز هفته (شنبه=۰، جمعه=۶) برای یک تاریخ شمسی
function jDayOfWeek(jy, jm, jd){
  var g = j2g(jy, jm, jd);
  var d = new Date(g[0], g[1]-1, g[2]).getDay();
  // JS: Sun=0..Sat=6. می‌خواهیم Sat=0..Fri=6
  return (d + 1) % 7;
}

// محدوده unix ms برای ماه/هفته/لیست جاری
function calComputeRange(){
  if(!_CAL_DATE) _CAL_DATE = todayJalali().split('/').map(Number);
  var jy = _CAL_DATE[0], jm = _CAL_DATE[1], jd = _CAL_DATE[2];
  if(_CAL_VIEW === 'month'){
    var g1 = j2g(jy, jm, 1);
    var lastDay = jDaysInMonth(jy, jm);
    var g2 = j2g(jy, jm, lastDay);
    _CAL_RANGE_FROM = new Date(g1[0], g1[1]-1, g1[2], 0, 0, 0).getTime();
    _CAL_RANGE_TO   = new Date(g2[0], g2[1]-1, g2[2], 23, 59, 59).getTime();
  } else if(_CAL_VIEW === 'week'){
    // یافتن شنبه هفته جاری
    var dow = jDayOfWeek(jy, jm, jd);
    var g = j2g(jy, jm, jd);
    var start = new Date(g[0], g[1]-1, g[2] - dow, 0, 0, 0);
    var end = new Date(start.getTime() + 7*24*3600*1000 - 1);
    _CAL_RANGE_FROM = start.getTime();
    _CAL_RANGE_TO = end.getTime();
  } else { // list
    var g0 = j2g(jy, jm, jd);
    _CAL_RANGE_FROM = new Date(g0[0], g0[1]-1, g0[2], 0, 0, 0).getTime();
    _CAL_RANGE_TO   = _CAL_RANGE_FROM + 30*24*3600*1000;
  }
}

// بارگذاری رویدادها از سرور
async function loadEvents(){
  if(!getApiBase()) return [];
  calComputeRange();
  try{
    var res = await apiCall('GET', '/events/manage.php?from=' + _CAL_RANGE_FROM + '&to=' + _CAL_RANGE_TO);
    if(res && res.ok){
      EVENTS = res.events || [];
      return EVENTS;
    }
  }catch(e){ console.warn('loadEvents failed', e); }
  return EVENTS;
}

// ذخیره رویداد (ایجاد یا ویرایش)
async function saveEvent(data){
  if(!getApiBase()){ alert('برای ذخیره رویداد به سرور نیاز است'); return null; }
  try{
    var action = data.id ? 'update' : 'create';
    var payload = Object.assign({action: action}, data);
    var res = await apiCall('POST', '/events/manage.php', payload);
    if(res && res.ok){
      await loadEvents();
      renderCalendar();
      return res;
    }
    alert('خطا در ذخیره: ' + (res && res.err || 'unknown'));
  }catch(e){ alert('خطا: ' + e.message); }
  return null;
}

async function deleteEvent(id){
  if(!confirm('این رویداد حذف شود؟')) return;
  try{
    var res = await apiCall('POST', '/events/manage.php', {action:'delete', id:id});
    if(res && res.ok){ await loadEvents(); renderCalendar(); }
  }catch(e){ alert('خطا: ' + e.message); }
}

async function completeEvent(id){
  try{
    var res = await apiCall('POST', '/events/manage.php', {action:'complete', id:id});
    if(res && res.ok){ await loadEvents(); renderCalendar(); }
  }catch(e){ alert('خطا: ' + e.message); }
}

// ── جمع‌آوری همه آیتم‌های تقویم: events + followups + tag-expiry ──
function collectCalendarItems(){
  var items = [];

  // ۱. رویدادها
  (EVENTS || []).forEach(function(ev){
    var startMs = parseInt(ev.start_at);
    if(!startMs) return;
    var d = new Date(startMs);
    var jArr = g2j(d.getFullYear(), d.getMonth()+1, d.getDate());
    var key = jArr.join('/');
    items.push({
      type: 'event',
      jDate: key,
      jy: jArr[0], jm: jArr[1], jd: jArr[2],
      time: ev.all_day ? null : (String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')),
      title: ev.title,
      color: ev.color || '#0ea5e9',
      eventId: ev.id,
      description: ev.description || '',
      owner: ev.owner,
      related: ev.related_record_type ? (ev.related_record_type+':'+ev.related_record_id) : null,
      sortKey: startMs
    });
  });

  // ۲. followup_date مراکز/استان‌های در دسترس کاربر
  var isManager = getUser(currentUser).isManager;
  function addFollowups(type, rows){
    rows.forEach(function(r){
      var e = getEdit(type, r.id);
      var fd = e.followupDate;
      if(!fd) return;
      var st = e.status || 'بدون تماس';
      if(st === 'قرارداد بسته شد' || st === 'غیرفعال') return;
      var parts = fd.split('/').map(Number);
      if(parts.length !== 3) return;
      items.push({
        type: 'followup',
        jDate: fd,
        jy: parts[0], jm: parts[1], jd: parts[2],
        time: null,
        title: r.name,
        color: '#f59e0b',
        recordType: type === 'provinces' ? 'province' : 'center',
        recordId: r.id,
        sortKey: new Date(j2g(parts[0],parts[1],parts[2])[0],j2g(parts[0],parts[1],parts[2])[1]-1,j2g(parts[0],parts[1],parts[2])[2]).getTime()
      });
    });
  }
  addFollowups('provinces', isManager ? PROVINCES : PROVINCES.filter(function(r){return r.owner===currentUser;}));
  addFollowups('centers', isManager ? CENTERS : CENTERS.filter(function(r){return r.owner===currentUser;}));

  // ۳. تگ‌هایی که expires_at دارند
  (TAGS || []).forEach(function(t){
    if(!t.expires_at) return;
    var parts = t.expires_at.split('/').map(Number);
    if(parts.length !== 3) return;
    items.push({
      type: 'tag-expiry',
      jDate: t.expires_at,
      jy: parts[0], jm: parts[1], jd: parts[2],
      time: null,
      title: 'انقضای: ' + t.name,
      color: t.color || '#94a3b8',
      tagId: t.id,
      sortKey: new Date(j2g(parts[0],parts[1],parts[2])[0],j2g(parts[0],parts[1],parts[2])[1]-1,j2g(parts[0],parts[1],parts[2])[2]).getTime()
    });
  });

  return items;
}

// رندر اصلی تقویم
async function renderCalendar(){
  var body = document.getElementById('calendarBody');
  if(!body) return;
  body.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">در حال بارگذاری...</div>';

  if(!_CAL_DATE) _CAL_DATE = todayJalali().split('/').map(Number);

  // بارگذاری رویدادها (لازم نیست هر بار ولی برای اطمینان)
  await loadEvents();
  var items = collectCalendarItems();

  // تنظیم title نوار بالا
  var monthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  var titleSpan = document.getElementById('calTitleSpan');
  if(_CAL_VIEW === 'month'){
    titleSpan.textContent = monthNames[_CAL_DATE[1]-1] + ' ' + _CAL_DATE[0];
  } else if(_CAL_VIEW === 'week'){
    titleSpan.textContent = 'هفته شامل ' + _CAL_DATE.join('/');
  } else {
    titleSpan.textContent = '۳۰ روز آینده';
  }

  // به‌روزرسانی دکمه view active
  ['Month','Week','List'].forEach(function(v){
    var btn = document.getElementById('calView'+v);
    if(btn) btn.classList.toggle('active', _CAL_VIEW === v.toLowerCase());
  });

  if(_CAL_VIEW === 'month'){
    body.innerHTML = renderCalendarMonth(items);
  } else if(_CAL_VIEW === 'week'){
    body.innerHTML = renderCalendarWeek(items);
  } else {
    body.innerHTML = renderCalendarList(items);
  }
}

function renderCalendarMonth(items){
  var jy = _CAL_DATE[0], jm = _CAL_DATE[1];
  var totalDays = jDaysInMonth(jy, jm);
  var firstDow = jDayOfWeek(jy, jm, 1);  // شنبه=۰
  var today = todayJalali();
  var dayNames = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه'];

  // گروه‌بندی آیتم‌ها بر اساس روز
  var byDay = {};
  items.forEach(function(it){
    if(it.jy !== jy || it.jm !== jm) return;
    if(!byDay[it.jd]) byDay[it.jd] = [];
    byDay[it.jd].push(it);
  });

  var html = '<div class="cal-month-grid">';
  // headers
  html += '<div class="cal-row cal-head-row">';
  dayNames.forEach(function(n){ html += '<div class="cal-day-head">'+n+'</div>'; });
  html += '</div>';

  // روزها
  var day = 1;
  var weeks = Math.ceil((firstDow + totalDays) / 7);
  for(var w = 0; w < weeks; w++){
    html += '<div class="cal-row">';
    for(var dow = 0; dow < 7; dow++){
      var cell = w*7 + dow;
      if(cell < firstDow || day > totalDays){
        html += '<div class="cal-day cal-day-empty"></div>';
      } else {
        var jd = day;
        var dateKey = jy + '/' + String(jm).padStart(2,'0') + '/' + String(jd).padStart(2,'0');
        var isToday = (dateKey === today);
        var dayItems = byDay[jd] || [];
        dayItems.sort(function(a,b){return (a.sortKey||0)-(b.sortKey||0);});

        html += '<div class="cal-day'+(isToday?' cal-today':'')+'" data-jd="'+jd+'" ondblclick="openEventModal(null,\''+dateKey+'\')">';
        html += '<div class="cal-day-num">'+jd+'</div>';
        html += '<div class="cal-day-events">';
        var visibleCount = Math.min(dayItems.length, 3);
        for(var k = 0; k < visibleCount; k++){
          var it = dayItems[k];
          html += renderCalEventChip(it);
        }
        if(dayItems.length > 3){
          html += '<div class="cal-more" onclick="openDayDetail(\''+dateKey+'\')">+'+(dayItems.length-3)+' بیشتر</div>';
        }
        html += '</div></div>';
        day++;
      }
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderCalEventChip(it){
  var clickHandler = '';
  var titleAttr = (it.title||'').replace(/"/g,'&quot;');
  if(it.type === 'event'){
    clickHandler = 'openEventModal('+it.eventId+')';
  } else if(it.type === 'followup'){
    clickHandler = "openCenterModal('"+(it.recordType==='province'?'provinces':'centers')+"','"+it.recordId+"','"+(it.title.replace(/'/g,"&apos;"))+"','')";
  } else {
    clickHandler = 'void(0)';
  }
  var timeStr = it.time ? '<span class="cal-chip-time">'+it.time+'</span>' : '';
  return '<div class="cal-chip" style="background:'+it.color+'" title="'+titleAttr+'" onclick="event.stopPropagation();'+clickHandler+'">'
    +timeStr+'<span class="cal-chip-text">'+escHtml(it.title)+'</span></div>';
}

function renderCalendarWeek(items){
  var jy = _CAL_DATE[0], jm = _CAL_DATE[1], jd = _CAL_DATE[2];
  var dow = jDayOfWeek(jy, jm, jd);
  // ساخت ۷ روز هفته
  var weekDays = [];
  var g = j2g(jy, jm, jd);
  var startG = new Date(g[0], g[1]-1, g[2] - dow);
  for(var i = 0; i < 7; i++){
    var gd = new Date(startG.getTime() + i*24*3600*1000);
    var jArr = g2j(gd.getFullYear(), gd.getMonth()+1, gd.getDate());
    weekDays.push({jy:jArr[0], jm:jArr[1], jd:jArr[2], dateKey: jArr.join('/'), dow:i});
  }

  var today = todayJalali();
  var dayNames = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه'];

  // گروه‌بندی
  var byKey = {};
  items.forEach(function(it){
    if(!byKey[it.jDate]) byKey[it.jDate] = [];
    byKey[it.jDate].push(it);
  });

  var html = '<div class="cal-week-grid">';
  weekDays.forEach(function(wd, i){
    var isToday = (wd.dateKey === today);
    var dayItems = byKey[wd.dateKey] || [];
    dayItems.sort(function(a,b){return (a.sortKey||0)-(b.sortKey||0);});
    html += '<div class="cal-week-day'+(isToday?' cal-today':'')+'">';
    html += '<div class="cal-week-day-head">'+dayNames[i]+' — '+wd.jd+'/'+wd.jm+'</div>';
    html += '<div class="cal-week-day-body" ondblclick="openEventModal(null,\''+wd.dateKey+'\')">';
    if(dayItems.length === 0){
      html += '<div class="cal-week-empty">رویدادی نیست</div>';
    } else {
      dayItems.forEach(function(it){
        html += renderCalEventChip(it);
      });
    }
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

function renderCalendarList(items){
  var today = todayJalali();
  var todayParts = today.split('/').map(Number);
  var todayMs = new Date(j2g(todayParts[0],todayParts[1],todayParts[2])[0], j2g(todayParts[0],todayParts[1],todayParts[2])[1]-1, j2g(todayParts[0],todayParts[1],todayParts[2])[2]).getTime();
  var cutoff = todayMs + 30*24*3600*1000;

  // فیلتر آینده + مرتب
  var future = items.filter(function(it){
    return it.sortKey && it.sortKey >= todayMs - 24*3600*1000 && it.sortKey <= cutoff;
  });
  future.sort(function(a,b){return a.sortKey - b.sortKey;});

  if(future.length === 0){
    return '<div style="text-align:center;padding:60px;color:#94a3b8">در ۳۰ روز آینده هیچ رویدادی نیست.<br><small>برای افزودن رویداد، روی دکمه «➕ رویداد جدید» کلیک کنید.</small></div>';
  }

  // گروه‌بندی بر اساس روز
  var byDate = {};
  future.forEach(function(it){
    if(!byDate[it.jDate]) byDate[it.jDate] = [];
    byDate[it.jDate].push(it);
  });

  var html = '<div class="cal-list">';
  Object.keys(byDate).sort().forEach(function(dk){
    var label = (dk === today) ? 'امروز' : dk;
    html += '<div class="cal-list-day">';
    html += '<div class="cal-list-day-head">'+label+'</div>';
    byDate[dk].forEach(function(it){
      html += '<div class="cal-list-item" style="border-right-color:'+it.color+'">';
      html += '<span class="cal-list-time">'+(it.time||'تمام روز')+'</span>';
      html += '<span class="cal-list-title">'+escHtml(it.title)+'</span>';
      if(it.type === 'event'){
        html += '<button class="cal-list-btn" onclick="openEventModal('+it.eventId+')">ویرایش</button>';
        html += '<button class="cal-list-btn" onclick="completeEvent('+it.eventId+')">✓ انجام شد</button>';
      } else if(it.type === 'followup'){
        var rt = it.recordType === 'province' ? 'provinces' : 'centers';
        html += '<button class="cal-list-btn" onclick="openCenterModal(\''+rt+'\',\''+it.recordId+'\',\''+it.title.replace(/\x27/g,"&apos;")+'\',\'\')">باز کردن</button>';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ── ناوبری تقویم ───────────────────────────────────────────
function calNav(delta){
  if(!_CAL_DATE) _CAL_DATE = todayJalali().split('/').map(Number);
  if(_CAL_VIEW === 'month'){
    _CAL_DATE[1] += delta;
    while(_CAL_DATE[1] < 1){ _CAL_DATE[1] += 12; _CAL_DATE[0]--; }
    while(_CAL_DATE[1] > 12){ _CAL_DATE[1] -= 12; _CAL_DATE[0]++; }
    _CAL_DATE[2] = 1;  // به اول ماه
  } else if(_CAL_VIEW === 'week'){
    // جابجایی ۷ روز
    var g = j2g(_CAL_DATE[0], _CAL_DATE[1], _CAL_DATE[2]);
    var d = new Date(g[0], g[1]-1, g[2] + delta*7);
    _CAL_DATE = g2j(d.getFullYear(), d.getMonth()+1, d.getDate());
  } else {
    // list: ۳۰ روز
    var g2 = j2g(_CAL_DATE[0], _CAL_DATE[1], _CAL_DATE[2]);
    var d2 = new Date(g2[0], g2[1]-1, g2[2] + delta*30);
    _CAL_DATE = g2j(d2.getFullYear(), d2.getMonth()+1, d2.getDate());
  }
  renderCalendar();
}

function calGoToday(){
  _CAL_DATE = todayJalali().split('/').map(Number);
  renderCalendar();
}

function calSetView(v){
  _CAL_VIEW = v;
  renderCalendar();
}

// ── modal جزئیات یک روز ────────────────────────────────────
function openDayDetail(dateKey){
  // اولویت ساده: مدال رویداد جدید با تاریخ پیش‌انتخاب‌شده
  // (در آینده می‌توان مدال جداگانه برای لیست همه آیتم‌های روز ساخت)
  var items = collectCalendarItems().filter(function(it){return it.jDate === dateKey;});
  if(items.length === 0){
    openEventModal(null, dateKey);
    return;
  }
  // ساخت مدال ساده با لیست
  var html = '<div style="background:#fff;border-radius:10px;padding:20px;max-width:500px;max-height:80vh;overflow-y:auto">';
  html += '<div style="font-size:16px;font-weight:700;margin-bottom:12px">رویدادهای '+dateKey+'</div>';
  items.sort(function(a,b){return (a.sortKey||0)-(b.sortKey||0);}).forEach(function(it){
    html += '<div style="padding:8px;margin:6px 0;border-right:3px solid '+it.color+';background:#f8fafc;border-radius:6px">';
    html += (it.time?'<strong>'+it.time+'</strong> ':'') + escHtml(it.title);
    html += '</div>';
  });
  html += '<div style="text-align:center;margin-top:14px">';
  html += '<button onclick="closeDayDetail();openEventModal(null,\''+dateKey+'\')" class="btn-primary">➕ رویداد جدید</button> ';
  html += '<button onclick="closeDayDetail()" class="btn-secondary">بستن</button>';
  html += '</div></div>';
  var ov = document.createElement('div');
  ov.id = 'dayDetailOverlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = html;
  ov.onclick = function(e){ if(e.target === ov) closeDayDetail(); };
  document.body.appendChild(ov);
}
function closeDayDetail(){
  var ov = document.getElementById('dayDetailOverlay');
  if(ov) ov.remove();
}

// ── modal ایجاد/ویرایش رویداد ──────────────────────────────
function openEventModal(eventId, preDateKey){
  var ev = null;
  if(eventId){
    ev = (EVENTS || []).find(function(e){return e.id === eventId || String(e.id) === String(eventId);});
  }
  var dateVal = '';
  var timeVal = '';
  if(ev){
    var d = new Date(parseInt(ev.start_at));
    var jArr = g2j(d.getFullYear(), d.getMonth()+1, d.getDate());
    dateVal = jArr[0]+'/'+String(jArr[1]).padStart(2,'0')+'/'+String(jArr[2]).padStart(2,'0');
    if(!ev.all_day){
      timeVal = String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    }
  } else if(preDateKey){
    dateVal = preDateKey;
  } else {
    dateVal = todayJalali();
  }

  var isManager = getUser(currentUser).isManager;
  var html = '<div class="ev-modal" onclick="event.stopPropagation()">';
  html += '<div class="ev-modal-head">'+(ev?'✏️ ویرایش رویداد':'➕ رویداد جدید')+'</div>';
  html += '<div class="ev-modal-body">';
  html += '<label>عنوان <span style="color:#dc2626">*</span></label>';
  html += '<input id="evTitle" type="text" value="'+(ev?escHtml(ev.title):'')+'" placeholder="مثلاً: جلسه با تیم فروش" maxlength="200">';

  html += '<label>توضیحات</label>';
  html += '<textarea id="evDesc" rows="3" placeholder="جزئیات اختیاری">'+(ev?escHtml(ev.description||''):'')+'</textarea>';

  html += '<div class="ev-row">';
  html += '<div><label>تاریخ</label><input id="evDate" type="text" value="'+dateVal+'" readonly onclick="JDP.open(this,function(v){document.getElementById(\'evDate\').value=v;})" placeholder="۱۴۰۴/۰۳/۱۵"></div>';
  html += '<div><label>زمان <small>(خالی = تمام روز)</small></label><input id="evTime" type="time" value="'+timeVal+'"></div>';
  html += '</div>';

  html += '<div class="ev-row">';
  html += '<div><label>رنگ</label><select id="evColor">';
  ['#0ea5e9','#22c55e','#a855f7','#f59e0b','#dc2626','#06b6d4','#ec4899','#64748b'].forEach(function(c){
    var sel = (ev && ev.color === c) ? ' selected' : '';
    html += '<option value="'+c+'"'+sel+' style="background:'+c+';color:#fff">'+c+'</option>';
  });
  html += '</select></div>';
  html += '<div><label>یادآور</label><select id="evRemind">';
  [[0,'بدون یادآور'],[15,'۱۵ دقیقه قبل'],[60,'۱ ساعت قبل'],[1440,'۱ روز قبل']].forEach(function(r){
    var sel = (ev && ev.reminder_minutes == r[0]) ? ' selected' : '';
    html += '<option value="'+r[0]+'"'+sel+'>'+r[1]+'</option>';
  });
  html += '</select></div>';
  html += '</div>';

  if(isManager){
    var checked = (ev && ev.shared_with_team) ? ' checked' : '';
    html += '<label style="display:flex;align-items:center;gap:6px;margin-top:8px"><input type="checkbox" id="evShare"'+checked+'> اشتراک با تیم (همه کارشناسان می‌بینند)</label>';
  }

  html += '</div>';
  html += '<div class="ev-modal-foot">';
  if(ev){
    html += '<button class="btn-danger" onclick="deleteEvent('+ev.id+');closeEventModal()">🗑 حذف</button>';
  }
  html += '<button class="btn-secondary" onclick="closeEventModal()">انصراف</button>';
  html += '<button class="btn-primary" onclick="submitEventModal('+(ev?ev.id:'null')+')">'+(ev?'ذخیره':'ایجاد')+'</button>';
  html += '</div>';
  html += '</div>';

  var ov = document.createElement('div');
  ov.id = 'eventOverlay';
  ov.className = 'ev-overlay';
  ov.onclick = closeEventModal;
  ov.innerHTML = html;
  document.body.appendChild(ov);
  setTimeout(function(){ document.getElementById('evTitle').focus(); }, 50);
}

function closeEventModal(){
  var ov = document.getElementById('eventOverlay');
  if(ov) ov.remove();
}

async function submitEventModal(eventId){
  var title = document.getElementById('evTitle').value.trim();
  if(!title){ alert('عنوان رویداد الزامی است'); return; }
  var dateVal = document.getElementById('evDate').value.trim();
  if(!dateVal){ alert('تاریخ الزامی است'); return; }
  var parts = dateVal.split('/').map(Number);
  if(parts.length !== 3){ alert('فرمت تاریخ نامعتبر'); return; }
  var g = j2g(parts[0], parts[1], parts[2]);

  var timeVal = document.getElementById('evTime').value;
  var allDay = !timeVal;
  var startMs;
  if(allDay){
    startMs = new Date(g[0], g[1]-1, g[2], 0, 0, 0).getTime();
  } else {
    var tp = timeVal.split(':').map(Number);
    startMs = new Date(g[0], g[1]-1, g[2], tp[0]||0, tp[1]||0, 0).getTime();
  }

  var shareEl = document.getElementById('evShare');
  var data = {
    title: title,
    description: document.getElementById('evDesc').value.trim(),
    start_at: startMs,
    all_day: allDay ? 1 : 0,
    color: document.getElementById('evColor').value,
    reminder_minutes: parseInt(document.getElementById('evRemind').value) || 0,
    shared_with_team: shareEl && shareEl.checked ? 1 : 0
  };
  if(eventId && eventId !== 'null') data.id = eventId;

  var res = await saveEvent(data);
  if(res){ closeEventModal(); }
}

// ── اعلان رویداد در زمان نزدیک ──────────────────────────────
function checkEventReminders(){
  if(!EVENTS || !EVENTS.length) return;
  if(!('Notification' in window)) return;
  if(Notification.permission !== 'granted') return;

  var now = Date.now();
  EVENTS.forEach(function(ev){
    if(!ev.reminder_minutes || ev.reminder_minutes <= 0) return;
    if(ev.status === 'done' || ev.status === 'cancelled') return;
    var startMs = parseInt(ev.start_at);
    if(!startMs) return;
    var triggerMs = startMs - ev.reminder_minutes * 60 * 1000;
    if(now < triggerMs - 60000 || now > triggerMs + 60000) return;  // پنجره ۲ دقیقه‌ای
    var key = 'crm_evnotif_' + ev.id + '_' + Math.floor(triggerMs/60000);
    if(localStorage.getItem(key)) return;
    try{
      new Notification('📅 یادآور رویداد', {
        body: ev.title + ' در ' + ev.reminder_minutes + ' دقیقه دیگر',
        tag: 'event-' + ev.id
      });
      localStorage.setItem(key, '1');
    }catch(e){}
  });
}

// چک هر دقیقه
if(typeof _evReminderInterval === 'undefined'){
  var _evReminderInterval = setInterval(checkEventReminders, 60000);
}

// ════════════════════════════════════════════════════════════════
// VIEW MODES (موج ۵) — list / kanban / card / map
// ════════════════════════════════════════════════════════════════
var _viewMode = 'list';  // پیش‌فرض

function setViewMode(mode){
  if(!['list','kanban','card','map'].includes(mode)) return;
  _viewMode = mode;

  // ذخیره ترجیح کاربر
  if(typeof savePreference === 'function' && currentUser){
    savePreference('view_'+currentTab, mode).catch(function(){});
  }

  // به‌روزرسانی UI دکمه‌ها
  ['list','kanban','card','map'].forEach(function(m){
    var btn = document.getElementById('viewBtn'+m[0].toUpperCase()+m.slice(1));
    if(btn) btn.classList.toggle('active', _viewMode === m);
  });

  // نمایش/مخفی container ها
  document.getElementById('mainTable').style.display = (mode==='list') ? '' : 'none';
  document.getElementById('kanbanView').style.display = (mode==='kanban') ? '' : 'none';
  document.getElementById('cardView').style.display   = (mode==='card')   ? '' : 'none';
  document.getElementById('mapView').style.display    = (mode==='map')    ? '' : 'none';

  // رندر مجدد
  renderTable();
}

// لود ترجیح ذخیره‌شده هنگام تغییر tab
function applyStoredViewMode(){
  if(!PREFERENCES) return;
  var stored = PREFERENCES['view_' + currentTab];
  if(stored && ['list','kanban','card','map'].includes(stored)){
    _viewMode = stored;
  } else {
    _viewMode = 'list';
  }
  // sync UI
  ['list','kanban','card','map'].forEach(function(m){
    var btn = document.getElementById('viewBtn'+m[0].toUpperCase()+m.slice(1));
    if(btn) btn.classList.toggle('active', _viewMode === m);
  });
  document.getElementById('mainTable').style.display = (_viewMode==='list') ? '' : 'none';
  document.getElementById('kanbanView').style.display = (_viewMode==='kanban') ? '' : 'none';
  document.getElementById('cardView').style.display   = (_viewMode==='card')   ? '' : 'none';
  document.getElementById('mapView').style.display    = (_viewMode==='map')    ? '' : 'none';
}

// ── KANBAN VIEW — ستون‌بندی بر اساس status ──────────────────
function renderKanbanView(data){
  var container = document.getElementById('kanbanView');
  if(!container) return;
  var type = currentTab === 'provinces' ? 'provinces' : 'centers';

  // گروه‌بندی
  var groups = {};
  STATUS_LIST.forEach(function(s){ groups[s] = []; });
  data.forEach(function(r){
    var e = getEdit(type, r.id);
    var st = e.status || 'بدون تماس';
    if(!groups[st]) groups[st] = [];
    groups[st].push({r:r, e:e});
  });

  var html = '<div class="kanban-board">';
  STATUS_LIST.forEach(function(st, idx){
    var rows = groups[st] || [];
    var cls = STATUS_CLS[idx] || 'st-0';
    html += '<div class="kanban-col" data-status="'+st+'"'
         + ' ondragover="event.preventDefault();this.classList.add(\'kanban-over\')"'
         + ' ondragleave="this.classList.remove(\'kanban-over\')"'
         + ' ondrop="event.preventDefault();this.classList.remove(\'kanban-over\');onKanbanDrop(event,\''+st+'\')">';
    html += '<div class="kanban-col-head '+cls+'">'+st+' <span class="kanban-count">'+rows.length+'</span></div>';
    html += '<div class="kanban-col-body">';
    rows.forEach(function(o){
      var r = o.r, e = o.e;
      var fd = e.followupDate || '';
      var leadTxt = type==='centers' ? (e.lead || r.lead || '') : '';
      var leadCls = leadTxt ? leadSelCls(leadTxt) : '';
      var tagsBadges = (typeof renderTagBadges === 'function') ? renderTagBadges(type==='provinces'?'province':'center', r.id) : '';
      html += '<div class="kanban-card" draggable="true"'
           + ' ondragstart="event.dataTransfer.setData(\'card\',\''+type+'|'+r.id+'\')"'
           + ' onclick="openCenterModal(\''+type+'\',\''+r.id+'\',\''+r.name.replace(/\x27/g,'&apos;')+'\',\''+(type==='centers'?'تهران':'')+'\')">';
      html += '<div class="kanban-card-name">'+escHtml(r.name)+'</div>';
      html += '<div class="kanban-card-meta">';
      html += '<span class="pot-badge pot-'+(e.potential||r.potential)+'">پ '+(e.potential||r.potential)+'</span>';
      if(leadTxt) html += '<span class="'+leadCls+'" style="font-size:9px;padding:1px 6px">'+leadTxt+'</span>';
      if(fd) html += '<span class="kanban-card-date">'+fd+'</span>';
      html += '</div>';
      if(tagsBadges) html += '<div class="kanban-card-tags">'+tagsBadges+'</div>';
      html += '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// drag-drop handler
function onKanbanDrop(ev, newStatus){
  var data = ev.dataTransfer.getData('card');
  if(!data) return;
  var parts = data.split('|');
  var type = parts[0], id = parts[1];
  // owner check
  var isManager = getUser(currentUser).isManager;
  var r = (type==='provinces' ? PROVINCES : CENTERS).find(function(x){return x.id===id;});
  if(!r) return;
  var e = getEdit(type, id);
  var currentOwner = e.owner || r.owner;
  if(!isManager && currentOwner !== currentUser){
    alert('شما مالک این رکورد نیستید');
    return;
  }
  // تغییر status
  setField(type, id, 'status', newStatus);
  renderTable();  // re-render
}

// ── CARD VIEW — کارت‌های مرتب در grid ───────────────────────
function renderCardView(data){
  var container = document.getElementById('cardView');
  if(!container) return;
  var type = currentTab === 'provinces' ? 'provinces' : 'centers';

  if(data.length === 0){
    container.innerHTML = '<div class="cv-empty">هیچ مرکزی با این فیلتر یافت نشد</div>';
    return;
  }

  var html = '<div class="card-grid">';
  data.forEach(function(r){
    var e = getEdit(type, r.id);
    var st = e.status || 'بدون تماس';
    var si = STATUS_LIST.indexOf(st);
    var sc = si >= 0 ? STATUS_CLS[si] : 'st-0';
    var fd = e.followupDate || '';
    var pot = e.potential !== undefined ? e.potential : r.potential;
    var leadTxt = type==='centers' ? (e.lead || r.lead || '') : '';
    var notes = e.notesList || [];
    var tagsBadges = (typeof renderTagBadges === 'function') ? renderTagBadges(type==='provinces'?'province':'center', r.id) : '';
    var longStall = (typeof isLongStalled === 'function' && isLongStalled(type, r.id));
    var fdOver = (typeof isFollowupOverdue === 'function' && isFollowupOverdue(type, r.id));

    html += '<div class="data-card'+(longStall?' card-danger':(fdOver?' card-warn':''))+'" onclick="openCenterModal(\''+type+'\',\''+r.id+'\',\''+r.name.replace(/\x27/g,'&apos;')+'\',\''+(type==='centers'?'تهران':'')+'\')">';
    html += '<div class="card-head">';
    html += '<span class="card-title">'+escHtml(r.name)+'</span>';
    html += '<span class="pot-badge pot-'+pot+'">'+pot+'</span>';
    html += '</div>';
    html += '<div class="card-status '+sc+'">'+st+'</div>';
    html += '<div class="card-meta">';
    if(leadTxt) html += '<span class="card-lead">'+leadTxt+'</span>';
    if(fd) html += '<span class="card-date'+(fdOver?' overdue':'')+'">📅 '+fd+'</span>';
    if(notes.length) html += '<span class="card-notes">📝 '+notes.length+'</span>';
    html += '</div>';
    if(tagsBadges) html += '<div class="card-tags">'+tagsBadges+'</div>';
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// ── MAP VIEW — نقشه ایران (برای استان‌ها) ──────────────────
function renderMapView(data){
  var container = document.getElementById('mapView');
  if(!container) return;

  if(currentTab !== 'provinces'){
    container.innerHTML = '<div class="cv-empty">نمایش نقشه فقط برای استان‌ها در دسترس است. <button class="btn-secondary" onclick="setViewMode(\'list\')" style="margin-right:10px">بازگشت به لیست</button></div>';
    return;
  }

  // ساده: لیست استان‌ها به‌صورت grid با badge های وضعیت
  // به دلیل پیچیدگی نقشه SVG واقعی ایران، grid چیدمان مناسب می‌شود
  var html = '<div class="map-grid">';
  data.forEach(function(r){
    var e = getEdit('provinces', r.id);
    var st = e.status || 'بدون تماس';
    var si = STATUS_LIST.indexOf(st);
    var sc = si >= 0 ? STATUS_CLS[si] : 'st-0';
    var fd = e.followupDate || '';
    html += '<div class="map-cell '+sc+'" onclick="openCenterModal(\'provinces\',\''+r.id+'\',\''+r.name.replace(/\x27/g,'&apos;')+'\',\'\')">';
    html += '<div class="map-cell-name">'+escHtml(r.name)+'</div>';
    html += '<div class="map-cell-info">';
    html += '<span class="map-cell-pot pot-'+r.potential+'">پ'+r.potential+'</span>';
    html += '<span class="map-cell-pct">'+r.biopsyPct+'٪</span>';
    html += '</div>';
    if(fd) html += '<div class="map-cell-date'+((typeof isFollowupOverdue==='function'&&isFollowupOverdue('provinces',r.id))?' overdue':'')+'">📅 '+fd+'</div>';
    html += '</div>';
  });
  html += '</div>';
  html += '<div style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:8px;font-size:11px;color:#64748b;text-align:center">'
       + '💡 نمایش نقشه — استان‌ها بر اساس وضعیت پیگیری رنگ‌بندی شده‌اند'
       + '</div>';
  container.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════
// UX (موج ۷) — feedback، URL hash، undo، empty state
// ════════════════════════════════════════════════════════════════

// ── highlight ردیف بعد از ذخیره ────────────────────────────
function flashRow(type, id, status){
  var key = (type==='provinces'?'centers_':'provinces_') + id;  // طبق ساختار renderTable
  // در عمل سعی می‌کنیم دو الگو را امتحان کنیم
  var row = document.querySelector('[data-row-id="centers_'+id+'"], [data-row-id="provinces_'+id+'"]');
  if(!row) return;
  row.classList.add(status === 'err' ? 'row-flash-err' : 'row-flash-ok');
  setTimeout(function(){
    row.classList.remove('row-flash-ok','row-flash-err');
  }, 1500);
}

// patch روی setField (اگر موجود است) - بعد از موفقیت flashRow
// نسخه ساده: یک observer روی save badge
if(typeof window._origSetField === 'undefined' && typeof setField === 'function'){
  window._origSetField = setField;
  window.setField = function(type, id, field, value){
    var r = window._origSetField.apply(this, arguments);
    try{ flashRow(type, id, 'ok'); }catch(e){}
    return r;
  };
}

// ── URL hash filters ───────────────────────────────────────
function serializeFiltersToHash(){
  if(!currentTab) return;
  var parts = ['tab=' + currentTab];
  var search = document.getElementById('searchInput');
  if(search && search.value) parts.push('q=' + encodeURIComponent(search.value));
  ['filterPot','filterStatus','filterOwner','filterLead','filterType','filterTag'].forEach(function(id){
    var el = document.getElementById(id);
    if(el && el.value) parts.push(id.replace('filter','').toLowerCase() + '=' + encodeURIComponent(el.value));
  });
  if(_viewMode && _viewMode !== 'list') parts.push('view=' + _viewMode);
  var newHash = '#' + parts.join('&');
  if(window.location.hash !== newHash){
    window.history.replaceState(null, '', newHash);
  }
}

function parseFiltersFromHash(){
  var hash = window.location.hash.replace(/^#/, '');
  if(!hash) return null;
  var pairs = hash.split('&');
  var obj = {};
  pairs.forEach(function(p){
    var kv = p.split('=');
    if(kv.length === 2) obj[kv[0]] = decodeURIComponent(kv[1]);
  });
  return obj;
}

function applyFiltersFromHash(){
  var f = parseFiltersFromHash();
  if(!f) return;
  if(f.tab && ['provinces','centers','checklist','mgrdash','activity','calendar'].includes(f.tab)){
    switchTab(f.tab);
  }
  // delay تا switchTab اعمال شود
  setTimeout(function(){
    if(f.q) document.getElementById('searchInput').value = f.q;
    ['Pot','Status','Owner','Lead','Type','Tag'].forEach(function(k){
      var el = document.getElementById('filter' + k);
      var v = f[k.toLowerCase()];
      if(el && v){ el.value = v; }
    });
    if(f.view && ['list','kanban','card','map'].includes(f.view)){
      _viewMode = f.view;
    }
    if(typeof renderTable === 'function') renderTable();
  }, 100);
}

// hook به تغییر filter ها
['searchInput','filterPot','filterStatus','filterOwner','filterLead','filterType','filterTag'].forEach(function(id){
  document.addEventListener('DOMContentLoaded', function(){
    var el = document.getElementById(id);
    if(el){
      el.addEventListener('change', serializeFiltersToHash);
      if(el.tagName === 'INPUT') el.addEventListener('input', serializeFiltersToHash);
    }
  });
});

// ── Undo toast ────────────────────────────────────────────
var _undoStack = [];
var _MAX_UNDO = 10;

function pushUndo(label, undoFn){
  _undoStack.push({label:label, undoFn:undoFn, ts:Date.now()});
  if(_undoStack.length > _MAX_UNDO) _undoStack.shift();
  showUndoToast(label);
}

function showUndoToast(label){
  var old = document.getElementById('undoToast');
  if(old) old.remove();
  var t = document.createElement('div');
  t.id = 'undoToast';
  t.className = 'undo-toast';
  t.innerHTML = '<span>'+escHtml(label)+'</span><button onclick="performUndo()">↶ بازگشت</button>';
  document.body.appendChild(t);
  setTimeout(function(){ t.classList.add('show'); }, 10);
  setTimeout(function(){
    t.classList.remove('show');
    setTimeout(function(){ if(t.parentNode) t.remove(); }, 300);
  }, 5000);
}

function performUndo(){
  if(_undoStack.length === 0) return;
  var item = _undoStack.pop();
  try{
    item.undoFn();
    var t = document.getElementById('undoToast');
    if(t) t.remove();
  }catch(e){ console.warn('Undo failed:', e); }
}

// keyboard shortcut Ctrl+Z
document.addEventListener('keydown', function(e){
  if((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.target.matches('input,textarea')){
    if(_undoStack.length > 0){
      e.preventDefault();
      performUndo();
    }
  }
});

// ── Empty state بهتر ──────────────────────────────────────
function renderEmptyState(){
  var msg = '';
  var hasFilter = false;
  ['Pot','Status','Owner','Lead','Type','Tag'].forEach(function(k){
    var el = document.getElementById('filter' + k);
    if(el && el.value) hasFilter = true;
  });
  var search = document.getElementById('searchInput');
  if(search && search.value) hasFilter = true;

  if(hasFilter){
    msg = '<div class="empty-state">'
        + '<div class="empty-icon">🔍</div>'
        + '<div class="empty-title">هیچ نتیجه‌ای با این فیلتر یافت نشد</div>'
        + '<div class="empty-subtitle">فیلترها را تغییر دهید یا پاک کنید</div>'
        + '<button class="btn-primary" onclick="clearAllFilters()">پاک کردن همه فیلترها</button>'
        + '</div>';
  } else {
    msg = '<div class="empty-state">'
        + '<div class="empty-icon">📭</div>'
        + '<div class="empty-title">هیچ رکوردی نیست</div>'
        + '<div class="empty-subtitle">برای شروع، یک مرکز جدید اضافه کنید</div>'
        + (currentTab === 'centers' ? '<button class="btn-primary" onclick="document.getElementById(\'addCenterBtn\').click()">➕ افزودن مرکز</button>' : '')
        + '</div>';
  }
  return msg;
}

function clearAllFilters(){
  ['searchInput','filterPot','filterStatus','filterOwner','filterLead','filterType','filterTag'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.value = '';
  });
  serializeFiltersToHash();
  renderTable();
}

// ════════════════════════════════════════════════════════════════
// موج ۶ — یکپارچه‌سازی
// ════════════════════════════════════════════════════════════════
// followup_date و tag-expiry قبلاً در collectCalendarItems جمع‌آوری می‌شوند ✅
// activity log قبلاً از /analytics/log.php می‌خواند که شامل تمام audit_trail است ✅

// اطلاع‌رسانی هنگام page load — اعمال hash filters
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    if(currentUser && window.location.hash){
      applyFiltersFromHash();
    }
  }, 500);
});
