const LIVE_FILE_NAME = "Aqua Super Live Data.json";
const BACKUP_FOLDER_NAME = "Aqua Super Daily Backup Data";

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "get";
  var result;

  if (action === "get") {
    result = getMaster_();
  } else if (action === "revision") {
    result = getRevision_();
  } else if (action === "seedLatest") {
    result = seedLatestBackup_();
  } else {
    result = { ok: false, error: "Unknown action" };
  }

  return output_(result, e && e.parameter ? e.parameter.callback : "");
}

function doPost(e) {
  try {
    var p = e && e.parameter ? e.parameter : {};
    var raw = p.data || "";

    if (!raw && e.postData && e.postData.contents) {
      raw = e.postData.contents;
    }

    var body = JSON.parse(raw || "{}");
    var clientDb = body.db;
    var clientRevision = Number(body.revision) || 0;
    var deletedCustomers = body.deletedCustomers || {};
    var deletedEntries = body.deletedEntries || {};
    var mode = String(body.mode || "merge");

    if (!clientDb ||
        !Array.isArray(clientDb.customers) ||
        !Array.isArray(clientDb.entries)) {
      return output_({
        ok: false,
        error: "Invalid database"
      }, p.callback || "");
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      var master = getMaster_();

      // A restore is intentional replacement, not a merge.
      // This is used only by the app's existing Google Drive Restore action.
      if (mode === "restore") {
        var restored = ensureIds_(
          normalize_(JSON.parse(JSON.stringify(clientDb)))
        );

        var restoredNext = {
          revision: Number(master.revision || 0) + 1,
          updatedAt: new Date().toISOString(),
          db: restored,
          meta: {
            deletedCustomers: {},
            deletedEntries: {}
          }
        };

        writeMaster_(restoredNext);

        return output_({
          ok: true,
          mode: "restore",
          revision: restoredNext.revision,
          updatedAt: restoredNext.updatedAt,
          db: restoredNext.db,
          meta: restoredNext.meta,
          clientRevision: clientRevision
        }, p.callback || "");
      }

      var merged = mergeDb_(master.db, clientDb);

      var meta = {
        deletedCustomers: mergeTombstones_(
          master.meta.deletedCustomers,
          deletedCustomers
        ),
        deletedEntries: mergeTombstones_(
          master.meta.deletedEntries,
          deletedEntries
        )
      };

      applyTombstones_(
        merged,
        meta.deletedCustomers,
        meta.deletedEntries
      );

      var next = {
        revision: Number(master.revision || 0) + 1,
        updatedAt: new Date().toISOString(),
        db: ensureIds_(merged),
        meta: meta
      };

      writeMaster_(next);

      return output_({
        ok: true,
        revision: next.revision,
        updatedAt: next.updatedAt,
        db: next.db,
        meta: next.meta,
        clientRevision: clientRevision
      }, p.callback || "");

    } finally {
      lock.releaseLock();
    }

  } catch (err) {
    return output_({
      ok: false,
      error: String(err && err.message || err)
    }, e && e.parameter ? e.parameter.callback : "");
  }
}


function seedLatestBackup_() {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    var master = getMaster_();

    if (master.db.customers.length || master.db.entries.length) {
      return {
        ok: false,
        error: "Master already contains data; seed skipped",
        revision: master.revision,
        customers: master.db.customers.length,
        entries: master.db.entries.length
      };
    }

    var folder = getBackupFolder_();
    var files = folder.getFiles();
    var latest = null;

    while (files.hasNext()) {
      var f = files.next();
      var name = f.getName();

      if (!/\\.json$/i.test(name)) continue;

      if (!latest || f.getLastUpdated().getTime() > latest.getLastUpdated().getTime()) {
        latest = f;
      }
    }

    if (!latest) {
      return {
        ok: false,
        error: "No JSON backup found in backup folder"
      };
    }

    var raw = latest.getBlob().getDataAsString() || "{}";
    var parsed = JSON.parse(raw);
    var sourceDb = normalize_(parsed);
    ensureIds_(sourceDb);

    var next = {
      revision: 1,
      updatedAt: new Date().toISOString(),
      db: sourceDb,
      meta: {
        deletedCustomers: {},
        deletedEntries: {}
      }
    };

    writeMaster_(next);

    return {
      ok: true,
      action: "seedLatest",
      revision: next.revision,
      updatedAt: next.updatedAt,
      sourceFile: latest.getName(),
      customers: next.db.customers.length,
      entries: next.db.entries.length
    };

  } catch (err) {
    return {
      ok: false,
      error: String(err && err.message || err)
    };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function getBackupFolder_() {
  var folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);

  if (folders.hasNext()) {
    return folders.next();
  }

  throw new Error("Backup folder not found: " + BACKUP_FOLDER_NAME);
}

function getMaster_() {
  var file = findMaster_();

  if (!file) {
    return {
      revision: 0,
      updatedAt: null,
      db: {
        customers: [],
        entries: []
      },
      meta: {
        deletedCustomers: {},
        deletedEntries: {}
      }
    };
  }

  var text = file.getBlob().getDataAsString() || "{}";
  var obj = JSON.parse(text);

  return {
    revision: Number(obj.revision) || 0,
    updatedAt: obj.updatedAt || null,
    db: ensureIds_(normalize_(obj.db)),
    meta: {
      deletedCustomers:
        obj.meta && obj.meta.deletedCustomers
          ? obj.meta.deletedCustomers
          : {},
      deletedEntries:
        obj.meta && obj.meta.deletedEntries
          ? obj.meta.deletedEntries
          : {}
    }
  };
}

function getRevision_() {
  var props = PropertiesService.getScriptProperties();
  var cached = props.getProperty("AQUA_LIVE_REVISION_CACHE");
  var cachedTime = props.getProperty("AQUA_LIVE_UPDATED_AT_CACHE");

  if (cached !== null) {
    var info = dailyRevisionInfo_(Number(cached) || 0);
    return {
      ok: true,
      revision: Number(cached) || 0,
      updatedAt: cachedTime || null,
      dailyRevision: info.dailyRevision,
      dailyRevisionDate: info.dailyRevisionDate
    };
  }

  var file = findMaster_();

  if (!file) {
    return {
      ok: true,
      revision: 0,
      updatedAt: null
    };
  }

  var text = file.getBlob().getDataAsString() || "{}";
  var obj = JSON.parse(text);
  var revision = Number(obj.revision) || 0;
  var updatedAt = obj.updatedAt || null;

  props.setProperty("AQUA_LIVE_REVISION_CACHE", String(revision));
  props.setProperty("AQUA_LIVE_UPDATED_AT_CACHE", String(updatedAt || ""));
  var info = dailyRevisionInfo_(revision);

  return {
    ok: true,
    revision: revision,
    updatedAt: updatedAt,
    dailyRevision: info.dailyRevision,
    dailyRevisionDate: info.dailyRevisionDate
  };
}

function dailyRevisionInfo_(totalRevision) {
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
  var savedDate = props.getProperty("AQUA_LIVE_DAILY_REV_DATE");
  var savedDaily = props.getProperty("AQUA_LIVE_DAILY_REVISION");

  // On first installation, align today's counter with the existing total
  // revision. On later calendar dates, show zero until the first new save.
  if (savedDate === null || savedDaily === null) {
    var initial = Number(totalRevision) || 0;
    props.setProperties({
      AQUA_LIVE_DAILY_REV_DATE: today,
      AQUA_LIVE_DAILY_REVISION: String(initial)
    }, false);
    return { dailyRevision: initial, dailyRevisionDate: today };
  }

  if (savedDate !== today) {
    return { dailyRevision: 0, dailyRevisionDate: today };
  }

  return {
    dailyRevision: Number(savedDaily) || 0,
    dailyRevisionDate: today
  };
}

function advanceDailyRevision_(updatedAt, totalRevision) {
  var props = PropertiesService.getScriptProperties();
  var date = Utilities.formatDate(
    updatedAt ? new Date(updatedAt) : new Date(),
    "Asia/Kolkata",
    "yyyy-MM-dd"
  );
  var savedDate = props.getProperty("AQUA_LIVE_DAILY_REV_DATE");
  var savedDaily = props.getProperty("AQUA_LIVE_DAILY_REVISION");
  var daily = savedDate === date && savedDaily !== null
    ? (Number(savedDaily) || 0) + 1
    : 1;

  props.setProperties({
    AQUA_LIVE_DAILY_REV_DATE: date,
    AQUA_LIVE_DAILY_REVISION: String(daily)
  }, false);

  return { dailyRevision: daily, dailyRevisionDate: date };
}

function findMaster_() {
  var files = DriveApp.getFilesByName(LIVE_FILE_NAME);

  if (files.hasNext()) {
    return files.next();
  }

  return null;
}

function writeMaster_(obj) {
  var oldFile = findMaster_();
  var text = JSON.stringify(obj);

  PropertiesService.getScriptProperties().setProperties({
    AQUA_LIVE_REVISION_CACHE: String(Number(obj.revision) || 0),
    AQUA_LIVE_UPDATED_AT_CACHE: String(obj.updatedAt || "")
  }, true);
  advanceDailyRevision_(obj.updatedAt, Number(obj.revision) || 0);

  if (oldFile) {
    oldFile.setContent(text);
  } else {
    DriveApp.createFile(
      LIVE_FILE_NAME,
      text,
      MimeType.PLAIN_TEXT
    );
  }
}

function normalize_(db) {
  if (!db || typeof db !== "object") {
    db = {};
  }

  if (!Array.isArray(db.customers)) {
    db.customers = [];
  }

  if (!Array.isArray(db.entries)) {
    db.entries = [];
  }

  return db;
}

function ensureIds_(db) {
  var customerById = {};
  var customerByName = {};

  db.customers.forEach(function(c) {
    if (!c.syncId) {
      c.syncId = Utilities.getUuid();
    }

    customerById[c.syncId] = c;

    var name = String(c.name || "").trim().toLowerCase();
    if (name && !customerByName[name]) {
      customerByName[name] = c;
    }
  });

  db.entries.forEach(function(e) {
    if (!e.syncId) {
      e.syncId = Utilities.getUuid();
    }

    if (e.customerSyncId && customerById[e.customerSyncId]) {
      e.name = customerById[e.customerSyncId].name;
    } else {
      var name = String(e.name || "").trim().toLowerCase();
      if (name && customerByName[name]) {
        e.customerSyncId = customerByName[name].syncId;
        e.name = customerByName[name].name;
      }
    }
  });

  return db;
}

function customerKey_(c) {
  if (c && c.syncId) {
    return "id:" + c.syncId;
  }

  return "legacy:" + [
    c && c.name || "",
    c && c.mobile || "",
    c && c.address || ""
  ].join("|").toLowerCase().trim();
}

function entryKey_(e) {
  if (e && e.syncId) {
    return "id:" + e.syncId;
  }

  return "legacy:" + [
    e && e.date || "",
    e && e.name || "",
    e && e.jg || 0,
    e && e.je || 0,
    e && e.cg || 0,
    e && e.ce || 0,
    e && e.amount || 0,
    e && e.paid || 0,
    e && e.previousDue || 0,
    e && e.createdAt || ""
  ].join("|");
}

function mergeDb_(master, client) {
  master = ensureIds_(
    normalize_(JSON.parse(JSON.stringify(master || {})))
  );

  client = ensureIds_(
    normalize_(JSON.parse(JSON.stringify(client || {})))
  );

  var customers = {};
  var entries = {};

  master.customers.forEach(function(c) {
    customers[customerKey_(c)] = c;
  });

  client.customers.forEach(function(c) {
    var key = customerKey_(c);
    var old = customers[key];

    if (!old || newer_(c, old)) {
      customers[key] = c;
    }
  });

  master.entries.forEach(function(e) {
    entries[entryKey_(e)] = e;
  });

  client.entries.forEach(function(e) {
    var key = entryKey_(e);

    if (!entries[key]) {
      entries[key] = e;
    }
  });

  return {
    customers: Object.keys(customers).map(function(key) {
      return customers[key];
    }),
    entries: Object.keys(entries).map(function(key) {
      return entries[key];
    })
  };
}

function newer_(a, b) {
  var ta = Date.parse(a && a.updatedAt || "") || 0;
  var tb = Date.parse(b && b.updatedAt || "") || 0;

  return ta >= tb;
}

function mergeTombstones_(a, b) {
  var out = {};

  Object.keys(a || {}).forEach(function(k) {
    out[k] = a[k];
  });

  Object.keys(b || {}).forEach(function(k) {
    var old = Number(out[k]) || 0;
    var next = Number(b[k]) || 0;

    if (next > old) {
      out[k] = next;
    }
  });

  return out;
}

function applyTombstones_(db, deletedCustomers, deletedEntries) {
  db.customers = db.customers.filter(function(c) {
    var t = Number(deletedCustomers[c.syncId]) || 0;
    var u = Date.parse(c.updatedAt || "") || 0;
    return !t || u > t;
  });

  db.entries = db.entries.filter(function(e) {
    var t = Number(deletedEntries[e.syncId]) || 0;
    var u = Date.parse(
      e.updatedAt || e.createdAt || ""
    ) || 0;
    return !t || u > t;
  });
}

function output_(obj, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(
        callback + "(" + JSON.stringify(obj) + ")"
      )
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
