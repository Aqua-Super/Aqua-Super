/**
 * Aqua Super Live Sync
 * Separate Google Apps Script Web App.
 *
 * Master file: "Aqua Super Live Data.json"
 * This file is intentionally separate from the existing backup Code.gs.
 */

const LIVE_FILE_NAME = "Aqua Super Live Data.json";

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "get";
  if (action === "get") {
    return json_(getMaster_());
  }
  return json_({ok:false,error:"Unknown action"});
}

function doPost(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "save";
    if (action !== "save") return json_({ok:false,error:"Unknown action"});

    const body = JSON.parse((e.postData && e.postData.contents) || "{}");
    const clientDb = body.db;
    const clientRevision = Number(body.revision) || 0;
    if (!clientDb || !Array.isArray(clientDb.customers) || !Array.isArray(clientDb.entries)) {
      return json_({ok:false,error:"Invalid database"});
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const master = getMaster_();
      const merged = mergeDb_(master.db, clientDb);
      const next = {
        revision: Number(master.revision || 0) + 1,
        updatedAt: new Date().toISOString(),
        db: merged
      };
      writeMaster_(next);
      return json_({ok:true,revision:next.revision,updatedAt:next.updatedAt,db:next.db,
                    clientRevision:clientRevision});
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ok:false,error:String(err && err.message || err)});
  }
}

function getMaster_() {
  const file = findMaster_();
  if (!file) return {revision:0,updatedAt:null,db:{customers:[],entries:[]}};
  try {
    const obj = JSON.parse(file.getBlob().getDataAsString() || "{}");
    return {
      revision:Number(obj.revision)||0,
      updatedAt:obj.updatedAt || null,
      db:normalize_(obj.db)
    };
  } catch (err) {
    throw new Error("Live master JSON is invalid: " + err);
  }
}

function findMaster_() {
  const files = DriveApp.getFilesByName(LIVE_FILE_NAME);
  return files.hasNext() ? files.next() : null;
}

function writeMaster_(obj) {
  const old = findMaster_();
  const text = JSON.stringify(obj);
  if (old) {
    old.setContent(text);
  } else {
    DriveApp.createFile(LIVE_FILE_NAME, text, MimeType.PLAIN_TEXT);
  }
}

function normalize_(db) {
  db = db && typeof db === "object" ? db : {};
  if (!Array.isArray(db.customers)) db.customers = [];
  if (!Array.isArray(db.entries)) db.entries = [];
  return db;
}

function customerKey_(c) {
  if (c && c.syncId) return "id:" + c.syncId;
  return "legacy:" + [
    c && c.name || "",
    c && c.mobile || "",
    c && c.address || ""
  ].join("|").toLowerCase().trim();
}

function entryKey_(e) {
  if (e && e.syncId) return "id:" + e.syncId;
  return "legacy:" + [
    e && e.date || "", e && e.name || "",
    e && e.jg || 0, e && e.je || 0,
    e && e.cg || 0, e && e.ce || 0,
    e && e.amount || 0, e && e.paid || 0,
    e && e.previousDue || 0, e && e.createdAt || ""
  ].join("|");
}

function mergeDb_(master, client) {
  master = normalize_(JSON.parse(JSON.stringify(master || {})));
  client = normalize_(JSON.parse(JSON.stringify(client || {})));

  const customers = {};
  master.customers.forEach(function(c){ customers[customerKey_(c)] = c; });
  client.customers.forEach(function(c){
    const k = customerKey_(c), old = customers[k];
    if (!old) customers[k] = c;
    else if (newer_(c, old)) customers[k] = c;
  });

  const entries = {};
  master.entries.forEach(function(e){ entries[entryKey_(e)] = e; });
  client.entries.forEach(function(e){
    const k = entryKey_(e);
    if (!entries[k]) entries[k] = e;
  });

  return {
    customers:Object.keys(customers).map(function(k){return customers[k];}),
    entries:Object.keys(entries).map(function(k){return entries[k];})
  };
}

function newer_(a,b) {
  const ta = Date.parse(a && a.updatedAt || "") || 0;
  const tb = Date.parse(b && b.updatedAt || "") || 0;
  return ta >= tb;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
